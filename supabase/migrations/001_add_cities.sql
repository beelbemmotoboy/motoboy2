create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cities (name, state, slug)
values
  ('Goiania', 'GO', 'goiania-go'),
  ('Aparecida de Goiania', 'GO', 'aparecida-de-goiania-go'),
  ('Anapolis', 'GO', 'anapolis-go')
on conflict (slug) do nothing;

alter table public.profiles add column if not exists city_id uuid references public.cities(id);
alter table public.profiles add column if not exists store_id uuid references public.stores(id);
alter table public.profiles add column if not exists courier_id uuid references public.couriers(id);
alter table public.stores add column if not exists city_id uuid references public.cities(id);
alter table public.customers add column if not exists city_id uuid references public.cities(id);
alter table public.couriers add column if not exists city_id uuid references public.cities(id);
alter table public.deliveries add column if not exists city_id uuid references public.cities(id);
alter table public.delivery_events add column if not exists city_id uuid references public.cities(id);

update public.stores
set city_id = (select id from public.cities where slug = 'goiania-go')
where city_id is null;

update public.customers
set city_id = (select id from public.cities where slug = 'goiania-go')
where city_id is null;

update public.couriers
set city_id = (select id from public.cities where slug = 'goiania-go')
where city_id is null;

update public.deliveries
set city_id = (select id from public.cities where slug = 'goiania-go')
where city_id is null;

update public.delivery_events
set city_id = (select id from public.cities where slug = 'goiania-go')
where city_id is null;

alter table public.stores alter column city_id set not null;
alter table public.customers alter column city_id set not null;
alter table public.couriers alter column city_id set not null;
alter table public.deliveries alter column city_id set not null;
alter table public.delivery_events alter column city_id set not null;

create index if not exists stores_city_id_idx on public.stores(city_id);
create index if not exists customers_city_id_idx on public.customers(city_id);
create index if not exists couriers_city_id_idx on public.couriers(city_id);
create index if not exists deliveries_city_id_idx on public.deliveries(city_id);
create index if not exists delivery_events_city_id_idx on public.delivery_events(city_id);

alter table public.cities enable row level security;

drop policy if exists "Authenticated users can read cities" on public.cities;
drop policy if exists "Authenticated users can manage cities" on public.cities;

create policy "Authenticated users can read cities" on public.cities
  for select to authenticated using (true);

create policy "Authenticated users can manage cities" on public.cities
  for all to authenticated using (true) with check (true);
