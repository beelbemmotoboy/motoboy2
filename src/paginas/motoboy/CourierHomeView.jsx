import React from 'react';
import { Bike, Clock3, LogOut, Mail, MapPin, Navigation, Search, Star, Store, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { acceptQueuedDelivery, emptyDelivery, getNextDeliveryForCourier, markDeliveryDelivered, markDeliveryPickedUp, rejectQueuedDelivery, setCourierAvailable } from '../../cadastra_entrega';
import { awardAcceptXp, awardOnTimeDeliveryXp, awardPickupXp } from '../../xp_motoboy';
import { LayoutMotoboy } from '../../layouts/LayoutMotoboy';

function triggerCourierOfferAlert() {
  if (typeof window === 'undefined') return;

  if (navigator.vibrate) {
    navigator.vibrate([450, 160, 450, 160, 700]);
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    [0, 0.34, 0.68].forEach((offset) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(1320, now + offset + 0.12);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.24, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.24);
    });
    window.setTimeout(() => audioContext.close(), 1200);
  } catch {
    // Mobile browsers may block audio until there is user interaction; vibration still runs when supported.
  }
}

export function CourierHomeView({ city, profile, onLogout }) {
  const [courierName, setCourierName] = React.useState(profile?.name || 'Motoboy');
  const [courierPoints, setCourierPoints] = React.useState(0);
  const [acceptTimeoutSeconds, setAcceptTimeoutSeconds] = React.useState(50);
  const [countdownRemaining, setCountdownRemaining] = React.useState(50);
  const [deadlineRemainingLabel, setDeadlineRemainingLabel] = React.useState('--:--');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scoreModalOpen, setScoreModalOpen] = React.useState(false);
  const [availabilityPromptOpen, setAvailabilityPromptOpen] = React.useState(true);
  const [currentDelivery, setCurrentDelivery] = React.useState(emptyDelivery());
  const [deliveryLoading, setDeliveryLoading] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState('');
  const [courierAvailable, setCourierAvailableState] = React.useState(profile?.availabilityStatus === 'available');
  const [courierStats, setCourierStats] = React.useState({
    onlineCouriers: 0,
    openStores: 0,
    todayDeliveries: 0,
    todayXp: 0,
  });
  const [xpAnimation, setXpAnimation] = React.useState(null);
  const [courierCoords, setCourierCoords] = React.useState(null);
  const deliveryPollingRef = React.useRef(false);
  const lastAlertedDeliveryRef = React.useRef('');
  const hasPendingOffer = Boolean(currentDelivery.id && currentDelivery.status === 'pending');
  const hasAcceptedDelivery = Boolean(currentDelivery.id && ['assigned', 'picked_up', 'on_route'].includes(currentDelivery.status));
  const showDeliveryData = hasAcceptedDelivery;
  const countdownLabel = `${String(Math.floor(countdownRemaining / 60)).padStart(2, '0')}:${String(countdownRemaining % 60).padStart(2, '0')}`;
  const courierLevel = Math.max(1, Math.floor(Number(courierPoints || 0) / 500) + 1);
  const courierStars = Math.min(5, Math.max(1, Math.floor(Number(courierPoints || 0) / 250) + 1));
  const formatXpValue = (value) => (
    Number.isInteger(Number(value)) ? Number(value).toFixed(0) : Number(value).toFixed(1).replace('.', ',')
  );

  const mapDeliveryStatus = (status) => {
    if (status === 'assigned') return 'A caminho da loja';
    if (['picked_up', 'on_route'].includes(status)) return 'A caminho do cliente';
    return 'Aguardando aceite';
  };

  const deliveryMapPoints = React.useMemo(() => {
    const points = [
      {
        key: 'courier',
        label: 'Voce',
        detail: mapDeliveryStatus(currentDelivery.status),
        icon: 'courier',
        coords: courierCoords,
        fallback: { x: 36, y: 70 },
      },
      {
        key: 'store',
        label: 'Loja',
        detail: currentDelivery.store,
        icon: 'store',
        coords: currentDelivery.storeLatitude !== null && currentDelivery.storeLongitude !== null
          ? { latitude: currentDelivery.storeLatitude, longitude: currentDelivery.storeLongitude }
          : null,
        fallback: { x: 64, y: 35 },
      },
      {
        key: 'customer',
        label: 'Cliente',
        detail: currentDelivery.customer,
        icon: 'customer',
        coords: currentDelivery.customerLatitude !== null && currentDelivery.customerLongitude !== null
          ? { latitude: currentDelivery.customerLatitude, longitude: currentDelivery.customerLongitude }
          : null,
        fallback: { x: 78, y: 68 },
      },
    ];

    const locatedPoints = points.filter((point) => point.coords);
    if (locatedPoints.length < 2) return points.map((point) => ({ ...point, position: point.fallback }));

    const latitudes = locatedPoints.map((point) => point.coords.latitude);
    const longitudes = locatedPoints.map((point) => point.coords.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latRange = maxLat - minLat || 0.01;
    const lngRange = maxLng - minLng || 0.01;

    return points.map((point) => {
      if (!point.coords) return { ...point, position: point.fallback };
      return {
        ...point,
        position: {
          x: 12 + ((point.coords.longitude - minLng) / lngRange) * 76,
          y: 18 + ((maxLat - point.coords.latitude) / latRange) * 64,
        },
      };
    });
  }, [courierCoords, currentDelivery.customer, currentDelivery.customerLatitude, currentDelivery.customerLongitude, currentDelivery.status, currentDelivery.store, currentDelivery.storeLatitude, currentDelivery.storeLongitude]);

  const routePoints = deliveryMapPoints
    .filter((point) => point.position)
    .map((point) => `${point.position.x},${point.position.y}`)
    .join(' ');

  const loadCurrentDelivery = React.useCallback(async ({ silent = false } = {}) => {
    if (!supabase || !profile?.courier_id || !city?.id) return;
    if (deliveryPollingRef.current) return;
    deliveryPollingRef.current = true;
    if (!silent) {
      setDeliveryLoading(true);
      setActionMessage('');
    }
    try {
      const nextDelivery = await getNextDeliveryForCourier({ supabase, cityId: city.id, courierId: profile.courier_id });
      setCurrentDelivery(nextDelivery);
    } catch (error) {
      if (!silent) setActionMessage(error.message);
    } finally {
      deliveryPollingRef.current = false;
      if (!silent) setDeliveryLoading(false);
    }
  }, [city?.id, profile?.courier_id]);

  React.useEffect(() => {
    let mounted = true;

    async function loadCourierConfig() {
      if (!supabase) return;

      if (profile?.courier_id) {
        const [{ data: pointsData }, { data: courierData }] = await Promise.all([
          supabase
            .from('courier_points')
            .select('total_points')
            .eq('courier_id', profile.courier_id)
            .maybeSingle(),
          supabase
            .from('couriers')
            .select('name, availability_status')
            .eq('id', profile.courier_id)
            .maybeSingle(),
        ]);

        if (mounted) {
          setCourierPoints(Number(pointsData?.total_points ?? 0));
          if (courierData?.name) setCourierName(courierData.name);
          if (courierData?.availability_status) setCourierAvailableState(courierData.availability_status === 'available');
        }
      }

      const { data: timeoutSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'delivery_accept_timeout')
        .maybeSingle();

      const configuredSeconds = Number(timeoutSetting?.value?.seconds);
      if (mounted && Number.isFinite(configuredSeconds) && configuredSeconds > 0) {
        setAcceptTimeoutSeconds(Math.round(configuredSeconds));
        setCountdownRemaining(Math.round(configuredSeconds));
      }

      if (city?.id) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        const [onlineResult, storesResult, deliveriesResult, xpTodayResult] = await Promise.all([
          supabase
            .from('couriers')
            .select('id', { count: 'exact', head: true })
            .eq('city_id', city.id)
            .eq('active', true)
            .eq('availability_status', 'available'),
          supabase
            .from('stores')
            .select('id', { count: 'exact', head: true })
            .eq('city_id', city.id)
            .eq('active', true)
            .eq('is_open', true),
          supabase
            .from('deliveries')
            .select('id', { count: 'exact', head: true })
            .eq('city_id', city.id)
            .eq('courier_id', profile.courier_id)
            .gte('created_at', dayStart.toISOString()),
          supabase
            .from('courier_xp_events')
            .select('points')
            .eq('city_id', city.id)
            .eq('courier_id', profile.courier_id)
            .gte('created_at', dayStart.toISOString()),
        ]);

        if (mounted) {
          setCourierStats({
            onlineCouriers: onlineResult.count ?? 0,
            openStores: storesResult.count ?? 0,
            todayDeliveries: deliveriesResult.count ?? 0,
            todayXp: (xpTodayResult.data ?? []).reduce((total, item) => total + Number(item.points || 0), 0),
          });
        }
      }
    }

    loadCourierConfig();
    loadCurrentDelivery();

    return () => {
      mounted = false;
    };
  }, [profile?.courier_id, city?.id, loadCurrentDelivery]);

  React.useEffect(() => {
    if (!hasPendingOffer) {
      setCountdownRemaining(acceptTimeoutSeconds);
      return undefined;
    }

    function updateCountdown() {
      const offeredAt = currentDelivery.offeredAt ? new Date(currentDelivery.offeredAt).getTime() : Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - offeredAt) / 1000));
      setCountdownRemaining(Math.max(0, acceptTimeoutSeconds - elapsedSeconds));
    }

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [acceptTimeoutSeconds, currentDelivery.id, currentDelivery.offeredAt, hasPendingOffer]);

  React.useEffect(() => {
    if (!hasAcceptedDelivery || !currentDelivery.deadlineAt) {
      setDeadlineRemainingLabel(currentDelivery.estimatedMinutes ? `${currentDelivery.estimatedMinutes} min` : '--:--');
      return undefined;
    }

    function updateDeliveryDeadline() {
      const deadlineTime = new Date(currentDelivery.deadlineAt).getTime();
      const remainingSeconds = Math.max(0, Math.ceil((deadlineTime - Date.now()) / 1000));
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      setDeadlineRemainingLabel(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }

    updateDeliveryDeadline();
    const intervalId = window.setInterval(updateDeliveryDeadline, 1000);
    return () => window.clearInterval(intervalId);
  }, [currentDelivery.deadlineAt, currentDelivery.estimatedMinutes, hasAcceptedDelivery]);

  React.useEffect(() => {
    if (!hasPendingOffer || !currentDelivery.id) return;
    if (lastAlertedDeliveryRef.current === currentDelivery.id) return;
    lastAlertedDeliveryRef.current = currentDelivery.id;
    triggerCourierOfferAlert();
  }, [currentDelivery.id, hasPendingOffer]);

  React.useEffect(() => {
    if (!supabase || !profile?.courier_id || !city?.id || !courierAvailable || hasPendingOffer || hasAcceptedDelivery) {
      return undefined;
    }

    let stopped = false;
    const refreshQueue = () => {
      if (!stopped) loadCurrentDelivery({ silent: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshQueue();
    };

    const intervalId = window.setInterval(refreshQueue, 4000);
    window.addEventListener('focus', refreshQueue);
    document.addEventListener('visibilitychange', handleVisibility);

    const queueChannel = supabase
      .channel(`courier-queue-${profile.courier_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_queue', filter: `courier_id=eq.${profile.courier_id}` },
        refreshQueue,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `city_id=eq.${city.id}` },
        refreshQueue,
      )
      .subscribe();

    refreshQueue();

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshQueue);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(queueChannel);
    };
  }, [city?.id, courierAvailable, hasAcceptedDelivery, hasPendingOffer, loadCurrentDelivery, profile?.courier_id]);

  React.useEffect(() => {
    if (!hasAcceptedDelivery || !navigator.geolocation) return undefined;

    let stopped = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (stopped) return;
        setCourierCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
    );

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [hasAcceptedDelivery]);

  async function acceptDelivery() {
    if (!currentDelivery.id || !profile?.courier_id || !supabase) {
      setActionMessage('Nenhuma entrega disponivel para aceitar.');
      return;
    }

    setActionMessage('');
    try {
      await acceptQueuedDelivery({ supabase, cityId: city.id, delivery: currentDelivery, courierId: profile.courier_id, courierName });
      const xpGained = await awardAcceptXp({ supabase, courierId: profile.courier_id, delivery: currentDelivery, cityId: city.id });
      setCourierPoints((current) => Number(current || 0) + xpGained);
      setCourierStats((current) => ({ ...current, todayXp: Number(current.todayXp || 0) + xpGained }));
      setXpAnimation(`+${xpGained} XP`);
      setTimeout(() => setXpAnimation(null), 3000);
      setActionMessage(`Entrega aceita. +${xpGained} XP`);
      loadCurrentDelivery();
    } catch (error) {
      setActionMessage(error.message);
    }
  }

  async function rejectDelivery() {
    if (!currentDelivery.id || !profile?.courier_id || !supabase) {
      setActionMessage('Nenhuma entrega disponivel para recusar.');
      return;
    }

    try {
      await rejectQueuedDelivery({ supabase, cityId: city.id, delivery: currentDelivery, courierId: profile.courier_id, courierName });
      setActionMessage('Entrega recusada. Buscando outra disponivel.');
      loadCurrentDelivery();
    } catch (error) {
      setActionMessage(error.message);
    }
  }

  async function confirmPickupAtStore() {
    if (!currentDelivery.id || !profile?.courier_id || !supabase) {
      setActionMessage('Nenhuma entrega aceita para retirar na loja.');
      return;
    }

    setActionMessage('');
    setDeliveryLoading(true);
    try {
      await markDeliveryPickedUp({ supabase, cityId: city.id, delivery: currentDelivery, courierId: profile.courier_id, courierName });
      const xpGained = await awardPickupXp({ supabase, courierId: profile.courier_id, deliveryId: currentDelivery.id, cityId: city.id });
      setCourierPoints((current) => Number(current || 0) + xpGained);
      setCourierStats((current) => ({ ...current, todayXp: Number(current.todayXp || 0) + xpGained }));
      setXpAnimation(`+${xpGained} XP`);
      setTimeout(() => setXpAnimation(null), 3000);
      setActionMessage(`Pedido retirado na loja. +${xpGained} XP`);
      loadCurrentDelivery();
    } catch (error) {
      setActionMessage(error.message);
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function confirmDeliveryFinished() {
    if (!currentDelivery.id || !profile?.courier_id || !supabase) {
      setActionMessage('Nenhuma entrega em andamento para finalizar.');
      return;
    }

    setActionMessage('');
    setDeliveryLoading(true);
    try {
      await markDeliveryDelivered({ supabase, cityId: city.id, delivery: currentDelivery, courierId: profile.courier_id, courierName });
      const xpGained = await awardOnTimeDeliveryXp({ supabase, courierId: profile.courier_id, deliveryId: currentDelivery.id, cityId: city.id });
      setCourierPoints((current) => Number(current || 0) + xpGained);
      setCourierStats((current) => ({
        ...current,
        todayXp: Number(current.todayXp || 0) + xpGained,
        todayDeliveries: Number(current.todayDeliveries || 0) + 1,
      }));
      setCourierAvailableState(true);
      setXpAnimation(`+${xpGained} XP`);
      setTimeout(() => setXpAnimation(null), 3000);
      setActionMessage(`Entrega finalizada. +${xpGained} XP`);
      setCurrentDelivery(emptyDelivery());
      loadCurrentDelivery();
    } catch (error) {
      setActionMessage(error.message);
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function confirmAvailability(available) {
    setAvailabilityPromptOpen(false);
    await setCourierAvailable({ supabase, courierId: profile?.courier_id, available });
    setCourierAvailableState(available);
    setActionMessage(available ? 'Status alterado para disponivel.' : 'Status mantido como offline.');
    if (available) loadCurrentDelivery();
  }

  async function changeAvailability(available) {
    await setCourierAvailable({ supabase, courierId: profile?.courier_id, available });
    setCourierAvailableState(available);
    setMenuOpen(false);
    setActionMessage(available ? 'Voce esta disponivel para receber entregas.' : 'Voce ficou offline.');
    if (available) loadCurrentDelivery();
  }

  return (
    <LayoutMotoboy>
      <header className="courier-app-header">
        <button className="courier-profile-card" type="button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-label="Abrir menu do motoboy">
          <span className={`courier-photo ${courierAvailable ? 'online' : 'offline'}`}><UserRound size={30} /></span>
          <span className={`courier-online-dot ${courierAvailable ? 'online' : 'offline'}`} />
          <div>
            <h1>{courierName}</h1>
            <p>Entrega #{currentDelivery.code}</p>
          </div>
        </button>
        {menuOpen && (
          <nav className="courier-profile-menu" aria-label="Menu do motoboy">
            <button type="button" onClick={() => changeAvailability(true)}>Ficar disponivel On-line</button>
            <button type="button" onClick={() => changeAvailability(false)}>Ficar Off-line</button>
            <button type="button" onClick={() => setActionMessage('Meus dados sera implementado na proxima etapa.')}>Meus dados</button>
            <button type="button" onClick={() => setActionMessage('Minhas entregas sera implementado na proxima etapa.')}>Minhas entregas</button>
            <button type="button" onClick={() => setActionMessage('Relatorios sera implementado na proxima etapa.')}>Relatorios</button>
            <button type="button" onClick={onLogout}>Sair</button>
          </nav>
        )}
        <button className="courier-score-pill" type="button" aria-label="Pontuacao" onClick={() => setScoreModalOpen(true)}>
          <span />
          <strong>{courierPoints}</strong>
          <Star size={22} />
        </button>
      </header>

      {xpAnimation && <div className="courier-xp-animation">{xpAnimation}</div>}

      {scoreModalOpen && (
        <div className="courier-score-modal" role="dialog" aria-modal="true" aria-labelledby="courier-score-title">
          <section>
            <h2 id="courier-score-title">Pontuacao do motoboy</h2>
            <article>
              <span>Nivel</span>
              <strong>{courierLevel}</strong>
            </article>
            <article>
              <span>Estrelas</span>
              <strong>{Array.from({ length: courierStars }).map((_, index) => <Star key={index} size={22} fill="currentColor" />)}</strong>
            </article>
            <article>
              <span>XP ganho hoje</span>
              <strong>{formatXpValue(courierStats.todayXp)}</strong>
            </article>
            <article>
              <span>XP total</span>
              <strong>{formatXpValue(courierPoints)}</strong>
            </article>
            <button className="primary-action" type="button" onClick={() => setScoreModalOpen(false)}>Fechar</button>
          </section>
        </div>
      )}

      <section className="courier-mini-stats" aria-label="Indicadores do motoboy">
        <article>
          <UserRound size={30} />
          <strong>{courierStats.onlineCouriers}</strong>
          <span>Motoboys on-line</span>
        </article>
        <article>
          <Store size={30} />
          <strong>{courierStats.openStores}</strong>
          <span>Lojas abertas</span>
        </article>
        <article>
          <WalletCards size={30} />
          <strong>{courierStats.todayDeliveries}</strong>
          <span>Suas entregas de hoje</span>
        </article>
      </section>

      <section className="courier-deadline-card" aria-label="Tempo limite da entrega">
        <Clock3 size={28} />
        <span>{hasAcceptedDelivery ? 'Tempo limite para finalizar no cliente' : 'Sem entrega em andamento'}</span>
        <strong>{hasAcceptedDelivery ? deadlineRemainingLabel : '--:--'}</strong>
      </section>

      {availabilityPromptOpen && (
        <div className="courier-availability-modal" role="dialog" aria-modal="true" aria-labelledby="courier-availability-title">
          <div>
            <h2 id="courier-availability-title">Mudar status para disponivel?</h2>
            <p>Ao confirmar, o sistema pode oferecer novas entregas para voce.</p>
            <span>
              <button type="button" className="primary-action" onClick={() => confirmAvailability(true)}>Sim</button>
              <button type="button" className="secondary-action" onClick={() => confirmAvailability(false)}>Nao</button>
            </span>
          </div>
        </div>
      )}

      {hasPendingOffer && (
        <div className="courier-offer-modal" role="dialog" aria-modal="true" aria-labelledby="courier-offer-title">
          <section className="courier-offer-panel">
            <p className="courier-offer-kicker">Nova entrega disponivel</p>
            <h2 id="courier-offer-title">{currentDelivery.code}</h2>
            <div className="courier-offer-details">
              <article>
                <UserRound size={28} />
                <span>Cliente</span>
                <strong>{currentDelivery.customer}</strong>
              </article>
              <article>
                <Store size={28} />
                <span>Loja</span>
                <strong>{currentDelivery.store}</strong>
              </article>
              <article>
                <WalletCards size={28} />
                <span>Taxa</span>
                <strong className="money">{currentDelivery.fee}</strong>
              </article>
              <article>
                <MapPin size={28} />
                <span>Endereco</span>
                <strong>{currentDelivery.address}</strong>
              </article>
              <article>
                <Navigation size={28} />
                <span>Bairro</span>
                <strong>{currentDelivery.district}</strong>
                {currentDelivery.locationUrl && (
                  <a className="location-link" href={currentDelivery.locationUrl} target="_blank" rel="noreferrer">Ver localizacao</a>
                )}
              </article>
            </div>
            <div className="courier-countdown offer-countdown">
              <Clock3 size={28} />
              <strong>{countdownLabel}</strong>
              <span>Tempo para aceitar</span>
            </div>
            <div className="courier-decision-grid offer-actions">
              <button type="button" className="accept" onClick={acceptDelivery} disabled={deliveryLoading}>
                <span>&#10003;</span>
                <strong>Aceitar entrega</strong>
                <small>{currentDelivery.fee}</small>
              </button>
              <button type="button" className="decline" onClick={rejectDelivery} disabled={deliveryLoading}>
                <span>&#215;</span>
                <strong>Recusar entrega</strong>
                <small>({currentDelivery.refusals})</small>
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="courier-route-map" aria-label={`Mapa da entrega em ${city.name}`}>
        <div className="courier-map-grid" />
        <span className="courier-map-label meireles">MEIRELES</span>
        <span className="courier-map-label aldeota">ALDEOTA</span>
        <span className="courier-map-label papicu">PAPICU</span>
        <span className="courier-map-label dionisio">DIONISIO<br />TORRES</span>
        <span className="courier-map-label coco">COCO</span>
        <span className="courier-map-street street-a">R. Silva Jatahy</span>
        <span className="courier-map-street street-b">Av. Santos Dumont</span>
        <span className="courier-map-street street-c">Av. Sen. Virgilio Tavora</span>
        <svg className="courier-map-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={routePoints} />
        </svg>
        {deliveryMapPoints.map((point) => (
          <React.Fragment key={point.key}>
            <div
              className={`courier-map-pin ${point.key}`}
              style={{ left: `${point.position.x}%`, top: `${point.position.y}%` }}
              title={point.label}
            >
              {point.icon === 'courier' ? <Bike size={27} /> : point.icon === 'store' ? <Store size={25} /> : <MapPin size={27} />}
            </div>
            <article
              className={`courier-map-callout ${point.key}`}
              style={{ left: `${Math.min(78, Math.max(4, point.position.x + 3))}%`, top: `${Math.min(78, Math.max(4, point.position.y - 5))}%` }}
            >
              <strong>{point.label}</strong>
              <span>{point.detail}</span>
            </article>
          </React.Fragment>
        ))}
        <div className="courier-map-actions">
          <button type="button" aria-label="Pesquisar"><Search size={31} /></button>
          <button type="button" aria-label="Minha localizacao"><Navigation size={28} /></button>
        </div>
      </section>

      {showDeliveryData && (
      <section className="courier-delivery-card" aria-label="Dados da entrega">
        <article>
          <UserRound size={32} />
          <span>Cliente</span>
          <strong>{currentDelivery.customer}</strong>
        </article>
        <article>
          <MapPin size={34} />
          <span>Loja</span>
          <strong>{currentDelivery.store}</strong>
        </article>
        <article>
          <WalletCards size={34} />
          <span>Valor da entrega</span>
          <strong className="money">{currentDelivery.fee}</strong>
        </article>
        <article>
          <MapPin size={34} />
          <span>Endereco</span>
          <strong>{[currentDelivery.address, currentDelivery.complement].filter(Boolean).join(' - ')}</strong>
        </article>
        <article>
          <Navigation size={34} />
          <span>Bairro</span>
          <strong>{currentDelivery.district}</strong>
        </article>
        {currentDelivery.locationUrl && (
          <article>
            <MapPin size={34} />
            <span>Localizacao</span>
            <a className="courier-inline-link" href={currentDelivery.locationUrl} target="_blank" rel="noreferrer">Ver localizacao</a>
          </article>
        )}
        {currentDelivery.storeMessageUrl && (
          <article>
            <Mail size={34} />
            <span>Comunicacao com a loja</span>
            <a className="courier-inline-link" href={currentDelivery.storeMessageUrl} target="_blank" rel="noreferrer">Enviar mensagem</a>
          </article>
        )}
        {currentDelivery.status === 'assigned' && (
          <button className="courier-pickup-button" type="button" onClick={confirmPickupAtStore} disabled={deliveryLoading}>
            Peguei o pedido.
          </button>
        )}
        {['picked_up', 'on_route'].includes(currentDelivery.status) && (
          <button className="courier-finish-button" type="button" onClick={confirmDeliveryFinished} disabled={deliveryLoading}>
            Entrega finalizada.
          </button>
        )}
      </section>
      )}

      {actionMessage && <p className="courier-action-message">{actionMessage}</p>}

      <button className="courier-logout" type="button" onClick={onLogout}>
        <LogOut size={18} />Sair
      </button>
    </LayoutMotoboy>
  );
}
