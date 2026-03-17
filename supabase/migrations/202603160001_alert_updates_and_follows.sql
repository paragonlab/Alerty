-- Migration: Add title to alerts, create alert_updates and alert_follows tables
-- Date: 2026-03-16

-- 1. Add title column to alerts
alter table public.alerts 
  add column if not exists title text;

-- 2. Create alert_updates table for threading
create table if not exists public.alert_updates (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS for updates
alter table public.alert_updates enable row level security;

-- Policies for updates
create policy "Alert updates are viewable by everyone"
  on public.alert_updates for select
  using (true);

create policy "Authenticated users can create updates"
  on public.alert_updates for insert
  with check (auth.uid() = user_id);

-- 3. Create alert_follows table
create table if not exists public.alert_follows (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (alert_id, user_id)
);

-- Enable RLS for follows
alter table public.alert_follows enable row level security;

-- Policies for follows
create policy "Follows are viewable by everyone"
  on public.alert_follows for select
  using (true);

create policy "Users can manage their own follows"
  on public.alert_follows for all
  using (auth.uid() = user_id);

-- 4. Create indexes for performance
create index if not exists alert_updates_alert_idx on public.alert_updates (alert_id);
create index if not exists alert_follows_user_idx on public.alert_follows (user_id);
create index if not exists alert_follows_alert_idx on public.alert_follows (alert_id);
