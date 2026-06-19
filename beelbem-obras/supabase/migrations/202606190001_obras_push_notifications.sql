create table if not exists public.obras_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete cascade,
  project_id uuid references public.obras_projects(id) on delete cascade,
  actor_user_id uuid default auth.uid() references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists obras_notifications_account_created_idx
  on public.obras_notifications(account_id, created_at desc);

create index if not exists obras_notifications_project_created_idx
  on public.obras_notifications(project_id, created_at desc);

create table if not exists public.obras_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.obras_current_account_id() references public.obras_accounts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists obras_push_subscriptions_account_idx
  on public.obras_push_subscriptions(account_id, active);

create index if not exists obras_push_subscriptions_user_idx
  on public.obras_push_subscriptions(user_id);

drop trigger if exists set_obras_push_subscriptions_updated_at on public.obras_push_subscriptions;
create trigger set_obras_push_subscriptions_updated_at
before update on public.obras_push_subscriptions
for each row execute function public.set_obras_updated_at();

alter table public.obras_notifications enable row level security;
alter table public.obras_push_subscriptions enable row level security;

grant select, insert on public.obras_notifications to authenticated;
grant select, insert, update, delete on public.obras_push_subscriptions to authenticated;

create policy "obras_notifications_select_account"
on public.obras_notifications
for select to authenticated
using (account_id = public.obras_current_account_id());

create policy "obras_notifications_insert_account"
on public.obras_notifications
for insert to authenticated
with check (
  account_id = public.obras_current_account_id()
  and public.obras_can_write()
  and (project_id is null or public.obras_can_access_project(project_id))
);

create policy "obras_push_subscriptions_select_own"
on public.obras_push_subscriptions
for select to authenticated
using (user_id = auth.uid() and account_id = public.obras_current_account_id());

create policy "obras_push_subscriptions_insert_own"
on public.obras_push_subscriptions
for insert to authenticated
with check (user_id = auth.uid() and account_id = public.obras_current_account_id());

create policy "obras_push_subscriptions_update_own"
on public.obras_push_subscriptions
for update to authenticated
using (user_id = auth.uid() and account_id = public.obras_current_account_id())
with check (user_id = auth.uid() and account_id = public.obras_current_account_id());

create policy "obras_push_subscriptions_delete_own"
on public.obras_push_subscriptions
for delete to authenticated
using (user_id = auth.uid() and account_id = public.obras_current_account_id());

do $$
begin
  begin
    alter publication supabase_realtime add table public.obras_notifications;
  exception
    when duplicate_object then null;
  end;
end $$;
