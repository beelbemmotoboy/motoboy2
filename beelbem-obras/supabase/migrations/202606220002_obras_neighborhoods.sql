create table if not exists public.obras_neighborhoods (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete cascade,
  cidade_id text not null,
  nome text not null,
  slug text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists obras_neighborhoods_account_city_slug_uidx
  on public.obras_neighborhoods (account_id, cidade_id, slug);

create index if not exists obras_neighborhoods_account_city_idx
  on public.obras_neighborhoods (account_id, cidade_id);

drop trigger if exists set_obras_neighborhoods_updated_at on public.obras_neighborhoods;
create trigger set_obras_neighborhoods_updated_at
  before update on public.obras_neighborhoods
  for each row execute function public.set_obras_updated_at();

alter table public.obras_neighborhoods enable row level security;

drop policy if exists "neighborhoods select account" on public.obras_neighborhoods;
create policy "neighborhoods select account"
  on public.obras_neighborhoods
  for select
  using (account_id = public.obras_current_account_id());

drop policy if exists "neighborhoods insert account" on public.obras_neighborhoods;
create policy "neighborhoods insert account"
  on public.obras_neighborhoods
  for insert
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

drop policy if exists "neighborhoods update account" on public.obras_neighborhoods;
create policy "neighborhoods update account"
  on public.obras_neighborhoods
  for update
  using (account_id = public.obras_current_account_id() and public.obras_can_write())
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

grant select, insert, update on public.obras_neighborhoods to authenticated;
