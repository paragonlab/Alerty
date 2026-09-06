-- fetched_at = primera vez que Pulso vio el post. El resync no lo pisa
-- para que la ventana 1h/24h no se reinicie cada cron.

create or replace function internal.keep_community_fetched_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.fetched_at is not null then
    new.fetched_at := old.fetched_at;
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_keep_fetched_at on public.community_posts;

create trigger community_posts_keep_fetched_at
before update on public.community_posts
for each row
execute procedure internal.keep_community_fetched_at();
