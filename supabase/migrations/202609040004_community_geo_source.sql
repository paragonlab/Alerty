-- Geo provenance for community_posts (publisher place vs colonia from text).
-- Does not delete or rewrite existing lat/lng; new syncs populate these columns.

alter table public.community_posts
  add column if not exists geo_source text;

alter table public.community_posts
  add column if not exists place_name_source text;

alter table public.community_posts
  add column if not exists geocoded_from_text text;

alter table public.community_posts
  drop constraint if exists community_posts_geo_source_check;

alter table public.community_posts
  add constraint community_posts_geo_source_check
  check (
    geo_source is null
    or geo_source in ('tweet_coords', 'place_bbox', 'text_colonia', 'none')
  );

comment on column public.community_posts.geo_source is
  'How lat/lng were chosen: tweet_coords | place_bbox | text_colonia | none';
comment on column public.community_posts.place_name_source is
  'Publisher check-in / place / feed label (may disagree with body colonia)';
comment on column public.community_posts.geocoded_from_text is
  'Colonia extracted from title/body when used or considered for the pin';
