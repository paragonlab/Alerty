-- secure_users_privileged_columns
-- Cierra dos huecos en public.users:
--  1) Un usuario (rol authenticated) podía auto-asignarse campos privilegiados
--     (is_premium, is_moderator, is_verified, trust_score, suscripción, ids de
--     Stripe/RevenueCat...). is_moderator() lee users.is_moderator, así que eso
--     daba acceso de admin.
--  2) La policy SELECT es `true`: anon y cualquier usuario leían last_lat/last_lng
--     (y stripe_customer_id, etc.).
--
-- Enfoque (sin romper la app actual, que hace select('*') del propio perfil):
--  * Trigger BEFORE INSERT/UPDATE que, si quien llama es un cliente
--    (current_user = anon/authenticated), revierte los campos privilegiados a OLD
--    (UPDATE) o los fuerza a su default (INSERT). service_role/postgres (webhooks,
--    edge functions, funciones SECURITY DEFINER, dashboard) no se ven afectados.
--  * La ubicación se desvía a public.user_locations (RLS: solo el dueño). El
--    cliente sigue haciendo update({last_lat,last_lng,last_seen_at}) igual; el
--    trigger guarda los valores en user_locations y deja NULL en users.
--    admin_overview() pasa a leer de user_locations.
--  * Grants: anon solo puede leer columnas de perfil público y no escribe nada;
--    authenticated solo puede INSERT/UPDATE de columnas no privilegiadas.


