create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
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
  location_received text,
  opening_hours jsonb not null default '{}'::jsonb,
  allow_manual_order boolean not null default true,
  require_pickup_confirmation boolean not null default true,
  rate_courier_after_delivery boolean not null default true,
  internal_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
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
  vehicle_type text,
  vehicle_plate text,
  pix_key text,
  pix_key_type text,
  pix_holder_name text,
  vehicle_notes text,
  cnh_file_path text,
  cnh_valid_until date,
  approval_status text not null default 'pending_approval',
  rating numeric(2,1) not null default 5.0,
  active boolean not null default true,
  available boolean not null default true,
  availability_status text not null default 'offline',
  internal_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  city_id uuid references public.cities(id),
  store_id uuid references public.stores(id),
  courier_id uuid references public.couriers(id),
  name text not null,
  cpf text,
  whatsapp text,
  address_proof_path text,
  role text not null default 'city_admin',
  active boolean not null default true,
  password_set_at timestamptz,
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now(),
  constraint access_invites_role_check check (
    role in ('system_admin', 'city_admin', 'store_admin', 'courier_admin')
  ),
  constraint access_invites_scope_check check (
    (role = 'system_admin' and city_id is null and store_id is null and courier_id is null)
    or (role = 'city_admin' and city_id is not null and store_id is null and courier_id is null)
    or (role = 'store_admin' and city_id is not null and store_id is not null and courier_id is null)
    or (role = 'courier_admin' and city_id is not null and store_id is null and courier_id is not null)
  )
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  order_code text not null,
  store_id uuid references public.stores(id),
  customer_id uuid references public.customers(id),
  courier_id uuid references public.couriers(id),
  pickup_address text,
  delivery_address text not null,
  status text not null default 'em_andamento',
  distance_km numeric(6,2),
  estimated_minutes integer,
  delivery_fee numeric(10,2) not null default 0,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (city_id, order_code)
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists stores_city_id_idx on public.stores(city_id);
create index if not exists customers_city_id_idx on public.customers(city_id);
create index if not exists couriers_city_id_idx on public.couriers(city_id);
create index if not exists profiles_city_id_idx on public.profiles(city_id);
create index if not exists access_invites_city_id_idx on public.access_invites(city_id);
create index if not exists deliveries_city_id_idx on public.deliveries(city_id);
create index if not exists delivery_events_city_id_idx on public.delivery_events(city_id);

alter table public.cities enable row level security;
alter table public.stores enable row level security;
alter table public.customers enable row level security;
alter table public.couriers enable row level security;
alter table public.profiles enable row level security;
alter table public.access_invites enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;

drop policy if exists "Authenticated users can read cities" on public.cities;
drop policy if exists "Authenticated users can manage cities" on public.cities;
drop policy if exists "Authenticated users can manage stores" on public.stores;
drop policy if exists "Authenticated users can manage customers" on public.customers;
drop policy if exists "Authenticated users can manage couriers" on public.couriers;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Authenticated users can manage access invites" on public.access_invites;
drop policy if exists "Authenticated users can manage deliveries" on public.deliveries;
drop policy if exists "Authenticated users can manage delivery events" on public.delivery_events;

create policy "Authenticated users can read cities" on public.cities
  for select to authenticated using (true);

create policy "Authenticated users can manage cities" on public.cities
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage stores" on public.stores
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage customers" on public.customers
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage couriers" on public.couriers
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can read profiles" on public.profiles
  for select to authenticated using (true);

create policy "Authenticated users can manage access invites" on public.access_invites
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage deliveries" on public.deliveries
  for all to authenticated using (true) with check (true);

create policy "Authenticated users can manage delivery events" on public.delivery_events
  for all to authenticated using (true) with check (true);

insert into public.cities (name, state, slug)
values
  ('Goiania', 'GO', 'goiania-go'),
  ('Aparecida de Goiania', 'GO', 'aparecida-de-goiania-go'),
  ('Anapolis', 'GO', 'anapolis-go')
on conflict (slug) do nothing;
