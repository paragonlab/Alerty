-- Cron cada ~10 min: sync-x-community y sync-news-rss.
-- No guarda keys en esta migración. Requiere Vault:
--   select vault.create_secret('https://hllgwcphvobgpdvidbad.supabase.co', 'project_url');
--   select vault.create_secret('<EXPO_PUBLIC_SUPABASE_ANON_KEY>', 'publishable_key');
-- Invoca las edge functions con JWT anon (verify_jwt). Las functions escriben con service_role de su env.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists internal;
revoke all on schema internal from public;

create or replace function internal.invoke_community_sync(function_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  api_key text;
  request_id bigint;
begin
  if function_name not in ('sync-x-community', 'sync-news-rss') then
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

  if project_url is null or api_key is null then
    raise warning 'community sync cron skipped: missing vault secrets project_url / publishable_key';
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key,
      'apikey', api_key
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function internal.invoke_community_sync(text) from public;
revoke all on function internal.invoke_community_sync(text) from anon, authenticated;

select cron.unschedule(j.jobid)
from cron.job as j
where j.jobname in ('pulso-sync-x-community', 'pulso-sync-news-rss');

select cron.schedule(
  'pulso-sync-x-community',
  '*/10 * * * *',
  $$select internal.invoke_community_sync('sync-x-community')$$
);

-- +2 min para no empatar cold start con X
select cron.schedule(
  'pulso-sync-news-rss',
  '2-59/10 * * * *',
  $$select internal.invoke_community_sync('sync-news-rss')$$
);
