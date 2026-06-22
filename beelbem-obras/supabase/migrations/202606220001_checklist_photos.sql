create table if not exists public.obras_checklist_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  schedule_item_id uuid not null,
  checklist_id uuid not null references public.obras_checklist(id) on delete cascade,
  checklist_item_id text not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  width integer,
  height integer,
  thumbnail_storage_path text,
  thumbnail_file_name text,
  thumbnail_mime_type text,
  thumbnail_file_size bigint,
  thumbnail_width integer,
  thumbnail_height integer,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint obras_checklist_photos_schedule_item_fkey
    foreign key (project_id, schedule_item_id)
    references public.obras_project_schedule_items(project_id, id)
    on delete restrict,
  constraint obras_checklist_photos_file_size_check check (file_size is null or file_size >= 0),
  constraint obras_checklist_photos_width_check check (width is null or width > 0),
  constraint obras_checklist_photos_height_check check (height is null or height > 0),
  constraint obras_checklist_photos_thumbnail_file_size_check check (thumbnail_file_size is null or thumbnail_file_size >= 0),
  constraint obras_checklist_photos_thumbnail_width_check check (thumbnail_width is null or thumbnail_width > 0),
  constraint obras_checklist_photos_thumbnail_height_check check (thumbnail_height is null or thumbnail_height > 0)
);

create index if not exists obras_checklist_photos_project_idx
  on public.obras_checklist_photos(project_id);
create index if not exists obras_checklist_photos_item_idx
  on public.obras_checklist_photos(schedule_item_id);
create index if not exists obras_checklist_photos_checklist_idx
  on public.obras_checklist_photos(checklist_id);
create index if not exists obras_checklist_photos_lookup_idx
  on public.obras_checklist_photos(project_id, schedule_item_id, checklist_id, checklist_item_id);
create unique index if not exists obras_checklist_photos_storage_path_idx
  on public.obras_checklist_photos(storage_path);
create unique index if not exists obras_checklist_photos_thumbnail_storage_path_idx
  on public.obras_checklist_photos(thumbnail_storage_path)
  where thumbnail_storage_path is not null;

create or replace function public.obras_limit_checklist_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.obras_checklist_photos photo
    where photo.project_id = new.project_id
      and photo.schedule_item_id = new.schedule_item_id
      and photo.checklist_id = new.checklist_id
      and photo.checklist_item_id = new.checklist_item_id
  ) >= 20 then
    raise exception 'Limite de 20 fotos por item de checklist atingido.';
  end if;

  return new;
end;
$$;

drop trigger if exists obras_limit_checklist_photos_trigger on public.obras_checklist_photos;
create trigger obras_limit_checklist_photos_trigger
  before insert on public.obras_checklist_photos
  for each row execute function public.obras_limit_checklist_photos();

alter table public.obras_checklist_photos enable row level security;

grant select, insert, delete on public.obras_checklist_photos to authenticated;

drop policy if exists "obras_checklist_photos_select_project" on public.obras_checklist_photos;
create policy "obras_checklist_photos_select_project"
on public.obras_checklist_photos
for select to authenticated
using (public.obras_can_access_project(project_id));

drop policy if exists "obras_checklist_photos_insert_project" on public.obras_checklist_photos;
create policy "obras_checklist_photos_insert_project"
on public.obras_checklist_photos
for insert to authenticated
with check (
  public.obras_can_access_project(project_id)
  and public.obras_can_write()
  and created_by = auth.uid()
);

drop policy if exists "obras_checklist_photos_delete_project" on public.obras_checklist_photos;
create policy "obras_checklist_photos_delete_project"
on public.obras_checklist_photos
for delete to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write());
