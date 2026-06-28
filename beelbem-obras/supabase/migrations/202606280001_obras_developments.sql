create table if not exists public.obras_developments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete cascade,
  nome text not null,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio text,
  uf text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists obras_developments_account_name_uidx
  on public.obras_developments (account_id, lower(nome));

create unique index if not exists obras_developments_account_cnpj_uidx
  on public.obras_developments (account_id, cnpj)
  where cnpj is not null and cnpj <> '';

alter table public.obras_projects
  add column if not exists development_id uuid references public.obras_developments(id) on delete restrict;

insert into public.obras_developments (account_id, nome)
select distinct project.account_id, project.nome
from public.obras_projects project
where not exists (
  select 1
  from public.obras_developments development
  where development.account_id = project.account_id
    and lower(development.nome) = lower(project.nome)
)
on conflict do nothing;

update public.obras_projects project
set development_id = development.id
from public.obras_developments development
where project.development_id is null
  and development.account_id = project.account_id
  and lower(development.nome) = lower(project.nome);

alter table public.obras_projects
  alter column development_id set not null;

create index if not exists obras_projects_development_idx
  on public.obras_projects (development_id);

drop trigger if exists set_obras_developments_updated_at on public.obras_developments;
create trigger set_obras_developments_updated_at
  before update on public.obras_developments
  for each row execute function public.set_obras_updated_at();

create or replace function public.obras_validate_project_development()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.obras_developments development
    where development.id = new.development_id
      and development.account_id = new.account_id
      and development.ativo = true
  ) then
    raise exception 'Empreendimento invalido para esta empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists obras_projects_validate_development on public.obras_projects;
create trigger obras_projects_validate_development
  before insert or update of development_id, account_id on public.obras_projects
  for each row execute function public.obras_validate_project_development();

alter table public.obras_developments enable row level security;

drop policy if exists "developments select account" on public.obras_developments;
create policy "developments select account"
  on public.obras_developments
  for select
  using (account_id = public.obras_current_account_id());

drop policy if exists "developments insert account" on public.obras_developments;
create policy "developments insert account"
  on public.obras_developments
  for insert
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

drop policy if exists "developments update account" on public.obras_developments;
create policy "developments update account"
  on public.obras_developments
  for update
  using (account_id = public.obras_current_account_id() and public.obras_can_write())
  with check (account_id = public.obras_current_account_id() and public.obras_can_write());

grant select, insert, update on public.obras_developments to authenticated;
grant execute on function public.obras_validate_project_development() to authenticated;

create or replace function public.obras_prevent_project_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.obras_current_role() not in ('owner', 'admin', 'engenheiro')
    and (
      new.development_id is distinct from old.development_id
      or new.nome is distinct from old.nome
      or new.cliente is distinct from old.cliente
      or new.endereco is distinct from old.endereco
      or new.cidade_id is distinct from old.cidade_id
      or new.bairro_id is distinct from old.bairro_id
      or new.cidade is distinct from old.cidade
      or new.bairro is distinct from old.bairro
      or new.quadra is distinct from old.quadra
      or new.lote is distinct from old.lote
      or new.area_construida is distinct from old.area_construida
      or new.area_terreno is distinct from old.area_terreno
      or new.pavimentos is distinct from old.pavimentos
      or new.responsavel is distinct from old.responsavel
      or new.observacoes is distinct from old.observacoes
    )
  then
    raise exception 'Apenas proprietarios, administradores e engenheiros podem alterar o cadastro da obra.';
  end if;

  return new;
end;
$$;
