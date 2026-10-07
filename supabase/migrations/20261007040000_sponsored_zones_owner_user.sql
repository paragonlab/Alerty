-- Vincula pines Aliado al usuario autenticado que inicia el checkout B2B.

alter table public.sponsored_zones
  add column if not exists owner_user_id uuid references public.users(id) on delete set null;

create index if not exists sponsored_zones_owner_user_idx
  on public.sponsored_zones (owner_user_id);

notify pgrst, 'reload schema';
