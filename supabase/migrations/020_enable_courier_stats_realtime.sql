alter table public.couriers replica identity full;
alter table public.stores replica identity full;
alter table public.deliveries replica identity full;
alter table public.courier_xp_events replica identity full;
alter table public.courier_points replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couriers'
  ) then
    alter publication supabase_realtime add table public.couriers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stores'
  ) then
    alter publication supabase_realtime add table public.stores;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deliveries'
  ) then
    alter publication supabase_realtime add table public.deliveries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courier_xp_events'
  ) then
    alter publication supabase_realtime add table public.courier_xp_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courier_points'
  ) then
    alter publication supabase_realtime add table public.courier_points;
  end if;
end $$;
