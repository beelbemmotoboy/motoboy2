create table if not exists public.obras_platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_platform_admins_email_check check (email = lower(trim(email)) and email <> '')
);

create unique index if not exists obras_platform_admins_email_idx
on public.obras_platform_admins(lower(email));

create table if not exists public.obras_plans (
  id text primary key,
  nome text not null,
  descricao text,
  tipo text not null default 'empresa',
  valor_mensal numeric(10,2) not null default 0,
  limite_obras integer,
  limite_usuarios integer,
  recursos jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_plans_tipo_check check (tipo in ('engenheiro', 'empresa', 'construtora')),
  constraint obras_plans_valor_mensal_check check (valor_mensal >= 0),
  constraint obras_plans_limite_obras_check check (limite_obras is null or limite_obras > 0),
  constraint obras_plans_limite_usuarios_check check (limite_usuarios is null or limite_usuarios > 0)
);

create table if not exists public.obras_signup_requests (
  id uuid primary key default gen_random_uuid(),
  account_type text not null default 'empresa',
  nome_responsavel text not null,
  empresa text,
  documento text,
  email text not null,
  telefone text not null,
  cidade text not null,
  estado text not null default 'GO',
  plan_id text references public.obras_plans(id) on delete set null,
  observacoes text,
  status text not null default 'novo',
  converted_account_id uuid references public.obras_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_signup_requests_account_type_check check (account_type in ('engenheiro', 'empresa')),
  constraint obras_signup_requests_status_check check (status in ('novo', 'em_analise', 'aprovado', 'rejeitado', 'convertido')),
  constraint obras_signup_requests_email_check check (email = lower(trim(email)) and email <> '')
);

create table if not exists public.obras_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.obras_accounts(id) on delete cascade,
  plan_id text references public.obras_plans(id) on delete set null,
  status text not null default 'trial',
  started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancelled_at timestamptz,
  limite_obras integer,
  limite_usuarios integer,
  valor_mensal numeric(10,2) not null default 0,
  payment_provider text,
  external_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_subscriptions_status_check check (status in ('trial', 'active', 'past_due', 'blocked', 'cancelled')),
  constraint obras_subscriptions_limite_obras_check check (limite_obras is null or limite_obras > 0),
  constraint obras_subscriptions_limite_usuarios_check check (limite_usuarios is null or limite_usuarios > 0),
  constraint obras_subscriptions_valor_mensal_check check (valor_mensal >= 0)
);

create unique index if not exists obras_subscriptions_account_id_idx
on public.obras_subscriptions(account_id);

create index if not exists obras_signup_requests_status_idx on public.obras_signup_requests(status);
create index if not exists obras_signup_requests_plan_id_idx on public.obras_signup_requests(plan_id);
create index if not exists obras_subscriptions_plan_id_idx on public.obras_subscriptions(plan_id);

create or replace function public.obras_is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with current_user_data as (
    select
      auth.uid() as user_id,
      lower(coalesce(auth.jwt() ->> 'email', '')) as email
  ),
  first_account as (
    select id
    from public.obras_accounts
    order by created_at asc
    limit 1
  )
  select coalesce(exists (
    select 1
    from current_user_data session_user_data
    where session_user_data.user_id is not null
      and session_user_data.email <> ''
      and (
        exists (
          select 1
          from public.obras_platform_admins admin
          where lower(admin.email) = session_user_data.email
            and admin.active = true
        )
        or exists (
          select 1
          from public.obras_users obras_user
          join first_account on first_account.id = obras_user.account_id
          where obras_user.auth_user_id = session_user_data.user_id
            and obras_user.active = true
            and obras_user.login_enabled = true
            and obras_user.role in ('owner', 'admin')
        )
      )
  ), false);
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'obras_platform_admins',
    'obras_plans',
    'obras_signup_requests',
    'obras_subscriptions'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_obras_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.obras_platform_admins enable row level security;
alter table public.obras_plans enable row level security;
alter table public.obras_signup_requests enable row level security;
alter table public.obras_subscriptions enable row level security;

grant select on public.obras_plans to anon, authenticated;
grant insert, update, delete on public.obras_plans to authenticated;
grant insert on public.obras_signup_requests to anon, authenticated;
grant select, update, delete on public.obras_signup_requests to authenticated;
grant select on public.obras_subscriptions to authenticated;
grant insert, update, delete on public.obras_subscriptions to authenticated;
grant select on public.obras_platform_admins to authenticated;
grant insert, update, delete on public.obras_platform_admins to authenticated;
grant execute on function public.obras_is_platform_admin() to authenticated;

