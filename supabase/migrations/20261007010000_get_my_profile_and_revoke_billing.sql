-- NO APLICAR hasta desplegar el cliente que deja de hacer select('*') sobre users
-- y carga el perfil propio vía get_my_profile().
--
-- 1) RPC segura para el propio perfil (incluye subscription_* / premium_source).
-- 2) Revoca SELECT de columnas de facturación a authenticated (followup).
-- 3) Quita UPDATE de trust_score/is_verified (ya no escribe el cliente).

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'avatar_url', u.avatar_url,
    'is_verified', u.is_verified,
    'trust_score', u.trust_score,
    'followers_count', u.followers_count,
    'created_at', u.created_at,
    'theme_mode', u.theme_mode,
    'push_enabled', u.push_enabled,
    'low_connection', u.low_connection,
    'active_categories', u.active_categories,
    'show_heatmap', u.show_heatmap,
    'hidden_categories', u.hidden_categories,
    'is_premium', u.is_premium,
    'categories_configured', u.categories_configured,
    'terms_accepted_at', u.terms_accepted_at,
    'is_moderator', u.is_moderator,
    'subscription_status', u.subscription_status,
    'subscription_end_date', u.subscription_end_date,
    'premium_source', u.premium_source
  )
  into result
  from public.users u
  where u.id = uid;

  return result;
end;
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- authenticated deja de poder leer campos de facturación de otros usuarios.
revoke select on public.users from authenticated;
grant select (id, username, avatar_url, is_verified, trust_score, followers_count,
              created_at, theme_mode, push_enabled, low_connection,
              active_categories, show_heatmap, is_premium, hidden_categories,
              categories_configured, terms_accepted_at, is_moderator)
  on public.users to authenticated;

-- El cliente ya no escribe reputación; el trigger la calcula en servidor.
revoke update (trust_score, is_verified) on public.users from authenticated;

-- Siguen ocultos para clientes: stripe_customer_id, revenuecat_user_id,
-- subscription_status, subscription_end_date, premium_source, last_lat, last_lng, last_seen_at.
-- (Las edge functions usan service_role y no se ven afectadas.)

notify pgrst, 'reload schema';
