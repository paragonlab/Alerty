-- Extiende community_posts para multi-fuente (X + RSS) y trust badges.
-- Lectura autenticada / escritura service_role sin cambios.

alter table public.community_posts
  drop constraint if exists community_posts_source_check;

alter table public.community_posts
  add constraint community_posts_source_check
  check (source in ('x', 'rss'));

alter table public.community_posts
  add column if not exists trust_tier text not null default 'community';

alter table public.community_posts
  drop constraint if exists community_posts_trust_tier_check;

alter table public.community_posts
  add constraint community_posts_trust_tier_check
  check (trust_tier in ('community', 'medio', 'oficial', 'news'));

comment on column public.community_posts.trust_tier is
  'community=Desde X; medio/oficial=allowlist; news=RSS local';
