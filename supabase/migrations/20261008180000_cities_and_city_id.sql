-- Fase 1 multi-ciudad: tabla cities + city_id en contenido/usuarios.
-- Aditiva: nullable → backfill Culiacán → NOT NULL + DEFAULT.
-- RLS de lectura de alerts/community_posts se mantiene city-agnostic
-- (el cliente filtra por city_id activo). No se debilita seguridad.
-- El delay RLS de operativo (2 h) sigue intacto; solo se actualiza el
-- trigger de strip-geo para usar cities.name cuando haya city_id.

-- IDs fijos para que app/edge puedan referenciarlos sin lookup.
-- culiacan = ciudad activa por defecto; mazatlan = seed de ciudad #2 (aún sin uso).
create table if not exists public.cities (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  state text not null,
  center_lat double precision not null
    check (center_lat >= -90 and center_lat <= 90),
  center_lng double precision not null
    check (center_lng >= -180 and center_lng <= 180),
  lat_delta double precision not null default 0.16
    check (lat_delta > 0),
  lng_delta double precision not null default 0.16
    check (lng_delta > 0),
  bbox_west double precision not null,
  bbox_south double precision not null,
  bbox_east double precision not null,
  bbox_north double precision not null,
  timezone text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  check (bbox_west < bbox_east),
  check (bbox_south < bbox_north)
);

comment on table public.cities is
  'Ciudades cubiertas por Pulso. slug estable (culiacan, mazatlan). active=true = feed/sync en prod.';

insert into public.cities (
  id, slug, name, state,
  center_lat, center_lng, lat_delta, lng_delta,
  bbox_west, bbox_south, bbox_east, bbox_north,
  timezone, active
) values
  (
    'c0a1c000-0001-4000-8000-000000000001',
    'culiacan',
    'Culiacán',
    'Sinaloa',
    24.8091, -107.394, 0.16, 0.16,
    -107.52, 24.70, -107.30, 24.88,
    'America/Mazatlan',
    true
  ),
  (
    'c0a1c000-0002-4000-8000-000000000002',
    'mazatlan',
    'Mazatlán',
    'Sinaloa',
    23.2494, -106.4111, 0.18, 0.18,
    -106.55, 23.15, -106.25, 23.35,
    'America/Mazatlan',
    false
  )
on conflict (id) do nothing;

-- city_id nullable primero (additive), luego backfill, luego NOT NULL.
alter table public.alerts
  add column if not exists city_id uuid references public.cities (id);

alter table public.community_posts
  add column if not exists city_id uuid references public.cities (id);

alter table public.sponsored_zones
  add column if not exists city_id uuid references public.cities (id);

alter table public.aliado_leads
  add column if not exists city_id uuid references public.cities (id);

alter table public.watched_zones
  add column if not exists city_id uuid references public.cities (id);

-- Ciudad preferida / home del usuario (fase 1: siempre Culiacán).
alter table public.users
  add column if not exists city_id uuid references public.cities (id);

-- Backfill: todo el contenido histórico es de Culiacán.
update public.alerts
set city_id = 'c0a1c000-0001-4000-8000-000000000001'
where city_id is null;

update public.community_posts
set city_id = 'c0a1c000-0001-4000-8000-000000000001'
where city_id is null;

update public.sponsored_zones
set city_id = 'c0a1c000-0001-4000-8000-000000000001'
where city_id is null;

update public.aliado_leads
set city_id = 'c0a1c000-0001-4000-8000-000000000001'
where city_id is null;

update public.watched_zones
set city_id = 'c0a1c000-0001-4000-8000-000000000001'
where city_id is null;

update public.users
set city_id = 'c0a1c000-0001-4000-8000-000000000001'
where city_id is null;

-- NOT NULL + DEFAULT Culiacán (inserts legacy sin city_id no rompen).
alter table public.alerts
  alter column city_id set default 'c0a1c000-0001-4000-8000-000000000001',
  alter column city_id set not null;

alter table public.community_posts
  alter column city_id set default 'c0a1c000-0001-4000-8000-000000000001',
  alter column city_id set not null;

alter table public.sponsored_zones
  alter column city_id set default 'c0a1c000-0001-4000-8000-000000000001',
  alter column city_id set not null;

alter table public.aliado_leads
  alter column city_id set default 'c0a1c000-0001-4000-8000-000000000001',
  alter column city_id set not null;

alter table public.watched_zones
  alter column city_id set default 'c0a1c000-0001-4000-8000-000000000001',
  alter column city_id set not null;

alter table public.users
  alter column city_id set default 'c0a1c000-0001-4000-8000-000000000001',
  alter column city_id set not null;

-- Índices para feeds por ciudad + recencia.
create index if not exists alerts_city_created_idx
  on public.alerts (city_id, created_at desc);

create index if not exists community_posts_city_created_idx
  on public.community_posts (city_id, created_at desc);

create index if not exists community_posts_city_fetched_idx
  on public.community_posts (city_id, fetched_at desc);

create index if not exists sponsored_zones_city_status_idx
  on public.sponsored_zones (city_id, status);

create index if not exists watched_zones_city_user_idx
  on public.watched_zones (city_id, user_id);

create index if not exists users_city_idx
  on public.users (city_id);

-- Nuevos usuarios → home city Culiacán.
create or replace function public.handle_new_alerty_user()
returns trigger as $$
begin
  insert into public.users (id, username, city_id)
  values (
    new.id,
    '@ciudadano' || right(new.id::text, 4),
    'c0a1c000-0001-4000-8000-000000000001'
  )
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Operativo strip-geo: place_label = nombre de la ciudad del post (sigue
-- siendo Culiacán hoy; listo cuando haya posts mazatlan).
create or replace function public.community_posts_strip_operativo_geo()
returns trigger
language plpgsql
as $$
declare
  city_name text;
begin
  if new.category_guess = 'operativo' then
    new.lat := null;
    new.lng := null;
    select c.name into city_name from public.cities c where c.id = new.city_id;
    new.place_label := coalesce(city_name, 'Culiacán');
    new.geo_source := 'none';
    new.place_name_source := null;
    new.geocoded_from_text := null;
  end if;
  return new;
end;
$$;

-- RLS: cities legible por todos (catálogo público); escritura solo service_role.
alter table public.cities enable row level security;

drop policy if exists "Cities are viewable by everyone" on public.cities;
create policy "Cities are viewable by everyone"
on public.cities for select
using (true);

-- Nota RLS alerts/community_posts: se dejan city-agnostic a propósito.
-- Filtrar por ciudad en RLS sin claim de ciudad en JWT rompería anon/preview
-- o forzaría una sola ciudad en DB. El cliente (y notify-on-alert) filtran
-- por city_id. La política de operativo 2h no se toca.
