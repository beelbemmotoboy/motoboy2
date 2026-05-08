-- Beelbem Motoboy - public signup policies
-- Run this file in Supabase SQL Editor.
-- Purpose:
-- 1. Allow public visitors to see only active cities in the signup form.
-- 2. Allow public visitors to create pending/inactive store and courier pre-registrations.
-- 3. Keep public visitors unable to read stores/couriers or create active users.

grant usage on schema public to anon;
grant select on public.cities to anon;
grant insert on public.stores to anon;
grant insert on public.couriers to anon;

alter table public.cities enable row level security;
alter table public.stores enable row level security;
alter table public.couriers enable row level security;

drop policy if exists "cities_public_read_active" on public.cities;
create policy "cities_public_read_active" on public.cities
  for select to anon
  using (active = true);

drop policy if exists "stores_public_insert_pending" on public.stores;
create policy "stores_public_insert_pending" on public.stores
  for insert to anon
  with check (
    active = false
    and city_id is not null
    and nullif(trim(name), '') is not null
    and nullif(trim(document), '') is not null
    and nullif(trim(responsible_name), '') is not null
    and nullif(trim(email), '') is not null
    and nullif(trim(whatsapp), '') is not null
    and exists (
      select 1
      from public.cities c
      where c.id = city_id
        and c.active = true
    )
  );

drop policy if exists "couriers_public_insert_pending" on public.couriers;
create policy "couriers_public_insert_pending" on public.couriers
  for insert to anon
  with check (
    active = false
    and available = false
    and vehicle_type = 'Moto'
    and approval_status = 'pending_approval'
    and availability_status = 'offline'
    and city_id is not null
    and nullif(trim(name), '') is not null
    and nullif(trim(cpf), '') is not null
    and nullif(trim(email), '') is not null
    and nullif(trim(phone), '') is not null
    and exists (
      select 1
      from public.cities c
      where c.id = city_id
        and c.active = true
    )
  );
