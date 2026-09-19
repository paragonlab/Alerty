-- Revisión humana en menos de 24 horas.
--
-- Ya existía el reflejo automático: al tercer denunciante distinto el trigger
-- oculta el pulso. Eso no es moderación: nadie mira los dos primeros reportes,
-- nadie revisa lo que se ocultó solo y nadie mira a las cuentas que la gente
-- bloquea. En los términos y en la respuesta a App Review prometimos revisar en
-- 24 horas; esto es lo que hace que esa frase sea cierta.

-- 1) Quién modera ------------------------------------------------------------

alter table public.users add column if not exists is_moderator boolean not null default false;

-- En security definer para que la policy no vuelva a entrar a users.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_moderator from public.users u where u.id = auth.uid()), false);
$$;

revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- 2) Lo que el moderador necesita ver y poder hacer ---------------------------

-- Las policies se suman: esta no abre las ocultas a nadie más.
drop policy if exists "Moderators see every alert" on public.alerts;
create policy "Moderators see every alert"
on public.alerts for select to authenticated
using (public.is_moderator());

drop policy if exists "Moderators can hide or restore alerts" on public.alerts;
create policy "Moderators can hide or restore alerts"
on public.alerts for update to authenticated
using (public.is_moderator())
with check (public.is_moderator());

drop policy if exists "Moderators see every flag" on public.alert_flags;
create policy "Moderators see every flag"
on public.alert_flags for select to authenticated
using (public.is_moderator());

drop policy if exists "Moderators see every block" on public.blocked_users;
create policy "Moderators see every block"
on public.blocked_users for select to authenticated
using (public.is_moderator());

-- 3) Constancia de cada revisión ---------------------------------------------

create table if not exists public.moderation_reviews (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  moderator_id uuid not null references auth.users(id) on delete cascade,
  -- hidden = se quitó; kept = se revisó y se deja visible.
  action text not null check (action in ('hidden', 'kept')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists moderation_reviews_alert_idx
  on public.moderation_reviews (alert_id, created_at desc);

alter table public.moderation_reviews enable row level security;

drop policy if exists "Moderators read reviews" on public.moderation_reviews;
create policy "Moderators read reviews"
on public.moderation_reviews for select to authenticated
using (public.is_moderator());

drop policy if exists "Moderators write reviews" on public.moderation_reviews;
create policy "Moderators write reviews"
on public.moderation_reviews for insert to authenticated
with check (public.is_moderator() and auth.uid() = moderator_id);

grant select, insert on table public.moderation_reviews to authenticated;

-- 4) La cola -----------------------------------------------------------------

-- security_invoker: la vista no es una puerta trasera, respeta las policies de
-- quien consulta. Un usuario normal solo ve sus propios reportes aquí.
create or replace view public.moderation_queue
with (security_invoker = on) as
select
  a.id                                      as alert_id,
  a.category,
  a.description,
  a.created_at,
  a.hidden_at,
  a.user_id                                 as author_id,
  u.username                                as author_username,
  count(f.*)                                as flag_count,
  min(f.created_at)                         as first_flag_at,
  max(f.created_at)                         as last_flag_at,
  array_remove(array_agg(f.reason), null)   as reasons,
  r.created_at                              as reviewed_at,
  r.action                                  as last_action
from public.alerts a
join public.alert_flags f on f.alert_id = a.id
left join public.users u on u.id = a.user_id
left join lateral (
  select mr.created_at, mr.action
    from public.moderation_reviews mr
   where mr.alert_id = a.id
   order by mr.created_at desc
   limit 1
) r on true
group by a.id, u.username, r.created_at, r.action;

grant select on public.moderation_queue to authenticated;

-- Cuentas que la gente bloquea: señal para mirar a quien reincide.
create or replace view public.moderation_blocked_accounts
with (security_invoker = on) as
select
  b.blocked_id        as user_id,
  u.username,
  count(*)            as block_count,
  max(b.created_at)   as last_block_at
from public.blocked_users b
left join public.users u on u.id = b.blocked_id
group by b.blocked_id, u.username;

grant select on public.moderation_blocked_accounts to authenticated;

notify pgrst, 'reload schema';