create policy "obras_platform_admins_select_platform" on public.obras_platform_admins
for select to authenticated
using (public.obras_is_platform_admin());

create policy "obras_platform_admins_insert_platform" on public.obras_platform_admins
for insert to authenticated
with check (public.obras_is_platform_admin());

create policy "obras_platform_admins_update_platform" on public.obras_platform_admins
for update to authenticated
using (public.obras_is_platform_admin())
with check (public.obras_is_platform_admin());

create policy "obras_platform_admins_delete_platform" on public.obras_platform_admins
for delete to authenticated
using (public.obras_is_platform_admin());

create policy "obras_plans_select_active" on public.obras_plans
for select to anon, authenticated
using (active = true);

create policy "obras_plans_select_platform" on public.obras_plans
for select to authenticated
using (public.obras_is_platform_admin());

create policy "obras_plans_insert_platform" on public.obras_plans
for insert to authenticated
with check (public.obras_is_platform_admin());

create policy "obras_plans_update_platform" on public.obras_plans
for update to authenticated
using (public.obras_is_platform_admin())
with check (public.obras_is_platform_admin());

create policy "obras_plans_delete_platform" on public.obras_plans
for delete to authenticated
using (public.obras_is_platform_admin());

create policy "obras_signup_requests_insert_public" on public.obras_signup_requests
for insert to anon, authenticated
with check (true);

create policy "obras_signup_requests_select_platform" on public.obras_signup_requests
for select to authenticated
using (public.obras_is_platform_admin());

create policy "obras_signup_requests_update_platform" on public.obras_signup_requests
for update to authenticated
using (public.obras_is_platform_admin())
with check (public.obras_is_platform_admin());

create policy "obras_signup_requests_delete_platform" on public.obras_signup_requests
for delete to authenticated
using (public.obras_is_platform_admin());

create policy "obras_subscriptions_select_account_or_platform" on public.obras_subscriptions
for select to authenticated
using (
  account_id = public.obras_current_account_id()
  or public.obras_is_platform_admin()
);

create policy "obras_subscriptions_insert_platform" on public.obras_subscriptions
for insert to authenticated
with check (public.obras_is_platform_admin());

create policy "obras_subscriptions_update_platform" on public.obras_subscriptions
for update to authenticated
using (public.obras_is_platform_admin())
with check (public.obras_is_platform_admin());

create policy "obras_subscriptions_delete_platform" on public.obras_subscriptions
for delete to authenticated
using (public.obras_is_platform_admin());

insert into public.obras_plans (
  id,
  nome,
  descricao,
  tipo,
  valor_mensal,
  limite_obras,
  limite_usuarios,
  recursos,
  sort_order
) values
  (
    'engenheiro-individual',
    'Engenheiro individual',
    'Para profissional autonomo acompanhar obras residenciais.',
    'engenheiro',
    79.90,
    8,
    3,
    '["Cronograma inteligente", "Fotos por etapa", "Pendencias", "Relatorios basicos"]'::jsonb,
    1
  ),
  (
    'empresa-campo',
    'Empresa de obras',
    'Para empresas com equipe propria e varias obras em andamento.',
    'empresa',
    149.90,
    30,
    12,
    '["Multiusuarios", "Cronograma por obra", "PLS Caixa", "Fotos com miniatura", "Relatorios"]'::jsonb,
    2
  ),
  (
    'construtora',
    'Construtora',
    'Para operacao com varias cidades, gestores e padroes de cronograma.',
    'construtora',
    299.90,
    null,
    null,
    '["Obras ilimitadas", "Usuarios ilimitados", "Padroes de cronograma", "Gestao comercial", "Suporte prioritario"]'::jsonb,
    3
  )
on conflict (id) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  tipo = excluded.tipo,
  valor_mensal = excluded.valor_mensal,
  limite_obras = excluded.limite_obras,
  limite_usuarios = excluded.limite_usuarios,
  recursos = excluded.recursos,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.obras_platform_admins (email, nome)
select distinct on (lower(email))
  lower(email),
  nome
from public.obras_users
where active = true
  and login_enabled = true
  and role in ('owner', 'admin')
  and email is not null
  and trim(email) <> ''
order by lower(email), created_at asc
on conflict do nothing;

insert into public.obras_subscriptions (
  account_id,
  plan_id,
  status,
  started_at,
  trial_ends_at,
  limite_obras,
  limite_usuarios,
  valor_mensal,
  notes
)
select
  account.id,
  'empresa-campo',
  'trial',
  now(),
  now() + interval '30 days',
  30,
  12,
  149.90,
  'Assinatura inicial criada automaticamente para contas existentes.'
from public.obras_accounts account
on conflict (account_id) do nothing;
