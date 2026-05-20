drop policy if exists "courier_points_read_by_scope" on public.courier_points;

create policy "courier_points_read_by_scope" on public.courier_points
  for select to authenticated using (
    public.is_system_admin()
    or courier_id = public.current_profile_courier_id()
    or exists (
      select 1 from public.couriers c
      where c.id = courier_points.courier_id
      and (
        public.is_city_admin(c.city_id)
        or (
          public.current_profile_role() = 'store_admin'
          and c.city_id = public.current_profile_city_id()
        )
      )
    )
  );
