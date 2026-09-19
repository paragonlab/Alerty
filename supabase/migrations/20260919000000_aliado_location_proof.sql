-- Dar de alta un Aliado sin escribir coordenadas a mano, y poder respaldar que
-- el lugar es suyo.
--
-- Hasta ahora el negocio tecleaba latitud y longitud: nadie tiene eso a la mano
-- y nada impedía poner el pin sobre el local de enfrente. Ahora el pin se
-- coloca en el mapa o buscando la dirección, y la solicitud viaja con una de
-- dos pruebas: el GPS del negocio coincidiendo con el pin, o un documento.

alter table public.aliado_leads add column if not exists address text;
alter table public.aliado_leads add column if not exists proof_url text;
alter table public.aliado_leads add column if not exists proof_kind text;
alter table public.aliado_leads add column if not exists location_verified_at timestamptz;
alter table public.aliado_leads add column if not exists location_distance_m double precision;

alter table public.aliado_leads drop constraint if exists aliado_leads_proof_kind_check;
alter table public.aliado_leads
  add constraint aliado_leads_proof_kind_check
  check (proof_kind is null or proof_kind in ('fachada', 'recibo', 'otro'));

-- El negocio puede ver su propia solicitud; las ajenas siguen sin API.
drop policy if exists "aliado leads read own" on public.aliado_leads;
create policy "aliado leads read own"
  on public.aliado_leads for select to authenticated
  using (auth.uid() = user_id);

grant select on table public.aliado_leads to authenticated;

-- Bucket privado: un recibo trae nombre y domicilio, no puede quedar en una
-- URL pública como el resto de la media.
insert into storage.buckets (id, name, public)
values ('aliado-proofs', 'aliado-proofs', false)
on conflict (id) do nothing;

drop policy if exists "aliado proof upload own" on storage.objects;
create policy "aliado proof upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aliado-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "aliado proof read own" on storage.objects;
create policy "aliado proof read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'aliado-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
