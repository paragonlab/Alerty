-- Añadir columnas de preferencias de la app a la tabla public.users
alter table public.users
  add column if not exists theme_mode text not null default 'light',
  add column if not exists push_enabled boolean not null default true,
  add column if not exists low_connection boolean not null default false,
  add column if not exists active_categories text[] not null default array['balacera', 'narcobloqueo', 'enfrentamiento', 'detonaciones', 'bloqueo', 'captura', 'robo', 'accidente', 'zona segura'],
  add column if not exists show_heatmap boolean not null default false,
  add column if not exists is_premium boolean not null default false,
  add column if not exists stripe_customer_id text;

-- Restricción para el modo de tema
alter table public.users
  drop constraint if exists users_theme_mode_check;

alter table public.users
  add constraint users_theme_mode_check
  check (theme_mode in ('light', 'darkHighVisibility'));
