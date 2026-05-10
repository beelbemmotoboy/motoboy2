-- Beelbem Motoboy - Supabase schema
-- Run this file in a fresh Supabase project SQL editor.
-- Security model:
-- system_admin: sees and manages everything.
-- city_admin: sees and manages records from its city only.
-- store_admin: sees its own store and creates/views deliveries for that store.
-- courier_admin: sees its own courier profile, own deliveries, and active stores in its city.

create extension if not exists pgcrypto;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  slug text not null unique,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  name text not null,
  fantasy_name text,
  document text,
  responsible_name text,
  email text,
  store_type text,
  whatsapp text,
  landline text,
  address text,
  address_number text,
  complement text,
  district text,
  zip_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  logo_url text,
  is_open boolean not null default true,
  location_received text,
  opening_hours jsonb not null default '{}'::jsonb,
  allow_manual_order boolean not null default true,
  require_pickup_confirmation boolean not null default true,
  rate_courier_after_delivery boolean not null default true,
  internal_notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  name text not null,
  birth_date date,
  cpf text,
  email text,
  phone text,
  face_photo_path text,
  whatsapp_validated boolean not null default false,
  whatsapp_validated_at timestamptz,
  vehicle_type text not null default 'Moto',
  vehicle_plate text,
  pix_key text,
  pix_key_type text,
  pix_holder_name text,
  vehicle_notes text,
  crlv_file_path text,
  cnh_file_path text,
  cnh_valid_until date,
  approval_status text not null default 'pending_approval',
  rating numeric(2,1) not null default 5.0,
  active boolean not null default true,
  available boolean not null default true,
  availability_status text not null default 'offline',
  internal_notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couriers_vehicle_type_check check (vehicle_type = 'Moto'),
  constraint couriers_approval_status_check check (
    approval_status in ('pending_approval', 'approved', 'rejected', 'blocked')
  ),
  constraint couriers_availability_status_check check (
    availability_status in ('offline', 'available', 'on_delivery', 'paused')
  )
);

create table if not exists public.courier_points (
  id uuid not null default gen_random_uuid(),
  courier_id uuid primary key references public.couriers(id) on delete cascade,
  total_points integer not null default 0,
  updated_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courier_points_total_points_check check (total_points >= 0)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  city_id uuid references public.cities(id),
  store_id uuid references public.stores(id),
  courier_id uuid references public.couriers(id),
  name text not null,
  email text,
  cpf text,
  whatsapp text,
  address_proof_path text,
  role text not null default 'city_admin',
  active boolean not null default true,
  password_set_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (
    role in ('system_admin', 'city_admin', 'store_admin', 'courier_admin')
  ),
  constraint profiles_scope_check check (
    (role = 'system_admin' and city_id is null and store_id is null and courier_id is null)
    or (role = 'city_admin' and city_id is not null and store_id is null and courier_id is null)
    or (role = 'store_admin' and city_id is not null and store_id is not null and courier_id is null)
    or (role = 'courier_admin' and city_id is not null and store_id is null and courier_id is not null)
  )
);

