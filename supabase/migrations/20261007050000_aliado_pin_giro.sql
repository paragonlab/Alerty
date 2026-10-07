-- Giro / categoría visual del pin Waze (tienda, farmacia, café…).
-- Nullable: si falta, la app deriva el icono desde pin_shape.
-- No se aplica a prod desde este agente; solo queda en supabase/migrations.

alter table public.sponsored_zones
  add column if not exists pin_giro text;

alter table public.sponsored_zones
  drop constraint if exists sponsored_zones_pin_giro_check;

alter table public.sponsored_zones
  add constraint sponsored_zones_pin_giro_check
  check (
    pin_giro is null
    or pin_giro in ('tienda', 'farmacia', 'cafe', 'generico', 'casa', 'escudo')
  );

alter table public.aliado_leads
  add column if not exists pin_giro text;

alter table public.aliado_leads
  drop constraint if exists aliado_leads_pin_giro_check;

alter table public.aliado_leads
  add constraint aliado_leads_pin_giro_check
  check (
    pin_giro is null
    or pin_giro in ('tienda', 'farmacia', 'cafe', 'generico', 'casa', 'escudo')
  );
