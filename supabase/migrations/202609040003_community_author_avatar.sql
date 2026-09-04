-- Avatar/logo del autor o fuente para pines de comunidad (X profile_image_url / RSS logo).
-- No borra posts: solo añade columna nullable.

alter table public.community_posts
  add column if not exists author_avatar_url text;

comment on column public.community_posts.author_avatar_url is
  'URL de avatar (X profile_image_url) o logo de feed RSS; opcional';
