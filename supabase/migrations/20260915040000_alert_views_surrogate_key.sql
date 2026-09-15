-- alert_views tenía llave primaria (alert_id, viewer_id), ambas llaves foráneas.
-- PostgREST la tomó como tabla puente alerts ↔ users, y el embed users(...) en
-- la consulta de alertas quedó ambiguo (PGRST201): la app dejó de cargar las
-- alertas de vecinos. Con una llave propia deja de ser puente, igual que
-- verifications; la unicidad por (alert_id, viewer_id) se mantiene.

alter table public.alert_views drop constraint alert_views_pkey;
alter table public.alert_views add column id bigint generated always as identity primary key;
alter table public.alert_views
  add constraint alert_views_alert_viewer_key unique (alert_id, viewer_id);

notify pgrst, 'reload schema';
