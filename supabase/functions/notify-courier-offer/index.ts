const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type QueueOffer = {
  id: string;
  courier_id: string;
  offered_at?: string | null;
  deliveries: {
    id: string;
    order_code: string | null;
    delivery_fee: number | null;
    stores: { name: string | null; fantasy_name: string | null } | null;
  };
};

const INDIVIDUAL_OFFER_LIMIT = 5;

const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { deliveryId, offerTimeoutSeconds = 60, notifyActiveOffer = false } = await request.json();
    if (!deliveryId) return json({ error: 'deliveryId is required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase env is not configured' }, 500);

    await expireTimedOutOffers({ supabaseUrl, serviceRoleKey, deliveryId, offerTimeoutSeconds });

    const offerMode = await fetchDeliveryOfferMode({ supabaseUrl, serviceRoleKey, deliveryId, offerTimeoutSeconds });
    const activeOffers = await fetchActiveQueueOffers({ supabaseUrl, serviceRoleKey, deliveryId });
    if (activeOffers.length) {
      if (notifyActiveOffer) {
        const result = await notifyOffers({ supabaseUrl, serviceRoleKey, offers: activeOffers });
        return json({ ...result, offers: activeOffers.length, notifiedActiveOffer: true, broadcast: activeOffers.length > 1 });
      }
      return json({ notified: 0, skipped: 'active_offer', offerId: activeOffers[0].id, offers: activeOffers.length, broadcast: offerMode.broadcast });
    }

    if (offerMode.broadcast) {
      const offers = await markBroadcastQueueOffers({ supabaseUrl, serviceRoleKey, deliveryId });
      if (!offers.length) return json({ notified: 0, skipped: 'no_online_waiting_courier', broadcast: true });

      const result = await notifyOffers({ supabaseUrl, serviceRoleKey, offers });
      return json({ ...result, offers: offers.length, broadcast: true });
    }

    let offer = await fetchNextQueueOffer({ supabaseUrl, serviceRoleKey, deliveryId });
    if (!offer) return json({ notified: 0, skipped: 'no_online_waiting_courier' });

    const markedOffer = await markQueueOfferAsOffered({ supabaseUrl, serviceRoleKey, offerId: offer.id });
    if (!markedOffer) return json({ notified: 0, skipped: 'offer_already_taken' });
    offer = { ...offer, ...markedOffer };

    const result = await notifyOffers({ supabaseUrl, serviceRoleKey, offers: [offer] });
    return json({ ...result, offerId: offer.id, courierId: offer.courier_id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});

async function expireTimedOutOffers({ supabaseUrl, serviceRoleKey, deliveryId, offerTimeoutSeconds }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
  offerTimeoutSeconds: number;
}) {
  const cutoff = new Date(Date.now() - Number(offerTimeoutSeconds || 60) * 1000).toISOString();
  const url = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  url.searchParams.set('delivery_id', `eq.${deliveryId}`);
  url.searchParams.set('status', 'eq.offered');
  url.searchParams.set('offered_at', `lt.${cutoff}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceRoleKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'expired', answered_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Could not expire queue offers: ${await response.text()}`);
}

