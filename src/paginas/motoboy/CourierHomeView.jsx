import React from 'react';
import { Bike, Clock3, LogOut, Mail, MapPin, Navigation, Search, Star, Store, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { acceptQueuedDelivery, avaliarEntregasCompativeisParaMotoboy, DELIVERY_OFFER_TIMEOUT_SECONDS, emptyDelivery, expireQueuedDeliveryOffer, formatDeliveryForCourier, getNextDeliveryForCourier, markDeliveryDelivered, markDeliveryPickedUp, rejectQueuedDelivery, setCourierAvailable, updateCourierLocation } from '../../cadastra_entrega';
import { awardAcceptXp, awardOnTimeDeliveryXp, awardPickupXp } from '../../xp_motoboy';
import { LayoutMotoboy } from '../../layouts/LayoutMotoboy';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const ACTIVE_DELIVERY_STATUSES = ['assigned', 'picked_up', 'on_route'];
const ACTIVE_DELIVERY_SELECT = 'id, city_id, order_code, store_id, customer_id, courier_id, pickup_address, delivery_address, delivery_district, delivery_complement, customer_latitude, customer_longitude, delivery_deadline_at, estimated_minutes, delivery_fee, status, created_at, customers(id, name, phone, address), stores(id, name, fantasy_name, whatsapp, address, address_number, district, latitude, longitude)';

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function requestCourierNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }

  return Notification.permission;
}

