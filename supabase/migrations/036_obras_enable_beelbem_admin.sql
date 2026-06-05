update public.obras_users
set
  login_enabled = true,
  active = true,
  role = 'owner',
  updated_at = now()
where lower(email) = 'beelbemmotoboy@gmail.com';