async function fetchDeliveryOfferMode({ supabaseUrl, serviceRoleKey, deliveryId, offerTimeoutSeconds }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
  offerTimeoutSeconds: number;
}): Promise<{ broadcast: boolean; broadcastAttempted: boolean; ageSeconds: number; attempts: number }> {
  const deliveryUrl = new URL(`${supabaseUrl}/rest/v1/deliveries`);
  deliveryUrl.searchParams.set('select', 'id,created_at');
  deliveryUrl.searchParams.set('id', `eq.${deliveryId}`);
  deliveryUrl.searchParams.set('limit', '1');

  const deliveryResponse = await fetch(deliveryUrl, { headers: serviceHeaders(serviceRoleKey) });
  if (!deliveryResponse.ok) throw new Error(`Could not fetch delivery mode: ${await deliveryResponse.text()}`);
  const deliveries = await deliveryResponse.json() as Array<{ id: string; created_at: string | null }>;
  const createdAt = deliveries[0]?.created_at ? new Date(deliveries[0].created_at).getTime() : Date.now();
  const ageSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));

  const attemptsUrl = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  attemptsUrl.searchParams.set('select', 'id,offered_at');
  attemptsUrl.searchParams.set('delivery_id', `eq.${deliveryId}`);
  attemptsUrl.searchParams.set('offered_at', 'not.is.null');

  const attemptsResponse = await fetch(attemptsUrl, { headers: serviceHeaders(serviceRoleKey) });
  if (!attemptsResponse.ok) throw new Error(`Could not count delivery offer attempts: ${await attemptsResponse.text()}`);
  const queueAttempts = await attemptsResponse.json() as Array<{ id: string; offered_at: string | null }>;
  const attempts = queueAttempts.length;
  const broadcastAfterSeconds = INDIVIDUAL_OFFER_LIMIT * Number(offerTimeoutSeconds || 60);
  const broadcastStartTime = createdAt + broadcastAfterSeconds * 1000;
  const broadcastAttempted = queueAttempts.some((row) => (
    row.offered_at && new Date(row.offered_at).getTime() >= broadcastStartTime
  ));

  return {
    broadcast: ageSeconds >= broadcastAfterSeconds || attempts >= INDIVIDUAL_OFFER_LIMIT,
    broadcastAttempted,
    ageSeconds,
    attempts,
  };
}

async function fetchActiveQueueOffers({ supabaseUrl, serviceRoleKey, deliveryId }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
}): Promise<QueueOffer[]> {
  const url = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  url.searchParams.set('select', 'id,courier_id,offered_at,deliveries!inner(id,order_code,delivery_fee,status,stores(name,fantasy_name))');
  url.searchParams.set('delivery_id', `eq.${deliveryId}`);
  url.searchParams.set('status', 'eq.offered');
  url.searchParams.set('deliveries.status', 'eq.pending');
  url.searchParams.set('order', 'offered_at.asc');

  const response = await fetch(url, { headers: serviceHeaders(serviceRoleKey) });
  if (!response.ok) throw new Error(`Could not fetch active delivery offer: ${await response.text()}`);
  return await response.json() as QueueOffer[];
}

