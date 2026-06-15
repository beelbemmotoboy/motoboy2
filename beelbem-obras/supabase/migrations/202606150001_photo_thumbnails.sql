create table if not exists public.obras_photo_thumbnails (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  photo_id uuid not null references public.obras_photos(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text not null default 'image/jpeg',
  file_size bigint,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_photo_thumbnails_file_size_check check (file_size is null or file_size >= 0),
  constraint obras_photo_thumbnails_width_check check (width is null or width > 0),
  constraint obras_photo_thumbnails_height_check check (height is null or height > 0)
);

create unique index if not exists obras_photo_thumbnails_photo_id_idx
  on public.obras_photo_thumbnails(photo_id);

create index if not exists obras_photo_thumbnails_project_id_idx
  on public.obras_photo_thumbnails(project_id);

create unique index if not exists obras_photo_thumbnails_storage_path_idx
  on public.obras_photo_thumbnails(storage_path);

drop trigger if exists set_obras_photo_thumbnails_updated_at on public.obras_photo_thumbnails;
create trigger set_obras_photo_thumbnails_updated_at
before update on public.obras_photo_thumbnails
for each row execute function public.set_obras_updated_at();

alter table public.obras_photo_thumbnails enable row level security;

grant select, insert, update, delete on public.obras_photo_thumbnails to authenticated;

drop policy if exists "obras_photo_thumbnails_select_by_account" on public.obras_photo_thumbnails;
create policy "obras_photo_thumbnails_select_by_account" on public.obras_photo_thumbnails
for select to authenticated
using (public.obras_can_access_project(project_id));

drop policy if exists "obras_photo_thumbnails_insert_by_account" on public.obras_photo_thumbnails;
create policy "obras_photo_thumbnails_insert_by_account" on public.obras_photo_thumbnails
for insert to authenticated
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

drop policy if exists "obras_photo_thumbnails_update_by_account" on public.obras_photo_thumbnails;
create policy "obras_photo_thumbnails_update_by_account" on public.obras_photo_thumbnails
for update to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write())
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

drop policy if exists "obras_photo_thumbnails_delete_by_account" on public.obras_photo_thumbnails;
create policy "obras_photo_thumbnails_delete_by_account" on public.obras_photo_thumbnails
for delete to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write());