create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  cpf text,
  whatsapp text,
  address_proof_path text,
  role text not null,
  city_id uuid references public.cities(id),
  store_id uuid references public.stores(id),
  courier_id uuid references public.couriers(id),
  status text not null default 'pending',
  user_active boolean not null default true,
  password_setup_sent_at timestamptz,
  password_setup_expires_at timestamptz,
  password_setup_token text,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_invites_role_check check (
    role in ('system_admin', 'city_admin', 'store_admin', 'courier_admin')
  ),
  constraint access_invites_status_check check (
    status in ('pending', 'sent', 'accepted', 'expired', 'cancelled')
  ),
  constraint access_invites_scope_check check (
    (role = 'system_admin' and city_id is null and store_id is null and courier_id is null)
    or (role = 'city_admin' and city_id is not null and store_id is null and courier_id is null)
    or (role = 'store_admin' and city_id is not null and store_id is not null and courier_id is null)
    or (role = 'courier_admin' and city_id is not null and store_id is null and courier_id is not null)
  )
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  name text not null,
  phone text,
  address text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  order_code text not null,
  store_id uuid not null references public.stores(id),
  customer_id uuid references public.customers(id),
  courier_id uuid references public.couriers(id),
  pickup_address text,
  delivery_address text not null,
  status text not null default 'pending',
  distance_km numeric(6,2),
  estimated_minutes integer,
  delivery_fee numeric(10,2) not null default 0,
  delivered_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, order_code),
  constraint deliveries_status_check check (
    status in ('pending', 'assigned', 'picked_up', 'on_route', 'delivered', 'cancelled')
  )
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id uuid not null default gen_random_uuid(),
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cities add column if not exists created_by uuid references auth.users(id);
alter table public.cities add column if not exists updated_by uuid references auth.users(id);
alter table public.stores add column if not exists created_by uuid references auth.users(id);
alter table public.stores add column if not exists updated_by uuid references auth.users(id);
alter table public.stores add column if not exists logo_url text;
alter table public.stores add column if not exists is_open boolean not null default true;
alter table public.couriers add column if not exists created_by uuid references auth.users(id);
alter table public.couriers add column if not exists updated_by uuid references auth.users(id);
alter table public.couriers add column if not exists crlv_file_path text;
alter table public.courier_points add column if not exists id uuid not null default gen_random_uuid();
alter table public.courier_points add column if not exists created_by uuid references auth.users(id);
alter table public.courier_points add column if not exists updated_by uuid references auth.users(id);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists created_by uuid references auth.users(id);
alter table public.profiles add column if not exists updated_by uuid references auth.users(id);
alter table public.access_invites add column if not exists created_by uuid references auth.users(id);
alter table public.access_invites add column if not exists updated_by uuid references auth.users(id);
alter table public.customers add column if not exists created_by uuid references auth.users(id);
alter table public.customers add column if not exists updated_by uuid references auth.users(id);
alter table public.deliveries add column if not exists created_by uuid references auth.users(id);
alter table public.deliveries add column if not exists updated_by uuid references auth.users(id);
alter table public.delivery_events add column if not exists created_by uuid references auth.users(id);
alter table public.system_settings add column if not exists id uuid not null default gen_random_uuid();
alter table public.system_settings add column if not exists created_by uuid references auth.users(id);
alter table public.system_settings add column if not exists updated_by uuid references auth.users(id);