-- 1. Tabla privada de ubicación ------------------------------------------------
create table if not exists public.user_locations (
  user_id    uuid primary key
             references public.users(id) on delete cascade
             deferrable initially deferred,
  lat        double precision not null check (lat >= -90 and lat <= 90),
  lng        double precision not null check (lng >= -180 and lng <= 180),
  seen_at    timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_locations enable row level security;

revoke all on public.user_locations from public, anon, authenticated;
grant select, insert, update on public.user_locations to authenticated;
grant all on public.user_locations to service_role;

drop policy if exists "Owner reads own location" on public.user_locations;
create policy "Owner reads own location" on public.user_locations
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Owner inserts own location" on public.user_locations;
create policy "Owner inserts own location" on public.user_locations
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Owner updates own location" on public.user_locations;
create policy "Owner updates own location" on public.user_locations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Migrar ubicaciones existentes (si las hay) y limpiarlas de users.
insert into public.user_locations (user_id, lat, lng, seen_at)
select id, last_lat, last_lng, coalesce(last_seen_at, now())
from public.users
where last_lat is not null and last_lng is not null
on conflict (user_id) do update
  set lat = excluded.lat, lng = excluded.lng, seen_at = excluded.seen_at, updated_at = now();

-- 2. Trigger de protección ----------------------------------------------------
-- SECURITY INVOKER a propósito: current_user es el rol real de quien llama
-- (anon/authenticated vía PostgREST; service_role en edge functions; postgres
-- dentro de funciones SECURITY DEFINER como handle_new_alerty_user). No depende
-- de claims manipulables.
create or replace function public.users_protect_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' then
      new.is_premium            := old.is_premium;
      new.is_moderator          := old.is_moderator;
      new.is_verified           := old.is_verified;
      new.trust_score           := old.trust_score;
      new.followers_count       := old.followers_count;
      new.subscription_status   := old.subscription_status;
      new.subscription_end_date := old.subscription_end_date;
      new.premium_source        := old.premium_source;
      new.stripe_customer_id    := old.stripe_customer_id;
      new.revenuecat_user_id    := old.revenuecat_user_id;
      new.created_at            := old.created_at;
    else -- INSERT
      new.is_premium            := false;
      new.is_moderator          := false;
      new.is_verified           := false;
      new.trust_score           := 0.5;
      new.followers_count       := 0;
      new.subscription_status   := null;
      new.subscription_end_date := null;
      new.premium_source        := null;
      new.stripe_customer_id    := null;
      new.revenuecat_user_id    := null;
      new.created_at            := now();
    end if;
  end if;

  -- La ubicación nunca se guarda en users (legible por todos): va a user_locations.
  if new.last_lat is not null and new.last_lng is not null then
    insert into public.user_locations (user_id, lat, lng, seen_at, updated_at)
    values (new.id, new.last_lat, new.last_lng, coalesce(new.last_seen_at, now()), now())
    on conflict (user_id) do update
      set lat = excluded.lat,
          lng = excluded.lng,
          seen_at = excluded.seen_at,
          updated_at = now();
  end if;
  new.last_lat     := null;
  new.last_lng     := null;
  new.last_seen_at := null;

  return new;
end;
$$;

revoke all on function public.users_protect_privileged_columns() from public, anon, authenticated;

drop trigger if exists users_protect_privileged_columns on public.users;
create trigger users_protect_privileged_columns
  before insert or update on public.users
  for each row execute function public.users_protect_privileged_columns();

-- Limpiar ubicaciones ya copiadas (corre como postgres; el trigger solo las anula).
update public.users
set last_lat = null, last_lng = null, last_seen_at = null
where last_lat is not null or last_lng is not null or last_seen_at is not null;

-- 3. Grants -------------------------------------------------------------------
-- anon: solo lectura de perfil público (lo que el feed embebe), sin escrituras.
revoke all on public.users from anon;
grant select (id, username, avatar_url, is_verified, is_premium, trust_score,
              followers_count, created_at)
  on public.users to anon;

-- authenticated: SELECT completo se mantiene (la app hace select('*') del propio
-- perfil; ver notas). Escritura solo en columnas no privilegiadas.
-- trust_score/is_verified siguen con UPDATE para que el cliente actual no reciba
-- errores, pero el trigger revierte cualquier cambio.
revoke insert, update, delete, truncate, references, trigger on public.users from authenticated;
grant insert (id, username, avatar_url, theme_mode, push_enabled, low_connection,
              active_categories, show_heatmap, hidden_categories,
              categories_configured, terms_accepted_at,
              last_lat, last_lng, last_seen_at)
  on public.users to authenticated;
grant update (username, avatar_url, theme_mode, push_enabled, low_connection,
              active_categories, show_heatmap, hidden_categories,
              categories_configured, terms_accepted_at,
              last_lat, last_lng, last_seen_at,
              trust_score, is_verified)
  on public.users to authenticated;

-- 4. admin_overview lee la ubicación de user_locations -------------------------
CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
          l.lat as last_lat,
          l.lng as last_lng,
          l.seen_at as last_seen_at,
          (select count(*)::int from public.alerts al where al.user_id = p.id) as alerts_count,
          (select count(*)::int from public.watched_zones wz where wz.user_id = p.id) as zones_count
        from public.users p
        left join auth.users a on a.id = p.id
        left join public.user_locations l on l.user_id = p.id
        order by p.created_at desc
        limit 100
      ) u
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(row_to_json(loc) order by loc.last_seen_at desc nulls last)
      from (
        select p.id, p.username, a.email, l.lat as last_lat, l.lng as last_lng, l.seen_at as last_seen_at
        from public.user_locations l
        join public.users p on p.id = l.user_id
        left join auth.users a on a.id = p.id
        order by l.seen_at desc nulls last
        limit 100
      ) loc
    ), '[]'::jsonb),
    'circulo', coalesce((
      select jsonb_agg(row_to_json(c) order by c.created_at desc)
      from (
        select
          p.id, p.username, a.email, p.subscription_status, p.subscription_end_date,
          p.premium_source, p.created_at,
          (select count(*)::int from public.watched_zones wz where wz.user_id = p.id) as zones_count
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
        select sz.id, sz.name, sz.description, sz.owner_email, sz.type, sz.status,
          sz.lat, sz.lng, sz.current_period_end, sz.created_at
        from public.sponsored_zones sz
        where sz.status = 'active'
        order by sz.created_at desc
        limit 100
      ) z
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(row_to_json(al) order by al.created_at desc)
      from (
        select a.id, a.category, a.title, a.description, a.lat, a.lng, a.status,
          a.hidden_at, a.created_at, a.user_id, u.username
        from public.alerts a
        left join public.users u on u.id = a.user_id
        order by a.created_at desc
        limit 40
      ) al
    ), '[]'::jsonb),
    'watched_zones', coalesce((
      select jsonb_agg(row_to_json(z) order by z.created_at desc)
      from (
        select wz.id, wz.user_id, wz.label, wz.lat, wz.lng, wz.created_at, u.username
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
      'with_location', (select count(*)::int from public.user_locations),
      'circulo_active', (
        select count(*)::int from public.users
        where is_premium = true
          and coalesce(subscription_status, 'active') in ('active', 'trialing')
      ),
      'aliados_active', (select count(*)::int from public.sponsored_zones where status = 'active'),
      'alerts_active', (select count(*)::int from public.alerts where status = 'active' and hidden_at is null),
      'alerts_total', (select count(*)::int from public.alerts),
      'watched_zones', (select count(*)::int from public.watched_zones),
      'community_posts', (select count(*)::int from public.community_posts)
    )
  ) into result;

  return result;
end;
$function$;


notify pgrst, 'reload schema';
