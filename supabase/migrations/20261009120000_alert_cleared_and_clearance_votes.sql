-- Ya se despejó: metadatos de resolución + votos de vecinos.
-- No aplicar en prod desde este agente; ver orden en el PR.

alter table public.alerts
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.users(id) on delete set null,
  add column if not exists resolved_via text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alerts_resolved_via_check'
  ) then
    alter table public.alerts
      add constraint alerts_resolved_via_check
      check (resolved_via is null or resolved_via in ('author', 'votes', 'expiry'));
  end if;
end $$;

comment on column public.alerts.resolved_at is
  'Cuándo se marcó despejada (status=resolved).';
comment on column public.alerts.resolved_via is
  'author = quien reportó; votes = umbral de vecinos; expiry = auto.';

-- Votos de “ya se despejó” (un voto por vecino).
create table if not exists public.alert_clearance_votes (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

create index if not exists alert_clearance_votes_alert_idx
  on public.alert_clearance_votes (alert_id);

alter table public.alert_clearance_votes enable row level security;

drop policy if exists alert_clearance_votes_select on public.alert_clearance_votes;
create policy alert_clearance_votes_select
  on public.alert_clearance_votes for select
  to authenticated, anon
  using (true);

drop policy if exists alert_clearance_votes_insert on public.alert_clearance_votes;
create policy alert_clearance_votes_insert
  on public.alert_clearance_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- RPC: marcar despejada (autor) o sumar voto (vecino). Umbral: 3 votos.
create or replace function public.mark_alert_cleared(p_alert_id uuid)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_alert public.alerts;
  v_votes int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_alert from public.alerts where id = p_alert_id for update;
  if not found then
    raise exception 'alert not found';
  end if;

  if v_alert.status = 'resolved' then
    return v_alert;
  end if;

  -- Autor (o sin user_id huérfano): resuelve directo.
  if v_alert.user_id is not null and v_alert.user_id = v_uid then
    update public.alerts
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = v_uid,
        resolved_via = 'author'
    where id = p_alert_id
    returning * into v_alert;
    return v_alert;
  end if;

  insert into public.alert_clearance_votes (alert_id, user_id)
  values (p_alert_id, v_uid)
  on conflict do nothing;

  select count(*)::int into v_votes
  from public.alert_clearance_votes
  where alert_id = p_alert_id;

  if v_votes >= 3 then
    update public.alerts
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = v_uid,
        resolved_via = 'votes'
    where id = p_alert_id
    returning * into v_alert;
  end if;

  select * into v_alert from public.alerts where id = p_alert_id;
  return v_alert;
end;
$$;

revoke all on function public.mark_alert_cleared(uuid) from public;
grant execute on function public.mark_alert_cleared(uuid) to authenticated;

-- Expiración suave: alertas activas de más de 24 h se marcan despejadas
-- (solo metadatos; el cliente ya filtra por ventana de tiempo).
create or replace function public.expire_stale_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with updated as (
    update public.alerts
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        resolved_via = coalesce(resolved_via, 'expiry')
    where status = 'active'
      and created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int into n from updated;
  return n;
end;
$$;

revoke all on function public.expire_stale_alerts() from public;
grant execute on function public.expire_stale_alerts() to service_role;
