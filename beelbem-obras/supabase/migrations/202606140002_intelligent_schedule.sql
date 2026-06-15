create table if not exists public.obras_schedule_library (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id()
    references public.obras_accounts(id) on delete cascade,
  parent_id uuid references public.obras_schedule_library(id) on delete restrict,
  code text not null,
  nome text not null,
  item_type text not null default 'task',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_schedule_library_type_check check (item_type in ('stage', 'task')),
  constraint obras_schedule_library_account_code_key unique (account_id, code)
);

create table if not exists public.obras_project_schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  library_item_id uuid references public.obras_schedule_library(id) on delete restrict,
  parent_item_id uuid references public.obras_project_schedule_items(id) on delete restrict,
  nome text not null,
  item_type text not null default 'task',
  inicio_previsto date,
  fim_previsto date,
  inicio_real date,
  fim_real date,
  status text not null default 'Nao iniciado',
  percentual integer not null default 0,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_project_schedule_type_check check (item_type in ('stage', 'task')),
  constraint obras_project_schedule_percentual_check check (percentual between 0 and 100),
  constraint obras_project_schedule_library_key unique (project_id, library_item_id),
  constraint obras_project_schedule_project_id_id_key unique (project_id, id)
);

create table if not exists public.obras_schedule_daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  schedule_item_id uuid not null,
  visit_date date not null default current_date,
  checklist text,
  observacoes text,
  pedido_material text,
  ferramentas text,
  mao_obra text,
  fotos_observacao text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_schedule_daily_logs_project_item_fkey
    foreign key (project_id, schedule_item_id)
    references public.obras_project_schedule_items(project_id, id)
    on delete restrict
);

create index if not exists obras_schedule_library_account_idx
  on public.obras_schedule_library(account_id, sort_order);
create index if not exists obras_project_schedule_project_idx
  on public.obras_project_schedule_items(project_id, sort_order);
create index if not exists obras_project_schedule_parent_idx
  on public.obras_project_schedule_items(parent_item_id);
create index if not exists obras_schedule_daily_logs_item_idx
  on public.obras_schedule_daily_logs(schedule_item_id, visit_date desc);

drop trigger if exists set_obras_schedule_library_updated_at on public.obras_schedule_library;
create trigger set_obras_schedule_library_updated_at
before update on public.obras_schedule_library
for each row execute function public.set_obras_updated_at();

drop trigger if exists set_obras_project_schedule_items_updated_at on public.obras_project_schedule_items;
create trigger set_obras_project_schedule_items_updated_at
before update on public.obras_project_schedule_items
for each row execute function public.set_obras_updated_at();

drop trigger if exists set_obras_schedule_daily_logs_updated_at on public.obras_schedule_daily_logs;
create trigger set_obras_schedule_daily_logs_updated_at
before update on public.obras_schedule_daily_logs
for each row execute function public.set_obras_updated_at();

alter table public.obras_schedule_library enable row level security;
alter table public.obras_project_schedule_items enable row level security;
alter table public.obras_schedule_daily_logs enable row level security;

grant select, insert, update on
  public.obras_schedule_library,
  public.obras_project_schedule_items,
  public.obras_schedule_daily_logs
to authenticated;

create policy "obras_schedule_library_select_account" on public.obras_schedule_library
for select to authenticated
using (account_id = public.obras_current_account_id());

create policy "obras_schedule_library_insert_account" on public.obras_schedule_library
for insert to authenticated
with check (account_id = public.obras_current_account_id() and public.obras_can_write());

create policy "obras_schedule_library_update_account" on public.obras_schedule_library
for update to authenticated
using (account_id = public.obras_current_account_id() and public.obras_can_write())
with check (account_id = public.obras_current_account_id() and public.obras_can_write());

create policy "obras_project_schedule_select_account" on public.obras_project_schedule_items
for select to authenticated
using (public.obras_can_access_project(project_id));

