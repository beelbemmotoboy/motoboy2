import { formatCurrency, formatMinutes, formatNumber, formatPercent } from './overviewFormatters';

const fallbackActiveDeliveries = [
  { code: '#E12789', store: 'Pizzaria Bella Roma', courier: 'Carlos Henrique', district: 'Aldeota', status: 'Indo para o cliente', eta: '11 min', tone: 'yellow' },
  { code: '#E12790', store: 'Mercadinho Sao Luiz', courier: 'Juliana Alves', district: 'Meireles', status: 'A caminho da loja', eta: '6 min', tone: 'green' },
  { code: '#E12791', store: 'Farmacia Bem Estar', courier: 'Marcos Paulo', district: 'Dionisio Torres', status: 'Atraso', eta: '32 min', tone: 'red' },
  { code: '#E12792', store: 'Burger House', courier: 'Ana Beatriz', district: 'Papicu', status: 'Indo para o cliente', eta: '9 min', tone: 'yellow' },
  { code: '#E12793', store: 'Mercado Central', courier: 'Rafael Souza', district: 'Coco', status: 'A caminho da loja', eta: '8 min', tone: 'green' },
];

const fallbackOnlineCouriers = [
  { id: 'MB-07', name: 'Lucas Silva', rating: 4.9, todayDeliveries: 12, status: 'Online' },
  { id: 'MB-35', name: 'Joao Santos', rating: 4.8, todayDeliveries: 15, status: 'Online' },
  { id: 'MB-18', name: 'Pedro Lima', rating: 4.7, todayDeliveries: 10, status: 'Online' },
  { id: 'MB-09', name: 'Rafael Costa', rating: 4.9, todayDeliveries: 14, status: 'Online' },
  { id: 'MB-12', name: 'Bruno Oliveira', rating: 4.6, todayDeliveries: 9, status: 'Online' },
];

const fallbackRanking = [
  { position: 1, courier: 'Lucas Silva (MB-07)', deliveries: 15, rating: 4.9 },
  { position: 2, courier: 'Joao Santos (MB-35)', deliveries: 15, rating: 4.8 },
  { position: 3, courier: 'Rafael Costa (MB-09)', deliveries: 14, rating: 4.9 },
  { position: 4, courier: 'Pedro Lima (MB-18)', deliveries: 10, rating: 4.7 },
  { position: 5, courier: 'Bruno Oliveira (MB-12)', deliveries: 9, rating: 4.6 },
];

export const overviewAlerts = [
  { type: 'critical', title: 'Entrega #E12791 com atraso de 12 minutos', detail: 'Motoboy MB-21 - ETA 32 min', time: '09:15' },
  { type: 'warning', title: 'Motoboy MB-02 parado ha 8 minutos', detail: 'Ultima movimentacao 09:07', time: '09:15' },
  { type: 'warning', title: 'Loja Mercadinho Sao Luiz aguardando retirada', detail: 'Pedido #E12794 - 5 min aguardando', time: '09:10' },
];

export const overviewStatusDistribution = [
  { label: 'A caminho da loja', value: 128, color: '#20d45a' },
  { label: 'Indo para o cliente', value: 186, color: '#ffd200' },
  { label: 'Atraso / Atencao', value: 42, color: '#ff4949' },
  { label: 'Entregue recentemente', value: 196, color: '#2878ff' },
  { label: 'Disponivel / Aguardando', value: 62, color: '#a1a5ad' },
];

export const overviewHourlyDeliveries = [
  3, 5, 4, 8, 7, 10, 16, 30, 48, 72, 65, 42,
  22, 12, 28, 55, 74, 68, 58, 35, 18, 12, 76, 86,
];

export const overviewMapMarkers = [
  { id: 'MB-12', x: 26, y: 18, tone: 'yellow', label: 'MB-12' },
  { id: 'MB-18', x: 24, y: 51, tone: 'green', label: 'MB-18' },
  { id: 'MB-27', x: 18, y: 74, tone: 'yellow', label: 'MB-27' },
  { id: 'MB-02', x: 40, y: 61, tone: 'gray', label: 'MB-02' },
  { id: 'MB-35', x: 54, y: 56, tone: 'yellow', label: 'MB-35' },
  { id: 'MB-07', x: 64, y: 19, tone: 'green', label: 'MB-07' },
  { id: 'MB-21', x: 79, y: 35, tone: 'red', label: 'MB-21' },
  { id: 'MB-09', x: 72, y: 68, tone: 'blue', label: 'MB-09' },
  { id: 'MB-14', x: 93, y: 63, tone: 'blue', label: 'MB-14' },
  { id: 'MB-31', x: 84, y: 78, tone: 'gray', label: 'MB-31' },
];

export const overviewMapRoutes = [
  { points: '260,118 330,142 402,116', tone: 'yellow' },
  { points: '280,355 354,310 430,268', tone: 'green' },
  { points: '458,418 545,418 650,464', tone: 'blue' },
  { points: '655,118 736,130 825,120', tone: 'green' },
  { points: '772,252 814,306 896,292', tone: 'red' },
  { points: '165,498 270,552 386,520 492,536', tone: 'yellow' },
];

