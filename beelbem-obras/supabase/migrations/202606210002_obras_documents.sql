create table if not exists public.obras_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.obras_projects(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descricao text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_documents_tipo_check check (tipo in (
    'Projetos da obra',
    'Documentos clientes',
    'Contratos Mao de Obra',
    'Outros documentos'
  )),
  constraint obras_documents_file_size_check check (file_size is null or file_size >= 0)
);

create index if not exists obras_documents_project_id_idx
  on public.obras_documents(project_id);

create index if not exists obras_documents_tipo_idx
  on public.obras_documents(project_id, tipo);

create unique index if not exists obras_documents_storage_path_idx
  on public.obras_documents(storage_path)
  where storage_path is not null;

drop trigger if exists set_obras_documents_updated_at on public.obras_documents;
create trigger set_obras_documents_updated_at
before update on public.obras_documents
for each row execute function public.set_obras_updated_at();

alter table public.obras_documents enable row level security;

grant select, insert, update, delete on public.obras_documents to authenticated;

drop policy if exists "obras_documents_select_by_account" on public.obras_documents;
create policy "obras_documents_select_by_account" on public.obras_documents
for select to authenticated
using (public.obras_can_access_project(project_id));

drop policy if exists "obras_documents_insert_by_account" on public.obras_documents;
create policy "obras_documents_insert_by_account" on public.obras_documents
for insert to authenticated
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

drop policy if exists "obras_documents_update_by_account" on public.obras_documents;
create policy "obras_documents_update_by_account" on public.obras_documents
for update to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write())
with check (public.obras_can_access_project(project_id) and public.obras_can_write());

drop policy if exists "obras_documents_delete_by_account" on public.obras_documents;
create policy "obras_documents_delete_by_account" on public.obras_documents
for delete to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'obras-documents',
  'obras-documents',
  false,
  52428800,
  null
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "obras_documents_storage_select" on storage.objects;
create policy "obras_documents_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'obras-documents'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
);

drop policy if exists "obras_documents_storage_insert" on storage.objects;
create policy "obras_documents_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);

drop policy if exists "obras_documents_storage_update" on storage.objects;
create policy "obras_documents_storage_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'obras-documents'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
)
with check (
  bucket_id = 'obras-documents'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);

drop policy if exists "obras_documents_storage_delete" on storage.objects;
create policy "obras_documents_storage_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-documents'
  and public.obras_can_access_project(public.obras_project_id_from_storage_name(name))
  and public.obras_can_write()
);
