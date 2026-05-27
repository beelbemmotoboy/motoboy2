create or replace function public.list_online_couriers_for_current_city(target_city_id uuid)
returns table (
  id uuid,
  name text,
  face_photo_path text,
  total_points numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    c.face_photo_path,
    coalesce(cp.total_points, 0) as total_points
  from public.couriers c
  left join public.courier_points cp on cp.courier_id = c.id
  where c.city_id = target_city_id
    and c.active = true
    and c.available = true
    and c.approval_status = 'approved'
    and c.availability_status in ('available', 'on_delivery')
    and (
      public.can_manage_city(target_city_id)
      or public.current_profile_city_id() = target_city_id
    )
  order by c.name asc;
$$;

grant execute on function public.list_online_couriers_for_current_city(uuid) to authenticated;

notify pgrst, 'reload schema';
