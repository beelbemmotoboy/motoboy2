alter table public.profiles add column if not exists password_set_at timestamptz;

alter table public.access_invites add column if not exists password_setup_expires_at timestamptz;
