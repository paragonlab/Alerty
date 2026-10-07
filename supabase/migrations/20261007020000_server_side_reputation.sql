-- Reputación server-side (antes la escribía el cliente; el trigger privileged
-- ya descartaba esos writes). Portamos la lógica de lib/alerty/store.ts:
--   trust_score: +5 al crear alerta, +1 al upvote (escala 0–100; legado 0–1 → ×20)
--   is_verified: ≥10 alertas, ratio upvotes/(up+down) ≥ 0.7, sin "falso reciente"
--                (últimos 30 días con downvotes > upvotes)

create or replace function public.normalize_trust_score(raw numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when raw is null or raw <> raw then 10
    when raw <= 1 then greatest(0, least(100, round(raw * 20)::int))
    else greatest(0, least(100, round(raw)::int))
  end;
$$;

create or replace function public.apply_trust_score_delta(p_user_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_raw numeric;
  normalized integer;
  next_score integer;
begin
  if p_user_id is null or p_delta = 0 then
    return;
  end if;

  select trust_score into current_raw from public.users where id = p_user_id for update;
  if not found then
    return;
  end if;

  normalized := public.normalize_trust_score(current_raw);
  next_score := greatest(0, least(100, normalized + p_delta));

  update public.users
  set trust_score = next_score
  where id = p_user_id;
end;
$$;

create or replace function public.recompute_user_verified(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_count integer;
  total_up integer;
  total_down integer;
  total_votes integer;
  ratio numeric;
  recent_false boolean;
  verified boolean;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::int into alert_count
  from public.alerts a
  where a.user_id = p_user_id
    and a.hidden_at is null;

  if alert_count < 10 then
    update public.users set is_verified = false where id = p_user_id and is_verified is distinct from false;
    return;
  end if;

  select
    coalesce(sum(case when v.vote_type = 'upvote' then 1 else 0 end), 0)::int,
    coalesce(sum(case when v.vote_type = 'downvote' then 1 else 0 end), 0)::int
  into total_up, total_down
  from public.alerts a
  left join public.verifications v on v.alert_id = a.id
  where a.user_id = p_user_id
    and a.hidden_at is null;

  total_votes := total_up + total_down;
  ratio := case when total_votes > 0 then total_up::numeric / total_votes::numeric else 0 end;

  select exists (
    select 1
    from public.alerts a
    where a.user_id = p_user_id
      and a.hidden_at is null
      and a.created_at > now() - interval '30 days'
      and (
        select count(*) filter (where v.vote_type = 'downvote')
        from public.verifications v
        where v.alert_id = a.id
      ) > (
        select count(*) filter (where v.vote_type = 'upvote')
        from public.verifications v
        where v.alert_id = a.id
      )
  ) into recent_false;

  verified := ratio >= 0.7 and not recent_false;

  update public.users
  set is_verified = verified
  where id = p_user_id
    and is_verified is distinct from verified;
end;
$$;

create or replace function public.on_alert_trust_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform public.apply_trust_score_delta(new.user_id, 5);
    perform public.recompute_user_verified(new.user_id);
  end if;
  return new;
end;
$$;

create or replace function public.on_verification_reputation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  -- El votante gana +1 por upvote (igual que el cliente).
  if new.vote_type = 'upvote' and new.user_id is not null then
    perform public.apply_trust_score_delta(new.user_id, 1);
  end if;

  select a.user_id into author from public.alerts a where a.id = new.alert_id;
  if author is not null then
    perform public.recompute_user_verified(author);
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_trust_score(numeric) from public, anon, authenticated;
revoke all on function public.apply_trust_score_delta(uuid, integer) from public, anon, authenticated;
revoke all on function public.recompute_user_verified(uuid) from public, anon, authenticated;
revoke all on function public.on_alert_trust_score() from public, anon, authenticated;
revoke all on function public.on_verification_reputation() from public, anon, authenticated;

drop trigger if exists alerts_trust_score on public.alerts;
create trigger alerts_trust_score
  after insert on public.alerts
  for each row execute function public.on_alert_trust_score();

drop trigger if exists verifications_reputation on public.verifications;
create trigger verifications_reputation
  after insert on public.verifications
  for each row execute function public.on_verification_reputation();

notify pgrst, 'reload schema';
