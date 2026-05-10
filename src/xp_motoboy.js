export function calculateAcceptXp(offeredAt, acceptedAt = new Date()) {
  const offerTime = offeredAt ? new Date(offeredAt).getTime() : acceptedAt.getTime();
  const elapsedSeconds = Math.max(0, Math.floor((acceptedAt.getTime() - offerTime) / 1000));
  return Math.max(0, Number((25 - elapsedSeconds * 0.5).toFixed(1)));
}

export async function awardCourierXp({ supabase, courierId, deliveryId, cityId, reason, points }) {
  if (!supabase || !courierId || !deliveryId || !cityId || !points) return 0;

  const xpPoints = Number(points);
  const { error: eventError } = await supabase.from('courier_xp_events').insert({
    courier_id: courierId,
    delivery_id: deliveryId,
    city_id: cityId,
    reason,
    points: xpPoints,
  });

  if (eventError) throw new Error(`Nao foi possivel registrar XP: ${eventError.message}`);

  const { data: currentPoints } = await supabase
    .from('courier_points')
    .select('total_points')
    .eq('courier_id', courierId)
    .maybeSingle();

  const nextTotal = Number(currentPoints?.total_points || 0) + xpPoints;
  const { error: totalError } = await supabase
    .from('courier_points')
    .upsert({ courier_id: courierId, total_points: nextTotal }, { onConflict: 'courier_id' });

  if (totalError) throw new Error(`Nao foi possivel atualizar total de XP: ${totalError.message}`);
  return xpPoints;
}

export async function awardAcceptXp({ supabase, courierId, delivery, cityId }) {
  const points = calculateAcceptXp(delivery?.offeredAt);
  return awardCourierXp({
    supabase,
    courierId,
    deliveryId: delivery.id,
    cityId,
    reason: 'accept_delivery',
    points,
  });
}

export async function awardPickupXp({ supabase, courierId, deliveryId, cityId }) {
  return awardCourierXp({
    supabase,
    courierId,
    deliveryId,
    cityId,
    reason: 'pickup_order',
    points: 10,
  });
}

export async function awardOnTimeDeliveryXp({ supabase, courierId, deliveryId, cityId }) {
  return awardCourierXp({
    supabase,
    courierId,
    deliveryId,
    cityId,
    reason: 'on_time_delivery',
    points: 50,
  });
}