export const overviewLegend = [
  { label: 'A caminho da loja', tone: 'green' },
  { label: 'Indo para o cliente', tone: 'yellow' },
  { label: 'Atraso / Atencao', tone: 'red' },
  { label: 'Entregue recentemente', tone: 'blue' },
  { label: 'Disponivel / Aguardando', tone: 'gray' },
];

function countActiveStores(stores, fallback) {
  const total = stores.filter((store) => store.active !== false).length;
  return stores.length ? total : Number(fallback || 0);
}

function countOpenStores(stores, fallback) {
  const total = stores.filter((store) => store.active !== false && store.isOpen !== false).length;
  return stores.length ? total : Number(fallback || 0);
}

function countOnlineCouriers(couriers, fallback) {
  const total = couriers.filter((courier) => (
    courier.active !== false && ['available', 'Disponivel'].includes(courier.availability)
  )).length;
  return couriers.length ? total : Number(fallback || 0);
}

function makeOnlineCouriers(couriers, { fallback = false } = {}) {
  const online = couriers
    .filter((courier) => courier.active !== false && ['available', 'Disponivel'].includes(courier.availability))
    .slice(0, 5)
    .map((courier, index) => ({
      id: courier.displayCode || `MB-${String(index + 7).padStart(2, '0')}`,
      name: courier.fullName || courier.name || 'Motoboy',
      rating: Number(courier.rating || 4.8),
      todayDeliveries: Number(courier.todayDeliveries || 0),
      status: 'Online',
    }));
  return online.length ? online : (fallback ? fallbackOnlineCouriers : []);
}

function makeRanking(couriers) {
  const ranked = makeOnlineCouriers(couriers, { fallback: true })
    .map((courier, index) => ({
      position: index + 1,
      courier: `${courier.name} (${courier.id})`,
      deliveries: courier.todayDeliveries,
      rating: courier.rating,
    }))
    .sort((a, b) => b.deliveries - a.deliveries || b.rating - a.rating)
    .map((item, index) => ({ ...item, position: index + 1 }));
  return ranked.length ? ranked : fallbackRanking;
}

export function buildOverviewData({
  city = {},
  stores = [],
  couriers = [],
  activeDeliveryRows = [],
  alerts = overviewAlerts,
  hourlyDeliveries = overviewHourlyDeliveries,
  statusDistribution = overviewStatusDistribution,
  ranking,
  mapMarkers = overviewMapMarkers,
  mapRoutes = overviewMapRoutes,
} = {}) {
  const totalDeliveries = Number(city.metrics?.[0] || 0);
  const activeDeliveriesCount = Number(city.activeDeliveries || city.metrics?.[1] || 0);
  const completedToday = Number(city.metrics?.[2] || 0);
  const onlineCouriers = countOnlineCouriers(couriers, city.availableCouriers || 0);
  const openStores = countOpenStores(stores, city.activeStores || 0);
  const successRate = Number.parseFloat(String(city.metrics?.[3] || '0').replace('%', '').replace(',', '.')) || 0;
  const revenueToday = Number(city.revenueToday || 0);
  const averageDeliveryMinutes = Number(city.averageDeliveryMinutes || 0);

  return {
    metrics: [
      { id: 'total', label: 'Total de entregas', value: formatNumber(totalDeliveries), trend: 'Hoje', icon: 'briefcase', tone: 'yellow' },
      { id: 'active', label: 'Em andamento', value: formatNumber(activeDeliveriesCount), trend: 'Agora', icon: 'bike', tone: 'yellow' },
      { id: 'couriers', label: 'Motoboys disponiveis', value: formatNumber(onlineCouriers), trend: 'Online agora', icon: 'user', tone: 'green' },
      { id: 'stores', label: 'Lojistas conectados', value: formatNumber(openStores), trend: `de ${formatNumber(countActiveStores(stores, openStores))} ativos`, icon: 'store', tone: 'yellow' },
      { id: 'completed', label: 'Concluidas hoje', value: formatNumber(completedToday), trend: 'Hoje', icon: 'check', tone: 'blue' },
      { id: 'success', label: 'Taxa de sucesso', value: formatPercent(successRate), trend: 'Entregues hoje', icon: 'pulse', tone: 'purple' },
      { id: 'revenue', label: 'Faturamento do dia', value: formatCurrency(revenueToday), trend: 'Hoje', icon: 'wallet', tone: 'yellow' },
      { id: 'time', label: 'Tempo medio entrega', value: formatMinutes(averageDeliveryMinutes), trend: 'Media hoje', icon: 'clock', tone: 'orange' },
    ],
    activeDeliveries: activeDeliveryRows.length ? activeDeliveryRows : fallbackActiveDeliveries,
    onlineCouriers: makeOnlineCouriers(couriers),
    ranking: Array.isArray(ranking) ? ranking : makeRanking(couriers),
    alerts,
    hourlyDeliveries,
    statusDistribution,
    mapMarkers,
    mapRoutes,
    legend: overviewLegend,
  };
}
