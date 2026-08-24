-- Tokens de push notifications. Un usuario puede tener varios dispositivos.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens
  add constraint push_tokens_platform_check
  check (platform in ('ios', 'android', 'web'));

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Users can view own push tokens"
on public.push_tokens for select
using (auth.uid() = user_id);

create policy "Users can insert own push tokens"
on public.push_tokens for insert
with check (auth.uid() = user_id);

create policy "Users can update own push tokens"
on public.push_tokens for update
using (auth.uid() = user_id);

create policy "Users can delete own push tokens"
on public.push_tokens for delete
using (auth.uid() = user_id);
