alter table public.obras_users
  add column if not exists login_enabled boolean not null default true;

comment on column public.obras_users.login_enabled is 'Permite login explicito no sistema Obras, separado dos usuarios do Motoboy.';

create index if not exists obras_users_login_enabled_idx
  on public.obras_users(login_enabled)
  where login_enabled = true;

update public.obras_users obras_user
set login_enabled = false
where exists (
  select 1
  from public.profiles profile
  left join auth.users auth_user on auth_user.id = profile.id
  where profile.id = obras_user.auth_user_id
     or lower(coalesce(profile.email, auth_user.email, '')) = lower(obras_user.email)
);

create or replace function public.obras_current_account_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select obras_user.account_id
  from public.obras_users obras_user
  where obras_user.auth_user_id = auth.uid()
    and obras_user.active = true
    and obras_user.login_enabled = true
  limit 1;
$$;

create or replace function public.obras_current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select obras_user.role
  from public.obras_users obras_user
  where obras_user.auth_user_id = auth.uid()
    and obras_user.active = true
    and obras_user.login_enabled = true
  limit 1;
$$;

create or replace function public.obras_can_access_project(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.obras_projects project
    join public.obras_users obras_user on obras_user.account_id = project.account_id
    where project.id = target_project_id
      and obras_user.auth_user_id = auth.uid()
      and obras_user.active = true
      and obras_user.login_enabled = true
  );
$$;

create or replace function public.obras_claim_user()
returns public.obras_users
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  claimed_user public.obras_users;
begin
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null or current_email = '' then
    return null;
  end if;

  update public.obras_users
  set
    auth_user_id = auth.uid(),
    updated_at = now()
  where id = (
    select candidate.id
    from public.obras_users candidate
    where candidate.auth_user_id is null
      and candidate.active = true
      and candidate.login_enabled = true
      and lower(candidate.email) = current_email
    order by candidate.created_at asc
    limit 1
  )
  returning * into claimed_user;

  if claimed_user.id is not null then
    return claimed_user;
  end if;

  select *
  into claimed_user
  from public.obras_users obras_user
  where obras_user.auth_user_id = auth.uid()
    and obras_user.active = true
    and obras_user.login_enabled = true
  order by obras_user.created_at asc
  limit 1;

  return claimed_user;
end;
$$;

grant execute on function public.obras_current_account_id() to authenticated;
grant execute on function public.obras_current_role() to authenticated;
grant execute on function public.obras_can_access_project(uuid) to authenticated;
grant execute on function public.obras_claim_user() to authenticated;
