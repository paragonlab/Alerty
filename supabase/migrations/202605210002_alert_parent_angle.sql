-- Aportes de video como "otro ángulo".
-- Una alerta puede referenciar a otra como su reporte original; el video
-- aportado se vuelve su propio Pulso (reel) ligado al reporte de referencia.

alter table public.alerts
  add column if not exists parent_alert_id uuid
  references public.alerts(id) on delete cascade;

create index if not exists idx_alerts_parent_alert_id
  on public.alerts(parent_alert_id);
