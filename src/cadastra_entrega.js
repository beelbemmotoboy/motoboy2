import { onlyDigits } from './utils/validators';

export function emptyDelivery() {
  return {
    id: '',
    code: 'Sem pedido',
    customer: 'Nenhum pedido pendente',
    store: 'Aguardando loja',
    fee: 'R$ 0,00',
    numericFee: 0,
    xp: '+0',
    address: 'Endereco nao informado',
    district: 'Bairro nao informado',
    locationUrl: '',
    refusals: '1/3',
    status: 'empty',
    queueId: '',
    offeredAt: null,
  };
}

export function formatDeliveryForCourier(delivery, queueId = '') {
  const deliveryAddress = delivery.delivery_address || delivery.customers?.address || 'Endereco nao informado';
  const deliveryDistrict = inferDistrictFromAddress(deliveryAddress);

  return {
    id: delivery.id,
    code: delivery.order_code || delivery.id,
    customer: delivery.customers?.name || 'Cliente nao informado',
    store: delivery.stores?.fantasy_name || delivery.stores?.name || 'Loja nao informada',
    fee: formatCurrency(Number(delivery.delivery_fee || 0)),
    numericFee: Number(delivery.delivery_fee || 0),
    xp: '+50',
    address: deliveryAddress,
    district: deliveryDistrict,
    locationUrl: deliveryAddress && deliveryAddress !== 'Endereco nao informado'
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`
      : '',
    refusals: '1/3',
    status: delivery.status,
    queueId,
    offeredAt: delivery.offered_at || null,
  };
}

export async function createDeliveryWithQueue({ supabase, city, store, requestForm }) {
  if (!supabase) throw new Error('Supabase nao disponivel nesta sessao.');
  if (!store?.id || !city?.id) throw new Error('Loja ou cidade nao encontrada para criar a entrega.');
  if (!requestForm.orderCode.trim() || !requestForm.customerName.trim() || !requestForm.deliveryAddress.trim()) {
    throw new Error('Pedido, cliente e endereco de entrega sao obrigatorios.');
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      city_id: city.id,
      name: requestForm.customerName.trim(),
      phone: onlyDigits(requestForm.customerPhone),
      address: requestForm.deliveryAddress.trim(),
    })
    .select('id')
    .single();

  if (customerError) throw new Error(`Nao foi possivel cadastrar o cliente: ${customerError.message}`);

  const deliveryFee = Number(String(requestForm.deliveryFee).replace(',', '.')) || 0;
  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .insert({
      city_id: city.id,
      order_code: requestForm.orderCode.trim(),
      store_id: store.id,
      customer_id: customer.id,
      pickup_address: [store.address, store.number, store.district].filter(Boolean).join(', '),
      delivery_address: requestForm.deliveryAddress.trim(),
      delivery_fee: deliveryFee,
      status: 'pending',
    })
    .select('id')
    .single();

  if (deliveryError) throw new Error(`Nao foi possivel criar a entrega: ${deliveryError.message}`);

  const queuedCount = await buildDeliveryQueue({ supabase, cityId: city.id, deliveryId: delivery.id });
  return { deliveryId: delivery.id, queuedCount };
}

export async function buildDeliveryQueue({ supabase, cityId, deliveryId }) {
  const { data: couriers, error: couriersError } = await supabase
    .from('couriers')
    .select('id, created_at')
    .eq('city_id', cityId)
    .eq('active', true)
    .eq('approval_status', 'approved')
    .in('availability_status', ['available', 'offline']);

  if (couriersError) throw new Error(`Nao foi possivel buscar motoboys: ${couriersError.message}`);
  if (!couriers?.length) return 0;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const { data: todayDeliveries, error: todayError } = await supabase
    .from('deliveries')
    .select('courier_id')
    .eq('city_id', cityId)
    .gte('created_at', dayStart.toISOString())
    .not('courier_id', 'is', null)
    .in('status', ['assigned', 'picked_up', 'on_route', 'delivered']);

  if (todayError) throw new Error(`Nao foi possivel calcular fila: ${todayError.message}`);

  const deliveryCountByCourier = new Map();
  for (const item of todayDeliveries ?? []) {
    deliveryCountByCourier.set(item.courier_id, (deliveryCountByCourier.get(item.courier_id) ?? 0) + 1);
  }

  const orderedCouriers = [...couriers].sort((a, b) => {
    const deliveriesA = deliveryCountByCourier.get(a.id) ?? 0;
    const deliveriesB = deliveryCountByCourier.get(b.id) ?? 0;
    if (deliveriesA !== deliveriesB) return deliveriesA - deliveriesB;
    return String(a.created_at).localeCompare(String(b.created_at));
  });

  const queueRows = orderedCouriers.map((courier, index) => ({
    city_id: cityId,
    delivery_id: deliveryId,
    courier_id: courier.id,
    queue_position: index + 1,
    status: 'waiting',
  }));

  const { error: queueError } = await supabase.from('delivery_queue').insert(queueRows);
  if (queueError) throw new Error(`Entrega criada, mas nao foi possivel montar a fila: ${queueError.message}`);
  return queueRows.length;
}

export async function getNextDeliveryForCourier({ supabase, cityId, courierId }) {
  if (!supabase || !cityId || !courierId) return emptyDelivery();

  const baseSelect = 'id, order_code, delivery_address, delivery_fee, status, created_at, customers(name, address), stores(name, fantasy_name)';
  const { data: assignedData, error: assignedError } = await supabase
    .from('deliveries')
    .select(baseSelect)
    .eq('courier_id', courierId)
    .in('status', ['assigned', 'picked_up', 'on_route'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (assignedError) throw new Error(`Nao foi possivel buscar entrega: ${assignedError.message}`);
  if (assignedData?.length) return formatDeliveryForCourier(assignedData[0]);

  const { data: queueRows, error: queueError } = await supabase
    .from('delivery_queue')
    .select('id, delivery_id, queue_position, offered_at, deliveries!inner(id, order_code, delivery_address, delivery_fee, status, created_at, customers(name, address), stores(name, fantasy_name))')
    .eq('city_id', cityId)
    .eq('courier_id', courierId)
    .eq('status', 'waiting')
    .eq('deliveries.status', 'pending')
    .order('queue_position', { ascending: true })
    .limit(10);

  if (queueError) {
    const schemaCacheError = queueError.message?.includes('schema cache') || queueError.message?.includes('delivery_queue');
    throw new Error(schemaCacheError
      ? 'Fila ainda nao disponivel no Supabase. Rode o schema.sql completo e depois atualize/recarregue o cache do schema no Supabase.'
      : `Nao foi possivel buscar fila: ${queueError.message}`);
  }

  for (const queueRow of queueRows ?? []) {
    const blocked = await hasEarlierQueueCandidate({ supabase, deliveryId: queueRow.delivery_id, queuePosition: queueRow.queue_position });
    if (!blocked && queueRow.deliveries) {
      const offeredAt = queueRow.offered_at || new Date().toISOString();
      if (!queueRow.offered_at) {
        await supabase.from('delivery_queue').update({ offered_at: offeredAt }).eq('id', queueRow.id);
      }
      return formatDeliveryForCourier({ ...queueRow.deliveries, offered_at: offeredAt }, queueRow.id);
    }
  }

  return emptyDelivery();
}

export async function acceptQueuedDelivery({ supabase, cityId, delivery, courierId, courierName }) {
  if (!delivery?.id || !courierId) throw new Error('Nenhuma entrega disponivel para aceitar.');

  const { error } = await supabase
    .from('deliveries')
    .update({ courier_id: courierId, status: 'assigned' })
    .eq('id', delivery.id)
    .eq('status', 'pending');

  if (error) throw new Error(`Nao foi possivel aceitar: ${error.message}`);

  await supabase
    .from('delivery_queue')
    .update({ status: 'accepted', answered_at: new Date().toISOString() })
    .eq('delivery_id', delivery.id)
    .eq('courier_id', courierId);

  await supabase.from('delivery_events').insert({
    city_id: cityId,
    delivery_id: delivery.id,
    status: 'assigned',
    note: `${courierName} aceitou a entrega.`,
  });
  await supabase.from('couriers').update({ availability_status: 'on_delivery' }).eq('id', courierId);
}

export async function markDeliveryPickedUp({ supabase, cityId, delivery, courierId, courierName }) {
  if (!delivery?.id || !courierId) throw new Error('Nenhuma entrega aceita para retirar na loja.');

  const { error } = await supabase
    .from('deliveries')
    .update({ status: 'picked_up' })
    .eq('id', delivery.id)
    .eq('courier_id', courierId)
    .eq('status', 'assigned')
    .select('id')
    .single();

  if (error) throw new Error(`Nao foi possivel confirmar retirada: ${error.message}`);

  await supabase.from('delivery_events').insert({
    city_id: cityId,
    delivery_id: delivery.id,
    status: 'picked_up',
    note: `${courierName} retirou o pedido na loja.`,
  });
}

export async function rejectQueuedDelivery({ supabase, cityId, delivery, courierId, courierName }) {
  if (!delivery?.id || !courierId) throw new Error('Nenhuma entrega disponivel para recusar.');

  const { error } = await supabase
    .from('delivery_queue')
    .update({ status: 'rejected', answered_at: new Date().toISOString() })
    .eq('delivery_id', delivery.id)
    .eq('courier_id', courierId)
    .eq('status', 'waiting');

  if (error) throw new Error(`Nao foi possivel recusar: ${error.message}`);

  await supabase
    .from('delivery_rejections')
    .upsert({
      city_id: cityId,
      delivery_id: delivery.id,
      courier_id: courierId,
      reason: 'Recusada pelo motoboy',
    }, { onConflict: 'delivery_id,courier_id' });

  await supabase.from('delivery_events').insert({
    city_id: cityId,
    delivery_id: delivery.id,
    status: 'pending',
    note: `${courierName} recusou a entrega.`,
  });
}

export async function setCourierAvailable({ supabase, courierId, available }) {
  if (!supabase || !courierId) return;
  await supabase
    .from('couriers')
    .update({
      available,
      availability_status: available ? 'available' : 'offline',
    })
    .eq('id', courierId);
}

async function hasEarlierQueueCandidate({ supabase, deliveryId, queuePosition }) {
  const { count, error } = await supabase
    .from('delivery_queue')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_id', deliveryId)
    .eq('status', 'waiting')
    .lt('queue_position', queuePosition);

  if (error) throw new Error(`Nao foi possivel validar ordem da fila: ${error.message}`);
  return Number(count || 0) > 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function inferDistrictFromAddress(address) {
  if (!address || address === 'Endereco nao informado') return 'Bairro nao informado';
  const parts = String(address)
    .split(/\s[-|]\s|,/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return 'Bairro nao informado';
  return parts[parts.length - 1];
}
