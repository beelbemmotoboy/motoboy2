import { onlyDigits } from './utils/validators.js';
import { selecionar_entregas_compativeis_para_motoboy } from './regras_agrupamento_entregas.js';
import { verificar_motoboy_proximo_da_loja } from './regras_localizacao.js';
import { parseValorMonetarioPedidoLoja } from './ValidaPedidoLoja.js';

const DELIVERY_RULES_SELECT = 'id, city_id, order_code, store_id, customer_id, courier_id, pickup_address, delivery_address, delivery_district, delivery_complement, customer_latitude, customer_longitude, delivery_deadline_at, estimated_minutes, delivery_fee, status, created_at, customers(id, name, phone, address), stores(id, name, fantasy_name, whatsapp, address, address_number, district, latitude, longitude)';
export const DELIVERY_OFFER_TIMEOUT_SECONDS = 60;
export const DELIVERY_INDIVIDUAL_OFFER_LIMIT = 5;
export const DELIVERY_BROADCAST_AFTER_SECONDS = DELIVERY_INDIVIDUAL_OFFER_LIMIT * DELIVERY_OFFER_TIMEOUT_SECONDS;
export const STORE_PENDING_FOLLOWUP_SECONDS = 5 * 60;

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
    complement: '',
    deadlineAt: '',
    estimatedMinutes: null,
    customerLatitude: null,
    customerLongitude: null,
    storeLatitude: null,
    storeLongitude: null,
    storeAddress: '',
    locationUrl: '',
    storeWhatsapp: '',
    storeMessageUrl: '',
    refusals: '1/3',
    status: 'empty',
    queueId: '',
    offeredAt: null,
  };
}

export function formatDeliveryForCourier(delivery, queueId = '') {
  const deliveryAddress = delivery.delivery_address || delivery.customers?.address || 'Endereco nao informado';
  const deliveryDistrict = delivery.delivery_district || inferDistrictFromAddress(deliveryAddress);
  const deliveryComplement = delivery.delivery_complement || '';
  const customerLatitude = parseNullableNumber(delivery.customer_latitude);
  const customerLongitude = parseNullableNumber(delivery.customer_longitude);
  const storeLatitude = parseNullableNumber(delivery.stores?.latitude);
  const storeLongitude = parseNullableNumber(delivery.stores?.longitude);
  const storeAddress = [
    delivery.stores?.address,
    delivery.stores?.address_number,
    delivery.stores?.district,
  ].filter(Boolean).join(', ');
  const storeWhatsapp = delivery.stores?.whatsapp || '';
  const locationUrl = customerLatitude !== null && customerLongitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${customerLatitude},${customerLongitude}`
    : deliveryAddress && deliveryAddress !== 'Endereco nao informado'
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`
      : '';

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
    complement: deliveryComplement,
    deadlineAt: delivery.delivery_deadline_at || '',
    estimatedMinutes: delivery.estimated_minutes ?? null,
    customerLatitude,
    customerLongitude,
    storeLatitude,
    storeLongitude,
    storeAddress,
    locationUrl,
    storeWhatsapp,
    storeMessageUrl: buildStoreMessageUrl(storeWhatsapp, delivery),
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

  const deliveryDistrict = requestForm.deliveryDistrict?.trim() || '';
  const deliveryComplement = requestForm.deliveryComplement?.trim() || '';
  const customerLocationUrl = requestForm.customerLocationUrl?.trim() || '';
  const customerCoordinates = extrairCoordenadasDoLinkLocalizacao(customerLocationUrl);
  if (customerLocationUrl && !customerCoordinates) {
    throw new Error('Nao foi possivel extrair latitude e longitude do link da localizacao do cliente.');
  }
  const customerLatitude = customerCoordinates?.latitude ?? null;
  const customerLongitude = customerCoordinates?.longitude ?? null;
  const estimatedMinutes = Math.max(1, Number.parseInt(requestForm.estimatedMinutes, 10) || 45);
  const deliveryDeadlineAt = new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      city_id: city.id,
      name: requestForm.customerName.trim(),
      phone: onlyDigits(requestForm.customerPhone),
      address: [requestForm.deliveryAddress.trim(), deliveryComplement, deliveryDistrict].filter(Boolean).join(' - '),
    })
    .select('id')
    .single();

  if (customerError) throw new Error(`Nao foi possivel cadastrar o cliente: ${customerError.message}`);

  const deliveryFee = parseValorMonetarioPedidoLoja(requestForm.deliveryFee) || 0;
  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .insert({
      city_id: city.id,
      order_code: requestForm.orderCode.trim(),
      store_id: store.id,
      customer_id: customer.id,
      pickup_address: [store.address, store.number, store.district].filter(Boolean).join(', '),
      delivery_address: requestForm.deliveryAddress.trim(),
      delivery_district: deliveryDistrict,
      delivery_complement: deliveryComplement,
      customer_latitude: customerLatitude,
      customer_longitude: customerLongitude,
      estimated_minutes: estimatedMinutes,
      delivery_deadline_at: deliveryDeadlineAt,
      delivery_fee: deliveryFee,
      status: 'pending',
    })
    .select('id')
    .single();

  if (deliveryError) throw new Error(`Nao foi possivel criar a entrega: ${deliveryError.message}`);

  const queuedCount = await buildDeliveryQueue({ supabase, cityId: city.id, deliveryId: delivery.id });
  if (queuedCount > 0) await notifyNextCourierOffer({ supabase, deliveryId: delivery.id });
  return { deliveryId: delivery.id, queuedCount };
}

