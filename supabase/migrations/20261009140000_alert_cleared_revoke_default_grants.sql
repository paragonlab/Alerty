-- Ya aplicado en prod (post #47): endurece grants de expire_stale_alerts.
-- Idempotente: REVOKE no falla si el privilegio no existía.
-- Solo service_role debe poder expirar alertas stale.

revoke execute on function public.expire_stale_alerts() from public;
revoke execute on function public.expire_stale_alerts() from anon;
revoke execute on function public.expire_stale_alerts() from authenticated;

grant execute on function public.expire_stale_alerts() to service_role;
