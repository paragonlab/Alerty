-- Personajes ciudadanos (pines Waze): columna users.character + grants + get_my_profile.
-- NO aplicar a prod sin el cliente que la consume.

alter table public.users
  add column if not exists character text;

alter table public.users
  drop constraint if exists users_character_check;

alter table public.users
  add constraint users_character_check
  check (
    character is null
    or character in (
      'vecina',
      'taxista',
      'ciclista',
      'estudiante',
      'abuelo',
      'enfermero',
      'repartidora',
      'ingeniera',
      'perrito',
      'gato',
      'tecolote',
      'aguila'
    )
  );

-- Backfill desde presets legados en avatar_url (solo cat/owl/eagle).
update public.users
set character = case
  when avatar_url = 'preset:cat' then 'gato'
  when avatar_url = 'preset:owl' then 'tecolote'
  when avatar_url = 'preset:eagle' then 'aguila'
  else character
end
where character is null
  and avatar_url in ('preset:cat', 'preset:owl', 'preset:eagle');

-- Grants: re-emite listas de columnas (incl. character) sin ampliar privilegios.
revoke select on public.users from anon;
grant select (id, username, avatar_url, character, is_verified, is_premium, trust_score,
              followers_count, created_at)
  on public.users to anon;

revoke select on public.users from authenticated;
grant select (id, username, avatar_url, character, is_verified, trust_score, followers_count,
              created_at, theme_mode, push_enabled, low_connection,
              active_categories, show_heatmap, is_premium, hidden_categories,
              categories_configured, terms_accepted_at, is_moderator)
  on public.users to authenticated;

grant insert (character) on public.users to authenticated;
grant update (character) on public.users to authenticated;

-- get_my_profile incluye character.
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
    'character', u.character,
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

notify pgrst, 'reload schema';
