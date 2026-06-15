create extension if not exists pgcrypto;

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
  auth_user_id uuid unique references auth.users(id) on delete set null,
  account_id uuid not null references public.obras_accounts(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  cidade_id text not null,
  cidade text not null,
  role text not null default 'operador',
  active boolean not null default true,
  login_enabled boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_users_role_check check (role in ('owner', 'admin', 'engenheiro', 'operador', 'viewer'))
);

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
    and obras_user.login_enabled = true
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
    and obras_user.login_enabled = true
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

create table if not exists public.obras_projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete restrict,
  owner_id uuid default auth.uid() references auth.users(id) on delete set null,
  nome text not null,
  cliente text not null,
  endereco text not null,
  cidade_id text not null,
  bairro_id text not null,
  cidade text not null,
  bairro text not null,
  percentual integer not null default 0,
  status text not null default 'Nao iniciada',
  proxima_etapa text not null default 'Servicos preliminares',
  pls_status text not null default 'Pendente',
  pendencias integer not null default 0,
  atraso integer not null default 0,
  area_construida text,
  area_terreno text,
  pavimentos text,
  responsavel text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_projects_percentual_check check (percentual between 0 and 100),
  constraint obras_projects_pendencias_check check (pendencias >= 0),
  constraint obras_projects_atraso_check check (atraso >= 0)
);

create table if not exists public.obras_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  nome text not null,
  percentual integer not null default 0,
  status text not null default 'Nao iniciado',
  inicio text,
  fim text,
  pendencias integer not null default 0,
  fotos_faltando integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_stages_percentual_check check (percentual between 0 and 100),
  constraint obras_stages_pendencias_check check (pendencias >= 0),
  constraint obras_stages_fotos_faltando_check check (fotos_faltando >= 0)
);

create table if not exists public.obras_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  etapa text not null,
  tipo text not null,
  data_label text not null,
  usuario text,
  observacao text,
  cor text not null default 'blue',
  storage_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obras_pls_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  etapa text not null,
  percentual integer not null default 0,
  fotos text not null default '0/0',
  status text not null default 'Pendente',
  vistoria text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_pls_items_percentual_check check (percentual between 0 and 100)
);

create table if not exists public.obras_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  descricao text not null,
  etapa text not null,
  responsavel text,
  prazo text,
  status text not null default 'Aberta',
  norma text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obras_supplies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  nome text not null,
  etapa text not null,
  unidade text,
  prevista numeric(12,2) not null default 0,
  usada numeric(12,2) not null default 0,
  status text not null default 'Necessario',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_supplies_prevista_check check (prevista >= 0),
  constraint obras_supplies_usada_check check (usada >= 0)
);

