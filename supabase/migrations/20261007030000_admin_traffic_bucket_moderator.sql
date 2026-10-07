-- admin_traffic_bucket es SECURITY DEFINER y solo la usa admin_overview()
-- (el cliente llama admin_overview, nunca este RPC directo). Añadimos chequeo
-- de moderador y revocamos EXECUTE a anon/authenticated.

create or replace function public.admin_traffic_bucket(since_ts timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not allowed';
  end if;

  return (
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
    )
  );
end;
$$;

revoke all on function public.admin_traffic_bucket(timestamptz) from public, anon, authenticated;
-- Solo service_role / postgres (p.ej. admin_overview SECURITY DEFINER) la ejecutan.

notify pgrst, 'reload schema';
