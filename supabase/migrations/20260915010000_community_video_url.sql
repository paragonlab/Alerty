-- Enlace directo al video (mp4) de un post de X, tomado de media.variants de
-- su API. Con él la app lo reproduce a pantalla completa, con la atribución
-- que piden las reglas de X. media_url sigue siendo la miniatura.
alter table public.community_posts add column if not exists video_url text;
