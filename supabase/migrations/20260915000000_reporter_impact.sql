-- Impacto del reportero. Dos datos que hoy no existen:
--   · cuántos vecinos confirmaron los pulsos de alguien (insignia "Reportero
--     confiable" y aviso "tu pulso está ayudando");
--   · cuántos vecinos vieron un pulso (solo para ese aviso al autor).
-- Las vistas NO ordenan ni destacan nada: premiar vistas empujaría a grabar
-- balaceras de cerca.
--
-- reporter_stats vive aparte de users porque users tiene "update own profile":
-- un contador ahí lo podría inflar el propio usuario.

create table if not exists public.reporter_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  confirmations_received integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.reporter_stats enable row level security;
create policy "Reporter stats are viewable by everyone"
  on public.reporter_stats for select using (true);

create table if not exists public.alert_views (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alert_id, viewer_id)
);
alter table public.alert_views enable row level security;
create policy "Users record their own views"
  on public.alert_views for insert to authenticated
  with check (auth.uid() = viewer_id);

insert into public.reporter_stats (user_id, confirmations_received)
select a.user_id, count(*)
  from public.verifications as v
  join public.alerts as a on a.id = v.alert_id
 where v.vote_type = 'upvote' and a.user_id is not null and v.user_id <> a.user_id
 group by a.user_id
on conflict (user_id) do nothing;

create or replace function internal.on_verification_upvote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  confirmations integer;
  project_url text;
  hook_secret text;
  api_key text;
begin
  if new.vote_type <> 'upvote' then
    return new;
  end if;

  select a.user_id into author from public.alerts as a where a.id = new.alert_id;
  if author is null or author = new.user_id then
    return new;
  end if;

  insert into public.reporter_stats as rs (user_id, confirmations_received)
  values (author, 1)
  on conflict (user_id) do update
    set confirmations_received = rs.confirmations_received + 1,
        updated_at = now();

  select count(*) into confirmations
    from public.verifications as v
   where v.alert_id = new.alert_id
     and v.vote_type = 'upvote'
     and v.user_id <> author;

  -- Solo en hitos: un aviso por cada voto sería ruido.
  if confirmations not in (1, 5, 10, 25, 50, 100) then
    return new;
  end if;

  select ds.decrypted_secret into project_url
    from vault.decrypted_secrets as ds
   where ds.name = 'project_url'
   limit 1;

  select ds.decrypted_secret into hook_secret
    from vault.decrypted_secrets as ds
   where ds.name = 'notify_hook_secret'
   limit 1;

  select ds.decrypted_secret into api_key
    from vault.decrypted_secrets as ds
   where ds.name in ('publishable_key', 'anon_key')
   order by case ds.name when 'publishable_key' then 0 else 1 end
   limit 1;

  if project_url is null or hook_secret is null or api_key is null then
    raise warning 'aviso de impacto no disparado: falta project_url, notify_hook_secret o publishable_key en Vault';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/notify-on-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key,
      'apikey', api_key,
      'x-pulso-hook', hook_secret
    ),
    body := jsonb_build_object(
      'type', 'impact',
      'alertId', new.alert_id,
      'confirmations', confirmations
    ),
    timeout_milliseconds := 20000
  );

  return new;
end;
$$;

drop trigger if exists verifications_impact on public.verifications;
create trigger verifications_impact
  after insert on public.verifications
  for each row execute function internal.on_verification_upvote();
