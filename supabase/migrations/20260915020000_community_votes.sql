-- Las noticias de X y RSS también se pueden confirmar o desmentir. Pulso es una
-- fuente informativa, no una verdad absoluta: los vecinos corrigen lo que ven.
-- Un voto por persona por noticia; los conteos son públicos.

create table if not exists public.community_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote_type text not null check (vote_type in ('confirm', 'deny')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_votes enable row level security;

create policy "Community votes are viewable by everyone"
  on public.community_votes for select using (true);

create policy "Users cast their own community votes"
  on public.community_votes for insert to authenticated
  with check (auth.uid() = user_id);
