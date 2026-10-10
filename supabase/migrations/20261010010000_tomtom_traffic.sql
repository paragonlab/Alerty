-- TomTom: incidents como pulsos (community_posts.source=tomtom),
-- caches de routing/flow/POI, cron de sync, y log anti-spam de avisos por zona.
-- NO aplicar en prod desde el agente — solo archivo de migración.

-- ── community_posts: fuente TomTom + estado despejado ───────────────────────
alter table public.community_posts
  drop constraint if exists community_posts_geo_source_check;

alter table public.community_posts
  add constraint community_posts_geo_source_check
  check (
    geo_source is null
    or geo_source in ('tweet_coords', 'place_bbox', 'text_colonia', 'none', 'tomtom')
  );

alter table public.community_posts
  drop constraint if exists community_posts_source_check;

alter table public.community_posts
  add constraint community_posts_source_check
  check (source in ('x', 'rss', 'tomtom'));

alter table public.community_posts
  drop constraint if exists community_posts_trust_tier_check;

alter table public.community_posts
  add constraint community_posts_trust_tier_check
  check (trust_tier in ('community', 'medio', 'oficial', 'news', 'traffic'));

alter table public.community_posts
  add column if not exists status text not null default 'active';

alter table public.community_posts
  drop constraint if exists community_posts_status_check;

alter table public.community_posts
  add constraint community_posts_status_check
  check (status in ('active', 'resolved'));

alter table public.community_posts
  add column if not exists resolved_at timestamptz;

alter table public.community_posts
  add column if not exists ends_at timestamptz;

alter table public.community_posts
  add column if not exists tomtom_icon_category integer;

comment on column public.community_posts.status is
  'active|resolved. TomTom marca resolved cuando el incidente cierra/expira.';
comment on column public.community_posts.tomtom_icon_category is
  'Código iconCategory de TomTom Incident Details (1=accident, 8=roadClosed, …).';

create index if not exists community_posts_tomtom_active_idx
  on public.community_posts (source, status, created_at desc)
  where source = 'tomtom';

-- ── Caches server-side (TTL corto; sin PII) ──────────────────────────────────
create table if not exists public.tomtom_cache (
  cache_key text primary key,
  kind text not null
    check (kind in ('route', 'flow', 'poi', 'incidents_meta', 'ratelimit')),
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tomtom_cache_expires_idx
  on public.tomtom_cache (expires_at);

alter table public.tomtom_cache enable row level security;
-- Sin policies para anon/authenticated: solo service_role (edge).

-- Anti-spam: un aviso suave por (usuario, incidente TomTom) cada 6 h.
create table if not exists public.tomtom_zone_notify_log (
  user_id uuid not null references public.users (id) on delete cascade,
  external_id text not null,
  city_id uuid not null references public.cities (id),
  sent_at timestamptz not null default now(),
  primary key (user_id, external_id)
);

create index if not exists tomtom_zone_notify_log_sent_idx
  on public.tomtom_zone_notify_log (sent_at desc);

alter table public.tomtom_zone_notify_log enable row level security;

-- ── Cron: sync incidents cada 20 min (presupuesto free ~360 req/día con 5 bbox ≤10k km²) ─
-- sync-tomtom-incidents exige x-pulso-hook (= notify_hook_secret / NOTIFY_HOOK_SECRET),
-- mismo patrón que notify-on-alert: JWT publishable abre el gateway; el hook autoriza.
-- Requiere en Vault (además de project_url / publishable_key):
--   select vault.create_secret('<secreto>', 'notify_hook_secret');
--   supabase secrets set NOTIFY_HOOK_SECRET=<mismo secreto>
create or replace function internal.invoke_community_sync(function_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  api_key text;
  hook_secret text;
  request_id bigint;
  headers jsonb;
begin
  if function_name not in (
    'sync-x-community',
    'sync-news-rss',
    'sync-tomtom-incidents'
  ) then
    raise exception 'function not allowed: %', function_name;
  end if;

  select ds.decrypted_secret into project_url
  from vault.decrypted_secrets as ds
  where ds.name = 'project_url'
  limit 1;

  select ds.decrypted_secret into api_key
  from vault.decrypted_secrets as ds
  where ds.name in ('publishable_key', 'anon_key')
  order by case ds.name when 'publishable_key' then 0 else 1 end
  limit 1;

  select ds.decrypted_secret into hook_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'notify_hook_secret'
  limit 1;

  if project_url is null or api_key is null then
    raise warning 'community sync cron skipped: missing vault secrets project_url / publishable_key';
    return null;
  end if;

  -- TomTom sync gasta cuota: sin hook no disparamos (evita llamadas abiertas con anon).
  if function_name = 'sync-tomtom-incidents' and hook_secret is null then
    raise warning 'sync-tomtom-incidents skipped: missing vault secret notify_hook_secret';
    return null;
  end if;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || api_key,
    'apikey', api_key
  );
  if hook_secret is not null then
    headers := headers || jsonb_build_object('x-pulso-hook', hook_secret);
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || function_name,
    headers := headers,
    body := jsonb_build_object('source', 'pg_cron')
  ) into request_id;

  return request_id;
end;
$$;

do $cmd$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid)
    from cron.job as j
    where j.jobname = 'pulso-sync-tomtom-incidents';

    perform cron.schedule(
      'pulso-sync-tomtom-incidents',
      '5,25,45 * * * *',
      $$select internal.invoke_community_sync('sync-tomtom-incidents')$$
    );
  else
    raise notice 'pg_cron no instalado: omitiendo schedule de sync-tomtom-incidents';
  end if;
end
$cmd$;
