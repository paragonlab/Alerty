-- Mapa y pulsos se ven sin cuenta. X/RSS vive en community_posts;
-- la policy anterior era solo authenticated y rompía el feed público.

drop policy if exists "Authenticated users can read community posts" on public.community_posts;

create policy "Community posts are viewable by everyone"
on public.community_posts for select
using (true);

grant select on table public.community_posts to anon, authenticated;
