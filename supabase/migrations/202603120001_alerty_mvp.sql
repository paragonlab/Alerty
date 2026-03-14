create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  is_verified boolean not null default false,
  trust_score numeric not null default 0.5,
  followers_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  category text not null,
  lat double precision not null,
  lng double precision not null,
  description text,
  created_at timestamptz not null default now(),
  status text not null default 'active'
);

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
    'zona segura'
  ));

alter table public.alerts
  add constraint alerts_status_check
  check (status in ('active', 'resolved'));

create index if not exists alerts_created_at_idx on public.alerts (created_at desc);
create index if not exists alerts_category_idx on public.alerts (category);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  media_url text not null,
  media_type text not null,
  created_at timestamptz not null default now()
);

alter table public.media
  add constraint media_type_check
  check (media_type in ('image', 'video'));

create index if not exists media_alert_idx on public.media (alert_id);

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote_type text not null,
  created_at timestamptz not null default now(),
  unique (alert_id, user_id)
);

alter table public.verifications
  add constraint verifications_vote_check
  check (vote_type in ('upvote', 'downvote'));

create index if not exists verifications_alert_idx on public.verifications (alert_id);

create or replace function public.handle_new_alerty_user()
returns trigger as $$
begin
  insert into public.users (id, username)
  values (new.id, '@ciudadano' || right(new.id::text, 4))
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_alerty on auth.users;
create trigger on_auth_user_created_alerty
after insert on auth.users
for each row execute procedure public.handle_new_alerty_user();

alter table public.users enable row level security;
alter table public.alerts enable row level security;
alter table public.media enable row level security;
alter table public.verifications enable row level security;

create policy "Users are viewable by everyone"
on public.users for select
using (true);

create policy "Users can insert own profile"
on public.users for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.users for update
using (auth.uid() = id);

create policy "Alerts are viewable by everyone"
on public.alerts for select
using (true);

create policy "Authenticated users can create alerts"
on public.alerts for insert
with check (auth.uid() = user_id);

create policy "Alert owners can update"
on public.alerts for update
using (auth.uid() = user_id);

create policy "Media is viewable by everyone"
on public.media for select
using (true);

create policy "Alert owners can add media"
on public.media for insert
with check (
  exists (
    select 1 from public.alerts
    where alerts.id = media.alert_id
    and alerts.user_id = auth.uid()
  )
);

create policy "Verifications are viewable by everyone"
on public.verifications for select
using (true);

create policy "Authenticated users can vote"
on public.verifications for insert
with check (auth.uid() = user_id);
