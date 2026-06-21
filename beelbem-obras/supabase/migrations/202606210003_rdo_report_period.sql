alter table public.obras_rdo_reports
add column if not exists start_date date,
add column if not exists end_date date;

update public.obras_rdo_reports
set
  start_date = coalesce(start_date, report_date),
  end_date = coalesce(end_date, report_date)
where start_date is null
   or end_date is null;

alter table public.obras_rdo_reports
alter column start_date set not null,
alter column end_date set not null;

alter table public.obras_rdo_reports
drop constraint if exists obras_rdo_reports_project_date_key;

create unique index if not exists obras_rdo_reports_project_period_key
  on public.obras_rdo_reports(project_id, start_date, end_date);

create index if not exists obras_rdo_reports_project_period_idx
  on public.obras_rdo_reports(project_id, start_date desc, end_date desc);
