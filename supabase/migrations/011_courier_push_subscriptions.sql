create table if not exists public.courier_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courier_push_subscriptions_courier_id_idx
  on public.courier_push_subscriptions(courier_id)
  where active = true;

alter table public.courier_push_subscriptions enable row level security;

drop policy if exists "courier_push_subscriptions_manage_own" on public.courier_push_subscriptions;
create policy "courier_push_subscriptions_manage_own" on public.courier_push_subscriptions
  for all
  using (courier_id = public.current_profile_courier_id())
  with check (courier_id = public.current_profile_courier_id());

drop trigger if exists set_courier_push_subscriptions_updated_at on public.courier_push_subscriptions;
create trigger set_courier_push_subscriptions_updated_at before update on public.courier_push_subscriptions
  for each row execute function public.set_updated_at();
