-- 1) Una sola push “Ya se despejó” por alerta (claim atómico en notify-on-alert).
-- 2) Cron horario de expire_stale_alerts (pg_cron).
--
-- IMPORTANTE — versiones ya aplicadas en prod (nombres distintos a este archivo):
--   20261009075123  (cleared / clearance base, vía #47)
--   20261009075129  (revoke grants ≡ 20261009140000)
--   20261009085219  (esta lógica de cron + cleared_push_sent_at)
-- No re-aplicar a ciegas: el contenido aquí es la forma correcta/idempotente
-- para ambientes que aún no la tienen (el nesting $$ original rompía db push).

alter table public.alerts
  add column if not exists cleared_push_sent_at timestamptz;

comment on column public.alerts.cleared_push_sent_at is
  'Cuándo se envió el push suave de despeje; null = aún no. Impide reenvíos.';

-- Cron: expirar alertas activas > 24 h (solo service_role vía función).
-- Usar $do$ / $cmd$ — anidar $$ dentro de do $$ falla en supabase db push.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid)
    from cron.job as j
    where j.jobname = 'pulso-expire-stale-alerts';

    perform cron.schedule(
      'pulso-expire-stale-alerts',
      '15 * * * *',
      $cmd$select public.expire_stale_alerts()$cmd$
    );
  else
    raise notice 'pg_cron no instalado: omitiendo schedule de expire_stale_alerts';
  end if;
end
$do$;
