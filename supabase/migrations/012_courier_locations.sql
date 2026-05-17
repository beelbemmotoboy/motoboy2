create table if not exists public.courier_locations (
  courier_id uuid primary key references public.couriers(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy_meters numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courier_locations_latitude_check check (latitude between -90 and 90),
  constraint courier_locations_longitude_check check (longitude between -180 and 180)
);

create index if not exists courier_locations_city_updated_idx
  on public.courier_locations(city_id, updated_at desc);

drop trigger if exists set_courier_locations_updated_at on public.courier_locations;
create trigger set_courier_locations_updated_at before update on public.courier_locations
  for each row execute function public.set_updated_at();

alter table public.courier_locations enable row level security;

drop policy if exists "courier_locations_read_by_scope" on public.courier_locations;
drop policy if exists "courier_locations_manage_own" on public.courier_locations;

create policy "courier_locations_read_by_scope" on public.courier_locations
  for select to authenticated using (
    public.can_manage_city(city_id)
    or courier_id = public.current_profile_courier_id()
    or (
      public.current_profile_role() = 'store_admin'
      and city_id = public.current_profile_city_id()
    )
  );

create policy "courier_locations_manage_own" on public.courier_locations
  for all to authenticated using (
    courier_id = public.current_profile_courier_id()
    and city_id = public.current_profile_city_id()
  ) with check (
    courier_id = public.current_profile_courier_id()
    and city_id = public.current_profile_city_id()
  );
