-- Círculo: zonas que el usuario vigila (1 gratis, 5 con suscripción).

create table if not exists public.watched_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  constraint watched_zones_label_len check (char_length(label) between 1 and 40),
  constraint watched_zones_lat_range check (lat >= -90 and lat <= 90),
  constraint watched_zones_lng_range check (lng >= -180 and lng <= 180)
);

create index if not exists watched_zones_user_id_idx on public.watched_zones (user_id);

alter table public.watched_zones enable row level security;

grant select, insert, update, delete on table public.watched_zones to authenticated;

create policy "Users can read own watched zones"
on public.watched_zones for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own watched zones"
on public.watched_zones for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own watched zones"
on public.watched_zones for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own watched zones"
on public.watched_zones for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.enforce_watched_zone_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n integer;
  premium boolean;
  max_zones integer;
begin
  select count(*)::integer into n
  from public.watched_zones
  where user_id = new.user_id;

  select coalesce(is_premium, false) into premium
  from public.users
  where id = new.user_id;

  max_zones := case when premium then 5 else 1 end;

  if n >= max_zones then
    raise exception 'watched_zone_limit';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_watched_zone_limit() from public;
revoke execute on function public.enforce_watched_zone_limit() from anon, authenticated;

drop trigger if exists watched_zones_limit on public.watched_zones;
create trigger watched_zones_limit
before insert on public.watched_zones
for each row
execute function public.enforce_watched_zone_limit();
