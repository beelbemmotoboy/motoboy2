alter table public.obras_photos
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint;

create unique index if not exists obras_photos_storage_path_idx
  on public.obras_photos(storage_path)
  where storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'obras-photos',
  'obras-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "obras_photos_storage_select" on storage.objects;
create policy "obras_photos_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "obras_photos_storage_insert" on storage.objects;
create policy "obras_photos_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "obras_photos_storage_update" on storage.objects;
create policy "obras_photos_storage_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "obras_photos_storage_delete" on storage.objects;
create policy "obras_photos_storage_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
