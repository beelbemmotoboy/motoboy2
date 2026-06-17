alter table public.obras_checklist
  add column if not exists schedule_item_id uuid references public.obras_project_schedule_items(id) on delete cascade,
  add column if not exists titulo text,
  add column if not exists procedimento text,
  add column if not exists itens jsonb not null default '[]'::jsonb;

update public.obras_checklist
set titulo = coalesce(nullif(titulo, ''), descricao, 'Checklist tecnico')
where titulo is null or titulo = '';

alter table public.obras_checklist
  alter column titulo set default 'Checklist tecnico';

do $$
begin
  alter table public.obras_checklist
    drop constraint if exists obras_checklist_itens_array_check;

  alter table public.obras_checklist
    add constraint obras_checklist_itens_array_check
    check (jsonb_typeof(itens) = 'array');
end $$;

create index if not exists obras_checklist_schedule_item_id_idx
  on public.obras_checklist(schedule_item_id);
