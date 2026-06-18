create table if not exists public.obras_rdo_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  report_date date not null,
  titulo text not null default 'Relatorio diario de obra',
  clima text,
  equipe text,
  resumo text,
  servicos_executados text,
  materiais text,
  ferramentas text,
  ocorrencias text,
  fotos_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_rdo_reports_project_date_key unique (project_id, report_date)
);

create index if not exists obras_rdo_reports_project_date_idx
  on public.obras_rdo_reports(project_id, report_date desc);

drop trigger if exists set_obras_rdo_reports_updated_at on public.obras_rdo_reports;
create trigger set_obras_rdo_reports_updated_at
before update on public.obras_rdo_reports
for each row execute function public.set_obras_updated_at();

alter table public.obras_rdo_reports enable row level security;

grant select, insert, update, delete on public.obras_rdo_reports to authenticated;

create policy "obras_rdo_reports_select_account"
on public.obras_rdo_reports
for select to authenticated
using (public.obras_can_access_project(project_id));

create policy "obras_rdo_reports_insert_account"
on public.obras_rdo_reports
for insert to authenticated
with check (
  public.obras_can_access_project(project_id)
  and public.obras_can_write()
);

create policy "obras_rdo_reports_update_account"
on public.obras_rdo_reports
for update to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write())
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

create policy "obras_rdo_reports_delete_account"
on public.obras_rdo_reports
for delete to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write());
