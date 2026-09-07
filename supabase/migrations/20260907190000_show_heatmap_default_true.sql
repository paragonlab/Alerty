alter table public.users alter column show_heatmap set default true;

update public.users
set show_heatmap = true
where show_heatmap is not true;
