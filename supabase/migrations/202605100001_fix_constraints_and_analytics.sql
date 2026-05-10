-- Migration: Fix constraints for SOS and Audio, add Analytics table
-- Date: 2026-05-10

-- 1. Actualizar el constraint de categorías para incluir 'sos'
alter table public.alerts 
  drop constraint if exists alerts_category_check;

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
    'zona segura',
    'sos'
  ));

-- 2. Actualizar el constraint de media para incluir 'audio'
alter table public.media
  drop constraint if exists media_type_check;

alter table public.media
  add constraint media_type_check
  check (media_type in ('image', 'video', 'audio'));

-- 3. Crear la tabla de analytics (que el código ya usa pero no existía)
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Habilitar RLS para analytics
alter table public.app_events enable row level security;

create policy "Users can insert their own events"
  on public.app_events for insert
  with check (auth.uid() = user_id);

create index if not exists app_events_user_idx on public.app_events (user_id);
create index if not exists app_events_type_idx on public.app_events (event_type);
