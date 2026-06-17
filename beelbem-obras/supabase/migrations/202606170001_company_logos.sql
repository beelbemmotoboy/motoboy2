alter table public.obras_accounts
  add column if not exists responsavel text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists endereco text,
  add column if not exists logo_storage_path text,
  add column if not exists logo_file_name text,
  add column if not exists logo_mime_type text,
  add column if not exists logo_file_size bigint;

drop policy if exists "obras_accounts_select_platform" on public.obras_accounts;
create policy "obras_accounts_select_platform" on public.obras_accounts
for select to authenticated
using (public.obras_is_platform_admin());

drop policy if exists "obras_accounts_update_platform" on public.obras_accounts;
create policy "obras_accounts_update_platform" on public.obras_accounts
for update to authenticated
using (public.obras_is_platform_admin())
with check (public.obras_is_platform_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'obras-account-logos',
  'obras-account-logos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "obras_account_logos_select_account" on storage.objects;
create policy "obras_account_logos_select_account" on storage.objects
for select to authenticated
using (
  bucket_id = 'obras-account-logos'
  and (
    public.obras_is_platform_admin()
    or public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  )
);

drop policy if exists "obras_account_logos_insert_admin" on storage.objects;
create policy "obras_account_logos_insert_admin" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-account-logos'
  and (
    public.obras_is_platform_admin()
    or (
      public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
      and public.obras_can_manage_users()
    )
  )
);

drop policy if exists "obras_account_logos_update_admin" on storage.objects;
create policy "obras_account_logos_update_admin" on storage.objects
for update to authenticated
using (
  bucket_id = 'obras-account-logos'
  and (
    public.obras_is_platform_admin()
    or (
      public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
      and public.obras_can_manage_users()
    )
  )
)
with check (
  bucket_id = 'obras-account-logos'
  and (
    public.obras_is_platform_admin()
    or (
      public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
      and public.obras_can_manage_users()
    )
  )
);

drop policy if exists "obras_account_logos_delete_admin" on storage.objects;
create policy "obras_account_logos_delete_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-account-logos'
  and (
    public.obras_is_platform_admin()
    or (
      public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
      and public.obras_can_manage_users()
    )
  )
);