update public.profiles profile
set email = auth_user.email
from auth.users auth_user
where profile.id = auth_user.id
  and (profile.email is null or profile.email <> auth_user.email);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  actor_id uuid references auth.users(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cities_slug_idx on public.cities(slug);
create index if not exists stores_city_id_idx on public.stores(city_id);
create index if not exists couriers_city_id_idx on public.couriers(city_id);
create index if not exists courier_points_total_points_idx on public.courier_points(total_points);
create index if not exists profiles_city_id_idx on public.profiles(city_id);
create index if not exists profiles_store_id_idx on public.profiles(store_id);
create index if not exists profiles_courier_id_idx on public.profiles(courier_id);
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists access_invites_city_id_idx on public.access_invites(city_id);
create index if not exists access_invites_email_idx on public.access_invites(email);
create index if not exists customers_city_id_idx on public.customers(city_id);
create index if not exists deliveries_city_id_idx on public.deliveries(city_id);
create index if not exists deliveries_store_id_idx on public.deliveries(store_id);
create index if not exists deliveries_courier_id_idx on public.deliveries(courier_id);
create index if not exists delivery_events_city_id_idx on public.delivery_events(city_id);
create index if not exists delivery_events_delivery_id_idx on public.delivery_events(delivery_id);
create index if not exists audit_logs_table_record_idx on public.audit_logs(table_name, record_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by = auth.uid();
  return new;
end;
$$;

create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by = coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_uuid uuid;
begin
  if tg_op = 'INSERT' then
    record_uuid = new.id;
    insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
    values (tg_table_name, record_uuid, tg_op, auth.uid(), null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    record_uuid = new.id;
    insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
    values (tg_table_name, record_uuid, tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    record_uuid = old.id;
    insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data)
    values (tg_table_name, record_uuid, tg_op, auth.uid(), to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists set_cities_updated_at on public.cities;
create trigger set_cities_updated_at before insert or update on public.cities
for each row execute function public.set_updated_at();

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at before insert or update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists set_couriers_updated_at on public.couriers;
create trigger set_couriers_updated_at before insert or update on public.couriers
for each row execute function public.set_updated_at();

drop trigger if exists set_courier_points_updated_at on public.courier_points;
create trigger set_courier_points_updated_at before insert or update on public.courier_points
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before insert or update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_access_invites_updated_at on public.access_invites;
create trigger set_access_invites_updated_at before insert or update on public.access_invites
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before insert or update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_deliveries_updated_at on public.deliveries;
create trigger set_deliveries_updated_at before insert or update on public.deliveries
for each row execute function public.set_updated_at();

drop trigger if exists set_delivery_events_created_by on public.delivery_events;
create trigger set_delivery_events_created_by before insert on public.delivery_events
for each row execute function public.set_created_by();

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at before insert or update on public.system_settings
for each row execute function public.set_updated_at();

drop trigger if exists audit_cities on public.cities;
create trigger audit_cities after insert or update or delete on public.cities
for each row execute function public.write_audit_log();

drop trigger if exists audit_stores on public.stores;
create trigger audit_stores after insert or update or delete on public.stores
for each row execute function public.write_audit_log();

drop trigger if exists audit_couriers on public.couriers;
create trigger audit_couriers after insert or update or delete on public.couriers
for each row execute function public.write_audit_log();

drop trigger if exists audit_courier_points on public.courier_points;
create trigger audit_courier_points after insert or update or delete on public.courier_points
for each row execute function public.write_audit_log();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after insert or update or delete on public.profiles
for each row execute function public.write_audit_log();

drop trigger if exists audit_access_invites on public.access_invites;
create trigger audit_access_invites after insert or update or delete on public.access_invites
for each row execute function public.write_audit_log();

drop trigger if exists audit_customers on public.customers;
create trigger audit_customers after insert or update or delete on public.customers
for each row execute function public.write_audit_log();

drop trigger if exists audit_deliveries on public.deliveries;
create trigger audit_deliveries after insert or update or delete on public.deliveries
for each row execute function public.write_audit_log();

drop trigger if exists audit_delivery_events on public.delivery_events;
create trigger audit_delivery_events after insert or update or delete on public.delivery_events
for each row execute function public.write_audit_log();

drop trigger if exists audit_system_settings on public.system_settings;
create trigger audit_system_settings after insert or update or delete on public.system_settings
for each row execute function public.write_audit_log();

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_profile_city_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select city_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_profile_store_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select store_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_profile_courier_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select courier_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'system_admin';
$$;

create or replace function public.is_city_admin(target_city_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'city_admin'
    and public.current_profile_city_id() = target_city_id;
$$;

create or replace function public.can_manage_city(target_city_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_system_admin() or public.is_city_admin(target_city_id);
$$;

alter table public.cities enable row level security;
alter table public.stores enable row level security;
alter table public.couriers enable row level security;
alter table public.courier_points enable row level security;
alter table public.profiles enable row level security;
alter table public.access_invites enable row level security;
alter table public.customers enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

drop policy if exists "cities_read_by_authenticated" on public.cities;
drop policy if exists "cities_manage_by_system_admin" on public.cities;
drop policy if exists "stores_read_by_scope" on public.stores;
drop policy if exists "stores_manage_by_system_or_city_admin" on public.stores;
drop policy if exists "stores_update_own_store_by_store_admin" on public.stores;
drop policy if exists "couriers_read_by_scope" on public.couriers;
drop policy if exists "couriers_manage_by_system_or_city_admin" on public.couriers;
drop policy if exists "courier_points_read_by_scope" on public.courier_points;
drop policy if exists "courier_points_manage_by_system_or_city_admin" on public.courier_points;
drop policy if exists "profiles_read_by_scope" on public.profiles;
drop policy if exists "profiles_manage_by_system_or_city_admin" on public.profiles;
drop policy if exists "access_invites_read_by_scope" on public.access_invites;
drop policy if exists "access_invites_manage_by_system_or_city_admin" on public.access_invites;
drop policy if exists "customers_read_by_scope" on public.customers;
drop policy if exists "customers_manage_by_scope" on public.customers;
drop policy if exists "deliveries_read_by_scope" on public.deliveries;
drop policy if exists "deliveries_insert_by_scope" on public.deliveries;
drop policy if exists "deliveries_update_by_scope" on public.deliveries;
drop policy if exists "delivery_events_read_by_scope" on public.delivery_events;
drop policy if exists "delivery_events_insert_by_scope" on public.delivery_events;
drop policy if exists "audit_logs_read_by_system_or_city_admin" on public.audit_logs;
drop policy if exists "system_settings_read_by_authenticated" on public.system_settings;
drop policy if exists "system_settings_manage_by_system_admin" on public.system_settings;

create policy "cities_read_by_authenticated" on public.cities
  for select to authenticated using (
    active = true or public.is_system_admin()
  );

create policy "cities_manage_by_system_admin" on public.cities
  for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

create policy "stores_read_by_scope" on public.stores
  for select to authenticated using (
    public.can_manage_city(city_id)
    or id = public.current_profile_store_id()
    or (
      public.current_profile_role() = 'courier_admin'
      and city_id = public.current_profile_city_id()
      and active = true
    )
  );

create policy "stores_manage_by_system_or_city_admin" on public.stores
  for all to authenticated using (public.can_manage_city(city_id)) with check (public.can_manage_city(city_id));

create policy "stores_update_own_store_by_store_admin" on public.stores
  for update to authenticated using (
    public.current_profile_role() = 'store_admin'
    and id = public.current_profile_store_id()
    and city_id = public.current_profile_city_id()
  ) with check (
    public.current_profile_role() = 'store_admin'
    and id = public.current_profile_store_id()
    and city_id = public.current_profile_city_id()
  );

create policy "couriers_read_by_scope" on public.couriers
  for select to authenticated using (
    public.can_manage_city(city_id)
    or id = public.current_profile_courier_id()
  );

create policy "couriers_manage_by_system_or_city_admin" on public.couriers
  for all to authenticated using (public.can_manage_city(city_id)) with check (public.can_manage_city(city_id));

create policy "courier_points_read_by_scope" on public.courier_points
  for select to authenticated using (
    public.is_system_admin()
    or courier_id = public.current_profile_courier_id()
    or exists (
      select 1 from public.couriers c
      where c.id = courier_points.courier_id
      and public.is_city_admin(c.city_id)
    )
  );

create policy "courier_points_manage_by_system_or_city_admin" on public.courier_points
  for all to authenticated using (
    public.is_system_admin()
    or exists (
      select 1 from public.couriers c
      where c.id = courier_points.courier_id
      and public.is_city_admin(c.city_id)
    )
  ) with check (
    public.is_system_admin()
    or exists (
      select 1 from public.couriers c
      where c.id = courier_points.courier_id
      and public.is_city_admin(c.city_id)
    )
  );

create policy "profiles_read_by_scope" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and city_id = public.current_profile_city_id()
    )
  );

create policy "profiles_manage_by_system_or_city_admin" on public.profiles
  for all to authenticated using (
    public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and city_id = public.current_profile_city_id()
      and role <> 'system_admin'
    )
  ) with check (
    public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and city_id = public.current_profile_city_id()
      and role <> 'system_admin'
    )
  );

create policy "access_invites_read_by_scope" on public.access_invites
  for select to authenticated using (
    public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and city_id = public.current_profile_city_id()
    )
  );

create policy "access_invites_manage_by_system_or_city_admin" on public.access_invites
  for all to authenticated using (
    public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and city_id = public.current_profile_city_id()
      and role <> 'system_admin'
    )
  ) with check (
    public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and city_id = public.current_profile_city_id()
      and role <> 'system_admin'
    )
  );

