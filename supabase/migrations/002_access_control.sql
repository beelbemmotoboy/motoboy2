alter table public.profiles add column if not exists city_id uuid references public.cities(id);
alter table public.profiles add column if not exists store_id uuid references public.stores(id);
alter table public.profiles add column if not exists courier_id uuid references public.couriers(id);
alter table public.profiles alter column role set default 'city_admin';

create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text not null,
  city_id uuid references public.cities(id),
  store_id uuid references public.stores(id),
  courier_id uuid references public.couriers(id),
  status text not null default 'pending',
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

create index if not exists access_invites_email_idx on public.access_invites(email);
create index if not exists access_invites_city_id_idx on public.access_invites(city_id);
create index if not exists access_invites_store_id_idx on public.access_invites(store_id);
create index if not exists access_invites_courier_id_idx on public.access_invites(courier_id);

alter table public.access_invites enable row level security;

drop policy if exists "Authenticated users can manage access invites" on public.access_invites;

create policy "Authenticated users can manage access invites" on public.access_invites
  for all to authenticated using (true) with check (true);