export async function buildDeliveryQueue({ supabase, cityId, deliveryId }) {
  const { data: deliveryForQueue, error: deliveryForQueueError } = await supabase
    .from('deliveries')
    .select('id, stores(latitude, longitude)')
    .eq('id', deliveryId)
    .maybeSingle();

  if (deliveryForQueueError) throw new Error(`Nao foi possivel buscar localizacao da loja: ${deliveryForQueueError.message}`);

  const { data: couriers, error: couriersError } = await supabase
    .from('couriers')
    .select('id, created_at')
    .eq('city_id', cityId)
    .eq('active', true)
    .eq('approval_status', 'approved')
    .in('availability_status', ['available', 'on_delivery']);

  if (couriersError) throw new Error(`Nao foi possivel buscar motoboys: ${couriersError.message}`);
  if (!couriers?.length) return 0;

  const couriersByRadius = await selecionarMotoboysPorRaioDaLojaComFallback({
    supabase,
    couriers,
    localizacaoLoja: deliveryForQueue?.stores,
  });
  if (!couriersByRadius.length) return 0;

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

  const orderedCouriers = [...couriersByRadius].sort((a, b) => {
    const deliveriesA = deliveryCountByCourier.get(a.id) ?? 0;
    const deliveriesB = deliveryCountByCourier.get(b.id) ?? 0;
    if (deliveriesA !== deliveriesB) return deliveriesA - deliveriesB;
    if (a.distanceToStoreKm !== b.distanceToStoreKm) return a.distanceToStoreKm - b.distanceToStoreKm;
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

async function selecionarMotoboysPorRaioDaLojaComFallback({ supabase, couriers, localizacaoLoja }) {
  const storeLatitude = parseNullableNumber(localizacaoLoja?.latitude);
  const storeLongitude = parseNullableNumber(localizacaoLoja?.longitude);
  if (storeLatitude === null || storeLongitude === null) {
    return couriers.map((courier) => ({ ...courier, distanceToStoreKm: Number.POSITIVE_INFINITY }));
  }

  const courierIds = couriers.map((courier) => courier.id);
  const { data: locations, error } = await supabase
    .from('courier_locations')
    .select('courier_id, latitude, longitude, accuracy_meters, updated_at')
    .in('courier_id', courierIds)
    .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  if (error) {
    const missingLocationTable = error.message?.includes('courier_locations') || error.message?.includes('schema cache');
    if (missingLocationTable) {
      return couriers.map((courier) => ({ ...courier, distanceToStoreKm: Number.POSITIVE_INFINITY }));
    }
    throw new Error(`Nao foi possivel buscar localizacao dos motoboys: ${error.message}`);
  }

  const locationByCourier = new Map((locations ?? []).map((location) => [location.courier_id, location]));
  const couriersWithDistance = couriers.map((courier) => {
    const localizacaoMotoboy = locationByCourier.get(courier.id);
    const resultado = verificar_motoboy_proximo_da_loja({
      localizacao_motoboy: localizacaoMotoboy,
      localizacao_loja: { latitude: storeLatitude, longitude: storeLongitude },
    });
    return {
      ...courier,
      distanceToStoreKm: resultado.distancia_km ?? Number.POSITIVE_INFINITY,
      withinStoreRadius: resultado.permitido,
    };
  });

  const couriersInRadius = couriersWithDistance.filter((courier) => courier.withinStoreRadius);
  return couriersInRadius.length ? couriersInRadius : couriersWithDistance;
}

export async function getNextDeliveryForCourier({ supabase, cityId, courierId }) {
  if (!supabase || !cityId || !courierId) return emptyDelivery();

  const baseSelect = 'id, order_code, delivery_address, delivery_district, delivery_complement, customer_latitude, customer_longitude, delivery_deadline_at, estimated_minutes, delivery_fee, status, created_at, customers(name, address), stores(name, fantasy_name, whatsapp, address, address_number, district, latitude, longitude)';
  const { data: queueRows, error: queueError } = await supabase
    .from('delivery_queue')
    .select('id, delivery_id, queue_position, offered_at, deliveries!inner(id, order_code, delivery_address, delivery_district, delivery_complement, customer_latitude, customer_longitude, delivery_deadline_at, estimated_minutes, delivery_fee, status, created_at, customers(name, address), stores(name, fantasy_name, whatsapp, address, address_number, district, latitude, longitude))')
    .eq('city_id', cityId)
    .eq('courier_id', courierId)
    .eq('status', 'offered')
    .eq('deliveries.status', 'pending')
    .order('offered_at', { ascending: true })
    .limit(1);

  if (queueError) {
    const schemaCacheError = queueError.message?.includes('schema cache') || queueError.message?.includes('delivery_queue');
    throw new Error(schemaCacheError
      ? 'Fila ainda nao disponivel no Supabase. Rode o schema.sql completo e depois atualize/recarregue o cache do schema no Supabase.'
      : `Nao foi possivel buscar fila: ${queueError.message}`);
  }

  const queueRow = queueRows?.[0];
  if (queueRow?.deliveries) {
    if (isQueueOfferExpired(queueRow.offered_at)) {
      await expireQueuedDeliveryOffer({
        supabase,
        cityId,
        delivery: { id: queueRow.delivery_id },
        courierId,
        courierName: 'Motoboy',
        note: 'Tempo para aceite esgotado.',
      });
      return emptyDelivery();
    }
    return formatDeliveryForCourier({ ...queueRow.deliveries, offered_at: queueRow.offered_at }, queueRow.id);
  }

  const { data: assignedData, error: assignedError } = await supabase
    .from('deliveries')
    .select(baseSelect)
    .eq('courier_id', courierId)
    .in('status', ['assigned', 'picked_up', 'on_route'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (assignedError) throw new Error(`Nao foi possivel buscar entrega: ${assignedError.message}`);
  if (assignedData?.length) return formatDeliveryForCourier(assignedData[0]);

  return emptyDelivery();
}

export async function buscarEntregasCompativeisParaMotoboy({
  supabase,
  cityId,
  courierId,
  localizacaoAtualMotoboy = null,
  limiteCorridasDisponiveis = 25,
} = {}) {
  if (!supabase || !cityId || !courierId) {
    return {
      motoboy: null,
      corrida_aceita: null,
      corridas_ativas_do_motoboy: [],
      lista_corridas_disponiveis: [],
      localizacao_atual_motoboy: localizacaoAtualMotoboy,
    };
  }

  const [{ data: courier, error: courierError }, { data: activeDeliveries, error: activeError }] = await Promise.all([
    supabase
      .from('couriers')
      .select('id, city_id, name, availability_status, active, approval_status')
      .eq('id', courierId)
      .maybeSingle(),
    supabase
      .from('deliveries')
      .select(DELIVERY_RULES_SELECT)
      .eq('city_id', cityId)
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'picked_up', 'on_route'])
      .order('created_at', { ascending: true }),
  ]);

  if (courierError) throw new Error(`Nao foi possivel buscar o motoboy: ${courierError.message}`);
  if (activeError) throw new Error(`Nao foi possivel buscar entregas ativas do motoboy: ${activeError.message}`);

  const corridasAtivas = (activeDeliveries ?? []).map(formatDeliveryForRules);
  const corridaAceita = corridasAtivas[0] ?? null;

  if (!corridaAceita) {
    return {
      motoboy: formatCourierForRules(courier, corridasAtivas),
      corrida_aceita: null,
      corridas_ativas_do_motoboy: corridasAtivas,
      lista_corridas_disponiveis: [],
      localizacao_atual_motoboy: localizacaoAtualMotoboy,
    };
  }

  const activeDeliveryIds = new Set(corridasAtivas.map((delivery) => delivery.id).filter(Boolean));
  const { data: pendingDeliveries, error: pendingError } = await supabase
    .from('deliveries')
    .select(DELIVERY_RULES_SELECT)
    .eq('city_id', cityId)
    .eq('status', 'pending')
    .is('courier_id', null)
    .order('created_at', { ascending: true })
    .limit(limiteCorridasDisponiveis);

  if (pendingError) throw new Error(`Nao foi possivel buscar entregas disponiveis: ${pendingError.message}`);

  const corridasDisponiveis = (pendingDeliveries ?? [])
    .filter((delivery) => !activeDeliveryIds.has(delivery.id))
    .map(formatDeliveryForRules);

  return {
    motoboy: formatCourierForRules(courier, corridasAtivas),
    corrida_aceita: corridaAceita,
    corridas_ativas_do_motoboy: corridasAtivas,
    lista_corridas_disponiveis: corridasDisponiveis,
    localizacao_atual_motoboy: localizacaoAtualMotoboy,
  };
}

export async function avaliarEntregasCompativeisParaMotoboy({
  supabase,
  cityId,
  courierId,
  localizacaoAtualMotoboy = null,
  rotaEstimativaAtual,
  limiteCorridasDisponiveis,
  configuracoes,
} = {}) {
  const contexto = await buscarEntregasCompativeisParaMotoboy({
    supabase,
    cityId,
    courierId,
    localizacaoAtualMotoboy,
    limiteCorridasDisponiveis,
  });

  if (!contexto.corrida_aceita) {
    return {
      ...contexto,
      corridas_compativeis: [],
      corridas_rejeitadas: [],
      sugestao_ordem_coleta_entrega: null,
      impacto_estimado_tempo_total_minutos: 0,
    };
  }

  const avaliacao = selecionar_entregas_compativeis_para_motoboy({
    motoboy: contexto.motoboy,
    corrida_aceita: contexto.corrida_aceita,
    corridas_ativas_do_motoboy: contexto.corridas_ativas_do_motoboy,
    lista_corridas_disponiveis: contexto.lista_corridas_disponiveis,
    localizacao_atual_motoboy: contexto.localizacao_atual_motoboy,
    rota_estimativa_atual: rotaEstimativaAtual,
    configuracoes,
  });

  return {
    ...contexto,
    ...avaliacao,
  };
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
}

export function extrairCoordenadasDoLinkLocalizacao(linkLocalizacao = '') {
  const texto = String(linkLocalizacao || '').trim();
  if (!texto) return null;

  const textoDecodificado = decodeUrlText(texto);
  const patterns = [
    /@(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/,
    /!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/,
    /(?:^|[^\d-])(-?\d{1,2}(?:[.,]\d+)?),\s*(-?\d{1,3}(?:[.,]\d+)?)(?:[^\d]|$)/,
  ];

  for (const pattern of patterns) {
    const match = textoDecodificado.match(pattern);
    if (!match) continue;
    const latitude = parseNullableNumber(match[1]);
    const longitude = parseNullableNumber(match[2]);
    if (coordenadasValidas(latitude, longitude)) return { latitude, longitude };
  }

  return null;
}

function decodeUrlText(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

function coordenadasValidas(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function buildStoreMessageUrl(phone, delivery) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  const message = [
    'Ola, preciso falar sobre a entrega.',
    `Pedido: ${delivery.order_code || delivery.id || ''}`,
    `Cliente: ${delivery.customers?.name || 'Cliente nao informado'}`,
  ].join('\n');
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

function formatDeliveryForRules(delivery) {
  const formatted = formatDeliveryForCourier(delivery);
  return {
    ...formatted,
    city_id: delivery.city_id,
    store_id: delivery.store_id,
    storeId: delivery.store_id,
    customer_id: delivery.customer_id,
    customerId: delivery.customer_id,
    courier_id: delivery.courier_id,
    courierId: delivery.courier_id,
    order_code: delivery.order_code,
    delivery_fee: Number(delivery.delivery_fee || 0),
    delivery_deadline_at: delivery.delivery_deadline_at || '',
    estimated_minutes: delivery.estimated_minutes ?? null,
    created_at: delivery.created_at || '',
    localizacao_loja: {
      latitude: parseNullableNumber(delivery.stores?.latitude),
      longitude: parseNullableNumber(delivery.stores?.longitude),
    },
    localizacao_destino: {
      latitude: parseNullableNumber(delivery.customer_latitude),
      longitude: parseNullableNumber(delivery.customer_longitude),
    },
    stores: delivery.stores,
    customers: delivery.customers,
    raw: delivery,
  };
}

function formatCourierForRules(courier, activeDeliveries = []) {
  if (!courier) return null;
  return {
    id: courier.id,
    city_id: courier.city_id,
    name: courier.name,
    availability_status: courier.availability_status,
    active: courier.active,
    approval_status: courier.approval_status,
    quantidade_entregas_ativas: activeDeliveries.length,
  };
}

export async function acceptQueuedDelivery({ supabase, cityId, delivery, courierId, courierName }) {
  if (!delivery?.id || !courierId) throw new Error('Nenhuma entrega disponivel para aceitar.');
  const answeredAt = new Date().toISOString();

  const { data: acceptedQueueRow, error: queueAcceptError } = await supabase
    .from('delivery_queue')
    .update({ status: 'accepted', answered_at: answeredAt })
    .eq('delivery_id', delivery.id)
    .eq('courier_id', courierId)
    .eq('status', 'offered')
    .select('id')
    .maybeSingle();

  if (queueAcceptError) throw new Error(`Nao foi possivel aceitar a fila: ${queueAcceptError.message}`);
  if (!acceptedQueueRow) throw new Error('Tempo de aceite esgotado ou oferta ja enviada para outro motoboy.');

  const { data: assignedDelivery, error } = await supabase
    .from('deliveries')
    .update({ courier_id: courierId, status: 'assigned' })
    .eq('id', delivery.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Nao foi possivel aceitar: ${error.message}`);
  if (!assignedDelivery) {
    await supabase.from('delivery_queue').update({ status: 'expired', answered_at: answeredAt }).eq('id', acceptedQueueRow.id);
    throw new Error('Entrega ja foi aceita por outro motoboy ou nao esta mais pendente.');
  }

  await supabase.from('delivery_events').insert({
    city_id: cityId,
    delivery_id: delivery.id,
    status: 'assigned',
    note: `${courierName} aceitou a entrega.`,
  });
  await supabase
    .from('delivery_queue')
    .update({ status: 'skipped', answered_at: answeredAt })
    .eq('delivery_id', delivery.id)
    .neq('id', acceptedQueueRow.id)
    .in('status', ['waiting', 'offered']);
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

export async function markDeliveryDelivered({ supabase, cityId, delivery, courierId, courierName }) {
  if (!delivery?.id || !courierId) throw new Error('Nenhuma entrega em andamento para finalizar.');

  const { error } = await supabase
    .from('deliveries')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', delivery.id)
    .eq('courier_id', courierId)
    .in('status', ['picked_up', 'on_route'])
    .select('id')
    .single();

  if (error) throw new Error(`Nao foi possivel finalizar a entrega: ${error.message}`);

  await supabase.from('delivery_events').insert({
    city_id: cityId,
    delivery_id: delivery.id,
    status: 'delivered',
    note: `${courierName} finalizou a entrega.`,
  });

  await supabase.from('couriers').update({ availability_status: 'available', available: true }).eq('id', courierId);
}

export async function rejectQueuedDelivery({ supabase, cityId, delivery, courierId, courierName }) {
  if (!delivery?.id || !courierId) throw new Error('Nenhuma entrega disponivel para recusar.');
  const answeredAt = new Date().toISOString();

  const { error } = await supabase
    .from('delivery_queue')
    .update({ status: 'rejected', answered_at: answeredAt })
    .eq('delivery_id', delivery.id)
    .eq('courier_id', courierId)
    .in('status', ['waiting', 'offered']);

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

  await notifyNextCourierOffer({
    supabase,
    deliveryId: delivery.id,
    allowClientFallback: false,
    allowServerInvoke: true,
  });
}

export async function expireQueuedDeliveryOffer({ supabase, cityId, delivery, courierId, courierName, note = 'Tempo para aceite esgotado.' }) {
  if (!delivery?.id || !courierId || !supabase) return { expired: false };

  const answeredAt = new Date().toISOString();
  const { data: expiredRows, error } = await supabase
    .from('delivery_queue')
    .update({ status: 'expired', answered_at: answeredAt })
    .eq('delivery_id', delivery.id)
    .eq('courier_id', courierId)
    .eq('status', 'offered')
    .select('id');

  if (error) throw new Error(`Nao foi possivel expirar a oferta: ${error.message}`);
  if (!expiredRows?.length) return { expired: false };

  await supabase.from('delivery_events').insert({
    city_id: cityId,
    delivery_id: delivery.id,
    status: 'pending',
    note: `${courierName || 'Motoboy'} nao respondeu em 1 minuto. ${note}`,
  });

  await notifyNextCourierOffer({
    supabase,
    deliveryId: delivery.id,
    allowClientFallback: false,
    allowServerInvoke: true,
  });
  return { expired: true };
}

export async function notifyNextCourierOffer({
  supabase,
  deliveryId,
  allowClientFallback = true,
  allowServerInvoke = false,
}) {
  if (!supabase || !deliveryId) return { ok: false, reason: 'missing-context' };

  await expireTimedOutDeliveryOffers({ supabase, deliveryId });
  const offerMode = await getDeliveryOfferMode({ supabase, deliveryId });
  const activeOffers = await getActiveQueueOffers({ supabase, deliveryId });
  if (activeOffers.length) {
    return { ok: true, alreadyOffered: true, offer: activeOffers[0], offers: activeOffers, broadcast: offerMode.broadcast };
  }

  if (allowClientFallback) {
    return activateQueueOffersByMode({ supabase, deliveryId, offerMode });
  }

  if (!allowServerInvoke) {
    return { ok: false, reason: 'server-handoff-disabled' };
  }

  let invokeResult = null;
  if (supabase.functions?.invoke) {
    try {
      invokeResult = await supabase.functions.invoke('notify-courier-offer', {
        body: {
          deliveryId,
          offerTimeoutSeconds: DELIVERY_OFFER_TIMEOUT_SECONDS,
          repeat: true,
        },
      });
    } catch {
      invokeResult = null;
    }
  }

  const activeOffersAfterInvoke = await getActiveQueueOffers({ supabase, deliveryId });
  if (activeOffersAfterInvoke.length) {
    return { ok: true, data: invokeResult?.data, offer: activeOffersAfterInvoke[0], offers: activeOffersAfterInvoke };
  }

  return { ok: Boolean(invokeResult?.data), data: invokeResult?.data, reason: 'server-handoff' };
}

export async function advanceDeliveryOfferQueue({ supabase, deliveryId }) {
  if (!supabase || !deliveryId) return { ok: false, reason: 'missing-context' };
  await expireTimedOutDeliveryOffers({ supabase, deliveryId });
  const offerMode = await getDeliveryOfferMode({ supabase, deliveryId });
  const activeOffers = await getActiveQueueOffers({ supabase, deliveryId });
  if (activeOffers.length) {
    return { ok: true, alreadyOffered: true, offer: activeOffers[0], offers: activeOffers, broadcast: offerMode.broadcast };
  }
  return notifyNextCourierOffer({ supabase, deliveryId });
}

export async function cancelPendingDeliveryOfferSearch({ supabase, deliveryId }) {
  if (!supabase || !deliveryId) return;
  await supabase.from('delivery_queue')
    .update({ status: 'skipped', answered_at: new Date().toISOString() })
    .eq('delivery_id', deliveryId)
    .in('status', ['waiting', 'offered']);
  await supabase.from('deliveries')
    .update({ status: 'cancelled' })
    .eq('id', deliveryId)
    .eq('status', 'pending');
}

async function expireTimedOutDeliveryOffers({ supabase, deliveryId }) {
  const cutoff = new Date(Date.now() - DELIVERY_OFFER_TIMEOUT_SECONDS * 1000).toISOString();
  const { data: expiredRows, error } = await supabase
    .from('delivery_queue')
    .update({ status: 'expired', answered_at: new Date().toISOString() })
    .eq('delivery_id', deliveryId)
    .eq('status', 'offered')
    .lt('offered_at', cutoff)
    .select('id');

  if (error) throw new Error(`Nao foi possivel atualizar ofertas expiradas: ${error.message}`);
  return expiredRows ?? [];
}

async function advanceDeliveryOfferQueueRpc({ supabase, deliveryId }) {
  if (!supabase?.rpc || !deliveryId) return { ok: false, missingRpc: true, reason: 'missing-context' };

  const { data, error } = await supabase.rpc('advance_delivery_offer_queue', {
    p_delivery_id: deliveryId,
    p_offer_timeout_seconds: DELIVERY_OFFER_TIMEOUT_SECONDS,
  });

  if (error) {
    const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    const missingRpc = error.code === '42883'
      || /advance_delivery_offer_queue|schema cache|function.*does not exist|could not find/i.test(text);
    if (missingRpc) return { ok: false, missingRpc: true, reason: 'rpc-missing' };
    throw new Error(`Nao foi possivel avancar a fila: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, reason: 'rpc-empty-response' };

  return {
    ok: Boolean(row.ok),
    reason: row.reason || '',
    offer: row.offer_id ? {
      id: row.offer_id,
      courier_id: row.offered_courier_id || row.courier_id,
    } : null,
    repeated: Boolean(row.repeated),
  };
}

async function getDeliveryOfferMode({ supabase, deliveryId }) {
  const [{ data: delivery, error: deliveryError }, { count: attemptCount, error: attemptsError }] = await Promise.all([
    supabase
      .from('deliveries')
      .select('id, created_at, status')
      .eq('id', deliveryId)
      .maybeSingle(),
    supabase
      .from('delivery_queue')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_id', deliveryId)
      .not('offered_at', 'is', null),
  ]);

  if (deliveryError) throw new Error(`Nao foi possivel buscar entrega: ${deliveryError.message}`);
  if (attemptsError) throw new Error(`Nao foi possivel contar ofertas da fila: ${attemptsError.message}`);

  const createdAt = delivery?.created_at ? new Date(delivery.created_at).getTime() : Date.now();
  const ageSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  const attempts = Number(attemptCount ?? 0);
  const broadcast = ageSeconds >= DELIVERY_BROADCAST_AFTER_SECONDS || attempts >= DELIVERY_INDIVIDUAL_OFFER_LIMIT;

  return {
    broadcast,
    ageSeconds,
    attempts,
    delivery,
  };
}

async function getActiveQueueOffers({ supabase, deliveryId }) {
  const { data, error } = await supabase
    .from('delivery_queue')
    .select('id, courier_id, offered_at, deliveries!inner(id, status)')
    .eq('delivery_id', deliveryId)
    .eq('status', 'offered')
    .eq('deliveries.status', 'pending')
    .order('offered_at', { ascending: true });

  if (error) throw new Error(`Nao foi possivel buscar oferta ativa: ${error.message}`);
  return data ?? [];
}

async function getActiveQueueOffer({ supabase, deliveryId }) {
  const activeOffers = await getActiveQueueOffers({ supabase, deliveryId });
  return activeOffers[0] ?? null;
}

async function activateQueueOffersByMode({ supabase, deliveryId, offerMode }) {
  return offerMode?.broadcast
    ? activateBroadcastQueueOffers({ supabase, deliveryId, offerMode })
    : activateNextQueueOffer({ supabase, deliveryId, offerMode });
}

async function activateNextQueueOffer({ supabase, deliveryId, offerMode }) {
  const deliveryIsPending = await isDeliveryPending({ supabase, deliveryId });
  if (!deliveryIsPending) return { ok: false, reason: 'delivery-not-pending' };

  let rows = await fetchWaitingQueueRows({ supabase, deliveryId });
  let didResetQueue = false;
  if (!rows.length) {
    if ((offerMode?.attempts ?? 0) >= DELIVERY_INDIVIDUAL_OFFER_LIMIT) {
      return activateBroadcastQueueOffers({ supabase, deliveryId, offerMode: { ...offerMode, broadcast: true } });
    }

    const activeOfferBeforeReset = await getActiveQueueOffer({ supabase, deliveryId });
    if (activeOfferBeforeReset) return { ok: true, alreadyOffered: true, offer: activeOfferBeforeReset };

    await resetQueueForRepeat({ supabase, deliveryId });
    didResetQueue = true;
    rows = await fetchWaitingQueueRows({ supabase, deliveryId });
  }

  for (const row of rows) {
    const courierAvailable = row.couriers?.active === true && ['available', 'on_delivery'].includes(row.couriers?.availability_status);
    if (!courierAvailable) {
      await supabase
        .from('delivery_queue')
        .update({ status: 'skipped', answered_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'waiting');
      continue;
    }

    const offeredAt = new Date().toISOString();
    const { data: offer, error } = await supabase
      .from('delivery_queue')
      .update({ status: 'offered', offered_at: offeredAt, answered_at: null })
      .eq('id', row.id)
      .eq('status', 'waiting')
      .select('id, courier_id, offered_at')
      .maybeSingle();

    if (error) {
      const activeOffer = await getActiveQueueOffer({ supabase, deliveryId });
      if (activeOffer && (error.code === '23505' || /duplicate|unique/i.test(error.message || ''))) {
        return { ok: true, alreadyOffered: true, offer: activeOffer };
      }
      throw new Error(`Nao foi possivel oferecer entrega: ${error.message}`);
    }
    if (offer) return { ok: true, offer, repeated: didResetQueue };
  }

  return { ok: false, reason: 'no-online-courier' };
}

async function activateBroadcastQueueOffers({ supabase, deliveryId, offerMode }) {
  const deliveryIsPending = await isDeliveryPending({ supabase, deliveryId });
  if (!deliveryIsPending) return { ok: false, reason: 'delivery-not-pending' };

  const rows = await fetchBroadcastQueueRows({ supabase, deliveryId });
  const offerIds = rows
    .filter((row) => row.couriers?.active === true && ['available', 'on_delivery'].includes(row.couriers?.availability_status))
    .map((row) => row.id)
    .filter(Boolean);

  if (!offerIds.length) return { ok: false, reason: 'no-online-courier', broadcast: true };

  const offeredAt = new Date().toISOString();
  const { data: offers, error } = await supabase
    .from('delivery_queue')
    .update({ status: 'offered', offered_at: offeredAt, answered_at: null })
    .in('id', offerIds)
    .in('status', ['waiting', 'expired', 'rejected', 'skipped'])
    .select('id, courier_id, offered_at');

  if (error) throw new Error(`Nao foi possivel oferecer entrega para varios motoboys: ${error.message}`);
  return {
    ok: Boolean(offers?.length),
    offer: offers?.[0] ?? null,
    offers: offers ?? [],
    broadcast: true,
    attempts: offerMode?.attempts ?? null,
    reason: offers?.length ? 'broadcast-offered' : 'no-online-courier',
  };
}

async function isDeliveryPending({ supabase, deliveryId }) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('id')
    .eq('id', deliveryId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) throw new Error(`Nao foi possivel validar entrega: ${error.message}`);
  return Boolean(data);
}

async function fetchWaitingQueueRows({ supabase, deliveryId }) {
  const { data, error } = await supabase
    .from('delivery_queue')
    .select('id, courier_id, queue_position, couriers(active, availability_status)')
    .eq('delivery_id', deliveryId)
    .eq('status', 'waiting')
    .order('queue_position', { ascending: true });

  if (error) throw new Error(`Nao foi possivel buscar proximo motoboy: ${error.message}`);
  return data ?? [];
}

async function fetchBroadcastQueueRows({ supabase, deliveryId }) {
  const { data, error } = await supabase
    .from('delivery_queue')
    .select('id, courier_id, queue_position, status, couriers(active, availability_status)')
    .eq('delivery_id', deliveryId)
    .in('status', ['waiting', 'expired', 'rejected', 'skipped'])
    .order('queue_position', { ascending: true });

  if (error) throw new Error(`Nao foi possivel buscar motoboys para oferta simultanea: ${error.message}`);
  return data ?? [];
}

async function resetQueueForRepeat({ supabase, deliveryId }) {
  const { error } = await supabase
    .from('delivery_queue')
    .update({ status: 'waiting', offered_at: null, answered_at: null })
    .eq('delivery_id', deliveryId)
    .in('status', ['expired', 'rejected', 'skipped']);

  if (error) throw new Error(`Nao foi possivel reiniciar a fila: ${error.message}`);
}

function isQueueOfferExpired(offeredAt, timeoutSeconds = DELIVERY_OFFER_TIMEOUT_SECONDS) {
  if (!offeredAt) return false;
  return Date.now() - new Date(offeredAt).getTime() >= timeoutSeconds * 1000;
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

export async function updateCourierLocation({ supabase, courierId, cityId, latitude, longitude, accuracyMeters = null }) {
  if (!supabase || !courierId || !cityId) return { ok: false };
  const parsedLatitude = parseNullableNumber(latitude);
  const parsedLongitude = parseNullableNumber(longitude);
  if (!coordenadasValidas(parsedLatitude, parsedLongitude)) return { ok: false };

  const { error } = await supabase
    .from('courier_locations')
    .upsert({
      courier_id: courierId,
      city_id: cityId,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      accuracy_meters: parseNullableNumber(accuracyMeters),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'courier_id' });

  if (error) throw new Error(`Nao foi possivel atualizar localizacao do motoboy: ${error.message}`);
  return { ok: true };
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
