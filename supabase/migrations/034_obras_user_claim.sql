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
  order by obras_user.created_at asc
  limit 1;

  return claimed_user;
end;
$$;

grant execute on function public.obras_claim_user() to authenticated;
