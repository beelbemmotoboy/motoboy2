create or replace function public.build_delivery_queue(
  p_city_id uuid,
  p_delivery_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_profile_store_id uuid := public.current_profile_store_id();
  v_inserted_count integer := 0;
begin
  select d.id, d.city_id, d.store_id, d.status
  into v_delivery
  from public.deliveries d
  where d.id = p_delivery_id
    and d.city_id = p_city_id
  for update;

  if not found then
    raise exception 'Entrega nao encontrada para montar fila.';
  end if;

  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not (
    public.can_manage_city(v_delivery.city_id)
    or v_profile_store_id = v_delivery.store_id
  ) then
    raise exception 'Usuario sem permissao para montar fila desta entrega.';
  end if;

  if v_delivery.status <> 'pending' then
    return 0;
  end if;

  select count(*)
  into v_inserted_count
  from public.delivery_queue dq
  where dq.delivery_id = p_delivery_id;

  if v_inserted_count > 0 then
    return v_inserted_count;
  end if;

  with today_deliveries as (
    select d.courier_id, count(*)::integer as total
    from public.deliveries d
    where d.city_id = p_city_id
      and d.created_at >= date_trunc('day', now())
      and d.courier_id is not null
      and d.status in ('assigned', 'picked_up', 'on_route', 'delivered')
    group by d.courier_id
  ),
  active_offers as (
    select dq.courier_id, count(*)::integer as total
    from public.delivery_queue dq
    join public.deliveries d on d.id = dq.delivery_id
    where d.city_id = p_city_id
      and d.status = 'pending'
      and dq.status = 'offered'
    group by dq.courier_id
  ),
  ordered_couriers as (
    select
      c.id as courier_id,
      row_number() over (
        order by
          coalesce(ao.total, 0) asc,
          coalesce(td.total, 0) asc,
          c.created_at asc
      ) as queue_position
    from public.couriers c
    left join today_deliveries td on td.courier_id = c.id
    left join active_offers ao on ao.courier_id = c.id
    where c.city_id = p_city_id
      and c.active = true
      and c.approval_status = 'approved'
      and c.availability_status in ('available', 'on_delivery')
  ),
  inserted as (
    insert into public.delivery_queue (
      city_id,
      delivery_id,
      courier_id,
      queue_position,
      status,
      offered_at
    )
    select
      p_city_id,
      p_delivery_id,
      oc.courier_id,
      oc.queue_position,
      case when oc.queue_position = 1 then 'offered' else 'waiting' end,
      case when oc.queue_position = 1 then now() else null end
    from ordered_couriers oc
    order by oc.queue_position
    returning id
  )
  select count(*)::integer
  into v_inserted_count
  from inserted;

  return coalesce(v_inserted_count, 0);
end;
$$;

grant execute on function public.build_delivery_queue(uuid, uuid) to authenticated;
