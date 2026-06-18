do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'obras_schedule_daily_logs_project_id_id_key'
  ) then
    alter table public.obras_schedule_daily_logs
      add constraint obras_schedule_daily_logs_project_id_id_key unique (project_id, id);
  end if;
end $$;

create table if not exists public.obras_schedule_checklist_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  schedule_item_id uuid not null,
  schedule_log_id uuid not null,
  checklist_id uuid not null references public.obras_checklist(id) on delete cascade,
  checklist_item_id text not null,
  checked boolean not null default false,
  checked_by uuid default auth.uid() references auth.users(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_schedule_checklist_results_item_fkey
    foreign key (project_id, schedule_item_id)
    references public.obras_project_schedule_items(project_id, id)
    on delete restrict,
  constraint obras_schedule_checklist_results_log_fkey
    foreign key (project_id, schedule_log_id)
    references public.obras_schedule_daily_logs(project_id, id)
    on delete cascade,
  constraint obras_schedule_checklist_results_log_item_key
    unique (schedule_log_id, checklist_item_id)
);

create index if not exists obras_schedule_checklist_results_project_idx
  on public.obras_schedule_checklist_results(project_id);
create index if not exists obras_schedule_checklist_results_item_idx
  on public.obras_schedule_checklist_results(schedule_item_id);
create index if not exists obras_schedule_checklist_results_log_idx
  on public.obras_schedule_checklist_results(schedule_log_id);
create index if not exists obras_schedule_checklist_results_checked_by_idx
  on public.obras_schedule_checklist_results(checked_by);

drop trigger if exists set_obras_schedule_checklist_results_updated_at on public.obras_schedule_checklist_results;
create trigger set_obras_schedule_checklist_results_updated_at
before update on public.obras_schedule_checklist_results
for each row execute function public.set_obras_updated_at();

alter table public.obras_schedule_checklist_results enable row level security;

grant select, insert, update, delete on public.obras_schedule_checklist_results to authenticated;

create policy "obras_schedule_checklist_results_select_account"
on public.obras_schedule_checklist_results
for select to authenticated
using (public.obras_can_access_project(project_id));

create policy "obras_schedule_checklist_results_insert_account"
on public.obras_schedule_checklist_results
for insert to authenticated
with check (
  public.obras_can_access_project(project_id)
  and public.obras_can_write()
  and checked_by = auth.uid()
);

create policy "obras_schedule_checklist_results_update_account"
on public.obras_schedule_checklist_results
for update to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write())
with check (
  public.obras_can_access_project(project_id)
  and public.obras_can_write()
  and checked_by = auth.uid()
);

create policy "obras_schedule_checklist_results_delete_account"
on public.obras_schedule_checklist_results
for delete to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write());
