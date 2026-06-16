alter table public.obras_users
  add column if not exists cpf text,
  add column if not exists professional_registry text,
  add column if not exists avatar_storage_path text,
  add column if not exists avatar_file_name text,
  add column if not exists avatar_mime_type text,
  add column if not exists avatar_file_size bigint;

do $$
begin
  alter table public.obras_users drop constraint if exists obras_users_role_check;
  alter table public.obras_users
    add constraint obras_users_role_check
    check (role in ('owner', 'admin', 'engenheiro', 'arquiteto', 'operador', 'viewer'));
end $$;

create or replace function public.obras_account_id_from_storage_name(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  account_id_text text;
begin
  account_id_text := split_part(object_name, '/', 1);
  if account_id_text = '' then
    return null;
  end if;
  return account_id_text::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.obras_account_id_from_storage_name(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'obras-user-avatars',
  'obras-user-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "obras_user_avatars_select_account" on storage.objects
for select to authenticated
using (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
);

create policy "obras_user_avatars_insert_admin" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and public.obras_can_manage_users()
);

create policy "obras_user_avatars_update_admin" on storage.objects
for update to authenticated
using (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and public.obras_can_manage_users()
)
with check (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and public.obras_can_manage_users()
);

create policy "obras_user_avatars_delete_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and public.obras_can_manage_users()
);
