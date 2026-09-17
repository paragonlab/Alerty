-- Solicitudes de Aliado hechas desde la app. En iPhone y Android no se puede
-- cobrar ni mandar a pagar fuera (App Review 3.1.1 y la política de pagos de
-- Google Play): el negocio deja sus datos aquí y la venta se cierra por fuera.
-- Vive aparte de sponsored_zones para no tocar la tabla que decide qué se
-- pinta en el mapa.

create table if not exists public.aliado_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text not null,
  contact_email text not null,
  type text not null,
  lat double precision,
  lng double precision,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.aliado_leads
  add constraint aliado_leads_type_check check (type in ('refugio', 'anuncio'));

alter table public.aliado_leads
  add constraint aliado_leads_status_check check (status in ('new', 'contacted', 'closed'));

alter table public.aliado_leads enable row level security;

-- Solo se puede insertar la solicitud propia. Nadie lee por la API: las
-- solicitudes se revisan en el panel de Supabase.
drop policy if exists "aliado leads insert own" on public.aliado_leads;
create policy "aliado leads insert own"
  on public.aliado_leads
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists aliado_leads_created_idx on public.aliado_leads (created_at desc);
