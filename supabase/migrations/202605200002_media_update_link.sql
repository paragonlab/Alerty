-- Permite ligar media a un comentario del hilo (no solo a la alerta).
alter table public.media
  add column if not exists update_id uuid references public.alert_updates(id) on delete cascade;

create index if not exists media_update_idx on public.media (update_id);

-- La policy anterior solo dejaba al dueño de la alerta subir media. Ahora
-- cualquier usuario puede subir media ligada a SU propio comentario.
drop policy if exists "Alert owners can add media" on public.media;

create policy "Users can add media to alerts or updates"
on public.media for insert
with check (
  exists (
    select 1 from public.alerts
    where alerts.id = media.alert_id and alerts.user_id = auth.uid()
  )
  or exists (
    select 1 from public.alert_updates
    where alert_updates.id = media.update_id and alert_updates.user_id = auth.uid()
  )
);
