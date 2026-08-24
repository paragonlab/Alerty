-- Endurecimiento de seguridad (avisos del linter de Supabase).
-- handle_new_alerty_user es un trigger de auth.users, no debe ser invocable
-- como RPC ni tener search_path mutable.

alter function public.handle_new_alerty_user() set search_path = '';

-- El revoke a anon/authenticated no basta: heredan EXECUTE del rol PUBLIC.
revoke execute on function public.handle_new_alerty_user() from public;
revoke execute on function public.handle_new_alerty_user() from anon, authenticated;
