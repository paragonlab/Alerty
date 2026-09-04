-- Posts de comunidad desde X (Twitter) para conciencia situacional en Culiacán.
-- Lectura: usuarios autenticados. Escritura: solo service_role (edge function).

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'x',
  external_id text not null,
  author_handle text not null,
  author_name text,
  text text not null,
  url text not null,
  media_url text,
  lat double precision,
  lng double precision,
  place_label text,
  created_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  category_guess text,
  is_demo boolean not null default false,
  unique (source, external_id)
);

alter table public.community_posts
  add constraint community_posts_source_check
  check (source in ('x'));

create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);

create index if not exists community_posts_source_idx
  on public.community_posts (source);

alter table public.community_posts enable row level security;

-- Lectura para usuarios autenticados (mismo patrón de sesión de la app).
create policy "Authenticated users can read community posts"
on public.community_posts for select
to authenticated
using (true);

-- Sin políticas de insert/update/delete para anon/authenticated:
-- la edge function sync-x-community escribe con service_role (bypassa RLS).

-- Realtime: nuevos posts aparecen en Feed/Map sin recargar.
alter publication supabase_realtime add table public.community_posts;

-- Seeds DEMO (claramente marcados). Visibles sin X_BEARER_TOKEN.
-- Coordenadas cerca del centro de Culiacán con offset para no apilar pines.
insert into public.community_posts (
  source, external_id, author_handle, author_name, text, url,
  media_url, lat, lng, place_label, created_at, fetched_at, category_guess, is_demo
) values
(
  'x',
  'demo-culiacan-1',
  'DemoPulsoX',
  'Demo Comunidad X',
  'DEMO — Ejemplo de post de X: reportan congestión y posible bloqueo cerca del centro de Culiacán. Esto NO es una alerta oficial de Pulso ni un tweet en vivo.',
  'https://x.com/DemoPulsoX/status/demo-culiacan-1',
  null,
  24.8091,
  -107.394,
  'Culiacán (X)',
  now() - interval '25 minutes',
  now(),
  'bloqueo',
  true
),
(
  'x',
  'demo-culiacan-2',
  'DemoPulsoX',
  'Demo Comunidad X',
  'DEMO — Ejemplo de post de X: vecinos comentan detonaciones lejanas por la zona de Las Quintas. Contenido de muestra, no en vivo.',
  'https://x.com/DemoPulsoX/status/demo-culiacan-2',
  null,
  24.8125,
  -107.3880,
  'Culiacán (X)',
  now() - interval '2 hours',
  now(),
  'detonaciones',
  true
),
(
  'x',
  'demo-culiacan-3',
  'DemoPulsoX',
  'Demo Comunidad X',
  'DEMO — Ejemplo de post de X: accidente vial reportado en redes cerca de Tres Ríos. Etiquetado como demo para no confundir con alertas ciudadanas.',
  'https://x.com/DemoPulsoX/status/demo-culiacan-3',
  null,
  24.8180,
  -107.4010,
  'Culiacán (X)',
  now() - interval '5 hours',
  now(),
  'accidente',
  true
)
on conflict (source, external_id) do nothing;
