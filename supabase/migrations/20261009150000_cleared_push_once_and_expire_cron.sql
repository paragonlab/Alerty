-- 1) Una sola push “Ya se despejó” por alerta (claim atómico en notify-on-alert).
-- 2) Cron horario de expire_stale_alerts (pg_cron), alineado al patrón de sync comunidad.

alter table public.alerts
  add column if not exists cleared_push_sent_at timestamptz;

comment on column public.alerts.cleared_push_sent_at is
  'Cuándo se envió el push suave de despeje; null = aún no. Impide reenvíos.';

-- Cron: expirar alertas activas > 24 h (solo service_role vía función).
-- pg_cron ya se crea en 20260905044049_community_sync_cron.sql.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid)
    from cron.job as j
    where j.jobname = 'pulso-expire-stale-alerts';

    perform cron.schedule(
      'pulso-expire-stale-alerts',
      '15 * * * *',
      $$select public.expire_stale_alerts()$$
    );
  else
    raise notice 'pg_cron no instalado: omitiendo schedule de expire_stale_alerts';
  end if;
end $$;
