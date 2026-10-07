-- Constraint canónico sobre community_posts.category_guess.
-- NOT VALID: no escanea filas existentes al crear; validar después si se desea:
--   alter table public.community_posts validate constraint community_posts_category_guess_check;
-- Aplicar DESPUÉS del backfill 20261007120000.

alter table public.community_posts
  drop constraint if exists community_posts_category_guess_check;

alter table public.community_posts
  add constraint community_posts_category_guess_check
  check (
    category_guess is null
    or category_guess in (
      'balacera',
      'enfrentamiento',
      'detonaciones',
      'narcobloqueo',
      'bloqueo',
      'captura',
      'robo',
      'accidente',
      'incendio',
      'inundacion',
      'zona segura',
      'sos',
      'desaparecida',
      'operativo',
      'alerta',
      'otro'
    )
  ) not valid;
