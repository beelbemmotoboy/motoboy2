-- Beelbem Motoboy - reset controlado de acesso
-- Rode este arquivo no Supabase SQL Editor.
--
-- O que ele faz:
-- 1. Mantem cidades, lojas, motoboys, clientes e entregas.
-- 2. Limpa convites e perfis de acesso.
-- 3. Garante o usuario beelbemmotoboy@gmail.com como system_admin.
-- 4. Define uma senha temporaria conhecida para esse usuario no Supabase Auth.
--
-- Login apos rodar:
-- E-mail: beelbemmotoboy@gmail.com
-- Senha: Beelbem@123

begin;

create extension if not exists pgcrypto;

do $$
declare
  admin_email text := 'beelbemmotoboy@gmail.com';
  admin_password text := 'Beelbem@123';
  admin_user_id uuid;
begin
  select id
  into admin_user_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_user_id is null then
    raise exception 'O usuario % nao existe em auth.users. Crie primeiro em Authentication > Users e rode este SQL novamente.', admin_email;
  end if;

  delete from public.access_invites;
  delete from public.profiles;

  update auth.users
  set
    encrypted_password = crypt(admin_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmed_at = coalesce(confirmed_at, now()),
    aud = 'authenticated',
    role = 'authenticated',
    raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', 'Beelbem Motoboy'),
    updated_at = now()
  where id = admin_user_id;

  insert into public.profiles (
    id,
    name,
    email,
    role,
    active,
    city_id,
    store_id,
    courier_id,
    password_set_at
  )
  values (
    admin_user_id,
    'Beelbem Motoboy',
    admin_email,
    'system_admin',
    true,
    null,
    null,
    null,
    now()
  );
end $$;

commit;

select
  users.id,
  users.email,
  users.email_confirmed_at,
  users.confirmed_at,
  profiles.name,
  profiles.role,
  profiles.active
from auth.users users
left join public.profiles profiles on profiles.id = users.id
where lower(users.email) = lower('beelbemmotoboy@gmail.com');