async function subscribeCourierPush({ supabase, courierId }) {
  if (!supabase || !courierId || typeof window === 'undefined') return { ok: false, reason: 'missing-context' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission' };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const payload = subscription.toJSON();
  const { error } = await supabase
    .from('courier_push_subscriptions')
    .upsert({
      courier_id: courierId,
      endpoint: payload.endpoint,
      p256dh: payload.keys?.p256dh,
      auth: payload.keys?.auth,
      user_agent: navigator.userAgent,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

async function showCourierOfferNotification(delivery) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const title = 'Nova entrega disponivel';
  const body = [
    delivery?.code,
    delivery?.store ? `Loja: ${delivery.store}` : '',
    delivery?.fee ? `Taxa: ${delivery.fee}` : '',
  ].filter(Boolean).join(' - ');
  const options = {
    body: body || 'Abra o app para aceitar ou recusar o pedido.',
    icon: '/beelbem-icon.png',
    badge: '/beelbem-icon.png',
    tag: `delivery-offer-${delivery?.id || 'new'}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [450, 160, 450, 160, 700],
    data: { url: '/#login' },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    }

    new Notification(title, options);
  } catch {
    // Notification support varies on mobile browsers; the in-page alert still runs below.
  }
}

function triggerCourierOfferAlert(delivery) {
  if (typeof window === 'undefined') return;

  showCourierOfferNotification(delivery);

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

function formatCurrencyDisplay(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDistanceDisplay(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) return '-- km';
  return `${distance.toFixed(1).replace('.', ',')} km`;
}

function formatMinutesDisplay(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '-- min';
  return `${Math.max(0, Math.round(minutes))} min`;
}

function calculateCourierStars(value) {
  return Math.min(5, Math.max(1, Math.floor(Number(value || 0) / 250) + 1));
}

function formatDateTimeDisplay(value) {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informado';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRawValue(value) {
  if (value === null || value === undefined || value === '') return 'Nao informado';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
  return String(value);
}

function isCourierDocumentField(label) {
  return ['Arquivo CRLV', 'Arquivo CNH', 'Foto de rosto'].includes(label);
}

async function createCourierDocumentPreviewUrl(path) {
  if (!path || typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.includes('/') || !supabase?.storage) return '';
  const { data, error } = await supabase.storage.from('courier-documents').createSignedUrl(path, 600);
  return error ? '' : data?.signedUrl || '';
}

async function createStoreLogoPreviewUrl(path) {
  if (!path || typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.includes('/') || !supabase?.storage) return '';
  const { data, error } = await supabase.storage.from('user-documents').createSignedUrl(path, 600);
  return error ? '' : data?.signedUrl || '';
}

async function fetchCourierStats({ supabase, cityId, courierId }) {
  if (!supabase || !cityId || !courierId) {
    return {
      onlineCouriers: 0,
      openStores: 0,
      todayDeliveries: 0,
      todayXp: 0,
    };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [onlineResult, storesResult, deliveriesResult, xpTodayResult] = await Promise.all([
    supabase
      .from('couriers')
      .select('id', { count: 'exact', head: true })
      .eq('city_id', cityId)
      .eq('active', true)
      .eq('availability_status', 'available'),
    supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('city_id', cityId)
      .eq('active', true)
      .eq('is_open', true),
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('city_id', cityId)
      .eq('courier_id', courierId)
      .gte('created_at', dayStart.toISOString()),
    supabase
      .from('courier_xp_events')
      .select('points')
      .eq('city_id', cityId)
      .eq('courier_id', courierId)
      .gte('created_at', dayStart.toISOString()),
  ]);

  return {
    onlineCouriers: onlineResult.count ?? 0,
    openStores: storesResult.count ?? 0,
    todayDeliveries: deliveriesResult.count ?? 0,
    todayXp: (xpTodayResult.data ?? []).reduce((total, item) => total + Number(item.points || 0), 0),
  };
}

export function CourierHomeView({ city, profile, onLogout }) {
  const [activePanel, setActivePanel] = React.useState('home');
  const [courierName, setCourierName] = React.useState(profile?.name || 'Motoboy');
  const [courierPoints, setCourierPoints] = React.useState(0);
  const [acceptTimeoutSeconds, setAcceptTimeoutSeconds] = React.useState(DELIVERY_OFFER_TIMEOUT_SECONDS);
  const [countdownRemaining, setCountdownRemaining] = React.useState(DELIVERY_OFFER_TIMEOUT_SECONDS);
  const [deadlineRemainingLabel, setDeadlineRemainingLabel] = React.useState('--:--');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scoreModalOpen, setScoreModalOpen] = React.useState(false);
  const [onlineCouriersModalOpen, setOnlineCouriersModalOpen] = React.useState(false);
  const [onlineCouriersLoading, setOnlineCouriersLoading] = React.useState(false);
  const [onlineCouriersMessage, setOnlineCouriersMessage] = React.useState('');
  const [onlineCouriers, setOnlineCouriers] = React.useState([]);
  const [openStoresModalOpen, setOpenStoresModalOpen] = React.useState(false);
  const [openStoresLoading, setOpenStoresLoading] = React.useState(false);
  const [openStoresMessage, setOpenStoresMessage] = React.useState('');
  const [openStores, setOpenStores] = React.useState([]);
  const [availabilityPromptOpen, setAvailabilityPromptOpen] = React.useState(false);
  const [currentDelivery, setCurrentDelivery] = React.useState(emptyDelivery());
  const [activeDeliveries, setActiveDeliveries] = React.useState([]);
  const [compatibleOffer, setCompatibleOffer] = React.useState(null);
  const [compatibleOfferCountdown, setCompatibleOfferCountdown] = React.useState(DELIVERY_OFFER_TIMEOUT_SECONDS);
  const [deliveryLoading, setDeliveryLoading] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState('');
  const [notificationPermission, setNotificationPermission] = React.useState(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ));
  const [courierAvailable, setCourierAvailableState] = React.useState(profile?.availabilityStatus === 'available');
  const [courierStats, setCourierStats] = React.useState({
    onlineCouriers: 0,
    openStores: 0,
    todayDeliveries: 0,
    todayXp: 0,
  });
  const [xpAnimation, setXpAnimation] = React.useState(null);
  const [courierCoords, setCourierCoords] = React.useState(null);
  const [completedDeliveries, setCompletedDeliveries] = React.useState([]);
  const [completedDeliveriesLoading, setCompletedDeliveriesLoading] = React.useState(false);
  const [completedDeliveriesMessage, setCompletedDeliveriesMessage] = React.useState('');
  const [courierDetails, setCourierDetails] = React.useState(null);
  const [courierDetailsLoading, setCourierDetailsLoading] = React.useState(false);
  const [courierDetailsMessage, setCourierDetailsMessage] = React.useState('');
  const [courierDocumentPreviews, setCourierDocumentPreviews] = React.useState({});
  const [courierPhotoUrl, setCourierPhotoUrl] = React.useState('');
  const [selectedDeliveryDetails, setSelectedDeliveryDetails] = React.useState(null);
  const deliveryPollingRef = React.useRef(false);
  const lastLocationSyncRef = React.useRef(0);
  const lastAlertedDeliveryRef = React.useRef('');
  const compatibleOfferDismissedRef = React.useRef(new Set());
  const compatibleOfferLoadingRef = React.useRef(false);
  const expiringOfferRef = React.useRef('');
  const hasPendingOffer = Boolean(currentDelivery.id && currentDelivery.status === 'pending');
  const hasAcceptedDelivery = Boolean(activeDeliveries.length || (currentDelivery.id && ACTIVE_DELIVERY_STATUSES.includes(currentDelivery.status)));
  const visibleDeliveryCards = activeDeliveries.length
    ? activeDeliveries
    : (currentDelivery.id && ACTIVE_DELIVERY_STATUSES.includes(currentDelivery.status) ? [currentDelivery] : []);
  const showDeliveryData = visibleDeliveryCards.length > 0;
  const countdownLabel = `${String(Math.floor(countdownRemaining / 60)).padStart(2, '0')}:${String(countdownRemaining % 60).padStart(2, '0')}`;
  const compatibleOfferCountdownLabel = `${String(Math.floor(compatibleOfferCountdown / 60)).padStart(2, '0')}:${String(compatibleOfferCountdown % 60).padStart(2, '0')}`;
  const courierLevel = Math.max(1, Math.floor(Number(courierPoints || 0) / 500) + 1);
  const courierStars = calculateCourierStars(courierPoints);
  const formatXpValue = (value) => (
    Number.isInteger(Number(value)) ? Number(value).toFixed(0) : Number(value).toFixed(1).replace('.', ',')
  );

  const completedDeliveryRows = completedDeliveries.map((delivery) => ({
    id: delivery.id,
    code: delivery.order_code || delivery.id,
    storeName: delivery.stores?.fantasy_name || delivery.stores?.name || 'Loja nao informada',
    finishedAt: formatDateTimeDisplay(delivery.delivered_at || delivery.updated_at || delivery.created_at),
    fee: formatCurrencyDisplay(delivery.delivery_fee),
    raw: delivery,
  }));

  const courierDetailSections = [
    {
      title: 'Cadastro',
      rows: [
        ['ID', courierDetails?.id || profile?.courier_id],
        ['Nome', courierDetails?.name || courierName],
        ['Nascimento', courierDetails?.birth_date ? formatDateTimeDisplay(courierDetails.birth_date).split(',')[0] : 'Nao informado'],
        ['CPF', courierDetails?.cpf],
        ['E-mail', courierDetails?.email || profile?.email],
        ['Telefone', courierDetails?.phone],
        ['Cidade', city?.name],
        ['Criado em', formatDateTimeDisplay(courierDetails?.created_at)],
        ['Atualizado em', formatDateTimeDisplay(courierDetails?.updated_at)],
      ],
    },
    {
      title: 'Status',
      rows: [
        ['Aprovacao', courierDetails?.approval_status],
        ['Disponibilidade', courierDetails?.availability_status],
        ['Ativo', courierDetails?.active === true ? 'Sim' : courierDetails?.active === false ? 'Nao' : 'Nao informado'],
        ['Disponivel', courierDetails?.available === true ? 'Sim' : courierDetails?.available === false ? 'Nao' : 'Nao informado'],
        ['WhatsApp validado', courierDetails?.whatsapp_validated === true ? 'Sim' : courierDetails?.whatsapp_validated === false ? 'Nao' : 'Nao informado'],
        ['Validado em', formatDateTimeDisplay(courierDetails?.whatsapp_validated_at)],
        ['Avaliacao', courierDetails?.rating],
        ['Pontos', courierPoints],
      ],
    },
    {
      title: 'Veiculo',
      rows: [
        ['Tipo', courierDetails?.vehicle_type],
        ['Placa', courierDetails?.vehicle_plate],
        ['CNH valida ate', courierDetails?.cnh_valid_until ? formatDateTimeDisplay(courierDetails.cnh_valid_until).split(',')[0] : 'Nao informado'],
        ['Observacoes', courierDetails?.vehicle_notes],
        ['Arquivo CRLV', courierDetails?.crlv_file_path],
        ['Arquivo CNH', courierDetails?.cnh_file_path],
        ['Foto de rosto', courierDetails?.face_photo_path],
      ],
    },
    {
      title: 'Pix',
      rows: [
        ['Tipo de chave', courierDetails?.pix_key_type],
        ['Chave Pix', courierDetails?.pix_key],
        ['Titular', courierDetails?.pix_holder_name],
      ],
    },
  ];

  const selectedDetailSections = selectedDeliveryDetails ? [
    {
      title: 'Entrega',
      rows: [
        ['ID', selectedDeliveryDetails.id],
        ['Codigo do pedido', selectedDeliveryDetails.order_code],
        ['Status', selectedDeliveryDetails.status],
        ['Criada em', formatDateTimeDisplay(selectedDeliveryDetails.created_at)],
        ['Finalizada em', formatDateTimeDisplay(selectedDeliveryDetails.delivered_at)],
        ['Taxa', formatCurrencyDisplay(selectedDeliveryDetails.delivery_fee)],
        ['Endereco de coleta', selectedDeliveryDetails.pickup_address],
        ['Endereco de entrega', selectedDeliveryDetails.delivery_address],
        ['Bairro', selectedDeliveryDetails.delivery_district],
        ['Complemento', selectedDeliveryDetails.delivery_complement],
        ['Latitude cliente', selectedDeliveryDetails.customer_latitude],
        ['Longitude cliente', selectedDeliveryDetails.customer_longitude],
        ['Prazo', formatDateTimeDisplay(selectedDeliveryDetails.delivery_deadline_at)],
        ['Minutos estimados', selectedDeliveryDetails.estimated_minutes],
      ],
    },
    {
      title: 'Loja',
      rows: [
        ['ID', selectedDeliveryDetails.stores?.id],
        ['Nome', selectedDeliveryDetails.stores?.name],
        ['Nome fantasia', selectedDeliveryDetails.stores?.fantasy_name],
        ['Responsavel', selectedDeliveryDetails.stores?.responsible_name],
        ['E-mail', selectedDeliveryDetails.stores?.email],
        ['WhatsApp', selectedDeliveryDetails.stores?.whatsapp],
        ['Endereco', [selectedDeliveryDetails.stores?.address, selectedDeliveryDetails.stores?.address_number, selectedDeliveryDetails.stores?.district].filter(Boolean).join(', ')],
        ['CEP', selectedDeliveryDetails.stores?.zip_code],
      ],
    },
    {
      title: 'Cliente',
      rows: [
        ['ID', selectedDeliveryDetails.customers?.id],
        ['Nome', selectedDeliveryDetails.customers?.name],
        ['Telefone', selectedDeliveryDetails.customers?.phone],
        ['Endereco salvo', selectedDeliveryDetails.customers?.address],
      ],
    },
  ] : [];

  function renderCourierDetailValue(label, value) {
    const previewUrl = isCourierDocumentField(label) ? courierDocumentPreviews[value] : '';
    if (!previewUrl) return <strong>{formatRawValue(value)}</strong>;

    return (
      <strong className="courier-data-file-value">
        <img src={previewUrl} alt={`Previa ${label}`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <span>{formatRawValue(value)}</span>
      </strong>
    );
  }

  const loadCourierStats = React.useCallback(async () => {
    const nextStats = await fetchCourierStats({ supabase, cityId: city?.id, courierId: profile?.courier_id });
    setCourierStats(nextStats);
  }, [city?.id, profile?.courier_id]);

  const loadActiveDeliveries = React.useCallback(async () => {
    if (!supabase || !profile?.courier_id || !city?.id) {
      setActiveDeliveries([]);
      return [];
    }

    const { data, error } = await supabase
      .from('deliveries')
      .select(ACTIVE_DELIVERY_SELECT)
      .eq('city_id', city.id)
      .eq('courier_id', profile.courier_id)
      .in('status', ACTIVE_DELIVERY_STATUSES)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    const deliveries = (data ?? []).map((delivery) => formatDeliveryForCourier(delivery));
    setActiveDeliveries(deliveries);
    return deliveries;
  }, [city?.id, profile?.courier_id]);

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
      await loadActiveDeliveries();
    } catch (error) {
      if (!silent) setActionMessage(error.message);
    } finally {
      deliveryPollingRef.current = false;
      if (!silent) setDeliveryLoading(false);
    }
  }, [city?.id, loadActiveDeliveries, profile?.courier_id]);

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
            .select('name, availability_status, face_photo_path')
            .eq('id', profile.courier_id)
            .maybeSingle(),
        ]);

        const nextPhotoUrl = await createCourierDocumentPreviewUrl(courierData?.face_photo_path);

        if (mounted) {
          setCourierPoints(Number(pointsData?.total_points ?? 0));
          if (courierData?.name) setCourierName(courierData.name);
          setCourierPhotoUrl(nextPhotoUrl);
          if (courierData?.availability_status) {
            const isAvailable = courierData.availability_status === 'available';
            setCourierAvailableState(isAvailable);
            setAvailabilityPromptOpen(!isAvailable);
          }
        }
      }

      const { data: timeoutSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'delivery_accept_timeout')
        .maybeSingle();

      const configuredSeconds = Number(timeoutSetting?.value?.seconds);
      if (mounted && Number.isFinite(configuredSeconds) && configuredSeconds > 0) {
        const nextTimeout = Math.max(DELIVERY_OFFER_TIMEOUT_SECONDS, Math.round(configuredSeconds));
        setAcceptTimeoutSeconds(nextTimeout);
        setCountdownRemaining(nextTimeout);
      }

      if (city?.id && profile?.courier_id) {
        const nextStats = await fetchCourierStats({ supabase, cityId: city.id, courierId: profile.courier_id });
        if (mounted) setCourierStats(nextStats);
      }
    }

    loadCourierConfig();
    loadCurrentDelivery();

    return () => {
      mounted = false;
    };
  }, [profile?.courier_id, city?.id, loadCurrentDelivery]);

  React.useEffect(() => {
    if (!supabase || !profile?.courier_id || !city?.id) return undefined;

    let stopped = false;
    let refreshTimeoutId = 0;

    const refreshStats = () => {
      if (stopped) return;
      window.clearTimeout(refreshTimeoutId);
      refreshTimeoutId = window.setTimeout(() => {
        loadCourierStats().catch(() => undefined);
      }, 250);
    };

    const refreshOwnCourier = async (payload) => {
      refreshStats();
      const nextCourier = payload.new?.id === profile.courier_id ? payload.new : null;
      if (!nextCourier || stopped) return;
      if (nextCourier.name) setCourierName(nextCourier.name);
      const nextPhotoUrl = await createCourierDocumentPreviewUrl(nextCourier.face_photo_path);
      if (stopped) return;
      setCourierPhotoUrl(nextPhotoUrl);
      if (nextCourier.availability_status) {
        const isAvailable = nextCourier.availability_status === 'available';
        setCourierAvailableState(isAvailable);
        if (isAvailable) setAvailabilityPromptOpen(false);
      }
    };

    const refreshCourierPoints = async () => {
      const { data } = await supabase
        .from('courier_points')
        .select('total_points')
        .eq('courier_id', profile.courier_id)
        .maybeSingle();
      if (!stopped) setCourierPoints(Number(data?.total_points ?? 0));
      refreshStats();
    };

    const refreshDeliveryState = () => {
      refreshStats();
      loadCurrentDelivery({ silent: true }).catch(() => undefined);
    };

    const statsChannel = supabase
      .channel(`courier-live-stats-${profile.courier_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couriers', filter: `city_id=eq.${city.id}` },
        refreshOwnCourier,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stores', filter: `city_id=eq.${city.id}` },
        refreshStats,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `city_id=eq.${city.id}` },
        refreshDeliveryState,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'courier_xp_events', filter: `courier_id=eq.${profile.courier_id}` },
        refreshStats,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'courier_points', filter: `courier_id=eq.${profile.courier_id}` },
        refreshCourierPoints,
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshStats();
    };

    window.addEventListener('focus', refreshStats);
    document.addEventListener('visibilitychange', handleVisibility);
    refreshStats();

    return () => {
      stopped = true;
      window.clearTimeout(refreshTimeoutId);
      window.removeEventListener('focus', refreshStats);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(statsChannel);
    };
  }, [city?.id, loadCourierStats, loadCurrentDelivery, profile?.courier_id]);

  React.useEffect(() => {
    if (!hasPendingOffer) {
      setCountdownRemaining(acceptTimeoutSeconds);
      expiringOfferRef.current = '';
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
    if (!hasPendingOffer || countdownRemaining > 0 || !currentDelivery.id || !profile?.courier_id || !city?.id || !supabase) return;
    if (expiringOfferRef.current === currentDelivery.queueId) return;
    expiringOfferRef.current = currentDelivery.queueId;

    async function expireOffer() {
      try {
        await expireQueuedDeliveryOffer({
          supabase,
          cityId: city.id,
          delivery: currentDelivery,
          courierId: profile.courier_id,
          courierName,
          note: 'Oferta encaminhada para o proximo motoboy.',
        });
        setActionMessage('Tempo esgotado. Oferta enviada para o proximo motoboy.');
        setCurrentDelivery(emptyDelivery());
        loadCurrentDelivery({ silent: true });
      } catch (error) {
        setActionMessage(error.message);
      }
    }

    expireOffer();
  }, [city?.id, countdownRemaining, courierName, currentDelivery, hasPendingOffer, loadCurrentDelivery, profile?.courier_id]);

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
    const alertKey = `${currentDelivery.queueId || currentDelivery.id}-${currentDelivery.offeredAt || ''}`;
    if (lastAlertedDeliveryRef.current === alertKey) return;
    lastAlertedDeliveryRef.current = alertKey;
    triggerCourierOfferAlert(currentDelivery);
  }, [currentDelivery.id, currentDelivery.offeredAt, currentDelivery.queueId, hasPendingOffer]);

  React.useEffect(() => {
    if (!supabase || !profile?.courier_id || !city?.id || !hasPendingOffer) return undefined;

    let stopped = false;
    const refreshPendingOffer = () => {
      if (!stopped) loadCurrentDelivery({ silent: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshPendingOffer();
    };

    const intervalId = window.setInterval(refreshPendingOffer, 3000);
    window.addEventListener('focus', refreshPendingOffer);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshPendingOffer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [city?.id, hasPendingOffer, loadCurrentDelivery, profile?.courier_id]);

  React.useEffect(() => {
    if (!compatibleOffer) {
      setCompatibleOfferCountdown(acceptTimeoutSeconds);
      return undefined;
    }

    function updateCompatibleOfferCountdown() {
      const offeredAt = compatibleOffer.offeredAt || Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - offeredAt) / 1000));
      setCompatibleOfferCountdown(Math.max(0, acceptTimeoutSeconds - elapsedSeconds));
    }

    updateCompatibleOfferCountdown();
    const intervalId = window.setInterval(updateCompatibleOfferCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [acceptTimeoutSeconds, compatibleOffer]);

  React.useEffect(() => {
    if (compatibleOfferCountdown > 0 || !compatibleOffer?.id) return;
    compatibleOfferDismissedRef.current.add(compatibleOffer.id);
    setCompatibleOffer(null);
  }, [compatibleOfferCountdown, compatibleOffer]);

  React.useEffect(() => {
    if (!supabase || !profile?.courier_id || !city?.id || !hasAcceptedDelivery || hasPendingOffer) {
      setCompatibleOffer(null);
      return undefined;
    }

    let stopped = false;
    async function refreshCompatibleOffer() {
      if (stopped || compatibleOfferLoadingRef.current) return;
      compatibleOfferLoadingRef.current = true;
      try {
        const avaliacao = await avaliarEntregasCompativeisParaMotoboy({
          supabase,
          cityId: city.id,
          courierId: profile.courier_id,
          localizacaoAtualMotoboy: courierCoords,
        });
        if (stopped) return;
        const nextOffer = avaliacao.corridas_compativeis
          ?.find((item) => item?.corrida?.id && !compatibleOfferDismissedRef.current.has(item.corrida.id));
        setCompatibleOffer((current) => {
          if (!nextOffer) return null;
          const nextId = nextOffer.corrida.id;
          return {
            ...nextOffer,
            id: nextId,
            offeredAt: current?.id === nextId ? current.offeredAt : Date.now(),
          };
        });
      } catch {
        if (!stopped) setCompatibleOffer(null);
      } finally {
        compatibleOfferLoadingRef.current = false;
      }
    }

    refreshCompatibleOffer();
    const intervalId = window.setInterval(refreshCompatibleOffer, 10000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [city?.id, courierCoords, hasAcceptedDelivery, hasPendingOffer, profile?.courier_id]);

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
    if (activePanel !== 'deliveries' || !supabase || !profile?.courier_id) return undefined;

    let stopped = false;
    async function loadCompletedDeliveries() {
      setCompletedDeliveriesLoading(true);
      setCompletedDeliveriesMessage('');
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, order_code, status, created_at, updated_at, delivered_at, pickup_address, delivery_address, delivery_district, delivery_complement, customer_latitude, customer_longitude, delivery_deadline_at, estimated_minutes, delivery_fee, customers(id, name, phone, address), stores(id, name, fantasy_name, responsible_name, email, whatsapp, address, address_number, district, zip_code)')
        .eq('courier_id', profile.courier_id)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .limit(80);

      if (stopped) return;
      setCompletedDeliveriesLoading(false);
      if (error) {
        setCompletedDeliveries([]);
        setCompletedDeliveriesMessage(`Nao foi possivel buscar entregas finalizadas: ${error.message}`);
        return;
      }
      setCompletedDeliveries(data ?? []);
      setCompletedDeliveriesMessage((data ?? []).length ? '' : 'Nenhuma entrega finalizada encontrada.');
    }

    loadCompletedDeliveries();
    return () => {
      stopped = true;
    };
  }, [activePanel, profile?.courier_id]);

  React.useEffect(() => {
    if (activePanel !== 'profile' || !supabase || !profile?.courier_id) return undefined;

    let stopped = false;
    async function loadCourierDetails() {
      setCourierDetailsLoading(true);
      setCourierDetailsMessage('');
      const { data, error } = await supabase
        .from('couriers')
        .select('id, city_id, name, birth_date, cpf, email, phone, face_photo_path, whatsapp_validated, whatsapp_validated_at, vehicle_type, vehicle_plate, pix_key, pix_key_type, pix_holder_name, vehicle_notes, crlv_file_path, cnh_file_path, cnh_valid_until, approval_status, rating, active, available, availability_status, internal_notes, created_at, updated_at')
        .eq('id', profile.courier_id)
        .maybeSingle();

      if (stopped) return;
      setCourierDetailsLoading(false);
      if (error) {
        setCourierDetails(null);
        setCourierDetailsMessage(`Nao foi possivel buscar os dados do motoboy: ${error.message}`);
        return;
      }
      setCourierDetails(data);
      setCourierDetailsMessage(data ? '' : 'Dados do motoboy nao encontrados.');
    }

    loadCourierDetails();
    return () => {
      stopped = true;
    };
  }, [activePanel, profile?.courier_id]);

  React.useEffect(() => {
    if (activePanel !== 'profile' || !courierDetails) {
      setCourierDocumentPreviews({});
      return undefined;
    }

    let stopped = false;
    async function loadCourierDocumentPreviews() {
      const paths = [
        courierDetails.crlv_file_path,
        courierDetails.cnh_file_path,
        courierDetails.face_photo_path,
      ].filter(Boolean);

      const entries = await Promise.all(paths.map(async (path) => [
        path,
        await createCourierDocumentPreviewUrl(path),
      ]));

      if (!stopped) {
        setCourierDocumentPreviews(Object.fromEntries(entries.filter(([, url]) => Boolean(url))));
      }
    }

    loadCourierDocumentPreviews();
    return () => {
      stopped = true;
    };
  }, [activePanel, courierDetails]);

  React.useEffect(() => {
    const shouldTrackLocation = Boolean(profile?.courier_id && city?.id && (courierAvailable || hasPendingOffer || hasAcceptedDelivery));
    if (!shouldTrackLocation || !navigator.geolocation) return undefined;

    let stopped = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (stopped) return;
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCourierCoords(nextCoords);

        const now = Date.now();
        if (now - lastLocationSyncRef.current < 15000) return;
        lastLocationSyncRef.current = now;
        updateCourierLocation({
          supabase,
          courierId: profile.courier_id,
          cityId: city.id,
          latitude: nextCoords.latitude,
          longitude: nextCoords.longitude,
          accuracyMeters: position.coords.accuracy,
        }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
    );

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [city?.id, courierAvailable, hasAcceptedDelivery, hasPendingOffer, profile?.courier_id]);

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

  async function confirmPickupAtStore(delivery = currentDelivery) {
    if (!delivery.id || !profile?.courier_id || !supabase) {
      setActionMessage('Nenhuma entrega aceita para retirar na loja.');
      return;
    }

    setActionMessage('');
    setDeliveryLoading(true);
    try {
      await markDeliveryPickedUp({ supabase, cityId: city.id, delivery, courierId: profile.courier_id, courierName });
      const xpGained = await awardPickupXp({ supabase, courierId: profile.courier_id, deliveryId: delivery.id, cityId: city.id });
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

  async function confirmDeliveryFinished(delivery = currentDelivery) {
    if (!delivery.id || !profile?.courier_id || !supabase) {
      setActionMessage('Nenhuma entrega em andamento para finalizar.');
      return;
    }

    setActionMessage('');
    setDeliveryLoading(true);
    try {
      await markDeliveryDelivered({ supabase, cityId: city.id, delivery, courierId: profile.courier_id, courierName });
      const xpGained = await awardOnTimeDeliveryXp({ supabase, courierId: profile.courier_id, deliveryId: delivery.id, cityId: city.id });
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
    let permission = notificationPermission;
    let pushResult = { ok: false };
    if (available) {
      permission = await requestCourierNotificationPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        pushResult = await subscribeCourierPush({ supabase, courierId: profile?.courier_id });
      }
    }
    await setCourierAvailable({ supabase, courierId: profile?.courier_id, available });
    setCourierAvailableState(available);
    setActionMessage(
      available && permission === 'denied'
        ? 'Status alterado para disponivel. Ative as notificacoes do navegador para receber alerta com a tela desligada.'
        : available && permission === 'granted' && !pushResult.ok
          ? 'Status alterado para disponivel. Nao foi possivel ativar o push em segundo plano neste aparelho.'
        : available
          ? 'Status alterado para disponivel.'
          : 'Status mantido como offline.'
    );
    if (available) loadCurrentDelivery();
  }

  async function changeAvailability(available) {
    let permission = notificationPermission;
    let pushResult = { ok: false };
    if (available) {
      permission = await requestCourierNotificationPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        pushResult = await subscribeCourierPush({ supabase, courierId: profile?.courier_id });
      }
    }
    await setCourierAvailable({ supabase, courierId: profile?.courier_id, available });
    setCourierAvailableState(available);
    setMenuOpen(false);
    setActionMessage(
      available && permission === 'denied'
        ? 'Voce esta disponivel, mas as notificacoes estao bloqueadas no navegador.'
        : available && permission === 'granted' && !pushResult.ok
          ? 'Voce esta disponivel, mas o push em segundo plano nao foi ativado neste aparelho.'
        : available
          ? 'Voce esta disponivel para receber entregas.'
          : 'Voce ficou offline.'
    );
    if (available) loadCurrentDelivery();
  }

  function openCourierDataPanel() {
    setMenuOpen(false);
    setActionMessage('');
    setSelectedDeliveryDetails(null);
    setActivePanel('profile');
  }

  function openCourierDeliveriesPanel() {
    setMenuOpen(false);
    setActionMessage('');
    setSelectedDeliveryDetails(null);
    setActivePanel('deliveries');
  }

  async function openOnlineCouriersModal() {
    setOnlineCouriersModalOpen(true);
    setOnlineCouriersLoading(true);
    setOnlineCouriersMessage('');
    setOnlineCouriers([]);

    if (!supabase || !city?.id) {
      setOnlineCouriersLoading(false);
      setOnlineCouriersMessage('Nao foi possivel buscar os motoboys on-line.');
      return;
    }

    const { data, error } = await supabase.rpc('list_online_couriers_for_current_city', {
      target_city_id: city.id,
    });

    if (error) {
      setOnlineCouriersLoading(false);
      setOnlineCouriersMessage(`Nao foi possivel buscar os motoboys on-line: ${error.message}`);
      return;
    }

    const mappedCouriers = await Promise.all((data ?? []).map(async (courier) => {
      const totalXp = Number(courier.total_points || 0);
      return {
        id: courier.id,
        name: courier.name || 'Motoboy',
        photoUrl: await createCourierDocumentPreviewUrl(courier.face_photo_path),
        totalXp,
        stars: calculateCourierStars(totalXp),
      };
    }));

    setOnlineCouriers(mappedCouriers);
    setOnlineCouriersLoading(false);
    if (!mappedCouriers.length) setOnlineCouriersMessage('Nenhum motoboy on-line no momento.');
  }

  async function openOpenStoresModal() {
    setOpenStoresModalOpen(true);
    setOpenStoresLoading(true);
    setOpenStoresMessage('');
    setOpenStores([]);

    if (!supabase || !city?.id) {
      setOpenStoresLoading(false);
      setOpenStoresMessage('Nao foi possivel buscar as lojas abertas.');
      return;
    }

    const { data, error } = await supabase
      .from('stores')
      .select('id, name, fantasy_name, district, logo_url')
      .eq('city_id', city.id)
      .eq('active', true)
      .eq('is_open', true)
      .order('fantasy_name', { ascending: true });

    if (error) {
      setOpenStoresLoading(false);
      setOpenStoresMessage(`Nao foi possivel buscar as lojas abertas: ${error.message}`);
      return;
    }

    const mappedStores = await Promise.all((data ?? []).map(async (store) => ({
      id: store.id,
      name: store.fantasy_name || store.name || 'Loja',
      district: store.district || 'Nao informado',
      logoUrl: await createStoreLogoPreviewUrl(store.logo_url),
    })));

    setOpenStores(mappedStores);
    setOpenStoresLoading(false);
    if (!mappedStores.length) setOpenStoresMessage('Nenhuma loja aberta no momento.');
  }

  function closeCourierDataPanel() {
    setSelectedDeliveryDetails(null);
    setActivePanel('home');
  }

  function rejectCompatibleOffer() {
    if (compatibleOffer?.id) compatibleOfferDismissedRef.current.add(compatibleOffer.id);
    setCompatibleOffer(null);
  }

  async function acceptCompatibleOffer() {
    const deliveryId = compatibleOffer?.corrida?.id;
    if (!deliveryId || !profile?.courier_id || !city?.id || !supabase) {
      setActionMessage('Nenhuma entrega extra disponivel para aceitar.');
      return;
    }

    setActionMessage('');
    setDeliveryLoading(true);
    try {
      const answeredAt = new Date().toISOString();
      const { data: acceptedDelivery, error } = await supabase
        .from('deliveries')
        .update({ courier_id: profile.courier_id, status: 'assigned' })
        .eq('id', deliveryId)
        .eq('city_id', city.id)
        .eq('status', 'pending')
        .is('courier_id', null)
        .select('id')
        .maybeSingle();

      if (error) throw new Error(`Nao foi possivel aceitar entrega extra: ${error.message}`);
      if (!acceptedDelivery) throw new Error('Entrega extra ja foi aceita por outro motoboy ou nao esta mais pendente.');

      await supabase.from('delivery_events').insert({
        city_id: city.id,
        delivery_id: deliveryId,
        status: 'assigned',
        note: `${courierName} aceitou entrega extra da mesma rota.`,
      });

      await supabase
        .from('delivery_queue')
        .update({ status: 'skipped', answered_at: answeredAt })
        .eq('delivery_id', deliveryId)
        .in('status', ['waiting', 'offered']);

      const xpGained = await awardAcceptXp({
        supabase,
        courierId: profile.courier_id,
        delivery: { id: deliveryId, offeredAt: compatibleOffer.offeredAt },
        cityId: city.id,
      });
      setCourierPoints((current) => Number(current || 0) + xpGained);
      setCourierStats((current) => ({ ...current, todayXp: Number(current.todayXp || 0) + xpGained }));
      setXpAnimation(`+${xpGained} XP`);
      setTimeout(() => setXpAnimation(null), 3000);
      compatibleOfferDismissedRef.current.add(deliveryId);
      setCompatibleOffer(null);
      setActionMessage(`Entrega extra aceita. +${xpGained} XP`);
      loadCurrentDelivery();
    } catch (error) {
      setActionMessage(error.message);
    } finally {
      setDeliveryLoading(false);
    }
  }

  return (
    <LayoutMotoboy>
      <header className="courier-app-header">
        <button className="courier-profile-card" type="button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-label="Abrir menu do motoboy">
          <span className={`courier-photo ${courierAvailable ? 'online' : 'offline'}`}>
            {courierPhotoUrl ? <img src={courierPhotoUrl} alt="" /> : <UserRound size={30} />}
          </span>
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
            <button type="button" onClick={openCourierDataPanel}>Meus dados</button>
            <button type="button" onClick={openCourierDeliveriesPanel}>Minhas entregas</button>
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

      {onlineCouriersModalOpen && (
        <div className="courier-data-modal" role="dialog" aria-modal="true" aria-labelledby="online-couriers-title">
          <section>
            <header>
              <div>
                <span>Disponiveis agora</span>
                <h2 id="online-couriers-title">Motoboys on-line</h2>
              </div>
              <button type="button" onClick={() => setOnlineCouriersModalOpen(false)}>Fechar</button>
            </header>

            <div className="courier-data-table-wrap">
              <table className="courier-data-table online-couriers-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nome</th>
                    <th>XP Total</th>
                    <th>Estrelas</th>
                  </tr>
                </thead>
                <tbody>
                  {onlineCouriers.map((courier) => (
                    <tr key={courier.id}>
                      <td>
                        <span className="online-courier-photo">
                          {courier.photoUrl ? <img src={courier.photoUrl} alt="" /> : <UserRound size={22} />}
                        </span>
                      </td>
                      <td>{courier.name}</td>
                      <td>{formatXpValue(courier.totalXp)}</td>
                      <td>
                        <span className="online-courier-stars" aria-label={`${courier.stars} estrelas`}>
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star key={index} size={18} fill={index < courier.stars ? 'currentColor' : 'none'} />
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!onlineCouriers.length && (
                    <tr>
                      <td colSpan="4">{onlineCouriersLoading ? 'Buscando motoboys on-line...' : onlineCouriersMessage || 'Nenhum dado encontrado.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {onlineCouriersMessage && onlineCouriers.length > 0 && (
              <p className="courier-action-message">{onlineCouriersMessage}</p>
            )}
          </section>
        </div>
      )}

      {openStoresModalOpen && (
        <div className="courier-data-modal" role="dialog" aria-modal="true" aria-labelledby="open-stores-title">
          <section>
            <header>
              <div>
                <span>Atendendo agora</span>
                <h2 id="open-stores-title">Lojas abertas</h2>
              </div>
              <button type="button" onClick={() => setOpenStoresModalOpen(false)}>Fechar</button>
            </header>

            <div className="courier-data-table-wrap">
              <table className="courier-data-table open-stores-table">
                <thead>
                  <tr>
                    <th>Logo</th>
                    <th>Nome da loja</th>
                    <th>Bairro</th>
                  </tr>
                </thead>
                <tbody>
                  {openStores.map((store) => (
                    <tr key={store.id}>
                      <td>
                        <span className="open-store-logo">
                          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <Store size={22} />}
                        </span>
                      </td>
                      <td>{store.name}</td>
                      <td>{store.district}</td>
                    </tr>
                  ))}
                  {!openStores.length && (
                    <tr>
                      <td colSpan="3">{openStoresLoading ? 'Buscando lojas abertas...' : openStoresMessage || 'Nenhum dado encontrado.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activePanel === 'profile' ? (
        <section className="courier-data-window" aria-labelledby="courier-profile-title">
          <div className="courier-data-toolbar">
            <div>
              <span>Cadastro do motoboy</span>
              <h2 id="courier-profile-title">Meus dados</h2>
            </div>
            <button className="secondary-action" type="button" onClick={closeCourierDataPanel}>Voltar</button>
          </div>

          {courierDetailsLoading ? (
            <p className="courier-action-message">Buscando dados do motoboy...</p>
          ) : courierDetailsMessage ? (
            <p className="courier-action-message">{courierDetailsMessage}</p>
          ) : (
            <div className="courier-data-detail-grid">
              {courierDetailSections.map((section) => (
                <article key={section.title}>
                  <h3>{section.title}</h3>
                  {section.rows.map(([label, value]) => (
                    <p key={`${section.title}-${label}`}>
                      <span>{label}</span>
                      {renderCourierDetailValue(label, value)}
                    </p>
                  ))}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : activePanel === 'deliveries' ? (
        <section className="courier-data-window" aria-labelledby="courier-data-title">
          <div className="courier-data-toolbar">
            <div>
              <span>Historico do motoboy</span>
              <h2 id="courier-data-title">Minhas entregas</h2>
            </div>
            <button className="secondary-action" type="button" onClick={closeCourierDataPanel}>Voltar</button>
          </div>

          <div className="courier-data-table-wrap">
            <table className="courier-data-table">
              <thead>
                <tr>
                  <th>Cod. pedido</th>
                  <th>Nome do lojista</th>
                  <th>Finalizacao</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {completedDeliveryRows.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <button type="button" className="courier-order-link" onClick={() => setSelectedDeliveryDetails(delivery.raw)}>
                        {delivery.code}
                      </button>
                    </td>
                    <td>{delivery.storeName}</td>
                    <td>{delivery.finishedAt}</td>
                    <td>{delivery.fee}</td>
                  </tr>
                ))}
                {!completedDeliveryRows.length && (
                  <tr>
                    <td colSpan="4">{completedDeliveriesLoading ? 'Buscando entregas finalizadas...' : completedDeliveriesMessage || 'Nenhum dado encontrado.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {completedDeliveriesMessage && completedDeliveryRows.length > 0 && (
            <p className="courier-action-message">{completedDeliveriesMessage}</p>
          )}

          {selectedDeliveryDetails && (
            <div className="courier-data-modal" role="dialog" aria-modal="true" aria-labelledby="courier-data-modal-title">
              <section>
                <header>
                  <div>
                    <span>Dados do pedido</span>
                    <h2 id="courier-data-modal-title">{selectedDeliveryDetails.order_code || selectedDeliveryDetails.id}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedDeliveryDetails(null)}>Fechar</button>
                </header>
                <div className="courier-data-detail-grid">
                  {selectedDetailSections.map((section) => (
                    <article key={section.title}>
                      <h3>{section.title}</h3>
                      {section.rows.length > 0 ? section.rows.map(([label, value]) => (
                        <p key={`${section.title}-${label}`}>
                          <span>{label}</span>
                          <strong>{formatRawValue(value)}</strong>
                        </p>
                      )) : (
                        <p>
                          <span>Registro</span>
                          <strong>Nao informado</strong>
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      ) : (
      <>
      <section className="courier-mini-stats" aria-label="Indicadores do motoboy">
        <button className="courier-mini-stat-card" type="button" onClick={openOnlineCouriersModal}>
          <UserRound size={30} />
          <strong>{courierStats.onlineCouriers}</strong>
          <span>Motoboys on-line</span>
        </button>
        <button className="courier-mini-stat-card" type="button" onClick={openOpenStoresModal}>
          <Store size={30} />
          <strong>{courierStats.openStores}</strong>
          <span>Lojas abertas</span>
        </button>
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

      {compatibleOffer && !hasPendingOffer && (
        <div className="courier-offer-modal compatible-offer-modal" role="dialog" aria-modal="true" aria-labelledby="compatible-offer-title">
          <section className="courier-offer-panel compatible-offer-panel">
            <p className="courier-offer-kicker">Nova entrega compativel com sua rota</p>
            <h2 id="compatible-offer-title">{compatibleOffer.corrida?.code || compatibleOffer.corrida?.order_code || compatibleOffer.corrida?.id}</h2>
            <div className="courier-offer-details">
              <article>
                <Store size={28} />
                <span>Loja</span>
                <strong>{compatibleOffer.corrida?.store || compatibleOffer.corrida?.stores?.fantasy_name || compatibleOffer.corrida?.stores?.name || 'Loja nao informada'}</strong>
              </article>
              <article>
                <UserRound size={28} />
                <span>Cliente</span>
                <strong>{compatibleOffer.corrida?.customer || compatibleOffer.corrida?.customers?.name || 'Cliente nao informado'}</strong>
              </article>
              <article>
                <WalletCards size={28} />
                <span>Taxa</span>
                <strong className="money">{compatibleOffer.corrida?.fee || formatCurrencyDisplay(compatibleOffer.valor_entrega)}</strong>
              </article>
              <article>
                <Navigation size={28} />
                <span>Distancia extra</span>
                <strong>{formatDistanceDisplay(compatibleOffer.distancia_extra_estimada_km)}</strong>
              </article>
              <article>
                <Clock3 size={28} />
                <span>Tempo extra</span>
                <strong>{formatMinutesDisplay(compatibleOffer.tempo_extra_estimado_minutos)}</strong>
              </article>
            </div>
            <div className="courier-countdown offer-countdown">
              <Clock3 size={28} />
              <strong>{compatibleOfferCountdownLabel}</strong>
              <span>Tempo para aceitar</span>
            </div>
            <div className="courier-decision-grid offer-actions">
              <button type="button" className="accept" onClick={acceptCompatibleOffer}>
                <span>&#10003;</span>
                <strong>Aceitar entrega</strong>
                <small>{formatDistanceDisplay(compatibleOffer.distancia_ate_rota_km)}</small>
              </button>
              <button type="button" className="decline" onClick={rejectCompatibleOffer}>
                <span>&#215;</span>
                <strong>Recusar entrega</strong>
                <small>Sugestao</small>
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

      {showDeliveryData && visibleDeliveryCards.map((delivery) => (
        <section className="courier-delivery-card" aria-label={`Dados da entrega ${delivery.code}`} key={delivery.id}>
          <article>
            <UserRound size={32} />
            <span>Cliente</span>
            <strong>{delivery.customer}</strong>
          </article>
          <article>
            <MapPin size={34} />
            <span>Loja</span>
            <strong>{delivery.store}</strong>
          </article>
          <article>
            <WalletCards size={34} />
            <span>Valor da entrega</span>
            <strong className="money">{delivery.fee}</strong>
          </article>
          <article>
            <MapPin size={34} />
            <span>Endereco</span>
            <strong>{[delivery.address, delivery.complement].filter(Boolean).join(' - ')}</strong>
          </article>
          <article>
            <Navigation size={34} />
            <span>Bairro</span>
            <strong>{delivery.district}</strong>
          </article>
          {delivery.locationUrl && (
            <article>
              <MapPin size={34} />
              <span>Localizacao</span>
              <a className="courier-inline-link" href={delivery.locationUrl} target="_blank" rel="noreferrer">Ver localizacao</a>
            </article>
          )}
          {delivery.storeMessageUrl && (
            <article>
              <Mail size={34} />
              <span>Comunicacao com a loja</span>
              <a className="courier-inline-link" href={delivery.storeMessageUrl} target="_blank" rel="noreferrer">Enviar mensagem</a>
            </article>
          )}
          {delivery.status === 'assigned' && (
            <button className="courier-pickup-button" type="button" onClick={() => confirmPickupAtStore(delivery)} disabled={deliveryLoading}>
              Peguei o pedido.
            </button>
          )}
          {['picked_up', 'on_route'].includes(delivery.status) && (
            <button className="courier-finish-button" type="button" onClick={() => confirmDeliveryFinished(delivery)} disabled={deliveryLoading}>
              Entrega finalizada.
            </button>
          )}
        </section>
      ))}

      {actionMessage && <p className="courier-action-message">{actionMessage}</p>}

      <button className="courier-logout" type="button" onClick={onLogout}>
        <LogOut size={18} />Sair
      </button>
      </>
      )}
    </LayoutMotoboy>
  );
}