create policy "customers_read_by_scope" on public.customers
  for select to authenticated using (
    public.can_manage_city(city_id)
    or exists (
      select 1 from public.deliveries d
      where d.customer_id = customers.id
      and d.store_id = public.current_profile_store_id()
    )
  );

create policy "customers_manage_by_scope" on public.customers
  for all to authenticated using (
    public.can_manage_city(city_id)
    or (
      public.current_profile_role() = 'store_admin'
      and city_id = public.current_profile_city_id()
    )
  ) with check (
    public.can_manage_city(city_id)
    or (
      public.current_profile_role() = 'store_admin'
      and city_id = public.current_profile_city_id()
    )
  );

create policy "deliveries_read_by_scope" on public.deliveries
  for select to authenticated using (
    public.can_manage_city(city_id)
    or store_id = public.current_profile_store_id()
    or courier_id = public.current_profile_courier_id()
  );

create policy "deliveries_insert_by_scope" on public.deliveries
  for insert to authenticated with check (
    public.can_manage_city(city_id)
    or (
      public.current_profile_role() = 'store_admin'
      and store_id = public.current_profile_store_id()
      and city_id = public.current_profile_city_id()
    )
  );

create policy "deliveries_update_by_scope" on public.deliveries
  for update to authenticated using (
    public.can_manage_city(city_id)
    or store_id = public.current_profile_store_id()
    or courier_id = public.current_profile_courier_id()
  ) with check (
    public.can_manage_city(city_id)
    or store_id = public.current_profile_store_id()
    or courier_id = public.current_profile_courier_id()
  );

