drop function if exists public.advance_delivery_offer_queue(uuid, integer);

create or replace function public.advance_delivery_offer_queue(
  p_delivery_id uuid,
  p_offer_timeout_seconds integer default 60
)
returns table (
  ok boolean,
  reason text,
  offer_id uuid,
  offered_courier_id uuid,
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
  v_now timestamptz := now();
  v_timeout_seconds integer := greatest(coalesce(p_offer_timeout_seconds, 60), 1);
  v_individual_offer_limit integer := 5;
  v_broadcast_after interval := make_interval(secs => greatest(coalesce(p_offer_timeout_seconds, 60), 1) * 5);
  v_attempts integer := 0;
  v_broadcast boolean := false;
  v_broadcast_attempted boolean := false;
  v_profile_store_id uuid := public.current_profile_store_id();
  v_profile_courier_id uuid := public.current_profile_courier_id();
begin
  select d.id, d.city_id, d.store_id, d.status, d.created_at
  into v_delivery
  from public.deliveries d
  where d.id = p_delivery_id
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

  update public.delivery_queue as dq
  set
    status = 'expired',
    answered_at = coalesce(dq.answered_at, v_now)
  where dq.delivery_id = p_delivery_id
    and dq.status = 'offered'
    and dq.offered_at < v_now - make_interval(secs => v_timeout_seconds);

  select dq.id, dq.courier_id, dq.offered_at
  into v_active_offer
  from public.delivery_queue dq
  where dq.delivery_id = p_delivery_id
    and dq.status = 'offered'
  order by dq.offered_at asc nulls last, dq.updated_at asc, dq.created_at asc
  limit 1;

  if found then
    return query select true, 'active-offer', v_active_offer.id, v_active_offer.courier_id, false;
    return;
  end if;

  select count(*)
  into v_attempts
  from public.delivery_queue dq
  where dq.delivery_id = p_delivery_id
    and dq.offered_at is not null;

  select exists (
    select 1
    from public.delivery_queue dq
    where dq.delivery_id = p_delivery_id
      and dq.offered_at >= v_delivery.created_at + v_broadcast_after
  )
  into v_broadcast_attempted;

  v_broadcast := v_now >= v_delivery.created_at + v_broadcast_after
    or v_attempts >= v_individual_offer_limit;

  if v_broadcast and v_broadcast_attempted then
    return query select false, 'broadcast-expired', null::uuid, null::uuid, false;
    return;
  end if;

  if v_broadcast then
    for v_marked_offer in
      update public.delivery_queue as dq
      set
        status = 'offered',
        offered_at = v_now,
        answered_at = null
      from public.couriers c
      where dq.delivery_id = p_delivery_id
        and dq.courier_id = c.id
        and dq.status in ('waiting', 'expired', 'rejected', 'skipped')
        and c.active = true
        and c.approval_status = 'approved'
        and c.availability_status in ('available', 'on_delivery')
      returning dq.id, dq.courier_id, dq.offered_at
    loop
      return query select true, 'broadcast-offered', v_marked_offer.id, v_marked_offer.courier_id, false;
      return;
    end loop;

    return query select false, 'no-online-courier', null::uuid, null::uuid, false;
    return;
  end if;

  for v_next_offer in
    select dq.id, dq.courier_id
    from public.delivery_queue dq
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
        and c.availability_status in ('available', 'on_delivery')
    ) then
      update public.delivery_queue as dq
      set
        status = 'offered',
        offered_at = v_now,
        answered_at = null
      where dq.id = v_next_offer.id
        and dq.status = 'waiting'
      returning dq.id, dq.courier_id, dq.offered_at
      into v_marked_offer;

      if found then
        return query select true, 'offered', v_marked_offer.id, v_marked_offer.courier_id, false;
        return;
      end if;

      return query select false, 'offer-already-advanced', null::uuid, null::uuid, false;
      return;
    end if;

    update public.delivery_queue as dq
    set
      status = 'skipped',
      answered_at = coalesce(dq.answered_at, v_now)
    where dq.id = v_next_offer.id
      and dq.status = 'waiting';
  end loop;

  update public.delivery_queue as dq
  set
    status = 'waiting',
    offered_at = null,
    answered_at = null
  where dq.delivery_id = p_delivery_id
    and dq.status in ('expired', 'rejected', 'skipped');

  if not found then
    return query select false, 'no-waiting-courier', null::uuid, null::uuid, false;
    return;
  end if;

  for v_next_offer in
    select dq.id, dq.courier_id
    from public.delivery_queue dq
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
        and c.availability_status in ('available', 'on_delivery')
    ) then
      update public.delivery_queue as dq
      set
        status = 'offered',
        offered_at = v_now,
        answered_at = null
      where dq.id = v_next_offer.id
        and dq.status = 'waiting'
      returning dq.id, dq.courier_id, dq.offered_at
      into v_marked_offer;

      if found then
        return query select true, 'offered-repeat', v_marked_offer.id, v_marked_offer.courier_id, true;
        return;
      end if;

      return query select false, 'offer-already-advanced', null::uuid, null::uuid, false;
      return;
    end if;

    update public.delivery_queue as dq
    set
      status = 'skipped',
      answered_at = coalesce(dq.answered_at, v_now)
    where dq.id = v_next_offer.id
      and dq.status = 'waiting';
  end loop;

  return query select false, 'no-online-courier', null::uuid, null::uuid, true;
end;
$$;

grant execute on function public.advance_delivery_offer_queue(uuid, integer) to authenticated;
