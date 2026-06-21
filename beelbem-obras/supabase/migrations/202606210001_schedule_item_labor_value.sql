alter table public.obras_project_schedule_items
  add column if not exists valor_mao_obra numeric(12,2) not null default 0;

alter table public.obras_project_schedule_items
  drop constraint if exists obras_project_schedule_valor_mao_obra_check;

alter table public.obras_project_schedule_items
  add constraint obras_project_schedule_valor_mao_obra_check
  check (valor_mao_obra >= 0);