async function expireQueueOffers({ supabaseUrl, serviceRoleKey, offerIds }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  offerIds: string[];
}) {
  const url = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  url.searchParams.set('id', `in.(${offerIds.join(',')})`);
  url.searchParams.set('status', 'eq.offered');

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceRoleKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'expired', answered_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Could not expire duplicate active offers: ${await response.text()}`);
}

async function fetchNextQueueOffer({ supabaseUrl, serviceRoleKey, deliveryId }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
}): Promise<QueueOffer | null> {
  const url = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  url.searchParams.set('select', 'id,courier_id,deliveries!inner(id,order_code,delivery_fee,status,stores(name,fantasy_name)),couriers!inner(active,approval_status,availability_status)');
  url.searchParams.set('delivery_id', `eq.${deliveryId}`);
  url.searchParams.set('status', 'eq.waiting');
  url.searchParams.set('deliveries.status', 'eq.pending');
  url.searchParams.set('couriers.active', 'eq.true');
  url.searchParams.set('couriers.approval_status', 'eq.approved');
  url.searchParams.set('couriers.availability_status', 'in.(available,on_delivery)');
  url.searchParams.set('order', 'queue_position.asc');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { headers: serviceHeaders(serviceRoleKey) });
  if (!response.ok) throw new Error(`Could not fetch delivery queue: ${await response.text()}`);
  const rows = await response.json() as QueueOffer[];
  return rows[0] ?? null;
}

async function markBroadcastQueueOffers({ supabaseUrl, serviceRoleKey, deliveryId }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
}): Promise<QueueOffer[]> {
  const rowsUrl = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  rowsUrl.searchParams.set('select', 'id,courier_id,deliveries!inner(id,order_code,delivery_fee,status,stores(name,fantasy_name)),couriers!inner(active,approval_status,availability_status)');
  rowsUrl.searchParams.set('delivery_id', `eq.${deliveryId}`);
  rowsUrl.searchParams.set('status', 'in.(waiting,expired,rejected,skipped)');
  rowsUrl.searchParams.set('deliveries.status', 'eq.pending');
  rowsUrl.searchParams.set('couriers.active', 'eq.true');
  rowsUrl.searchParams.set('couriers.approval_status', 'eq.approved');
  rowsUrl.searchParams.set('couriers.availability_status', 'in.(available,on_delivery)');
  rowsUrl.searchParams.set('order', 'queue_position.asc');

  const rowsResponse = await fetch(rowsUrl, { headers: serviceHeaders(serviceRoleKey) });
  if (!rowsResponse.ok) throw new Error(`Could not fetch broadcast delivery queue: ${await rowsResponse.text()}`);
  const rows = await rowsResponse.json() as QueueOffer[];
  const offerIds = rows.map((row) => row.id).filter(Boolean);
  if (!offerIds.length) return [];

  const offeredAt = new Date().toISOString();
  const updateUrl = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  updateUrl.searchParams.set('id', `in.(${offerIds.join(',')})`);
  updateUrl.searchParams.set('status', 'in.(waiting,expired,rejected,skipped)');
  updateUrl.searchParams.set('select', 'id,courier_id,offered_at,deliveries!inner(id,order_code,delivery_fee,status,stores(name,fantasy_name))');

  const updateResponse = await fetch(updateUrl, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceRoleKey), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'offered', offered_at: offeredAt, answered_at: null }),
  });
  if (!updateResponse.ok) throw new Error(`Could not mark broadcast queue offers: ${await updateResponse.text()}`);
  return await updateResponse.json() as QueueOffer[];
}

async function markQueueOfferAsOffered({ supabaseUrl, serviceRoleKey, offerId }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  offerId: string;
}): Promise<Pick<QueueOffer, 'id' | 'courier_id' | 'offered_at'> | null> {
  const offeredAt = new Date().toISOString();
  const url = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  url.searchParams.set('id', `eq.${offerId}`);
  url.searchParams.set('status', 'eq.waiting');
  url.searchParams.set('select', 'id,courier_id,offered_at');

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceRoleKey), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'offered', offered_at: offeredAt, answered_at: null }),
  });
  if (!response.ok) throw new Error(`Could not mark queue offer: ${await response.text()}`);
  const rows = await response.json() as Pick<QueueOffer, 'id' | 'courier_id' | 'offered_at'>[];
  return rows[0] ?? null;
}

async function resetQueueForRepeat({ supabaseUrl, serviceRoleKey, deliveryId }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
}) {
  const url = new URL(`${supabaseUrl}/rest/v1/delivery_queue`);
  url.searchParams.set('delivery_id', `eq.${deliveryId}`);
  url.searchParams.set('status', 'in.(expired,rejected,skipped)');

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceRoleKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'waiting', offered_at: null, answered_at: null }),
  });
  if (!response.ok) throw new Error(`Could not reset queue: ${await response.text()}`);
}

async function fetchCourierSubscriptions({ supabaseUrl, serviceRoleKey, courierId }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  courierId: string;
}): Promise<PushSubscriptionRow[]> {
  const url = new URL(`${supabaseUrl}/rest/v1/courier_push_subscriptions`);
  url.searchParams.set('select', 'id,endpoint,p256dh,auth');
  url.searchParams.set('courier_id', `eq.${courierId}`);
  url.searchParams.set('active', 'eq.true');

  const response = await fetch(url, { headers: serviceHeaders(serviceRoleKey) });
  if (!response.ok) throw new Error(`Could not fetch push subscriptions: ${await response.text()}`);
  return response.json();
}

async function deactivateSubscriptions({ supabaseUrl, serviceRoleKey, ids }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  ids: string[];
}) {
  const url = new URL(`${supabaseUrl}/rest/v1/courier_push_subscriptions`);
  url.searchParams.set('id', `in.(${ids.join(',')})`);
  await fetch(url, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceRoleKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
  });
}

async function notifyOffers({ supabaseUrl, serviceRoleKey, offers }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  offers: QueueOffer[];
}): Promise<{ notified: number; stale: number }> {
  let notified = 0;
  const staleSubscriptionIds: string[] = [];

  for (const offer of offers) {
    const subscriptions = await fetchCourierSubscriptions({
      supabaseUrl,
      serviceRoleKey,
      courierId: offer.courier_id,
    });

    const payload = JSON.stringify({
      title: 'Nova entrega disponivel',
      body: [
        offer.deliveries.order_code || offer.deliveries.id,
        offer.deliveries.stores?.fantasy_name || offer.deliveries.stores?.name || '',
        formatCurrency(Number(offer.deliveries.delivery_fee || 0)),
      ].filter(Boolean).join(' - '),
      url: '/#courier-home',
      deliveryId: offer.deliveries.id,
    });

    for (const subscription of subscriptions) {
      const result = await sendWebPush(subscription, payload);
      if (result.ok) notified += 1;
      if (result.stale) staleSubscriptionIds.push(subscription.id);
    }
  }

  if (staleSubscriptionIds.length) {
    await deactivateSubscriptions({ supabaseUrl, serviceRoleKey, ids: staleSubscriptionIds });
  }

  return { notified, stale: staleSubscriptionIds.length };
}

async function sendWebPush(subscription: PushSubscriptionRow, payload: string): Promise<{ ok: boolean; stale: boolean }> {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@beelbem.com.br';
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured');
  }

  const encrypted = await encryptPushPayload({
    payload,
    receiverPublicKey: subscription.p256dh,
    receiverAuthSecret: subscription.auth,
  });
  const authorization = await createVapidAuthorization({
    endpoint: subscription.endpoint,
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
    subject: vapidSubject,
  });

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '60',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: authorization,
    },
    body: encrypted,
  });

  return { ok: response.ok, stale: response.status === 404 || response.status === 410 };
}

async function encryptPushPayload({ payload, receiverPublicKey, receiverAuthSecret }: {
  payload: string;
  receiverPublicKey: string;
  receiverAuthSecret: string;
}): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const receiverKey = await crypto.subtle.importKey(
    'raw',
    base64UrlDecode(receiverPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, serverKeys.privateKey, 256));
  const authSecret = base64UrlDecode(receiverAuthSecret);
  const authPrk = await hmac(authSecret, sharedSecret);
  const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), base64UrlDecode(receiverPublicKey), serverPublicKey, new Uint8Array([1]));
  const ikm = await hmac(authPrk, keyInfo);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concatBytes(encoder.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concatBytes(encoder.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const plaintext = concatBytes(encoder.encode(payload), new Uint8Array([2]));
  const cryptoKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cryptoKey, plaintext));
  const recordSize = new Uint8Array([0, 0, 16, 0]);

  return concatBytes(salt, recordSize, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

async function createVapidAuthorization({ endpoint, publicKey, privateKey, subject }: {
  endpoint: string;
  publicKey: string;
  privateKey: string;
  subject: string;
}) {
  const endpointUrl = new URL(endpoint);
  const aud = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const publicBytes = base64UrlDecode(publicKey);
  const privateBytes = base64UrlDecode(privateKey);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicBytes.slice(1, 33)),
    y: base64UrlEncode(publicBytes.slice(33, 65)),
    d: base64UrlEncode(privateBytes),
    ext: true,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(encoder.encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${publicKey}`;
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

function concatBytes(...chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function base64UrlDecode(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function base64UrlEncode(value: Uint8Array) {
  return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function serviceHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