create policy "delivery_events_read_by_scope" on public.delivery_events
  for select to authenticated using (
    public.can_manage_city(city_id)
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_events.delivery_id
      and (
        d.store_id = public.current_profile_store_id()
        or d.courier_id = public.current_profile_courier_id()
      )
    )
  );

create policy "delivery_events_insert_by_scope" on public.delivery_events
  for insert to authenticated with check (
    public.can_manage_city(city_id)
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_events.delivery_id
      and (
        d.store_id = public.current_profile_store_id()
        or d.courier_id = public.current_profile_courier_id()
      )
    )
  );

create policy "audit_logs_read_by_system_or_city_admin" on public.audit_logs
  for select to authenticated using (
    public.is_system_admin()
    or (
      public.current_profile_role() = 'city_admin'
      and coalesce(
        new_data ->> 'city_id',
        old_data ->> 'city_id',
        case when table_name = 'cities' then record_id::text end
      ) = public.current_profile_city_id()::text
    )
  );

create policy "system_settings_read_by_authenticated" on public.system_settings
  for select to authenticated using (true);

create policy "system_settings_manage_by_system_admin" on public.system_settings
  for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

insert into public.system_settings (key, value)
values ('delivery_accept_timeout', jsonb_build_object('seconds', 25))
on conflict (key) do nothing;

insert into public.courier_points (courier_id, total_points)
select id, 0
from public.couriers
on conflict (courier_id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'user-documents',
    'user-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'courier-documents',
    'courier-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_select_by_authenticated_scope" on storage.objects;
drop policy if exists "documents_insert_by_authenticated" on storage.objects;
drop policy if exists "documents_update_by_system_or_city_admin" on storage.objects;
drop policy if exists "documents_delete_by_system_admin" on storage.objects;

create policy "documents_select_by_authenticated_scope" on storage.objects
  for select to authenticated using (
    bucket_id in ('user-documents', 'courier-documents')
    and (
      owner = auth.uid()
      or public.is_system_admin()
      or public.current_profile_role() = 'city_admin'
    )
  );

create policy "documents_insert_by_authenticated" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('user-documents', 'courier-documents')
    and owner = auth.uid()
  );

create policy "documents_update_by_system_or_city_admin" on storage.objects
  for update to authenticated using (
    bucket_id in ('user-documents', 'courier-documents')
    and (
      owner = auth.uid()
      or public.is_system_admin()
      or public.current_profile_role() = 'city_admin'
    )
  ) with check (
    bucket_id in ('user-documents', 'courier-documents')
    and (
      owner = auth.uid()
      or public.is_system_admin()
      or public.current_profile_role() = 'city_admin'
    )
  );

create policy "documents_delete_by_system_admin" on storage.objects
  for delete to authenticated using (
    bucket_id in ('user-documents', 'courier-documents')
    and public.is_system_admin()
  );
