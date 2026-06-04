create table if not exists public.obras_accounts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  cidade_id text not null,
  cidade text not null,
  plano text not null default 'basico',
  status text not null default 'Ativa',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_accounts_status_check check (status in ('Ativa', 'Suspensa', 'Cancelada'))
);

create table if not exists public.obras_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  account_id uuid not null references public.obras_accounts(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  cidade_id text not null,
  cidade text not null,
  role text not null default 'operador',
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_users_role_check check (role in ('owner', 'admin', 'engenheiro', 'operador', 'viewer'))
);

comment on table public.obras_accounts is 'Contas comerciais do sistema Obras, separadas dos cadastros do Motoboy.';
comment on table public.obras_users is 'Usuarios do sistema Obras vinculados a uma conta comercial.';

create index if not exists obras_accounts_cidade_id_idx on public.obras_accounts(cidade_id);
create index if not exists obras_accounts_created_by_idx on public.obras_accounts(created_by);
create index if not exists obras_users_account_id_idx on public.obras_users(account_id);
create index if not exists obras_users_auth_user_id_idx on public.obras_users(auth_user_id);
create unique index if not exists obras_users_account_email_idx on public.obras_users(account_id, lower(email));

create or replace function public.set_obras_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_obras_accounts_updated_at on public.obras_accounts;
create trigger set_obras_accounts_updated_at
before update on public.obras_accounts
for each row execute function public.set_obras_updated_at();

drop trigger if exists set_obras_users_updated_at on public.obras_users;
create trigger set_obras_users_updated_at
before update on public.obras_users
for each row execute function public.set_obras_updated_at();

with owner_projects as (
  select
    project.owner_id,
    coalesce(min(project.cidade_id), 'sem-cidade') as cidade_id,
    coalesce(min(project.cidade), 'Sem cidade') as cidade,
    coalesce(max(auth_user.email), 'Conta Obras') as email
  from public.obras_projects project
  left join auth.users auth_user on auth_user.id = project.owner_id
  where project.owner_id is not null
  group by project.owner_id
),
missing_owners as (
  select owner_projects.*
  from owner_projects
  where not exists (
    select 1
    from public.obras_users obras_user
    where obras_user.auth_user_id = owner_projects.owner_id
  )
),
inserted_accounts as (
  insert into public.obras_accounts (nome, cidade_id, cidade, created_by)
  select email, cidade_id, cidade, owner_id
  from missing_owners
  returning id, created_by, created_at
),
account_map as (
  select distinct on (created_by) created_by, id
  from (
    select inserted_accounts.created_by, inserted_accounts.id, inserted_accounts.created_at
    from inserted_accounts
    union all
    select account.created_by, account.id, account.created_at
    from public.obras_accounts account
    join missing_owners on missing_owners.owner_id = account.created_by
  ) accounts
  order by created_by, created_at desc
)
insert into public.obras_users (auth_user_id, account_id, nome, email, cidade_id, cidade, role, active)
select
  missing_owners.owner_id,
  account_map.id,
  missing_owners.email,
  missing_owners.email,
  missing_owners.cidade_id,
  missing_owners.cidade,
  'owner',
  true
from missing_owners
join account_map on account_map.created_by = missing_owners.owner_id
where account_map.id is not null
on conflict (auth_user_id) do nothing;

create or replace function public.obras_current_account_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select obras_user.account_id
  from public.obras_users obras_user
  where obras_user.auth_user_id = auth.uid()
    and obras_user.active = true
  limit 1;
$$;

create or replace function public.obras_current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select obras_user.role
  from public.obras_users obras_user
  where obras_user.auth_user_id = auth.uid()
    and obras_user.active = true
  limit 1;
$$;

create or replace function public.obras_can_write()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.obras_current_role() in ('owner', 'admin', 'engenheiro', 'operador'), false);
$$;

create or replace function public.obras_can_manage_users()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.obras_current_role() in ('owner', 'admin'), false);
$$;

alter table public.obras_projects
  add column if not exists account_id uuid references public.obras_accounts(id) on delete restrict;

update public.obras_projects project
set account_id = obras_user.account_id
from public.obras_users obras_user
where project.account_id is null
  and obras_user.auth_user_id = project.owner_id;

alter table public.obras_projects
  alter column account_id set default public.obras_current_account_id();

do $$
begin
  if exists (select 1 from public.obras_projects where account_id is null) then
    raise exception 'Existem obras sem conta Obras vinculada. Confira os owners antigos antes de aplicar 033_obras_users.sql.';
  end if;
end $$;

alter table public.obras_projects
  alter column account_id set not null;

create index if not exists obras_projects_account_id_idx on public.obras_projects(account_id);

create or replace function public.obras_can_access_project(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.obras_projects project
    join public.obras_users obras_user on obras_user.account_id = project.account_id
    where project.id = target_project_id
      and obras_user.auth_user_id = auth.uid()
      and obras_user.active = true
  );
$$;

