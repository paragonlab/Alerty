-- Requisitos de App Review 1.2 (contenido de usuarios): poder bloquear a quien
-- abusa —y que su contenido desaparezca al instante— y dejar constancia de que
-- cada cuenta aceptó los términos con tolerancia cero al contenido ofensivo.
--
-- La llave primaria es propia y no el par (blocker, blocked): dos llaves
-- foráneas como llave primaria hacen que PostgREST trate la tabla como puente
-- entre users y users, y los embeds de alertas se vuelven ambiguos. Ya pasó con
-- alert_views y dejó la app sin cargar alertas.

create table if not exists public.blocked_users (
  id bigint generated always as identity primary key,
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocked_users
  add constraint blocked_users_pair_key unique (blocker_id, blocked_id);

alter table public.blocked_users
  add constraint blocked_users_not_self check (blocker_id <> blocked_id);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked users read own" on public.blocked_users;
create policy "blocked users read own"
  on public.blocked_users for select to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "blocked users insert own" on public.blocked_users;
create policy "blocked users insert own"
  on public.blocked_users for insert to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "blocked users delete own" on public.blocked_users;
create policy "blocked users delete own"
  on public.blocked_users for delete to authenticated
  using (auth.uid() = blocker_id);

-- Constancia de aceptación de términos por cuenta.
alter table public.users add column if not exists terms_accepted_at timestamptz;

notify pgrst, 'reload schema';
