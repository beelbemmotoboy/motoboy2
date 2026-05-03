alter table public.profiles add column if not exists active boolean not null default true;

alter table public.access_invites add column if not exists user_active boolean not null default true;
alter table public.access_invites add column if not exists password_setup_sent_at timestamptz;
alter table public.access_invites add column if not exists password_setup_token text;