create or replace function public.obras_project_id_from_storage_name(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  project_id_text text;
begin
  project_id_text := split_part(object_name, '/', 2);
  if project_id_text = '' then
    return null;
  end if;
  return project_id_text::uuid;
exception
  when others then
    return null;
end;
$$;

alter table public.obras_accounts enable row level security;
alter table public.obras_users enable row level security;

grant select, insert, update, delete on
  public.obras_accounts,
  public.obras_users
to authenticated;

grant execute on function
  public.obras_current_account_id(),
  public.obras_current_role(),
  public.obras_can_write(),
  public.obras_can_manage_users(),
  public.obras_can_access_project(uuid),
  public.obras_project_id_from_storage_name(text)
to authenticated;

drop policy if exists "obras_accounts_select_own" on public.obras_accounts;
create policy "obras_accounts_select_own" on public.obras_accounts
for select to authenticated
using (id = public.obras_current_account_id());

drop policy if exists "obras_accounts_insert_creator" on public.obras_accounts;
create policy "obras_accounts_insert_creator" on public.obras_accounts
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "obras_accounts_update_admin" on public.obras_accounts;
create policy "obras_accounts_update_admin" on public.obras_accounts
for update to authenticated
using (id = public.obras_current_account_id() and public.obras_can_manage_users())
with check (id = public.obras_current_account_id() and public.obras_can_manage_users());

drop policy if exists "obras_users_select_own_account" on public.obras_users;
create policy "obras_users_select_own_account" on public.obras_users
for select to authenticated
using (account_id = public.obras_current_account_id() or auth_user_id = auth.uid());

drop policy if exists "obras_users_insert_admin" on public.obras_users;
create policy "obras_users_insert_admin" on public.obras_users
for insert to authenticated
with check (account_id = public.obras_current_account_id() and public.obras_can_manage_users());

drop policy if exists "obras_users_update_admin" on public.obras_users;
create policy "obras_users_update_admin" on public.obras_users
for update to authenticated
using (account_id = public.obras_current_account_id() and public.obras_can_manage_users())
with check (account_id = public.obras_current_account_id() and public.obras_can_manage_users());

drop policy if exists "obras_users_delete_admin" on public.obras_users;
create policy "obras_users_delete_admin" on public.obras_users
for delete to authenticated
using (account_id = public.obras_current_account_id() and public.obras_can_manage_users());

drop policy if exists "obras_projects_owner_manage" on public.obras_projects;
drop policy if exists "obras_projects_select_by_account" on public.obras_projects;
drop policy if exists "obras_projects_insert_by_account" on public.obras_projects;
drop policy if exists "obras_projects_update_by_account" on public.obras_projects;
drop policy if exists "obras_projects_delete_by_account_admin" on public.obras_projects;

create policy "obras_projects_select_by_account" on public.obras_projects
for select to authenticated
using (public.obras_can_access_project(id));

create policy "obras_projects_insert_by_account" on public.obras_projects
for insert to authenticated
with check (
  account_id = public.obras_current_account_id()
  and owner_id = auth.uid()
  and public.obras_can_write()
);

create policy "obras_projects_update_by_account" on public.obras_projects
for update to authenticated
using (public.obras_can_access_project(id) and public.obras_can_write())
with check (account_id = public.obras_current_account_id() and public.obras_can_write());

create policy "obras_projects_delete_by_account_admin" on public.obras_projects
for delete to authenticated
using (public.obras_can_access_project(id) and public.obras_can_manage_users());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'obras_stages',
    'obras_photos',
    'obras_pls_items',
    'obras_issues',
    'obras_supplies',
    'obras_tools',
    'obras_checklist'
  ]
  loop
    execute format('drop policy if exists "%s_owner_manage" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_select_by_account" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_insert_by_account" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_update_by_account" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_delete_by_account" on public.%I', table_name, table_name);

    execute format(
      'create policy "%s_select_by_account" on public.%I for select to authenticated using (public.obras_can_access_project(project_id))',
      table_name,
      table_name
    );
    execute format(
      'create policy "%s_insert_by_account" on public.%I for insert to authenticated with check (public.obras_can_access_project(project_id) and public.obras_can_write())',
      table_name,
      table_name
    );
    execute format(
      'create policy "%s_update_by_account" on public.%I for update to authenticated using (public.obras_can_access_project(project_id) and public.obras_can_write()) with check (public.obras_can_access_project(project_id) and public.obras_can_write())',
      table_name,
      table_name
    );
    execute format(
      'create policy "%s_delete_by_account" on public.%I for delete to authenticated using (public.obras_can_access_project(project_id) and public.obras_can_write())',
      table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists "obras_photos_storage_select" on storage.objects;
create policy "obras_photos_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'obras-photos'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
);

drop policy if exists "obras_photos_storage_insert" on storage.objects;
create policy "obras_photos_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);

drop policy if exists "obras_photos_storage_update" on storage.objects;
create policy "obras_photos_storage_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'obras-photos'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
)
with check (
  bucket_id = 'obras-photos'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);

drop policy if exists "obras_photos_storage_delete" on storage.objects;
create policy "obras_photos_storage_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-photos'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);