create table if not exists public.obras_tools (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  nome text not null,
  etapa text not null,
  tipo text,
  obrigatorio text,
  status text not null default 'Necessario',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obras_checklist (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  descricao text not null,
  etapa text not null,
  norma text,
  foto text,
  responsavel text,
  data_label text,
  status text not null default 'Nao iniciado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists obras_accounts_cidade_id_idx on public.obras_accounts(cidade_id);
create index if not exists obras_users_account_id_idx on public.obras_users(account_id);
create index if not exists obras_users_auth_user_id_idx on public.obras_users(auth_user_id);
create unique index if not exists obras_users_account_email_idx on public.obras_users(account_id, lower(email));
create index if not exists obras_projects_account_id_idx on public.obras_projects(account_id);
create index if not exists obras_projects_owner_id_idx on public.obras_projects(owner_id);
create index if not exists obras_stages_project_id_idx on public.obras_stages(project_id);
create index if not exists obras_photos_project_id_idx on public.obras_photos(project_id);
create unique index if not exists obras_photos_storage_path_idx on public.obras_photos(storage_path) where storage_path is not null;
create index if not exists obras_pls_items_project_id_idx on public.obras_pls_items(project_id);
create index if not exists obras_issues_project_id_idx on public.obras_issues(project_id);
create index if not exists obras_supplies_project_id_idx on public.obras_supplies(project_id);
create index if not exists obras_tools_project_id_idx on public.obras_tools(project_id);
create index if not exists obras_checklist_project_id_idx on public.obras_checklist(project_id);

create or replace function public.set_obras_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'obras_accounts',
    'obras_users',
    'obras_projects',
    'obras_stages',
    'obras_photos',
    'obras_pls_items',
    'obras_issues',
    'obras_supplies',
    'obras_tools',
    'obras_checklist'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_obras_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

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
      and obras_user.login_enabled = true
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

create or replace function public.obras_claim_user()
returns public.obras_users
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  claimed_user public.obras_users;
begin
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null or current_email = '' then
    return null;
  end if;

  update public.obras_users
  set
    auth_user_id = auth.uid(),
    updated_at = now()
  where id = (
    select candidate.id
    from public.obras_users candidate
    where candidate.auth_user_id is null
      and candidate.active = true
      and candidate.login_enabled = true
      and lower(candidate.email) = current_email
    order by candidate.created_at asc
    limit 1
  )
  returning * into claimed_user;

  if claimed_user.id is not null then
    return claimed_user;
  end if;

  select *
  into claimed_user
  from public.obras_users obras_user
  where obras_user.auth_user_id = auth.uid()
    and obras_user.active = true
    and obras_user.login_enabled = true
  order by obras_user.created_at asc
  limit 1;

  return claimed_user;
end;
$$;

create or replace function public.obras_bootstrap_owner(
  p_nome text,
  p_cidade_id text,
  p_cidade text
)
returns public.obras_users
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  account_row public.obras_accounts;
  user_row public.obras_users;
begin
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null or current_email = '' then
    raise exception 'Autenticacao obrigatoria.';
  end if;

  select *
  into user_row
  from public.obras_users
  where auth_user_id = auth.uid()
  limit 1;

  if user_row.id is not null then
    return user_row;
  end if;

  if exists (select 1 from public.obras_accounts) then
    raise exception 'A conta inicial do Obras ja foi criada.';
  end if;

  insert into public.obras_accounts (nome, cidade_id, cidade, created_by)
  values (coalesce(nullif(trim(p_nome), ''), current_email), p_cidade_id, p_cidade, auth.uid())
  returning * into account_row;

  insert into public.obras_users (
    auth_user_id,
    account_id,
    nome,
    email,
    cidade_id,
    cidade,
    role,
    active,
    login_enabled
  )
  values (
    auth.uid(),
    account_row.id,
    coalesce(nullif(trim(p_nome), ''), current_email),
    current_email,
    p_cidade_id,
    p_cidade,
    'owner',
    true,
    true
  )
  returning * into user_row;

  return user_row;
end;
$$;

alter table public.obras_accounts enable row level security;
alter table public.obras_users enable row level security;
alter table public.obras_projects enable row level security;
alter table public.obras_stages enable row level security;
alter table public.obras_photos enable row level security;
alter table public.obras_pls_items enable row level security;
alter table public.obras_issues enable row level security;
alter table public.obras_supplies enable row level security;
alter table public.obras_tools enable row level security;
alter table public.obras_checklist enable row level security;

grant select, insert, update, delete on
  public.obras_accounts,
  public.obras_users,
  public.obras_projects,
  public.obras_stages,
  public.obras_photos,
  public.obras_pls_items,
  public.obras_issues,
  public.obras_supplies,
  public.obras_tools,
  public.obras_checklist
to authenticated;

revoke all on function public.obras_current_account_id() from public, anon;
revoke all on function public.obras_current_role() from public, anon;
revoke all on function public.obras_can_write() from public, anon;
revoke all on function public.obras_can_manage_users() from public, anon;
revoke all on function public.obras_can_access_project(uuid) from public, anon;
revoke all on function public.obras_project_id_from_storage_name(text) from public, anon;
revoke all on function public.obras_claim_user() from public, anon;
revoke all on function public.obras_bootstrap_owner(text, text, text) from public, anon;

grant execute on function public.obras_current_account_id() to authenticated;
grant execute on function public.obras_current_role() to authenticated;
grant execute on function public.obras_can_write() to authenticated;
grant execute on function public.obras_can_manage_users() to authenticated;
grant execute on function public.obras_can_access_project(uuid) to authenticated;
grant execute on function public.obras_project_id_from_storage_name(text) to authenticated;
grant execute on function public.obras_claim_user() to authenticated;
grant execute on function public.obras_bootstrap_owner(text, text, text) to authenticated;

create policy "obras_accounts_select_own" on public.obras_accounts
for select to authenticated
using (id = public.obras_current_account_id());

create policy "obras_accounts_update_admin" on public.obras_accounts
for update to authenticated
using (id = public.obras_current_account_id() and public.obras_can_manage_users())
with check (id = public.obras_current_account_id() and public.obras_can_manage_users());

create policy "obras_users_select_own_account" on public.obras_users
for select to authenticated
using (account_id = public.obras_current_account_id() or auth_user_id = auth.uid());

create policy "obras_users_insert_admin" on public.obras_users
for insert to authenticated
with check (account_id = public.obras_current_account_id() and public.obras_can_manage_users());

create policy "obras_users_update_admin" on public.obras_users
for update to authenticated
using (account_id = public.obras_current_account_id() and public.obras_can_manage_users())
with check (account_id = public.obras_current_account_id() and public.obras_can_manage_users());

create policy "obras_users_delete_admin" on public.obras_users
for delete to authenticated
using (account_id = public.obras_current_account_id() and public.obras_can_manage_users());

create policy "obras_projects_select_by_account" on public.obras_projects
for select to authenticated
using (account_id = public.obras_current_account_id());

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'obras-photos',
  'obras-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "obras_photos_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'obras-photos'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
);

create policy "obras_photos_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);

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

create policy "obras_photos_storage_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-photos'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);
