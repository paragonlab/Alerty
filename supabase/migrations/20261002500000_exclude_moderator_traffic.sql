-- El dashboard no debe contar visitas ni minutos de moderadores.

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
      from public.app_events e
      where e.event_type = 'visit'
        and e.created_at >= since_ts
        and e.session_id is not null
        and (
          e.user_id is null
          or not exists (
            select 1 from public.users u
            where u.id = e.user_id and u.is_moderator
          )
        )
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
      select count(distinct coalesce(e.session_id, e.user_id::text))::int
      from public.app_events e
      where e.event_type = 'visit'
        and e.created_at >= since_ts
        and e.user_id is not null
        and not exists (
          select 1 from public.users u
          where u.id = e.user_id and u.is_moderator
        )
    ),
    'minutes', (
      select coalesce(count(*)::int, 0)
      from public.app_events e
      where e.event_type = 'session_ping'
        and e.created_at >= since_ts
        and (
          e.user_id is null
          or not exists (
            select 1 from public.users u
            where u.id = e.user_id and u.is_moderator
          )
        )
    )
  );
$$;

-- Limpia eventos ya guardados de cuentas admin para que el conteo baje ya.
delete from public.app_events e
using public.users u
where e.user_id = u.id
  and u.is_moderator
  and e.event_type in ('visit', 'session_ping');

notify pgrst, 'reload schema';