create policy "obras_project_schedule_insert_account" on public.obras_project_schedule_items
for insert to authenticated
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

create policy "obras_project_schedule_update_account" on public.obras_project_schedule_items
for update to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write())
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

create policy "obras_schedule_logs_select_account" on public.obras_schedule_daily_logs
for select to authenticated
using (public.obras_can_access_project(project_id));

create policy "obras_schedule_logs_insert_account" on public.obras_schedule_daily_logs
for insert to authenticated
with check (
  public.obras_can_access_project(project_id)
  and public.obras_can_write()
  and created_by = auth.uid()
);

create policy "obras_schedule_logs_update_account" on public.obras_schedule_daily_logs
for update to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write())
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

create or replace function public.obras_apply_schedule_blueprint(
  p_project_id uuid,
  p_blueprint jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  project_account_id uuid;
  stage_record jsonb;
  child_record record;
  library_stage_id uuid;
  library_child_id uuid;
  project_stage_id uuid;
  project_child_id uuid;
  inserted_count integer := 0;
  stage_order integer := 0;
begin
  if not public.obras_can_access_project(p_project_id) or not public.obras_can_write() then
    raise exception 'Voce nao pode alterar o cronograma desta obra.';
  end if;

  select account_id
  into project_account_id
  from public.obras_projects
  where id = p_project_id;

  if project_account_id is null then
    raise exception 'Obra nao encontrada.';
  end if;

  for stage_record in
    select value from jsonb_array_elements(coalesce(p_blueprint, '[]'::jsonb))
  loop
    insert into public.obras_schedule_library (
      account_id,
      code,
      nome,
      item_type,
      sort_order
    )
    values (
      project_account_id,
      stage_record ->> 'code',
      stage_record ->> 'nome',
      'stage',
      stage_order
    )
    on conflict (account_id, code)
    do update set
      nome = excluded.nome,
      item_type = excluded.item_type,
      sort_order = excluded.sort_order,
      active = true
    returning id into library_stage_id;

    insert into public.obras_project_schedule_items (
      project_id,
      library_item_id,
      nome,
      item_type,
      sort_order,
      visible
    )
    values (
      p_project_id,
      library_stage_id,
      stage_record ->> 'nome',
      'stage',
      stage_order,
      true
    )
    on conflict (project_id, library_item_id)
    do update set nome = excluded.nome
    returning id into project_stage_id;

    inserted_count := inserted_count + 1;

    for child_record in
      select value, ordinality - 1 as child_order
      from jsonb_array_elements_text(coalesce(stage_record -> 'children', '[]'::jsonb))
      with ordinality
    loop
      insert into public.obras_schedule_library (
        account_id,
        parent_id,
        code,
        nome,
        item_type,
        sort_order
      )
      values (
        project_account_id,
        library_stage_id,
        (stage_record ->> 'code') || '-' || lpad(child_record.child_order::text, 2, '0'),
        child_record.value,
        'task',
        child_record.child_order
      )
      on conflict (account_id, code)
      do update set
        parent_id = excluded.parent_id,
        nome = excluded.nome,
        item_type = excluded.item_type,
        sort_order = excluded.sort_order,
        active = true
      returning id into library_child_id;

      insert into public.obras_project_schedule_items (
        project_id,
        library_item_id,
        parent_item_id,
        nome,
        item_type,
        sort_order,
        visible
      )
      values (
        p_project_id,
        library_child_id,
        project_stage_id,
        child_record.value,
        'task',
        child_record.child_order,
        true
      )
      on conflict (project_id, library_item_id)
      do update set
        parent_item_id = excluded.parent_item_id,
        nome = excluded.nome
      returning id into project_child_id;

      inserted_count := inserted_count + 1;
    end loop;

    stage_order := stage_order + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.obras_apply_schedule_blueprint(uuid, jsonb) from public, anon;
grant execute on function public.obras_apply_schedule_blueprint(uuid, jsonb) to authenticated;
