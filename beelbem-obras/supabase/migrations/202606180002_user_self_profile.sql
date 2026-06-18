create or replace function public.obras_user_id_from_storage_name(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  user_id_text text;
begin
  user_id_text := split_part(object_name, '/', 2);
  if user_id_text = '' then
    return null;
  end if;
  return user_id_text::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.obras_user_id_from_storage_name(text) to authenticated;

create or replace function public.obras_update_my_profile(
  p_nome text,
  p_telefone text,
  p_cpf text,
  p_professional_registry text,
  p_cidade_id text,
  p_cidade text,
  p_avatar_storage_path text,
  p_avatar_file_name text,
  p_avatar_mime_type text,
  p_avatar_file_size bigint
)
returns public.obras_users
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_user public.obras_users;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if nullif(trim(coalesce(p_nome, '')), '') is null then
    raise exception 'Informe seu nome.';
  end if;

  update public.obras_users
  set
    nome = trim(p_nome),
    telefone = nullif(trim(coalesce(p_telefone, '')), ''),
    cpf = nullif(trim(coalesce(p_cpf, '')), ''),
    professional_registry = nullif(trim(coalesce(p_professional_registry, '')), ''),
    cidade_id = p_cidade_id,
    cidade = p_cidade,
    avatar_storage_path = nullif(trim(coalesce(p_avatar_storage_path, '')), ''),
    avatar_file_name = nullif(trim(coalesce(p_avatar_file_name, '')), ''),
    avatar_mime_type = nullif(trim(coalesce(p_avatar_mime_type, '')), ''),
    avatar_file_size = p_avatar_file_size
  where auth_user_id = auth.uid()
  returning * into updated_user;

  if updated_user.id is null then
    raise exception 'Usuario do Obras nao encontrado.';
  end if;

  return updated_user;
end;
$$;

revoke all on function public.obras_update_my_profile(text, text, text, text, text, text, text, text, text, bigint) from public, anon;
grant execute on function public.obras_update_my_profile(text, text, text, text, text, text, text, text, text, bigint) to authenticated;

create policy "obras_user_avatars_insert_self" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and exists (
    select 1
    from public.obras_users user_profile
    where user_profile.id = public.obras_user_id_from_storage_name(name)
      and user_profile.auth_user_id = auth.uid()
  )
);

create policy "obras_user_avatars_update_self" on storage.objects
for update to authenticated
using (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and exists (
    select 1
    from public.obras_users user_profile
    where user_profile.id = public.obras_user_id_from_storage_name(name)
      and user_profile.auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and exists (
    select 1
    from public.obras_users user_profile
    where user_profile.id = public.obras_user_id_from_storage_name(name)
      and user_profile.auth_user_id = auth.uid()
  )
);

create policy "obras_user_avatars_delete_self" on storage.objects
for delete to authenticated
using (
  bucket_id = 'obras-user-avatars'
  and public.obras_account_id_from_storage_name(name) = public.obras_current_account_id()
  and exists (
    select 1
    from public.obras_users user_profile
    where user_profile.id = public.obras_user_id_from_storage_name(name)
      and user_profile.auth_user_id = auth.uid()
  )
);
