-- El dashboard de administración lee solicitudes y prende o apaga pines.
-- Solo is_moderator. El correo del negocio y el comprobante no salen a nadie más.

alter table public.aliado_leads
  add column if not exists zone_id uuid references public.sponsored_zones(id);

drop policy if exists "moderators read aliado leads" on public.aliado_leads;
create policy "moderators read aliado leads"
  on public.aliado_leads for select to authenticated
  using (public.is_moderator());

drop policy if exists "moderators update aliado leads" on public.aliado_leads;
create policy "moderators update aliado leads"
  on public.aliado_leads for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

grant update on table public.aliado_leads to authenticated;

drop policy if exists "moderators read sponsored zones" on public.sponsored_zones;
create policy "moderators read sponsored zones"
  on public.sponsored_zones for select to authenticated
  using (public.is_moderator());

drop policy if exists "moderators insert sponsored zones" on public.sponsored_zones;
create policy "moderators insert sponsored zones"
  on public.sponsored_zones for insert to authenticated
  with check (public.is_moderator());

drop policy if exists "moderators update sponsored zones" on public.sponsored_zones;
create policy "moderators update sponsored zones"
  on public.sponsored_zones for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

grant select, insert, update on table public.sponsored_zones to authenticated;

drop policy if exists "moderators read aliado proofs" on storage.objects;
create policy "moderators read aliado proofs"
  on storage.objects for select to authenticated
  using (bucket_id = 'aliado-proofs' and public.is_moderator());

notify pgrst, 'reload schema';
