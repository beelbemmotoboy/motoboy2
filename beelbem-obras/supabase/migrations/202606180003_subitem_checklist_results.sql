alter table public.obras_schedule_checklist_results
  alter column schedule_log_id drop not null;

create unique index if not exists obras_schedule_checklist_results_subitem_item_uidx
  on public.obras_schedule_checklist_results(project_id, schedule_item_id, checklist_item_id)
  where schedule_log_id is null;

create unique index if not exists obras_schedule_checklist_results_log_item_uidx
  on public.obras_schedule_checklist_results(schedule_log_id, checklist_item_id)
  where schedule_log_id is not null;
