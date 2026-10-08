-- Operativo fuera del mapa en vivo (riesgo legal: halconeo en Sinaloa).
--
-- 1) Ciudadanos no pueden crear alertas category=operativo (check sin operativo).
-- 2) community_posts operativo: sin lat/lng; lugar = ciudad.
-- 3) RLS: posts operativo solo visibles tras 2 horas (mismo valor que
--    OPERATIVO_FEED_DELAY_MS en lib/alerty/operativoPolicy.ts).
--
-- Verificar en prod antes de apply: select count(*) from alerts where category='operativo';
-- Debe ser 0 (confirmado en desarrollo al escribir esta migración).

do $$
declare
  n int;
begin
  select count(*)::int into n from public.alerts where category = 'operativo';
  if n <> 0 then
    raise exception
      'Refusing migration: expected 0 alerts with category=operativo, found %. Move or reclassify them first.',
      n;
  end if;
end $$;

-- Quitar operativo del check de alertas ciudadanas (0 filas afectadas).
alter table public.alerts
  drop constraint if exists alerts_category_check;

alter table public.alerts
  add constraint alerts_category_check
  check (category in (
    'balacera',
    'narcobloqueo',
    'enfrentamiento',
    'detonaciones',
    'bloqueo',
    'captura',
    'robo',
    'accidente',
    'incendio',
    'inundacion',
    'zona segura',
    'sos',
    'desaparecida'
  ));

-- Mensaje claro si alguien intenta insertar operativo (el check también lo bloquea).
create or replace function public.reject_operativo_alert()
returns trigger
language plpgsql
as $$
begin
  if new.category = 'operativo' then
    raise exception 'category operativo is not allowed for citizen alerts'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alerts_reject_operativo on public.alerts;
create trigger alerts_reject_operativo
  before insert or update of category on public.alerts
  for each row
  execute function public.reject_operativo_alert();

-- Strip geo en filas operativo existentes (pins / clusters / deep links).
update public.community_posts
set
  lat = null,
  lng = null,
  place_label = 'Culiacán',
  geo_source = 'none',
  place_name_source = null,
  geocoded_from_text = null
where category_guess = 'operativo'
  and (
    lat is not null
    or lng is not null
    or place_label is distinct from 'Culiacán'
    or coalesce(geo_source, 'none') is distinct from 'none'
    or place_name_source is not null
    or geocoded_from_text is not null
  );

-- Defensa en servidor: sync/upsert no puede volver a guardar coords de operativo.
create or replace function public.community_posts_strip_operativo_geo()
returns trigger
language plpgsql
as $$
begin
  if new.category_guess = 'operativo' then
    new.lat := null;
    new.lng := null;
    new.place_label := 'Culiacán';
    new.geo_source := 'none';
    new.place_name_source := null;
    new.geocoded_from_text := null;
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_strip_operativo_geo on public.community_posts;
create trigger community_posts_strip_operativo_geo
  before insert or update on public.community_posts
  for each row
  execute function public.community_posts_strip_operativo_geo();

-- Delay de lectura: 2 horas desde created_at (UTC).
-- service_role (sync) bypass RLS; anon/authenticated no ven operativo en vivo.
drop policy if exists "Community posts are viewable by everyone" on public.community_posts;

create policy "Community posts are viewable by everyone"
on public.community_posts for select
using (
  category_guess is distinct from 'operativo'
  or created_at <= (timezone('utc', now()) - interval '2 hours')
);
