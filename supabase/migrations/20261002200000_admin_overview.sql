-- El dashboard necesita ver a quién hay, dónde vigilan y qué alertas hay.
-- Solo is_moderator. El correo sale de auth.users, no de la app pública.

drop policy if exists "moderators read watched zones" on public.watched_zones;
create policy "moderators read watched zones"
  on public.watched_zones for select to authenticated
  using (public.is_moderator());

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_moderator() then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(row_to_json(u) order by u.created_at desc)
      from (
        select
          p.id,
          p.username,
          a.email,
          p.created_at,
          p.is_premium,
          p.is_moderator,
          p.subscription_status,
          (
            select count(*)::int from public.alerts al where al.user_id = p.id
          ) as alerts_count,
          (
            select count(*)::int from public.watched_zones wz where wz.user_id = p.id
          ) as zones_count
        from public.users p
        left join auth.users a on a.id = p.id
        order by p.created_at desc
        limit 100
      ) u
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(row_to_json(al) order by al.created_at desc)
      from (
        select
          a.id,
          a.category,
          a.title,
          a.description,
          a.lat,
          a.lng,
          a.status,
          a.hidden_at,
          a.created_at,
          a.user_id,
          u.username
        from public.alerts a
        left join public.users u on u.id = a.user_id
        order by a.created_at desc
        limit 40
      ) al
    ), '[]'::jsonb),
    'watched_zones', coalesce((
      select jsonb_agg(row_to_json(z) order by z.created_at desc)
      from (
        select
          wz.id,
          wz.user_id,
          wz.label,
          wz.lat,
          wz.lng,
          wz.created_at,
          u.username
        from public.watched_zones wz
        left join public.users u on u.id = wz.user_id
        order by wz.created_at desc
        limit 40
      ) z
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'users', (select count(*)::int from public.users),
      'alerts_active', (
        select count(*)::int from public.alerts
        where status = 'active' and hidden_at is null
      ),
      'alerts_total', (select count(*)::int from public.alerts),
      'watched_zones', (select count(*)::int from public.watched_zones),
      'community_posts', (select count(*)::int from public.community_posts)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

notify pgrst, 'reload schema';
