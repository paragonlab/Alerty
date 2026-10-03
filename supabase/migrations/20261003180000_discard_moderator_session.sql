-- Si un admin entra, esa sesión (aunque empezó sin cuenta) sale del dashboard.

create or replace function public.discard_my_visit_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    return;
  end if;
  if p_session_id is null or char_length(p_session_id) < 8 or char_length(p_session_id) > 80 then
    return;
  end if;

  delete from public.app_events
  where session_id = p_session_id
    and event_type in ('visit', 'session_ping');
end;
$$;

revoke all on function public.discard_my_visit_session(text) from public, anon;
grant execute on function public.discard_my_visit_session(text) to authenticated;

-- Pestañas de prueba que quedaron abiertas y sumaban visitas sin cuenta.
delete from public.app_events
where event_type in ('visit', 'session_ping')
  and session_id in (
    'v_mus0h9p2_o0wl606f',
    'v_murxdyn6_2gaa792d',
    'v_musyxksn_9y22k63y',
    'v_murvyrbr_autku9kp'
  );

notify pgrst, 'reload schema';
