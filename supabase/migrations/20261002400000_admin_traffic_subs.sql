-- Visitas sin cuenta + suscripciones en el dashboard.
-- session_id identifica una visita de paso; user_id puede ser null.

alter table public.app_events
  add column if not exists session_id text;

create index if not exists app_events_session_idx on public.app_events (session_id);
create index if not exists app_events_created_idx on public.app_events (created_at desc);

drop policy if exists "Users can insert their own events" on public.app_events;
create policy "Users can insert their own events"
  on public.app_events for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Anyone can insert guest visits" on public.app_events;
create policy "Anyone can insert guest visits"
  on public.app_events for insert to anon, authenticated
  with check (
    user_id is null
    and event_type in ('visit', 'session_ping')
    and session_id is not null
    and char_length(session_id) between 8 and 80
  );

drop policy if exists "Moderators read app events" on public.app_events;
create policy "Moderators read app events"
  on public.app_events for select to authenticated
  using (public.is_moderator());

grant insert on table public.app_events to anon, authenticated;
grant select on table public.app_events to authenticated;

create or replace function public.admin_traffic_bucket(since_ts timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'visits', (
      select count(distinct session_id)::int
      from public.app_events
      where event_type = 'visit'
        and created_at >= since_ts
        and session_id is not null
    ),
    'guest_visits', (
      select count(distinct session_id)::int
      from public.app_events
      where event_type = 'visit'
        and created_at >= since_ts
        and user_id is null
        and session_id is not null
    ),
    'signed_in_visits', (
      select count(distinct coalesce(session_id, user_id::text))::int
      from public.app_events
      where event_type = 'visit'
        and created_at >= since_ts
        and user_id is not null
    ),
    'minutes', (
      select coalesce(count(*)::int, 0)
      from public.app_events
      where event_type = 'session_ping'
        and created_at >= since_ts
    )
  );
$$;

revoke all on function public.admin_traffic_bucket(timestamptz) from public, anon;
grant execute on function public.admin_traffic_bucket(timestamptz) to authenticated;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
  day_start timestamptz := date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan';
  week_start timestamptz := date_trunc('week', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan';
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan';
  year_start timestamptz := date_trunc('year', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan';
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
          p.last_lat,
          p.last_lng,
          p.last_seen_at,
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
    'locations', coalesce((
      select jsonb_agg(row_to_json(loc) order by loc.last_seen_at desc nulls last)
      from (
        select
          p.id,
          p.username,
          a.email,
          p.last_lat,
          p.last_lng,
          p.last_seen_at
        from public.users p
        left join auth.users a on a.id = p.id
        where p.last_lat is not null and p.last_lng is not null
        order by p.last_seen_at desc nulls last
        limit 100
      ) loc
    ), '[]'::jsonb),
    'circulo', coalesce((
      select jsonb_agg(row_to_json(c) order by c.created_at desc)
      from (
        select
          p.id,
          p.username,
          a.email,
          p.subscription_status,
          p.subscription_end_date,
          p.premium_source,
          p.created_at,
          (
            select count(*)::int from public.watched_zones wz where wz.user_id = p.id
          ) as zones_count
        from public.users p
        left join auth.users a on a.id = p.id
        where p.is_premium = true
          and coalesce(p.subscription_status, 'active') in ('active', 'trialing')
        order by p.created_at desc
        limit 100
      ) c
    ), '[]'::jsonb),
    'aliados', coalesce((
      select jsonb_agg(row_to_json(z) order by z.created_at desc)
      from (
        select
          sz.id,
          sz.name,
          sz.description,
          sz.owner_email,
          sz.type,
          sz.status,
          sz.lat,
          sz.lng,
          sz.current_period_end,
          sz.created_at
        from public.sponsored_zones sz
        where sz.status = 'active'
        order by sz.created_at desc
        limit 100
      ) z
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
    'traffic', jsonb_build_object(
      'day', public.admin_traffic_bucket(day_start),
      'week', public.admin_traffic_bucket(week_start),
      'month', public.admin_traffic_bucket(month_start),
      'year', public.admin_traffic_bucket(year_start)
    ),
    'counts', jsonb_build_object(
      'users', (select count(*)::int from public.users),
      'with_location', (
        select count(*)::int from public.users
        where last_lat is not null and last_lng is not null
      ),
      'circulo_active', (
        select count(*)::int from public.users
        where is_premium = true
          and coalesce(subscription_status, 'active') in ('active', 'trialing')
      ),
      'aliados_active', (
        select count(*)::int from public.sponsored_zones where status = 'active'
      ),
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
