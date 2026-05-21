create or replace function public.advance_delivery_offer_queue(
  p_delivery_id uuid,
  p_offer_timeout_seconds integer default 60
)
returns table (
  ok boolean,
  reason text,
  offer_id uuid,
  courier_id uuid,
  repeated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_active_offer record;
  v_next_offer record;
  v_marked_offer record;
  v_repeated boolean := false;
  v_now timestamptz := now();
  v_timeout_seconds integer := greatest(coalesce(p_offer_timeout_seconds, 60), 1);
  v_profile_store_id uuid := public.current_profile_store_id();
  v_profile_courier_id uuid := public.current_profile_courier_id();
begin
  select id, city_id, store_id, status
  into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    return query select false, 'delivery-not-found', null::uuid, null::uuid, false;
    return;
  end if;

  if auth.uid() is null then
    return query select false, 'not-authenticated', null::uuid, null::uuid, false;
    return;
  end if;

  if not (
    public.can_manage_city(v_delivery.city_id)
    or v_profile_store_id = v_delivery.store_id
    or exists (
      select 1
      from public.delivery_queue dq
      where dq.delivery_id = p_delivery_id
        and dq.courier_id = v_profile_courier_id
    )
  ) then
    return query select false, 'permission-denied', null::uuid, null::uuid, false;
    return;
  end if;

  if v_delivery.status <> 'pending' then
    return query select false, 'delivery-not-pending', null::uuid, null::uuid, false;
    return;
  end if;

  update public.delivery_queue
  set
    status = 'expired',
    answered_at = coalesce(answered_at, v_now)
  where delivery_id = p_delivery_id
    and status = 'offered'
    and offered_at < v_now - make_interval(secs => v_timeout_seconds);

  select id, courier_id, offered_at
  into v_active_offer
  from public.delivery_queue
  where delivery_id = p_delivery_id
    and status = 'offered'
  order by offered_at asc nulls last, updated_at asc, created_at asc
  limit 1;

  if found then
    update public.delivery_queue
    set
      status = 'expired',
      answered_at = coalesce(answered_at, v_now)
    where delivery_id = p_delivery_id
      and status = 'offered'
      and id <> v_active_offer.id;

    return query select true, 'active-offer', v_active_offer.id, v_active_offer.courier_id, false;
    return;
  end if;

  loop
    for v_next_offer in
      select dq.id, dq.courier_id
      from public.delivery_queue dq
      join public.couriers c on c.id = dq.courier_id
      where dq.delivery_id = p_delivery_id
        and dq.status = 'waiting'
      order by dq.queue_position asc, dq.created_at asc
    loop
      if exists (
        select 1
        from public.couriers c
        where c.id = v_next_offer.courier_id
          and c.active = true
          and c.approval_status = 'approved'
          and c.availability_status = 'available'
      ) then
        update public.delivery_queue
        set
          status = 'offered',
          offered_at = v_now,
          answered_at = null
        where id = v_next_offer.id
          and status = 'waiting'
        returning id, courier_id, offered_at
        into v_marked_offer;

        if found then
          return query select true, 'offered', v_marked_offer.id, v_marked_offer.courier_id, v_repeated;
          return;
        end if;
      else
        update public.delivery_queue
        set
          status = 'skipped',
          answered_at = coalesce(answered_at, v_now)
        where id = v_next_offer.id
          and status = 'waiting';
      end if;
    end loop;

    if v_repeated then
      return query select false, 'no-online-courier', null::uuid, null::uuid, true;
      return;
    end if;

    if exists (
      select 1
      from public.delivery_queue
      where delivery_id = p_delivery_id
        and status = 'waiting'
    ) then
      return query select false, 'waiting-couriers-not-offered', null::uuid, null::uuid, false;
      return;
    end if;

    update public.delivery_queue
    set
      status = 'waiting',
      offered_at = null,
      answered_at = null
    where delivery_id = p_delivery_id
      and status in ('expired', 'rejected', 'skipped');

    v_repeated := true;
  end loop;
end;
$$;

grant execute on function public.advance_delivery_offer_queue(uuid, integer) to authenticated;
