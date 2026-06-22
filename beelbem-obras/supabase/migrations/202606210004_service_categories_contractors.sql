create table if not exists public.obras_service_categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists obras_service_categories_account_nome_uidx
  on public.obras_service_categories (account_id, lower(nome));

alter table public.obras_project_schedule_items
  add column if not exists categoria_servico_id uuid references public.obras_service_categories(id) on delete set null;

create index if not exists obras_project_schedule_items_categoria_idx
  on public.obras_project_schedule_items (categoria_servico_id);

create or replace function public.obras_validate_schedule_service_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.categoria_servico_id is not null and not exists (
    select 1
    from public.obras_service_categories category
    join public.obras_projects project on project.account_id = category.account_id
    where category.id = new.categoria_servico_id
      and project.id = new.project_id
  ) then
    raise exception 'Categoria de servico nao pertence a esta empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists obras_project_schedule_validate_category on public.obras_project_schedule_items;
create trigger obras_project_schedule_validate_category
  before insert or update of categoria_servico_id, project_id on public.obras_project_schedule_items
  for each row execute function public.obras_validate_schedule_service_category();

create table if not exists public.obras_contractors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete cascade,
  nome text not null,
  telefone text,
  documento text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists obras_contractors_account_nome_uidx
  on public.obras_contractors (account_id, lower(nome));

create table if not exists public.obras_subitem_contractors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  schedule_item_id uuid not null,
  contractor_id uuid not null references public.obras_contractors(id) on delete restrict,
  data_inicio date,
  data_fim date,
  valor_contratado numeric(12,2) not null default 0 check (valor_contratado >= 0),
  forma_pagamento text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_subitem_contractors_schedule_fk
    foreign key (project_id, schedule_item_id)
    references public.obras_project_schedule_items(project_id, id)
    on delete restrict
);

create index if not exists obras_subitem_contractors_project_idx
  on public.obras_subitem_contractors (project_id);

create index if not exists obras_subitem_contractors_schedule_idx
  on public.obras_subitem_contractors (schedule_item_id);

create unique index if not exists obras_subitem_contractors_active_uidx
  on public.obras_subitem_contractors (project_id, schedule_item_id)
  where ativo = true;

drop trigger if exists set_obras_service_categories_updated_at on public.obras_service_categories;
create trigger set_obras_service_categories_updated_at
  before update on public.obras_service_categories
  for each row execute function public.set_obras_updated_at();

drop trigger if exists set_obras_contractors_updated_at on public.obras_contractors;
create trigger set_obras_contractors_updated_at
  before update on public.obras_contractors
  for each row execute function public.set_obras_updated_at();

drop trigger if exists set_obras_subitem_contractors_updated_at on public.obras_subitem_contractors;
create trigger set_obras_subitem_contractors_updated_at
  before update on public.obras_subitem_contractors
  for each row execute function public.set_obras_updated_at();

alter table public.obras_service_categories enable row level security;
alter table public.obras_contractors enable row level security;
alter table public.obras_subitem_contractors enable row level security;

drop policy if exists "service categories select account" on public.obras_service_categories;
create policy "service categories select account"
  on public.obras_service_categories
  for select
  using (account_id = public.obras_current_account_id());

drop policy if exists "service categories insert account" on public.obras_service_categories;
create policy "service categories insert account"
  on public.obras_service_categories
  for insert
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

drop policy if exists "service categories update account" on public.obras_service_categories;
create policy "service categories update account"
  on public.obras_service_categories
  for update
  using (account_id = public.obras_current_account_id() and public.obras_can_write())
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

drop policy if exists "contractors select account" on public.obras_contractors;
create policy "contractors select account"
  on public.obras_contractors
  for select
  using (account_id = public.obras_current_account_id());

drop policy if exists "contractors insert account" on public.obras_contractors;
create policy "contractors insert account"
  on public.obras_contractors
  for insert
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

drop policy if exists "contractors update account" on public.obras_contractors;
create policy "contractors update account"
  on public.obras_contractors
  for update
  using (account_id = public.obras_current_account_id() and public.obras_can_write())
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

drop policy if exists "subitem contractors select project" on public.obras_subitem_contractors;
create policy "subitem contractors select project"
  on public.obras_subitem_contractors
  for select
  using (public.obras_can_access_project(project_id));

drop policy if exists "subitem contractors insert project" on public.obras_subitem_contractors;
create policy "subitem contractors insert project"
  on public.obras_subitem_contractors
  for insert
  with check (
    public.obras_can_access_project(project_id)
    and public.obras_can_write()
    and exists (
      select 1
      from public.obras_contractors contractor
      where contractor.id = contractor_id
        and contractor.account_id = public.obras_current_account_id()
    )
  );

drop policy if exists "subitem contractors update project" on public.obras_subitem_contractors;
create policy "subitem contractors update project"
  on public.obras_subitem_contractors
  for update
  using (public.obras_can_access_project(project_id) and public.obras_can_write())
  with check (
    public.obras_can_access_project(project_id)
    and public.obras_can_write()
    and exists (
      select 1
      from public.obras_contractors contractor
      where contractor.id = contractor_id
        and contractor.account_id = public.obras_current_account_id()
    )
  );

grant select, insert, update on public.obras_service_categories to authenticated;
grant select, insert, update on public.obras_contractors to authenticated;
grant select, insert, update on public.obras_subitem_contractors to authenticated;

create or replace function public.obras_seed_default_service_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.obras_service_categories (account_id, nome, descricao)
  values
    (new.id, 'Fundacao', 'Servicos de fundacao, estacas, blocos e sapatas.'),
    (new.id, 'Alvenaria', 'Execucao de paredes, pilares, vergas e respaldo.'),
    (new.id, 'Estrutura', 'Laje, vigas, pilares e cobertura estrutural.'),
    (new.id, 'Hidraulica', 'Instalacoes hidraulicas e sanitarias.'),
    (new.id, 'Eletrica', 'Instalacoes eletricas brutas e finais.'),
    (new.id, 'Acabamento', 'Revestimentos, pintura, forro e limpeza final.'),
    (new.id, 'Mao de obra geral', 'Servicos gerais e apoio de campo.')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists obras_accounts_seed_service_categories on public.obras_accounts;
create trigger obras_accounts_seed_service_categories
  after insert on public.obras_accounts
  for each row execute function public.obras_seed_default_service_categories();

insert into public.obras_service_categories (account_id, nome, descricao)
select account.id, category.nome, category.descricao
from public.obras_accounts account
cross join (
  values
    ('Fundacao', 'Servicos de fundacao, estacas, blocos e sapatas.'),
    ('Alvenaria', 'Execucao de paredes, pilares, vergas e respaldo.'),
    ('Estrutura', 'Laje, vigas, pilares e cobertura estrutural.'),
    ('Hidraulica', 'Instalacoes hidraulicas e sanitarias.'),
    ('Eletrica', 'Instalacoes eletricas brutas e finais.'),
    ('Acabamento', 'Revestimentos, pintura, forro e limpeza final.'),
    ('Mao de obra geral', 'Servicos gerais e apoio de campo.')
) as category(nome, descricao)
on conflict do nothing;
