import React from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, Bike, Camera, Clock3, MapPin, Minus, Navigation, PencilLine, Phone, Plus, Search, Star, Store, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { advanceDeliveryOfferQueue, cancelPendingDeliveryOfferSearch, createDeliveryWithQueue, STORE_PENDING_FOLLOWUP_SECONDS } from '../../cadastra_entrega';
import { analisarComprovantePedidoComGemini, transformarAnaliseEmPedidoLoja } from '../../analisa_comprovante_pedido';
import { isValidCep, isValidEmail, isValidPhone, maskCep, maskCnpj, maskPhone, onlyDigits } from '../../utils/validators';
import { LayoutLojista } from '../../layouts/LayoutLojista';
import { calcularMinutosAteHorarioPrevistoPedidoLoja, validarHorarioPrevistoPedidoLoja, validarPedidoLoja, validarTaxaEntregaPedidoLoja } from '../../ValidaPedidoLoja';
import { validar_dadoscomprovante_gemini } from '../../valid_dadoscomprovante_gemini';

const STATUS_DETAIL_CONFIG = {
  'to-store': {
    title: 'A caminho da loja',
    openLabel: 'Abrir entregas a caminho da loja',
    statuses: ['assigned'],
    dateColumnLabel: 'Conf.',
    emptyMessage: 'Nenhuma confirmacao encontrada neste periodo.',
  },
  'to-customer': {
    title: 'A caminho do cliente',
    openLabel: 'Abrir entregas a caminho do cliente',
    statuses: ['picked_up', 'on_route'],
    dateColumnLabel: 'Conf.',
    emptyMessage: 'Nenhuma entrega a caminho do cliente encontrada neste periodo.',
  },
  late: {
    title: 'Em atraso',
    openLabel: 'Abrir entregas em atraso',
    statuses: ['assigned', 'picked_up', 'on_route'],
    dateColumnLabel: 'Prazo',
    lateOnly: true,
    emptyMessage: 'Nenhum pedido em atraso encontrado neste periodo.',
  },
};

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhotoAnalysisErrorMessage(message, code = '', status = '') {
  const text = String(message || '').trim();
  if (code === 'gemini_api_key_missing' || /VITE_GEMINI_API_KEY|chave/i.test(text)) {
    return 'Analise por foto sem chave do Gemini neste ambiente. Configure VITE_GEMINI_API_KEY e reinicie o app.';
  }
  if (status === 'RESOURCE_EXHAUSTED' || /quota|rate limit|resource exhausted/i.test(text)) {
    return 'Limite da API do Gemini atingido. Aguarde a liberacao da cota ou revise o faturamento/limites no Google AI Studio.';
  }
  if (['PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(status) || /API key not valid|permission|denied|unauthenticated/i.test(text)) {
    return 'A chave do Gemini foi recusada. Verifique se ela continua ativa, se a API esta habilitada e se nao ha restricao bloqueando este dominio.';
  }
  if (status === 'NOT_FOUND' || /model.*not found|not found.*model|not supported.*generateContent/i.test(text)) {
    return 'Modelo do Gemini indisponivel para esta chave. Configure VITE_GEMINI_MODEL para um modelo ativo, como gemini-3.5-flash.';
  }
  if (status === 'FAILED_PRECONDITION' || /location is not supported|restricted|precondition/i.test(text)) {
    return 'O projeto ou a localizacao da chave nao pode usar o Gemini API neste momento. Verifique as restricoes da chave e a conta do Google AI Studio.';
  }
  if (code === 'gemini_empty_response') return text;
  if (!text) return 'Nao foi possivel analisar a foto automaticamente.';
  return text;
}

function montarDetalhesFalhaAnaliseFoto(result = {}) {
  const detalhes = [
    result.codigo ? `Codigo: ${result.codigo}` : '',
    result.status ? `Status Gemini: ${result.status}` : '',
    result.httpStatus ? `HTTP: ${result.httpStatus}` : '',
    result.modelo ? `Modelo: ${result.modelo}` : '',
    result.motivo ? `Mensagem original: ${result.motivo}` : '',
  ].filter(Boolean);
  return detalhes.length ? detalhes.join('\n') : '';
}

function maskDeliveryTime(value) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function maskDeliveryFee(value) {
  const digits = onlyDigits(value).slice(0, 5);
  const amount = Number(digits || 0) / 100;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatXpValue(value) {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1).replace('.', ',');
}

function formatShortDateTime(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function uniqueStatusDetailRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.deliveryId || row.orderCode || row.id;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function courierLevelFromXp(value) {
  return Math.max(1, Math.floor(Number(value || 0) / 500) + 1);
}

function courierStarsFromXp(value) {
  return Math.min(5, Math.max(1, Math.floor(Number(value || 0) / 250) + 1));
}

export function StoreHomeView({ city, store, profile, onLogout }) {
  const photoCaptureInputRef = React.useRef(null);
  const photoPageInputRef = React.useRef(null);
  const storeName = store?.fantasyName || store?.name || profile?.name || 'Minha loja';
  const storeWords = storeName.split(' ').filter(Boolean);
  const brandTop = storeWords[0] || 'Beelbem';
  const brandBottom = storeWords.slice(1, 3).join(' ') || 'Loja';
  const storeLogo = store?.logoUrl || store?.logo_url || store?.logo || '';
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState('home');
  const [passwordInfo, setPasswordInfo] = React.useState('');
  const [storeDataForm, setStoreDataForm] = React.useState(() => ({
    email: store?.email || profile?.email || '',
    whatsapp: store?.whatsapp ? maskPhone(store.whatsapp) : '',
    landline: store?.landline ? maskPhone(store.landline) : '',
    address: store?.address || '',
    number: store?.number || '',
    district: store?.district || '',
    zipCode: store?.zipCode ? maskCep(store.zipCode) : '',
    locationReceived: store?.locationReceived || '',
  }));
  const [dataMessage, setDataMessage] = React.useState('');
  const [savingStoreData, setSavingStoreData] = React.useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [deliverySearch, setDeliverySearch] = React.useState('');
  const [deliveryFilter, setDeliveryFilter] = React.useState('all');
  const [deliveryDate, setDeliveryDate] = React.useState(todayIso);
  const [storeDeliveries, setStoreDeliveries] = React.useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = React.useState(false);
  const [deliveriesMessage, setDeliveriesMessage] = React.useState('');
  const [statusDetailsType, setStatusDetailsType] = React.useState(null);
  const [statusDetailsRows, setStatusDetailsRows] = React.useState([]);
  const [statusDetailsLoading, setStatusDetailsLoading] = React.useState(false);
  const [statusDetailsMessage, setStatusDetailsMessage] = React.useState('');
  const [statusDetailsFilters, setStatusDetailsFilters] = React.useState({
    startDate: todayIso,
    endDate: todayIso,
  });
  const [liveDeliveries, setLiveDeliveries] = React.useState([]);
  const [liveDeliveriesMessage, setLiveDeliveriesMessage] = React.useState('');
  const [pendingOfferPrompt, setPendingOfferPrompt] = React.useState(null);
  const [dismissedAcceptedDeliveryId, setDismissedAcceptedDeliveryId] = React.useState('');
  const [storeOpen, setStoreOpen] = React.useState(store?.isOpen ?? true);
  const [showOpenPrompt, setShowOpenPrompt] = React.useState(store?.isOpen === false);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [requestModalOpen, setRequestModalOpen] = React.useState(false);
  const [requestSaving, setRequestSaving] = React.useState(false);
  const [requestMessage, setRequestMessage] = React.useState('');
  const [requestForm, setRequestForm] = React.useState({
    orderCode: '',
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryDistrict: '',
    deliveryComplement: '',
    estimatedMinutes: '',
    estimatedTime: '',
    customerLocationUrl: '',
    deliveryFee: '',
  });
  const [photoRequest, setPhotoRequest] = React.useState({
    file: null,
    previewUrl: '',
    customerLocationUrl: '',
  });
  const [photoAnalysis, setPhotoAnalysis] = React.useState(null);
  const [photoMessage, setPhotoMessage] = React.useState('');
  const [photoAnalysisError, setPhotoAnalysisError] = React.useState('');
  const [photoAnalysisDebug, setPhotoAnalysisDebug] = React.useState(null);
  const [photoAnalyzing, setPhotoAnalyzing] = React.useState(false);
  const pendingOfferPromptNextAtRef = React.useRef(new Map());
  const statusDetailsConfig = statusDetailsType ? STATUS_DETAIL_CONFIG[statusDetailsType] : null;

  const liveDeliveryStats = React.useMemo(() => {
    const now = Date.now();
    const toStore = liveDeliveries.filter((delivery) => delivery.status === 'assigned').length;
    const toCustomer = liveDeliveries.filter((delivery) => ['picked_up', 'on_route'].includes(delivery.status)).length;
    const late = liveDeliveries.filter((delivery) => (
      delivery.deadlineAt && new Date(delivery.deadlineAt).getTime() < now && delivery.status !== 'delivered'
    )).length;
    return [
      { key: 'to-store', label: 'A caminho da loja', value: String(toStore).padStart(2, '0'), tone: 'green', icon: <Bike size={32} /> },
      { key: 'to-customer', label: 'A caminho do cliente', value: String(toCustomer).padStart(2, '0'), tone: 'yellow', icon: <Bike size={32} /> },
      { key: 'late', label: 'Em atraso', value: String(late).padStart(2, '0'), tone: 'red', icon: <AlertTriangle size={32} /> },
    ];
  }, [liveDeliveries]);

  const acceptedDelivery = liveDeliveries[0] ?? null;
  const showAcceptedDeliveryPopup = Boolean(acceptedDelivery && acceptedDelivery.id !== dismissedAcceptedDeliveryId);

  React.useEffect(() => {
    setStoreOpen(store?.isOpen ?? true);
    setShowOpenPrompt(store?.isOpen === false);
    setStatusMessage('');
    setStoreDataForm({
      email: store?.email || profile?.email || '',
      whatsapp: store?.whatsapp ? maskPhone(store.whatsapp) : '',
      landline: store?.landline ? maskPhone(store.landline) : '',
      address: store?.address || '',
      number: store?.number || '',
      district: store?.district || '',
      zipCode: store?.zipCode ? maskCep(store.zipCode) : '',
      locationReceived: store?.locationReceived || '',
    });
  }, [store?.id, store?.isOpen]);

  React.useEffect(() => () => {
    if (photoRequest.previewUrl) window.URL.revokeObjectURL(photoRequest.previewUrl);
  }, [photoRequest.previewUrl]);

  React.useEffect(() => {
    let mounted = true;

    async function loadStoreDeliveries() {
      if (activePanel !== 'deliveries') return;
      setDeliveriesMessage('');

      const fallbackDeliveries = [
        { id: 'demo-1', courier: 'Carlos Silva', customer: 'Ana Beatriz', order: '#1234', fee: 12.5, date: new Date().toLocaleDateString('pt-BR'), status: 'A caminho', courierPhone: '' },
        { id: 'demo-2', courier: 'Juliana Santos', customer: 'Rafael Souza', order: '#1233', fee: 10, date: new Date().toLocaleDateString('pt-BR'), status: 'Entregue', courierPhone: '' },
      ];

      if (!supabase || !store?.id) {
        setStoreDeliveries(fallbackDeliveries);
        return;
      }

      const start = `${deliveryDate}T00:00:00`;
      const end = `${deliveryDate}T23:59:59.999`;
      setDeliveriesLoading(true);
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, order_code, delivery_fee, status, created_at, customers(name), couriers(name, phone)')
        .eq('store_id', store.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setDeliveriesLoading(false);

      if (error) {
        setDeliveriesMessage(`Nao foi possivel buscar entregas: ${error.message}`);
        setStoreDeliveries([]);
        return;
      }

      setStoreDeliveries((data ?? []).map((delivery) => ({
        id: delivery.id,
        courier: delivery.couriers?.name || 'Sem entregador',
        courierPhone: delivery.couriers?.phone || '',
        customer: delivery.customers?.name || 'Cliente nao informado',
        order: delivery.order_code || delivery.id,
        fee: Number(delivery.delivery_fee || 0),
        date: new Date(delivery.created_at).toLocaleDateString('pt-BR'),
        status: deliveryStatusLabel(delivery.status),
      })));
    }

    loadStoreDeliveries();
    return () => {
      mounted = false;
    };
  }, [activePanel, deliveryDate, store?.id]);

  React.useEffect(() => {
    let mounted = true;

    async function signedCourierPhoto(path) {
      if (!path || /^https?:\/\//i.test(path)) return path || '';
      if (!path.includes('/') || !supabase?.storage) return '';
      const { data, error } = await supabase.storage.from('courier-documents').createSignedUrl(path, 600);
      return error ? '' : data?.signedUrl || '';
    }

    async function loadLiveDeliveries() {
      if (!supabase || !store?.id) {
        setLiveDeliveries([]);
        return;
      }

      setLiveDeliveriesMessage('');
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, order_code, delivery_fee, status, delivery_deadline_at, updated_at, customers(name), couriers(id, name, phone, face_photo_path, rating)')
        .eq('store_id', store.id)
        .in('status', ['assigned', 'picked_up', 'on_route'])
        .order('updated_at', { ascending: false })
        .limit(4);

      if (!mounted) return;
      if (error) {
        setLiveDeliveries([]);
        setLiveDeliveriesMessage(`Nao foi possivel buscar entregas em andamento: ${error.message}`);
        return;
      }

      const courierIds = [...new Set((data ?? []).map((delivery) => delivery.couriers?.id).filter(Boolean))];
      const pointsByCourier = new Map();
      if (courierIds.length) {
        const { data: pointsData } = await supabase
          .from('courier_points')
          .select('courier_id, total_points')
          .in('courier_id', courierIds);
        for (const item of pointsData ?? []) pointsByCourier.set(item.courier_id, Number(item.total_points || 0));
      }

      const mapped = await Promise.all((data ?? []).map(async (delivery) => {
        const courierId = delivery.couriers?.id || '';
        const xp = pointsByCourier.get(courierId) ?? 0;
        return {
          id: delivery.id,
          order: delivery.order_code || delivery.id,
          status: delivery.status,
          fee: Number(delivery.delivery_fee || 0),
          deadlineAt: delivery.delivery_deadline_at || '',
          acceptedAt: delivery.updated_at || '',
          customer: delivery.customers?.name || 'Cliente nao informado',
          courierId,
          courierName: delivery.couriers?.name || 'Motoboy',
          courierPhone: delivery.couriers?.phone || '',
          courierPhotoUrl: await signedCourierPhoto(delivery.couriers?.face_photo_path),
          courierXp: xp,
          courierLevel: courierLevelFromXp(xp),
          courierStars: courierStarsFromXp(xp),
          courierRating: Number(delivery.couriers?.rating || 0),
        };
      }));

      if (mounted) setLiveDeliveries(mapped);
    }

    loadLiveDeliveries();
    const intervalId = window.setInterval(loadLiveDeliveries, 10000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [store?.id]);

  React.useEffect(() => {
    if (!statusDetailsConfig) return undefined;
    let mounted = true;

    async function loadStatusDetails() {
      setStatusDetailsMessage('');
      if (!supabase || !store?.id) {
        setStatusDetailsRows([]);
        setStatusDetailsMessage('Supabase nao disponivel nesta sessao.');
        return;
      }

      const startDate = statusDetailsFilters.startDate || todayIso;
      const endDate = statusDetailsFilters.endDate || startDate;
      const start = `${startDate}T00:00:00`;
      const end = `${endDate}T23:59:59.999`;

      setStatusDetailsLoading(true);
      if (statusDetailsConfig.lateOnly) {
        const { data: lateDeliveries, error: lateError } = await supabase
          .from('deliveries')
          .select('id, order_code, delivery_district, delivery_deadline_at, customers(name), couriers(name)')
          .eq('store_id', store.id)
          .in('status', statusDetailsConfig.statuses)
          .lt('delivery_deadline_at', new Date().toISOString())
          .gte('delivery_deadline_at', start)
          .lte('delivery_deadline_at', end)
          .order('delivery_deadline_at', { ascending: true });

        if (!mounted) return;
        setStatusDetailsLoading(false);

        if (lateError) {
          setStatusDetailsRows([]);
          setStatusDetailsMessage(`Nao foi possivel carregar a tabela: ${lateError.message}`);
          return;
        }

        setStatusDetailsRows(uniqueStatusDetailRows((lateDeliveries ?? []).map((delivery) => ({
          id: delivery.id,
          deliveryId: delivery.id,
          courierName: delivery.couriers?.name || 'Motoboy',
          orderCode: delivery.order_code || delivery.id,
          confirmedAt: delivery.delivery_deadline_at,
          customerName: delivery.customers?.name || 'Cliente nao informado',
          district: delivery.delivery_district || 'Bairro nao informado',
        }))));
        return;
      }

      const { data, error } = await supabase
        .from('delivery_events')
        .select('id, created_at, deliveries!inner(id, order_code, delivery_district, store_id, customers(name), couriers(name))')
        .in('status', statusDetailsConfig.statuses)
        .eq('deliveries.store_id', store.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (!mounted) return;

      if (!error) {
        setStatusDetailsRows(uniqueStatusDetailRows((data ?? []).map((event) => ({
          id: event.deliveries?.id || event.id,
          deliveryId: event.deliveries?.id || '',
          courierName: event.deliveries?.couriers?.name || 'Motoboy',
          orderCode: event.deliveries?.order_code || event.deliveries?.id || '',
          confirmedAt: event.created_at,
          customerName: event.deliveries?.customers?.name || 'Cliente nao informado',
          district: event.deliveries?.delivery_district || 'Bairro nao informado',
        }))));
        setStatusDetailsLoading(false);
        return;
      }

      const fallback = await supabase
        .from('deliveries')
        .select('id, order_code, delivery_district, updated_at, customers(name), couriers(name)')
        .eq('store_id', store.id)
        .in('status', statusDetailsConfig.statuses)
        .gte('updated_at', start)
        .lte('updated_at', end)
        .order('updated_at', { ascending: false });

      if (!mounted) return;
      setStatusDetailsLoading(false);

      if (fallback.error) {
        setStatusDetailsRows([]);
        setStatusDetailsMessage(`Nao foi possivel carregar a tabela: ${fallback.error.message}`);
        return;
      }

      setStatusDetailsRows(uniqueStatusDetailRows((fallback.data ?? []).map((delivery) => ({
        id: delivery.id,
        deliveryId: delivery.id,
        courierName: delivery.couriers?.name || 'Motoboy',
        orderCode: delivery.order_code || delivery.id,
        confirmedAt: delivery.updated_at,
        customerName: delivery.customers?.name || 'Cliente nao informado',
        district: delivery.delivery_district || 'Bairro nao informado',
      }))));
    }

    loadStatusDetails();
    return () => {
      mounted = false;
    };
  }, [statusDetailsConfig, statusDetailsFilters.endDate, statusDetailsFilters.startDate, store?.id, todayIso]);

  React.useEffect(() => {
    if (!supabase || !store?.id) return undefined;

    let stopped = false;
    let running = false;

    async function monitorPendingOffers() {
      if (stopped || running) return;
      running = true;
      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select('id, order_code, created_at')
          .eq('store_id', store.id)
          .eq('status', 'pending')
          .is('courier_id', null)
          .order('created_at', { ascending: true })
          .limit(10);

        if (error) {
          if (!stopped) setLiveDeliveriesMessage(`Nao foi possivel monitorar solicitacoes pendentes: ${error.message}`);
          return;
        }

        for (const delivery of data ?? []) {
          await advanceDeliveryOfferQueue({ supabase, deliveryId: delivery.id });
        }

        const pendingIds = new Set((data ?? []).map((delivery) => delivery.id));
        if (!stopped) {
          setPendingOfferPrompt((current) => current && !pendingIds.has(current.id) ? null : current);
        }

        const now = Date.now();
        const waitingTooLong = (data ?? []).find((delivery) => {
          const createdAt = new Date(delivery.created_at).getTime();
          const nextPromptAt = pendingOfferPromptNextAtRef.current.get(delivery.id) || createdAt + STORE_PENDING_FOLLOWUP_SECONDS * 1000;
          return now >= nextPromptAt;
        });

        if (!stopped && waitingTooLong) {
          setPendingOfferPrompt((current) => current?.id === waitingTooLong.id ? current : {
            id: waitingTooLong.id,
            orderCode: waitingTooLong.order_code || waitingTooLong.id,
            createdAt: waitingTooLong.created_at,
          });
        }
      } finally {
        running = false;
      }
    }

    monitorPendingOffers();
    const intervalId = window.setInterval(monitorPendingOffers, 5000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [store?.id]);

  const normalizedDeliverySearch = deliverySearch.trim().toLowerCase();
  const visibleStoreDeliveries = storeDeliveries.filter((delivery) => {
    const searchable = [delivery.courier, delivery.customer, delivery.order, delivery.status].join(' ').toLowerCase();
    const matchesSearch = !normalizedDeliverySearch || searchable.includes(normalizedDeliverySearch);
    const matchesFilter = deliveryFilter === 'all' || delivery.status === deliveryFilter;
    return matchesSearch && matchesFilter;
  });

  async function toggleStoreStatus() {
    const nextStatus = !storeOpen;
    setStoreOpen(nextStatus);
    setStatusMessage('');

    if (!supabase || !store?.id) return;

    const { error } = await supabase
      .from('stores')
      .update({ is_open: nextStatus })
      .eq('id', store.id);

    if (error) {
      setStoreOpen(!nextStatus);
      setStatusMessage(`Nao foi possivel alterar o status: ${error.message}`);
      return;
    }

    setStatusMessage(nextStatus ? 'Loja aberta para entregas.' : 'Loja fechada para entregas.');
    if (nextStatus) setShowOpenPrompt(false);
  }

  function storeGeoErrorMessage(error) {
    if (error?.code === 1) return 'Permissao de localizacao negada. Autorize no navegador ou cole o link do Google Maps.';
    if (error?.code === 2) return 'Localizacao indisponivel. Verifique GPS/Wi-Fi/dados moveis.';
    if (error?.code === 3) return 'Tempo esgotado para obter a localizacao. Tente novamente.';
    return 'Nao foi possivel obter a localizacao.';
  }

  function sendStoreLocation() {
    setDataMessage('');
    if (!navigator.geolocation) {
      setDataMessage('Este navegador nao permite enviar localizacao.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStoreDataForm((current) => ({
          ...current,
          locationReceived: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
        }));
        setDataMessage('Localizacao atualizada. Clique em Salvar dados para gravar.');
      },
      (geoError) => setDataMessage(storeGeoErrorMessage(geoError)),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function saveStoreData(event) {
    event.preventDefault();
    setDataMessage('');

    if (!isValidEmail(storeDataForm.email)) {
      setDataMessage('Informe um e-mail valido.');
      return;
    }
    if (!isValidPhone(storeDataForm.whatsapp)) {
      setDataMessage('Informe um WhatsApp valido.');
      return;
    }
    if (!storeDataForm.address.trim() || !storeDataForm.number.trim() || !storeDataForm.district.trim()) {
      setDataMessage('Endereco, numero e bairro sao obrigatorios.');
      return;
    }
    if (storeDataForm.zipCode && !isValidCep(storeDataForm.zipCode)) {
      setDataMessage('Informe um CEP valido.');
      return;
    }
    if (!supabase || !store?.id) {
      setDataMessage('Dados prontos para salvar. Supabase nao disponivel nesta sessao.');
      return;
    }

    setSavingStoreData(true);
    const { error } = await supabase
      .from('stores')
      .update({
        email: storeDataForm.email.trim().toLowerCase(),
        whatsapp: onlyDigits(storeDataForm.whatsapp),
        landline: onlyDigits(storeDataForm.landline),
        address: storeDataForm.address.trim(),
        address_number: storeDataForm.number.trim(),
        district: storeDataForm.district.trim(),
        zip_code: onlyDigits(storeDataForm.zipCode),
        location_received: storeDataForm.locationReceived.trim(),
      })
      .eq('id', store.id);
    setSavingStoreData(false);

    setDataMessage(error ? `Nao foi possivel salvar: ${error.message}` : 'Dados atualizados.');
  }

  function openDeliveryRequest(mode = 'modal') {
    const requestMode = mode === 'page' ? 'page' : 'modal';
    setRequestMessage('');
    setRequestForm({
      orderCode: `PED-${Date.now().toString().slice(-6)}`,
      customerName: '',
      customerPhone: '',
      deliveryAddress: '',
      deliveryDistrict: '',
      deliveryComplement: '',
      estimatedMinutes: '',
      estimatedTime: '',
      customerLocationUrl: '',
      deliveryFee: '',
    });
    setRequestModalOpen(requestMode === 'modal');
    if (requestMode === 'page') setActivePanel('request');
  }

  function openPhotoRequest() {
    setRequestModalOpen(false);
    setPhotoMessage('');
    setPhotoAnalysis(null);
    setPhotoAnalysisError('');
    setPhotoAnalysisDebug(null);
    setPhotoRequest((current) => ({ ...current, file: null, previewUrl: '', customerLocationUrl: '' }));
    setActivePanel('photo-request');
  }

  function openPhotoCamera() {
    setRequestModalOpen(false);
    setPhotoMessage('');
    setPhotoAnalysis(null);
    setPhotoAnalysisError('');
    setPhotoAnalysisDebug(null);
    setPhotoRequest((current) => ({ ...current, file: null, previewUrl: '', customerLocationUrl: '' }));
    photoCaptureInputRef.current?.click();
  }

  function closeDeliveryRequest() {
    setRequestModalOpen(false);
    if (activePanel === 'request') setActivePanel('home');
  }

  function closePhotoRequest() {
    setPhotoMessage('');
    setActivePanel('home');
  }

  function updatePhotoRequestFile(event) {
    const file = event.target.files?.[0] || null;
    setPhotoMessage('');
    setPhotoAnalysis(null);
    setPhotoAnalysisError('');
    setPhotoAnalysisDebug(null);
    if (!file) {
      setPhotoRequest((current) => ({ ...current, file: null, previewUrl: '' }));
      return;
    }

    setPhotoRequestFile(file);
    setActivePanel('photo-request');
    analyzePhotoRequest(file);
    event.target.value = '';
  }

  function retakePhotoRequest() {
    setPhotoMessage('');
    setPhotoAnalysis(null);
    setPhotoAnalysisError('');
    setPhotoAnalysisDebug(null);
    photoPageInputRef.current?.click();
  }

  function setPhotoRequestFile(file) {
    setPhotoRequest((current) => ({
      ...current,
      file,
      previewUrl: window.URL.createObjectURL(file),
    }));
  }

  async function analyzePhotoRequest(fileOverride = photoRequest.file, linkOverride = photoRequest.customerLocationUrl) {
    setPhotoMessage('');
    setPhotoAnalysis(null);
    setPhotoAnalysisError('');
    setPhotoAnalysisDebug(null);
    setPhotoAnalyzing(true);
    const result = await analisarComprovantePedidoComGemini({
      arquivo: fileOverride,
      linkLocalizacao: linkOverride,
    });
    setPhotoAnalyzing(false);

    if (result.ok) {
      const dataValidation = validar_dadoscomprovante_gemini(result.valores);
      if (dataValidation.todosNaoEncontrados) {
        setPhotoAnalysis(null);
        setPhotoAnalysisError(dataValidation.mensagemTodosNaoEncontrados);
        setPhotoMessage(dataValidation.mensagemTodosNaoEncontrados);
        return;
      }

      const timeValidation = validarHorarioPrevistoPedidoLoja(result.valores?.entregaPrevista);
      if (!timeValidation.valido) {
        setPhotoAnalysis(null);
        setPhotoAnalysisError(timeValidation.motivo);
        setPhotoMessage(timeValidation.motivo);
        return;
      }
    }

    const userMessage = result.ok ? 'Analise concluida. Nenhum dado foi gravado.' : formatPhotoAnalysisErrorMessage(result.motivo, result.codigo, result.status);
    setPhotoAnalysis(result.ok ? result : null);
    setPhotoAnalysisError(result.ok ? '' : userMessage);
    setPhotoAnalysisDebug(result.ok ? null : montarDetalhesFalhaAnaliseFoto(result));
    setPhotoMessage(userMessage);
  }

  function openManualRequestAfterPhotoError() {
    setPhotoMessage('');
    setPhotoAnalysisError('');
    setPhotoAnalysisDebug(null);
    openDeliveryRequest('page');
  }

  function loadPhotoAnalysisIntoManualForm() {
    if (!photoAnalysis?.ok) return;
    const values = transformarAnaliseEmPedidoLoja(photoAnalysis);
    const calculatedMinutes = calcularMinutosAteHorarioPrevistoPedidoLoja(values.estimatedTime);
    setRequestForm((current) => ({
      ...current,
      ...values,
      orderCode: values.orderCode || current.orderCode || `PED-${Date.now().toString().slice(-6)}`,
      estimatedMinutes: calculatedMinutes === null ? '' : String(calculatedMinutes),
      customerLocationUrl: photoRequest.customerLocationUrl,
    }));
    setRequestMessage('Dados carregados para conferencia. Nada foi salvo ainda.');
    setActivePanel('request');
  }

  function validateEstimatedTimeField() {
    const validation = validarHorarioPrevistoPedidoLoja(requestForm.estimatedTime);
    if (!validation.valido) {
      setRequestMessage(validation.motivo);
      return false;
    }
    return true;
  }

  function validateDeliveryFeeField() {
    const validation = validarTaxaEntregaPedidoLoja(requestForm.deliveryFee);
    if (!validation.valido) {
      setRequestMessage(validation.motivo);
      return false;
    }
    setRequestMessage('');
    return true;
  }

  async function createDeliveryRequest(event) {
    event.preventDefault();
    setRequestMessage('');

    if (!store?.id || !city?.id) {
      setRequestMessage('Loja ou cidade nao encontrada para criar a entrega.');
      return;
    }
    if (!requestForm.orderCode.trim() || !requestForm.customerName.trim() || !requestForm.deliveryAddress.trim()) {
      setRequestMessage('Pedido, cliente e endereco de entrega sao obrigatorios.');
      return;
    }
    const validation = validarPedidoLoja(requestForm);
    if (!validation.valido) {
      setRequestMessage(validation.motivo);
      return;
    }
    const calculatedMinutes = calcularMinutosAteHorarioPrevistoPedidoLoja(requestForm.estimatedTime);
    const requestPayload = {
      ...requestForm,
      estimatedMinutes: calculatedMinutes === null ? requestForm.estimatedMinutes : String(calculatedMinutes),
    };
    if (!supabase) {
      setRequestMessage('Supabase nao disponivel nesta sessao.');
      return;
    }

    setRequestSaving(true);
    try {
      const { queuedCount } = await createDeliveryWithQueue({ supabase, city, store, requestForm: requestPayload });
      setRequestMessage(
        queuedCount > 0
          ? `Entrega criada e enviada para ${queuedCount} motoboy(s) na fila.`
          : 'Entrega criada, mas nao ha motoboy aprovado e disponivel na cidade.'
      );
      setRequestModalOpen(false);
      setActivePanel('deliveries');
      setDeliveryDate(todayIso);
    } catch (error) {
      setRequestMessage(error.message);
    } finally {
      setRequestSaving(false);
    }
  }

  async function continuePendingOfferSearch() {
    if (!pendingOfferPrompt?.id) return;
    pendingOfferPromptNextAtRef.current.set(
      pendingOfferPrompt.id,
      Date.now() + STORE_PENDING_FOLLOWUP_SECONDS * 1000,
    );
    setStatusMessage(`Continuando a busca de motoboy para o pedido ${pendingOfferPrompt.orderCode}.`);
    setPendingOfferPrompt(null);
    try {
      await advanceDeliveryOfferQueue({ supabase, deliveryId: pendingOfferPrompt.id });
    } catch (error) {
      setStatusMessage(`Nao foi possivel continuar a busca: ${error.message}`);
    }
  }

  async function cancelPendingOfferSearch() {
    if (!pendingOfferPrompt?.id) return;
    const deliveryToCancel = pendingOfferPrompt;
    setPendingOfferPrompt(null);
    try {
      await cancelPendingDeliveryOfferSearch({ supabase, deliveryId: deliveryToCancel.id });
      setStatusMessage(`Solicitacao ${deliveryToCancel.orderCode} cancelada.`);
    } catch (error) {
      setStatusMessage(`Nao foi possivel cancelar a solicitacao: ${error.message}`);
    }
  }

  function renderDeliveryRequestForm({ page = false } = {}) {
    return (
      <form className={`delivery-request-form${page ? ' delivery-request-page-form' : ''}`} onSubmit={createDeliveryRequest}>
        {!page && (
          <button className="delivery-request-back" type="button" aria-label="Voltar" onClick={closeDeliveryRequest}>
            <ArrowLeft size={26} />
          </button>
        )}
        <div className="delivery-request-hero">
          <span className="delivery-request-brand"><Store size={28} /> BEELBEM MOTOBOY</span>
          <h2 id="delivery-request-title">Nova entrega</h2>
          <p>Preencha os dados do pedido para enviar aos motoboys disponiveis.</p>
        </div>

        <section className="delivery-request-section">
          <h3><Store size={22} /> Dados do pedido</h3>
          <div className="delivery-request-grid">
            <label className="request-field wide">
              <span>Numero do pedido</span>
              <span className="request-input"><Store size={20} /><input value={requestForm.orderCode} onChange={(event) => setRequestForm((current) => ({ ...current, orderCode: event.target.value }))} /></span>
            </label>
            <label className="request-field">
              <span>Nome do cliente</span>
              <span className="request-input"><UserRound size={20} /><input value={requestForm.customerName} onChange={(event) => setRequestForm((current) => ({ ...current, customerName: event.target.value }))} /></span>
            </label>
            <label className="request-field">
              <span>Telefone do cliente</span>
              <span className="request-input"><Phone size={20} /><input value={requestForm.customerPhone} onChange={(event) => setRequestForm((current) => ({ ...current, customerPhone: maskPhone(event.target.value) }))} /></span>
            </label>
            <label className="request-field">
              <span>Horario previsto</span>
              <span className="request-input"><Clock3 size={20} /><input inputMode="numeric" maxLength={5} placeholder="00:00" value={requestForm.estimatedTime} onBlur={validateEstimatedTimeField} onChange={(event) => setRequestForm((current) => {
                const nextTime = maskDeliveryTime(event.target.value);
                const calculatedMinutes = calcularMinutosAteHorarioPrevistoPedidoLoja(nextTime);
                return { ...current, estimatedTime: nextTime, estimatedMinutes: calculatedMinutes === null ? '' : String(calculatedMinutes) };
              })} /></span>
            </label>
            <label className="request-field">
              <span>Taxa da entrega</span>
              <span className="request-input"><WalletCards size={20} /><input inputMode="numeric" value={requestForm.deliveryFee} onBlur={validateDeliveryFeeField} onChange={(event) => setRequestForm((current) => ({ ...current, deliveryFee: maskDeliveryFee(event.target.value) }))} placeholder="R$ 18,50" /></span>
            </label>
          </div>
        </section>

        <section className="delivery-request-section">
          <h3><MapPin size={22} /> Endereco de entrega</h3>
          <div className="delivery-request-grid">
            <label className="request-field wide">
              <span>Endereco completo</span>
              <span className="request-input"><MapPin size={20} /><input value={requestForm.deliveryAddress} onChange={(event) => setRequestForm((current) => ({ ...current, deliveryAddress: event.target.value }))} placeholder="Rua, numero, complemento" /></span>
            </label>
            <label className="request-field">
              <span>Bairro</span>
              <span className="request-input"><Navigation size={20} /><input value={requestForm.deliveryDistrict} onChange={(event) => setRequestForm((current) => ({ ...current, deliveryDistrict: event.target.value }))} /></span>
            </label>
            <label className="request-field">
              <span>Complemento</span>
              <span className="request-input"><PencilLine size={20} /><input value={requestForm.deliveryComplement} onChange={(event) => setRequestForm((current) => ({ ...current, deliveryComplement: event.target.value }))} /></span>
            </label>
            <label className="request-field">
              <span>Tempo limite ate o cliente (min)</span>
              <span className="request-input"><Clock3 size={20} /><input inputMode="numeric" value={requestForm.estimatedMinutes} disabled readOnly placeholder="Calculado pelo horario" /></span>
            </label>
            <label className="request-field wide">
              <span>Link da localizacao do cliente</span>
              <span className="request-input"><MapPin size={20} /><input value={requestForm.customerLocationUrl} onChange={(event) => setRequestForm((current) => ({ ...current, customerLocationUrl: event.target.value }))} placeholder="Cole aqui o link do Google Maps ou Apple Maps" /></span>
            </label>
          </div>
        </section>
        {requestMessage && <p className="field-error">{requestMessage}</p>}
        <div className="delivery-request-actions">
          <button className="primary-action" type="submit" disabled={requestSaving}>{requestSaving ? 'Criando...' : 'Criar entrega'}</button>
          <button className="secondary-action" type="button" onClick={closeDeliveryRequest}>Cancelar</button>
        </div>
      </form>
    );
  }

  if (activePanel === 'data') {
    return (
      <LayoutLojista dataPage>
        <header className="store-app-header">
          <button className="store-menu-button store-logo-menu" type="button" aria-label="Voltar" onClick={() => setActivePanel('home')}>
            <ArrowRight size={24} className="back-icon" />
          </button>
          <h1>Meus dados</h1>
          <button className={`store-connected-pill ${storeOpen ? 'open' : 'closed'}`} type="button" onClick={toggleStoreStatus}>
            <span />{storeOpen ? 'Aberto' : 'Fechado'}
          </button>
        </header>

        <form className="store-data-card" onSubmit={saveStoreData}>
          <div className="store-data-identity">
            <div className="store-data-logo">
              {storeLogo ? <img src={storeLogo} alt="" /> : <Store size={34} />}
            </div>
            <div>
              <span>Loja cadastrada</span>
              <h2>{storeName}</h2>
              <p>{store?.type || 'Tipo nao informado'} · {store?.document ? maskCnpj(store.document) : 'CNPJ nao informado'}</p>
            </div>
          </div>

          <div className="store-data-grid">
            <article><span>Responsavel</span><strong>{store?.responsible || profile?.name || 'Nao informado'}</strong></article>
            <article><span>Cidade</span><strong>{city.name} - {city.state}</strong></article>
            <article><span>Status no sistema</span><strong>{storeOpen ? 'Aberta' : 'Fechada'}</strong></article>
          </div>
          <div className="store-data-form-grid">
            <label>E-mail da loja<input type="email" value={storeDataForm.email} onChange={(event) => setStoreDataForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>WhatsApp<input value={storeDataForm.whatsapp} onChange={(event) => setStoreDataForm((current) => ({ ...current, whatsapp: maskPhone(event.target.value) }))} /></label>
            <label>Telefone fixo<input value={storeDataForm.landline} onChange={(event) => setStoreDataForm((current) => ({ ...current, landline: maskPhone(event.target.value) }))} /></label>
            <label>CEP<input value={storeDataForm.zipCode} onChange={(event) => setStoreDataForm((current) => ({ ...current, zipCode: maskCep(event.target.value) }))} /></label>
            <label className="wide">Endereco<input value={storeDataForm.address} onChange={(event) => setStoreDataForm((current) => ({ ...current, address: event.target.value }))} /></label>
            <label>Numero<input value={storeDataForm.number} onChange={(event) => setStoreDataForm((current) => ({ ...current, number: event.target.value }))} /></label>
            <label>Bairro<input value={storeDataForm.district} onChange={(event) => setStoreDataForm((current) => ({ ...current, district: event.target.value }))} /></label>
            <label className="wide">
              Localizacao da loja
              <div className="lookup-field">
                <input value={storeDataForm.locationReceived} onChange={(event) => setStoreDataForm((current) => ({ ...current, locationReceived: event.target.value }))} placeholder="Cole o link do Google Maps ou envie novamente" />
                <button type="button" onClick={sendStoreLocation}>Enviar localizacao</button>
              </div>
            </label>
          </div>

          <div className="store-data-actions">
            <button className="primary-action" type="submit" disabled={savingStoreData}>{savingStoreData ? 'Salvando...' : 'Salvar dados'}</button>
            <button
              className="secondary-action"
              type="button"
              onClick={() => setPasswordInfo('Solicitacao de alteracao de senha registrada. O envio por e-mail sera implementado depois.')}
            >
              Alterar senha
            </button>
            <button className="secondary-action" type="button" onClick={() => setActivePanel('home')}>Voltar</button>
          </div>
          {passwordInfo && <p className="success-message">{passwordInfo}</p>}
          {dataMessage && <p className={dataMessage.includes('atualizad') || dataMessage.includes('prontos') ? 'success-message' : 'field-error'}>{dataMessage}</p>}
        </form>
      </LayoutLojista>
    );
  }

  if (activePanel === 'deliveries') {
    return (
      <LayoutLojista dataPage>
        <header className="store-app-header">
          <button className="store-menu-button store-logo-menu" type="button" aria-label="Voltar" onClick={() => setActivePanel('home')}>
            <ArrowRight size={24} className="back-icon" />
          </button>
          <h1>Minhas entregas</h1>
          <button className={`store-connected-pill ${storeOpen ? 'open' : 'closed'}`} type="button" onClick={toggleStoreStatus}>
            <span />{storeOpen ? 'Aberto' : 'Fechado'}
          </button>
        </header>

        <section className="store-data-card store-deliveries-card">
          <div className="courier-center-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input value={deliverySearch} onChange={(event) => setDeliverySearch(event.target.value)} placeholder="Buscar por entregador, cliente ou pedido" />
            </label>
            <label className="filter-field">
              Data
              <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value || todayIso)} />
            </label>
            <label className="filter-field">
              Status
              <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="Entregue">Entregue</option>
                <option value="A caminho">A caminho</option>
                <option value="Ocorrencia">Ocorrencia</option>
              </select>
            </label>
          </div>

          <div className="store-deliveries-table" role="table" aria-label="Minhas entregas">
            <div className="store-deliveries-head" role="row">
              <span>Entregador</span>
              <span>Cliente</span>
              <span>Pedido</span>
              <span>Taxa</span>
              <span>Data</span>
              <span>Status</span>
              <span>Acoes</span>
            </div>
            {deliveriesLoading && <p className="form-note">Buscando entregas do dia...</p>}
            {deliveriesMessage && <p className="field-error">{deliveriesMessage}</p>}
            {visibleStoreDeliveries.map((delivery) => (
              <article className="store-deliveries-row" role="row" key={delivery.order}>
                <strong>{delivery.courier}</strong>
                <span>{delivery.customer}</span>
                <span>{delivery.order}</span>
                <span>{formatCurrency(delivery.fee)}</span>
                <span>{delivery.date}</span>
                <mark className={`delivery-status ${delivery.status === 'Entregue' ? 'done' : delivery.status === 'Ocorrencia' ? 'issue' : 'route'}`}>{delivery.status}</mark>
                <span className="store-delivery-links">
                  <a href={delivery.courierPhone ? `https://wa.me/55${onlyDigits(delivery.courierPhone)}` : '#'} target="_blank" rel="noreferrer">Mensagem</a>
                  <button type="button" onClick={() => setDeliveriesMessage('Detalhes da entrega serao exibidos aqui na area do lojista.')}>Detalhes</button>
                </span>
              </article>
            ))}
            {visibleStoreDeliveries.length === 0 && <p className="empty-state">Nenhuma entrega encontrada.</p>}
          </div>
        </section>
      </LayoutLojista>
    );
  }

  if (activePanel === 'photo-request') {
    const values = photoAnalysis?.valores || {};
    const photoDataValidation = photoAnalysis?.ok ? validar_dadoscomprovante_gemini(values) : null;
    const analysisFields = [
      { icon: <Store size={24} />, label: 'Loja', value: values.loja },
      { icon: <PencilLine size={24} />, label: 'Pedido', value: values.numeroPedido },
      { icon: <Clock3 size={24} />, label: 'Entrega prevista', value: values.entregaPrevista },
      { icon: <UserRound size={24} />, label: 'Cliente', value: values.cliente },
      { icon: <MapPin size={24} />, label: 'Endereco', value: values.endereco },
      { icon: <Navigation size={24} />, label: 'Bairro', value: values.bairro },
      { icon: <PencilLine size={24} />, label: 'Complemento', value: values.complemento },
      { icon: <WalletCards size={24} />, label: 'Valor do pedido', value: values.valorPedido },
    ];

    return (
      <LayoutLojista dataPage>
        <header className="store-app-header">
          <button className="store-menu-button store-logo-menu" type="button" aria-label="Voltar" onClick={closePhotoRequest}>
            <ArrowRight size={24} className="back-icon" />
          </button>
          <h1>Pedido por foto</h1>
          <button className={`store-connected-pill ${storeOpen ? 'open' : 'closed'}`} type="button" onClick={toggleStoreStatus}>
            <span />{storeOpen ? 'Aberto' : 'Fechado'}
          </button>
        </header>

        <section className="photo-request-page" aria-label="Pedido por foto">
          <div className="photo-request-hero">
            <span className="delivery-request-brand"><Camera size={28} /> BEELBEM MOTOBOY</span>
          </div>

          <div className="photo-request-shell">
            <section className="photo-request-upload" aria-label="Foto do comprovante">
              <label className="photo-dropzone">
                <input ref={photoPageInputRef} type="file" accept="image/*" capture="environment" onChange={updatePhotoRequestFile} />
                {photoRequest.previewUrl ? (
                  <img src={photoRequest.previewUrl} alt="" />
                ) : (
                  <span>
                    <Camera size={44} />
                    Abrir camera
                  </span>
                )}
              </label>

              <label className="request-field wide">
                <span>Link da localizacao do cliente</span>
                <span className="request-input">
                  <MapPin size={20} />
                  <input
                    value={photoRequest.customerLocationUrl}
                    onChange={(event) => setPhotoRequest((current) => ({ ...current, customerLocationUrl: event.target.value }))}
                    placeholder="Cole aqui o link do Google Maps ou Apple Maps"
                  />
                </span>
              </label>

              {photoRequest.file && <p className="photo-file-name">{photoRequest.file.name}</p>}
              {photoMessage && !photoAnalysisError && <p className={photoAnalysis ? 'success-message' : 'field-error'}>{photoMessage}</p>}

              <div className="photo-request-actions">
                <button className="primary-action" type="button" onClick={() => analyzePhotoRequest()} disabled={photoAnalyzing}>
                  {photoAnalyzing ? 'Analisando...' : 'Analisar foto'}
                </button>
                <button className="secondary-action" type="button" onClick={closePhotoRequest}>Voltar</button>
              </div>
            </section>

            <section className="photo-analysis-result" aria-label="Resultado da analise">
              {photoAnalysis ? (
                <>
                  <div className="photo-analysis-title">
                    <span>Dados encontrados</span>
                    <strong>{values.origem || 'Pedido por foto'}</strong>
                  </div>
                  {photoDataValidation?.camposNaoAnalisados.length > 0 && (
                    <div className="photo-analysis-missing">
                      <AlertTriangle size={24} />
                      <p>{photoDataValidation.mensagem}</p>
                    </div>
                  )}
                  <div className="photo-analysis-list">
                    {analysisFields.map((field) => (
                      <article key={field.label}>
                        {field.icon}
                        <span>{field.label}</span>
                        <strong>{field.value || 'Nao encontrado'}</strong>
                      </article>
                    ))}
                  </div>
                  {values.itemPrincipal && <p className="photo-item-summary">{values.itemPrincipal}</p>}
                  {photoAnalysis.avisos?.length > 0 && (
                    <ul className="photo-analysis-warnings">
                      {photoAnalysis.avisos.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  )}
                  <button className="primary-action" type="button" onClick={loadPhotoAnalysisIntoManualForm}>
                    Usar dados no formulario
                  </button>
                </>
              ) : (
                <div className="photo-analysis-empty">
                  <Camera size={48} />
                  <strong>{photoAnalyzing ? 'Analisando foto' : 'Aguardando analise'}</strong>
                  <span>{photoAnalyzing ? 'Extraindo os dados do comprovante.' : 'Os valores extraidos aparecerao aqui.'}</span>
                </div>
              )}
            </section>
          </div>
        </section>
        {photoAnalysisError && !photoAnalyzing && (
          <div className="photo-error-popup" role="dialog" aria-modal="true" aria-labelledby="photo-error-title">
            <section>
              <AlertTriangle size={46} />
              <h2 id="photo-error-title">Nao foi possivel analisar o comprovante</h2>
              <p>{photoAnalysisError}</p>
              {photoAnalysisDebug && (
                <details className="photo-error-details">
                  <summary>Detalhes tecnicos</summary>
                  <pre>{photoAnalysisDebug}</pre>
                </details>
              )}
              <div>
                <button className="primary-action" type="button" onClick={retakePhotoRequest}>
                  Nova foto
                </button>
                <button className="secondary-action" type="button" onClick={openManualRequestAfterPhotoError}>
                  Solicitar manual
                </button>
              </div>
            </section>
          </div>
        )}
      </LayoutLojista>
    );
  }

  if (activePanel === 'request') {
    return (
      <LayoutLojista dataPage>
        <header className="store-app-header">
          <button className="store-menu-button store-logo-menu" type="button" aria-label="Voltar" onClick={closeDeliveryRequest}>
            <ArrowRight size={24} className="back-icon" />
          </button>
          <h1>Realizar pedido</h1>
          <button className={`store-connected-pill ${storeOpen ? 'open' : 'closed'}`} type="button" onClick={toggleStoreStatus}>
            <span />{storeOpen ? 'Aberto' : 'Fechado'}
          </button>
        </header>

        <section className="delivery-request-page" aria-labelledby="delivery-request-title">
          {renderDeliveryRequestForm({ page: true })}
        </section>
      </LayoutLojista>
    );
  }

  return (
    <LayoutLojista>
      <header className="store-app-header">
        <button className="store-menu-button store-logo-menu" type="button" aria-label="Abrir menu" onClick={() => setMenuOpen((current) => !current)}>
          {storeLogo ? (
            <img src={storeLogo} alt="" />
          ) : (
            <>
              <span>{brandTop}</span>
              <strong>{brandBottom}</strong>
            </>
          )}
        </button>
        {menuOpen && (
          <nav className="store-mobile-menu" aria-label="Menu lojista">
            <button type="button" onClick={() => { setActivePanel('data'); setMenuOpen(false); }}>Meus dados</button>
            <button type="button" onClick={() => { setActivePanel('deliveries'); setMenuOpen(false); }}>Minhas entregas</button>
            <button type="button">Relatorios</button>
            <button type="button" onClick={onLogout}>Sair</button>
          </nav>
        )}
        <button className={`store-connected-pill ${storeOpen ? 'open' : 'closed'}`} type="button" onClick={toggleStoreStatus}>
          <span />{storeOpen ? 'Aberto' : 'Fechado'}
        </button>
      </header>
      {showOpenPrompt && (
        <div className="store-open-prompt" role="dialog" aria-modal="true" aria-labelledby="store-open-title">
          <section>
            <h2 id="store-open-title">Sua loja esta fechada</h2>
            <p>Deseja abrir a loja no sistema para comecar a receber entregas?</p>
            <div>
              <button className="primary-action" type="button" onClick={toggleStoreStatus}>Abrir loja</button>
              <button className="secondary-action" type="button" onClick={() => setShowOpenPrompt(false)}>Agora nao</button>
            </div>
          </section>
        </div>
      )}
      {pendingOfferPrompt && (
        <div className="store-open-prompt" role="dialog" aria-modal="true" aria-labelledby="pending-offer-title">
          <section>
            <h2 id="pending-offer-title">Ainda sem aceite</h2>
            <p>Ja se passaram 5 minutos e nenhum motoboy aceitou o pedido {pendingOfferPrompt.orderCode}. Deseja continuar tentando?</p>
            <div>
              <button className="primary-action" type="button" onClick={continuePendingOfferSearch}>Continuar</button>
              <button className="secondary-action" type="button" onClick={cancelPendingOfferSearch}>Cancelar solicitacao</button>
            </div>
          </section>
        </div>
      )}
      {statusMessage && <p className={`store-status-message ${statusMessage.startsWith('Nao') ? 'error' : 'success'}`}>{statusMessage}</p>}

      <section className="store-status-grid" aria-label="Resumo das entregas">
        {liveDeliveryStats.map((item) => {
          const detailConfig = STATUS_DETAIL_CONFIG[item.key];
          return (
            <button
              className={`store-status-card ${item.tone}${detailConfig ? ' clickable' : ''}`}
              type="button"
              key={item.label}
              onClick={detailConfig ? () => setStatusDetailsType(item.key) : undefined}
              disabled={!detailConfig}
              aria-label={detailConfig ? detailConfig.openLabel : item.label}
            >
              <div className="store-status-card-top">
                <div className="store-status-icon">{item.icon}</div>
                <p>{item.label}</p>
              </div>
              <strong>{item.value}</strong>
            </button>
          );
        })}
      </section>

      {statusDetailsConfig && (
        <div className="status-detail-modal" role="dialog" aria-modal="true" aria-labelledby="status-detail-title">
          <section>
            <header>
              <div>
                <span>Entregas</span>
                <h2 id="status-detail-title">{statusDetailsConfig.title}</h2>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setStatusDetailsType(null)}>Fechar</button>
            </header>

            <div className="status-detail-filters" aria-label="Filtros por periodo">
              <label>
                Periodo inicial
                <input
                  type="date"
                  value={statusDetailsFilters.startDate}
                  onChange={(event) => {
                    const nextStartDate = event.target.value || todayIso;
                    setStatusDetailsFilters((current) => ({
                      ...current,
                      startDate: nextStartDate,
                      endDate: current.endDate < nextStartDate ? nextStartDate : current.endDate,
                    }));
                  }}
                />
              </label>
              <label>
                Periodo final
                <input
                  type="date"
                  value={statusDetailsFilters.endDate}
                  min={statusDetailsFilters.startDate}
                  onChange={(event) => setStatusDetailsFilters((current) => ({
                    ...current,
                    endDate: event.target.value || current.startDate,
                  }))}
                />
              </label>
            </div>

            <div className="status-detail-table" role="table" aria-label={`Tabela de entregas ${statusDetailsConfig.title.toLowerCase()}`}>
              <div className="status-detail-head" role="row">
                <span>Nome Motoboy</span>
                <span>Numero pedido</span>
                <span>{statusDetailsConfig.dateColumnLabel}</span>
                <span>Nome cliente</span>
                <span>Bairro</span>
              </div>
              {statusDetailsLoading && <p className="form-note">Carregando entregas...</p>}
              {statusDetailsMessage && <p className="field-error">{statusDetailsMessage}</p>}
              {!statusDetailsLoading && !statusDetailsMessage && statusDetailsRows.map((row) => (
                <article className="status-detail-row" role="row" key={`${row.id}-${row.confirmedAt}`}>
                  <strong>{row.courierName}</strong>
                  <span>{row.orderCode}</span>
                  <span>{formatShortDateTime(row.confirmedAt)}</span>
                  <span>{row.customerName}</span>
                  <span>{row.district}</span>
                </article>
              ))}
              {!statusDetailsLoading && !statusDetailsMessage && statusDetailsRows.length === 0 && (
                <p className="empty-state">{statusDetailsConfig.emptyMessage}</p>
              )}
            </div>
          </section>
        </div>
      )}

      {liveDeliveriesMessage && <p className="store-status-message error">{liveDeliveriesMessage}</p>}

      {showAcceptedDeliveryPopup && (
        <section className="store-accepted-delivery" aria-label="Motoboy aceitou a corrida">
          <div className="accepted-delivery-panel">
            <div className="accepted-delivery-main">
              <div className="accepted-courier-photo">
                {acceptedDelivery.courierPhotoUrl ? (
                  <img src={acceptedDelivery.courierPhotoUrl} alt="" />
                ) : (
                  <UserRound size={54} />
                )}
              </div>
              <div>
                <span className="accepted-kicker">Motoboy aceitou a corrida</span>
                <h2>{acceptedDelivery.courierName}</h2>
                <div className="accepted-stars" aria-label={`${acceptedDelivery.courierStars} estrelas`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} size={22} fill={index < acceptedDelivery.courierStars ? 'currentColor' : 'none'} />
                  ))}
                </div>
              </div>
            </div>
            <div className="accepted-delivery-details">
              <article>
                <PencilLine size={28} />
                <span>Pedido</span>
                <strong>{acceptedDelivery.order}</strong>
              </article>
              <article>
                <UserRound size={28} />
                <span>Cliente</span>
                <strong>{acceptedDelivery.customer}</strong>
              </article>
              <article>
                <Star size={28} />
                <span>XP</span>
                <strong>{formatXpValue(acceptedDelivery.courierXp)}</strong>
              </article>
              <article>
                <Bike size={28} />
                <span>Nivel</span>
                <strong>{acceptedDelivery.courierLevel}</strong>
              </article>
              <article>
                <Navigation size={28} />
                <span>Status</span>
                <strong>{storeDeliveryProgressLabel(acceptedDelivery.status)}</strong>
              </article>
              <article>
                <WalletCards size={28} />
                <span>Taxa</span>
                <strong className="money">{formatCurrency(acceptedDelivery.fee)}</strong>
              </article>
            </div>
            <div className="accepted-actions">
              {acceptedDelivery.courierPhone && (
                <a className="accepted-message-link" href={`https://wa.me/55${onlyDigits(acceptedDelivery.courierPhone)}?text=${encodeURIComponent(`Ola, preciso falar sobre o pedido ${acceptedDelivery.order}.`)}`} target="_blank" rel="noreferrer">
                  Mensagem
                </a>
              )}
              <button type="button" className="accepted-close-button" onClick={() => setDismissedAcceptedDeliveryId(acceptedDelivery.id)}>
                Entendi
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="store-live-map" aria-label={`Mapa de entregas em ${city.name}`}>
        <div className="store-map-grid" />
        <span className="store-map-label meireles">MEIRELLES</span>
        <span className="store-map-label aldeota">ALDEOTA</span>
        <span className="store-map-label papicu">PAPICU</span>
        <span className="store-map-label dionisio">DIONISIO<br />TORRES</span>
        <span className="store-map-label coco">COCO</span>
        <span className="store-map-street street-a">R. Silva Jatahy</span>
        <span className="store-map-street street-b">Av. Santos Dumont</span>
        <span className="store-map-street street-c">Av. Sen. Virgilio Tavora</span>
        <div className="store-route route-to-store" />
        <span className="store-courier-pin single" style={{ left: '30%', top: '35%' }}>
          <Bike size={23} />
        </span>
        <span className="store-main-pin">
          {storeLogo ? <img src={storeLogo} alt="" /> : <Store size={32} />}
          <i />
        </span>
        <div className="store-map-actions">
          <button type="button" aria-label="Pesquisar"><Search size={40} /></button>
          <button type="button" aria-label="Centralizar"><Navigation size={30} /></button>
          <button type="button" aria-label="Aproximar"><Plus size={34} /></button>
          <button type="button" aria-label="Afastar"><Minus size={34} /></button>
        </div>
      </section>

      <section className="store-request-actions" aria-label="Solicitar entrega">
        <input
          ref={photoCaptureInputRef}
          className="camera-capture-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={updatePhotoRequestFile}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button className="store-request-card photo" type="button" onClick={openPhotoCamera}>
          <span className="request-icon"><Camera size={52} /></span>
          <span>
            <strong>Solicitar por foto</strong>
            <small>Agilize o cadastro do pedido com a foto da comanda.</small>
          </span>
          <ArrowRight size={42} />
        </button>
        <button className="store-request-card manual" type="button" onClick={() => openDeliveryRequest('page')}>
          <span className="request-icon"><PencilLine size={52} /></span>
          <span>
            <strong>Solicitar manualmente</strong>
            <small>Preencha os dados do pedido manualmente.</small>
          </span>
          <ArrowRight size={42} />
        </button>
      </section>
      {requestMessage && <p className={requestMessage.includes('criada') ? 'success-message' : 'field-error'}>{requestMessage}</p>}
      {requestModalOpen && (
        <div className="store-open-prompt delivery-request-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-request-title">
          {renderDeliveryRequestForm()}
        </div>
      )}
    </LayoutLojista>
  );
}

function deliveryStatusLabel(status) {
  if (status === 'delivered') return 'Entregue';
  if (['pending', 'assigned', 'picked_up', 'on_route'].includes(status)) return 'A caminho';
  return 'Ocorrencia';
}

function storeDeliveryProgressLabel(status) {
  if (status === 'assigned') return 'Indo para a loja';
  if (status === 'picked_up') return 'Pedido retirado';
  if (status === 'on_route') return 'Indo para o cliente';
  return 'Em andamento';
}
