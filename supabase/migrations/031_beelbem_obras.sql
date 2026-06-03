create table if not exists public.obras_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now()
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

create index if not exists obras_projects_owner_id_idx on public.obras_projects(owner_id);
create index if not exists obras_stages_project_id_idx on public.obras_stages(project_id);
create index if not exists obras_photos_project_id_idx on public.obras_photos(project_id);
create index if not exists obras_pls_items_project_id_idx on public.obras_pls_items(project_id);
create index if not exists obras_issues_project_id_idx on public.obras_issues(project_id);
create index if not exists obras_supplies_project_id_idx on public.obras_supplies(project_id);
create index if not exists obras_tools_project_id_idx on public.obras_tools(project_id);
create index if not exists obras_checklist_project_id_idx on public.obras_checklist(project_id);

create or replace function public.set_obras_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
    where project.id = target_project_id
      and project.owner_id = auth.uid()
  );
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'obras_projects',
    'obras_stages',
    'obras_pls_items',
    'obras_issues',
    'obras_supplies',
    'obras_tools',
    'obras_checklist'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_obras_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.obras_projects enable row level security;
alter table public.obras_stages enable row level security;
alter table public.obras_photos enable row level security;
alter table public.obras_pls_items enable row level security;
alter table public.obras_issues enable row level security;
alter table public.obras_supplies enable row level security;
alter table public.obras_tools enable row level security;
alter table public.obras_checklist enable row level security;

grant select, insert, update, delete on
  public.obras_projects,
  public.obras_stages,
  public.obras_photos,
  public.obras_pls_items,
  public.obras_issues,
  public.obras_supplies,
  public.obras_tools,
  public.obras_checklist
to authenticated;

drop policy if exists "obras_projects_owner_manage" on public.obras_projects;
create policy "obras_projects_owner_manage" on public.obras_projects
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "obras_stages_owner_manage" on public.obras_stages;
create policy "obras_stages_owner_manage" on public.obras_stages
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));

drop policy if exists "obras_photos_owner_manage" on public.obras_photos;
create policy "obras_photos_owner_manage" on public.obras_photos
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));

drop policy if exists "obras_pls_items_owner_manage" on public.obras_pls_items;
create policy "obras_pls_items_owner_manage" on public.obras_pls_items
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));

drop policy if exists "obras_issues_owner_manage" on public.obras_issues;
create policy "obras_issues_owner_manage" on public.obras_issues
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));

drop policy if exists "obras_supplies_owner_manage" on public.obras_supplies;
create policy "obras_supplies_owner_manage" on public.obras_supplies
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));

drop policy if exists "obras_tools_owner_manage" on public.obras_tools;
create policy "obras_tools_owner_manage" on public.obras_tools
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));

drop policy if exists "obras_checklist_owner_manage" on public.obras_checklist;
create policy "obras_checklist_owner_manage" on public.obras_checklist
for all to authenticated
using (public.obras_can_access_project(project_id))
with check (public.obras_can_access_project(project_id));
