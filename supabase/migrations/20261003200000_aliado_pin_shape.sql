-- El Aliado elige cómo se ve su pin (pin, bandera, casa o escudo) y puede
-- subir un logotipo público. El comprobante del negocio sigue en el bucket
-- privado; el logo es otra cosa y sí se muestra en el mapa.

alter table public.sponsored_zones add column if not exists pin_shape text not null default 'pin';
alter table public.sponsored_zones drop constraint if exists sponsored_zones_pin_shape_check;
alter table public.sponsored_zones
  add constraint sponsored_zones_pin_shape_check
  check (pin_shape in ('pin', 'flag', 'house', 'shield'));

alter table public.aliado_leads add column if not exists pin_shape text not null default 'pin';
alter table public.aliado_leads add column if not exists logo_url text;
alter table public.aliado_leads drop constraint if exists aliado_leads_pin_shape_check;
alter table public.aliado_leads
  add constraint aliado_leads_pin_shape_check
  check (pin_shape in ('pin', 'flag', 'house', 'shield'));

insert into storage.buckets (id, name, public)
values ('aliado-logos', 'aliado-logos', true)
on conflict (id) do nothing;

drop policy if exists "aliado logo upload own" on storage.objects;
create policy "aliado logo upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aliado-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
