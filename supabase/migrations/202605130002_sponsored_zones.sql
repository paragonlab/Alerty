-- Pines patrocinados B2B: negocios pagan suscripción mensual para aparecer en el mapa

create table if not exists public.sponsored_zones (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  description text not null,
  lat double precision not null,
  lng double precision not null,
  type text not null,
  status text not null default 'pending',
  logo_url text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sponsored_zones
  add constraint sponsored_zones_type_check
  check (type in ('refugio', 'anuncio'));

alter table public.sponsored_zones
  add constraint sponsored_zones_status_check
  check (status in ('pending', 'active', 'past_due', 'canceled'));

create index if not exists sponsored_zones_status_idx on public.sponsored_zones (status);
create index if not exists sponsored_zones_stripe_sub_idx on public.sponsored_zones (stripe_subscription_id);
create index if not exists sponsored_zones_owner_email_idx on public.sponsored_zones (owner_email);

alter table public.sponsored_zones enable row level security;

-- Cualquiera puede ver zonas activas (aparecen en el mapa y feed públicamente)
create policy "Active sponsored zones are viewable by everyone"
on public.sponsored_zones for select
using (status = 'active');

-- Las escrituras (insert/update/delete) las hacen solamente las edge functions usando service_role,
-- que bypasea RLS automáticamente. No hay política de cliente para mutaciones.
