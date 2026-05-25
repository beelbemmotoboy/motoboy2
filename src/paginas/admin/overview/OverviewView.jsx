import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bike,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Layers,
  LocateFixed,
  Minus,
  Plus,
  Star,
  Store,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { buildOverviewData } from './overviewData';

const metricIcons = {
  briefcase: BriefcaseBusiness,
  bike: Bike,
  user: UserRound,
  store: Store,
  check: CheckCircle2,
  pulse: Activity,
  wallet: WalletCards,
  clock: Clock3,
};

const ACTIVE_DELIVERY_STATUSES = ['pending', 'assigned', 'picked_up', 'on_route'];
const ACTIVE_DELIVERY_SELECT = 'id, order_code, courier_id, delivery_district, delivery_deadline_at, estimated_minutes, status, created_at, stores(name, fantasy_name), couriers(id, name, rating)';
const TODAY_DELIVERY_SELECT = 'id, order_code, courier_id, status, delivery_deadline_at, estimated_minutes, delivery_fee, delivered_at, created_at, updated_at, stores(name, fantasy_name), couriers(id, name, rating)';
const STORE_SELECT = 'id, city_id, name, fantasy_name, active, is_open, logo_url, district';
const COURIER_SELECT = 'id, city_id, name, face_photo_path, availability_status, rating, active';
const EMPTY_HOURLY_DELIVERIES = Array.from({ length: 24 }, () => 0);
const STATUS_COLORS = {
  assigned: '#20d45a',
  customer: '#ffd200',
  delayed: '#ff4949',
  delivered: '#2878ff',
  pending: '#a1a5ad',
};
const MAP_MARKER_LAYOUT = [
  { x: 26, y: 18 },
  { x: 64, y: 19 },
  { x: 79, y: 35 },
  { x: 24, y: 51 },
  { x: 54, y: 56 },
  { x: 72, y: 68 },
  { x: 18, y: 74 },
  { x: 84, y: 78 },
  { x: 40, y: 61 },
  { x: 93, y: 63 },
];
const MAP_ROUTE_LAYOUT = [
  '260,118 330,142 402,116',
  '655,118 736,130 825,120',
  '772,252 814,306 896,292',
  '280,355 354,310 430,268',
  '458,418 545,418 650,464',
  '165,498 270,552 386,520 492,536',
];

function initials(name) {
  return String(name || 'BB')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function firstName(name, fallback = 'Sem motoboy') {
  return String(name || fallback).trim().split(/\s+/)[0] || fallback;
}

function StatusDot({ tone }) {
  return <span className={`overview-status-dot ${tone}`} />;
}

function calculateCourierStars(value) {
  return Math.min(5, Math.max(1, Math.floor(Number(value || 0) / 250) + 1));
}

function formatXpValue(value) {
  return Number.isInteger(Number(value)) ? Number(value).toFixed(0) : Number(value).toFixed(1).replace('.', ',');
}

function formatDeliveryEta(delivery) {
  if (delivery.delivery_deadline_at) {
    const remaining = Math.ceil((new Date(delivery.delivery_deadline_at).getTime() - Date.now()) / 60000);
    if (Number.isFinite(remaining)) return `${Math.max(0, remaining)} min`;
  }

  const estimated = Number(delivery.estimated_minutes);
  if (Number.isFinite(estimated)) return `${Math.max(0, Math.round(estimated))} min`;
  return '--';
}

function deliveryStatusView(status, deadlineAt) {
  const deadline = deadlineAt ? new Date(deadlineAt).getTime() : null;
  if (deadline && Number.isFinite(deadline) && deadline < Date.now() && status !== 'delivered') {
    return { label: 'Atraso', tone: 'red' };
  }
  if (status === 'assigned') return { label: 'A caminho da loja', tone: 'green' };
  if (['picked_up', 'on_route'].includes(status)) return { label: 'Indo para o cliente', tone: 'yellow' };
  return { label: 'Aguardando aceite', tone: 'gray' };
}

function mapActiveDelivery(delivery) {
  const status = deliveryStatusView(delivery.status, delivery.delivery_deadline_at);
  const courier = delivery.couriers?.name || '';
  return {
    id: delivery.id,
    code: delivery.order_code || `#${String(delivery.id || '').slice(0, 6).toUpperCase()}`,
    store: delivery.stores?.fantasy_name || delivery.stores?.name || 'Loja',
    courier: courier || 'Sem motoboy',
    courierFirstName: firstName(courier),
    district: delivery.delivery_district || 'Bairro nao informado',
    status: status.label,
    eta: formatDeliveryEta(delivery),
    tone: status.tone,
  };
}

async function createCourierDocumentPreviewUrl(path) {
  if (!path || typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.includes('/') || !supabase?.storage) return '';
  const { data, error } = await supabase.storage.from('courier-documents').createSignedUrl(path, 600);
  return error ? '' : data?.signedUrl || '';
}

function isOnlineCourier(courier) {
  return courier.active !== false && ['available', 'Disponivel'].includes(courier.availability);
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
}

function minutesBetween(start, end) {
  const startTime = new Date(start || '').getTime();
  const endTime = new Date(end || '').getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.max(0, Math.round((endTime - startTime) / 60000));
}

function makeCourierDisplayCode(id, index = 0) {
  const source = String(id || index);
  const seed = source.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return `MB-${String((seed % 90) + 10).padStart(2, '0')}`;
}

function mapStoreFromDb(store) {
  return {
    id: store.id,
    cityId: store.city_id,
    name: store.name,
    fantasyName: store.fantasy_name,
    active: store.active,
    isOpen: store.is_open,
    logoUrl: store.logo_url,
    district: store.district,
  };
}

function mapCourierFromDb(courier, index, pointsByCourier, deliveriesByCourier) {
  const totalXp = Number(pointsByCourier.get(courier.id) || 0);
  return {
    id: courier.id,
    cityId: courier.city_id,
    fullName: courier.name,
    name: courier.name,
    facePhoto: courier.face_photo_path,
    availability: courier.availability_status,
    rating: Number(courier.rating || 5),
    active: courier.active,
    displayCode: makeCourierDisplayCode(courier.id, index),
    todayDeliveries: Number(deliveriesByCourier.get(courier.id) || 0),
    totalXp,
  };
}

function buildHourlyDeliveries(deliveries) {
  const values = Array.from({ length: 24 }, () => 0);
  for (const delivery of deliveries) {
    const hour = new Date(delivery.created_at || '').getHours();
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) values[hour] += 1;
  }
  return values;
}

function isDelayedDelivery(delivery, now = Date.now()) {
  const deadline = delivery.delivery_deadline_at ? new Date(delivery.delivery_deadline_at).getTime() : null;
  return deadline && Number.isFinite(deadline) && deadline < now && delivery.status !== 'delivered';
}

function buildStatusDistribution(activeRows, todayRows) {
  const now = Date.now();
  return [
    {
      label: 'A caminho da loja',
      value: activeRows.filter((delivery) => delivery.status === 'assigned' && !isDelayedDelivery(delivery, now)).length,
      color: STATUS_COLORS.assigned,
    },
    {
      label: 'Indo para o cliente',
      value: activeRows.filter((delivery) => ['picked_up', 'on_route'].includes(delivery.status) && !isDelayedDelivery(delivery, now)).length,
      color: STATUS_COLORS.customer,
    },
    {
      label: 'Atraso / Atencao',
      value: activeRows.filter((delivery) => isDelayedDelivery(delivery, now)).length,
      color: STATUS_COLORS.delayed,
    },
    {
      label: 'Entregue recentemente',
      value: todayRows.filter((delivery) => delivery.status === 'delivered').length,
      color: STATUS_COLORS.delivered,
    },
    {
      label: 'Disponivel / Aguardando',
      value: activeRows.filter((delivery) => delivery.status === 'pending' && !isDelayedDelivery(delivery, now)).length,
      color: STATUS_COLORS.pending,
    },
  ];
}

function buildOverviewAlerts(activeRows) {
  const now = Date.now();
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  return activeRows
    .flatMap((delivery) => {
      const code = delivery.order_code || `#${String(delivery.id || '').slice(0, 6).toUpperCase()}`;
      const courier = delivery.couriers?.name || 'Sem motoboy';
      const alerts = [];
      const deadline = delivery.delivery_deadline_at ? new Date(delivery.delivery_deadline_at).getTime() : null;
      if (deadline && Number.isFinite(deadline) && deadline < now) {
        const lateMinutes = Math.max(1, Math.ceil((now - deadline) / 60000));
        alerts.push({
          type: 'critical',
          title: `Entrega ${code} com atraso de ${lateMinutes} minutos`,
          detail: `Motoboy ${courier} - ETA ${formatDeliveryEta(delivery)}`,
          time,
          sort: lateMinutes + 1000,
        });
      }

      if (delivery.status === 'pending') {
        const waitingMinutes = minutesBetween(delivery.created_at, new Date());
        if (waitingMinutes && waitingMinutes >= 5) {
          alerts.push({
            type: 'warning',
            title: `Entrega ${code} aguardando aceite`,
            detail: `${waitingMinutes} min sem motoboy vinculado`,
            time,
            sort: waitingMinutes,
          });
        }
      }
      return alerts;
    })
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 5)
    .map(({ sort, ...alert }) => alert);
}

function buildCourierRanking(todayRows) {
  const rankingByCourier = new Map();
  for (const delivery of todayRows) {
    if (!delivery.courier_id || delivery.status === 'cancelled') continue;
    const current = rankingByCourier.get(delivery.courier_id) || {
      courier: delivery.couriers?.name || 'Motoboy',
      deliveries: 0,
      rating: Number(delivery.couriers?.rating || 5),
      displayCode: makeCourierDisplayCode(delivery.courier_id),
    };
    current.deliveries += 1;
    rankingByCourier.set(delivery.courier_id, current);
  }

  return [...rankingByCourier.values()]
    .sort((a, b) => b.deliveries - a.deliveries || b.rating - a.rating)
    .slice(0, 5)
    .map((item, index) => ({
      position: index + 1,
      courier: `${item.courier} (${item.displayCode})`,
      deliveries: item.deliveries,
      rating: item.rating,
    }));
}

function averageDeliveryMinutes(deliveries) {
  const durations = deliveries
    .map((delivery) => {
      if (delivery.delivered_at) return minutesBetween(delivery.created_at, delivery.delivered_at);
      const estimated = Number(delivery.estimated_minutes);
      return Number.isFinite(estimated) ? estimated : null;
    })
    .filter((value) => Number.isFinite(value));

  if (!durations.length) return 0;
  return durations.reduce((total, value) => total + value, 0) / durations.length;
}

function buildMapMarkers(activeRows, couriers) {
  const usedCourierIds = new Set();
  const activeMarkers = activeRows.slice(0, 6).map((delivery, index) => {
    const position = MAP_MARKER_LAYOUT[index] || MAP_MARKER_LAYOUT[0];
    if (delivery.courier_id) usedCourierIds.add(delivery.courier_id);
    return {
      id: delivery.id,
      x: position.x,
      y: position.y,
      tone: deliveryStatusView(delivery.status, delivery.delivery_deadline_at).tone,
      label: delivery.couriers?.name ? firstName(delivery.couriers.name) : 'Pedido',
    };
  });

  const availableMarkers = couriers
    .filter((courier) => isOnlineCourier(courier) && !usedCourierIds.has(courier.id))
    .slice(0, Math.max(0, MAP_MARKER_LAYOUT.length - activeMarkers.length))
    .map((courier, index) => {
      const position = MAP_MARKER_LAYOUT[activeMarkers.length + index] || MAP_MARKER_LAYOUT[0];
      return {
        id: `courier-${courier.id}`,
        x: position.x,
        y: position.y,
        tone: 'green',
        label: firstName(courier.fullName || courier.name, courier.displayCode || makeCourierDisplayCode(courier.id, index)),
      };
    });

  return [...activeMarkers, ...availableMarkers];
}

function buildMapRoutes(activeRows) {
  return activeRows.slice(0, MAP_ROUTE_LAYOUT.length).map((delivery, index) => ({
    points: MAP_ROUTE_LAYOUT[index],
    tone: deliveryStatusView(delivery.status, delivery.delivery_deadline_at).tone,
  }));
}

function MetricCard({ metric, onOpenOnlineCouriers }) {
  const Icon = metricIcons[metric.icon] || Activity;
  const content = (
    <>
      <span className="overview-metric-icon"><Icon size={22} /></span>
      <div>
        <p>{metric.label}</p>
        <strong>{metric.value}</strong>
        <small>{metric.trend}</small>
      </div>
    </>
  );

  if (metric.id === 'couriers') {
    return (
      <button
        className={`overview-metric overview-metric-action ${metric.tone}`}
        type="button"
        onClick={onOpenOnlineCouriers}
        aria-label="Ver todos os motoboys online"
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`overview-metric ${metric.tone}`}>
      {content}
    </article>
  );
}

function OverviewMap({ data }) {
  return (
    <section className="overview-map-panel" aria-label="Mapa operacional">
      <div className="overview-map-grid" />
      <div className="overview-map-label meireles">MEIRELES</div>
      <div className="overview-map-label aldeota">ALDEOTA</div>
      <div className="overview-map-label papicu">PAPICU</div>
      <div className="overview-map-label dionisio">DIONISIO<br />TORRES</div>
      <div className="overview-map-street street-one">R. Silva Jatahy</div>
      <div className="overview-map-street street-two">Av. Sen. Virgilio Tavora</div>
      <div className="overview-map-street street-three">Av. Santos Dumont</div>

      <svg className="overview-route-layer" viewBox="0 0 1000 620" aria-hidden="true">
        {data.mapRoutes.map((route) => (
          <polyline key={`${route.tone}-${route.points}`} className={`overview-route ${route.tone}`} points={route.points} />
        ))}
      </svg>

      <div className="overview-map-legend">
        <strong>Legenda de status</strong>
        {data.legend.map((item) => (
          <span key={item.label}><StatusDot tone={item.tone} />{item.label}</span>
        ))}
        <button type="button"><LocateFixed size={16} />Centralizar mapa</button>
      </div>

      {data.mapMarkers.map((marker) => (
        <div
          className={`overview-map-marker ${marker.tone}`}
          key={marker.id}
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        >
          <Bike size={17} />
          <span>{marker.label}</span>
        </div>
      ))}

      <div className="overview-map-controls" aria-hidden="true">
        <button type="button"><Plus size={18} /></button>
        <button type="button"><Minus size={18} /></button>
        <button type="button"><Layers size={18} /></button>
      </div>
    </section>
  );
}

function ActiveDeliveriesTable({ rows, loading, message, onRefresh }) {
  return (
    <section className="overview-panel overview-side-list" aria-labelledby="overview-active-title">
      <header>
        <h2 id="overview-active-title">Entregas em curso</h2>
        <button type="button" onClick={() => onRefresh()}>Ver todas</button>
      </header>
      <div className="overview-delivery-list">
        {rows.map((row) => (
          <article key={row.code}>
            <StatusDot tone={row.tone} />
            <a href="#overview" onClick={(event) => event.preventDefault()} aria-label={`Abrir pedido ${row.code}`}>{row.code}</a>
            <strong>{row.courierFirstName || firstName(row.courier)}</strong>
            <span>{row.district}</span>
          </article>
        ))}
        {!rows.length && (
          <p className="overview-empty-state">
            {loading ? 'Buscando entregas em curso...' : message || 'Nenhuma entrega em curso.'}
          </p>
        )}
      </div>
    </section>
  );
}

function OnlineCouriersTable({ rows, onViewAll }) {
  return (
    <section className="overview-panel overview-side-list" aria-labelledby="overview-couriers-title">
      <header>
        <h2 id="overview-couriers-title">Motoboys online</h2>
        <button type="button" onClick={onViewAll}>Ver todas</button>
      </header>
      <div className="overview-courier-list">
        {rows.map((row) => (
          <article key={`${row.id}-${row.name}`}>
            <span className="overview-avatar">{initials(row.name)}</span>
            <strong>{row.id}</strong>
            <div>
              <span>{row.name}</span>
              <small><Star size={13} fill="currentColor" />{row.rating}</small>
            </div>
            <span>{row.todayDeliveries}</span>
            <em>{row.status}</em>
          </article>
        ))}
        {!rows.length && (
          <p className="overview-empty-state">Nenhum motoboy online no momento.</p>
        )}
      </div>
    </section>
  );
}

function OnlineCouriersModal({ rows, loading, message, onClose }) {
  return (
    <div className="courier-data-modal" role="dialog" aria-modal="true" aria-labelledby="overview-online-couriers-title">
      <section>
        <header>
          <div>
            <span>Disponiveis agora</span>
            <h2 id="overview-online-couriers-title">Motoboys on-line</h2>
          </div>
          <button type="button" onClick={onClose}>Fechar</button>
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
              {rows.map((courier) => (
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
              {!rows.length && (
                <tr>
                  <td colSpan="4">{loading ? 'Buscando motoboys on-line...' : message || 'Nenhum dado encontrado.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {message && rows.length > 0 && (
          <p className="courier-action-message">{message}</p>
        )}
      </section>
    </div>
  );
}

function AlertsTable({ rows }) {
  return (
    <section className="overview-panel overview-alerts" aria-labelledby="overview-alerts-title">
      <header>
        <h2 id="overview-alerts-title">Alertas</h2>
        <button type="button">Ver todos</button>
      </header>
      {rows.map((row) => (
        <article className={row.type} key={row.title}>
          <span><AlertTriangle size={20} /></span>
          <div>
            <strong>{row.title}</strong>
            <small>{row.detail}</small>
          </div>
          <time>{row.time}</time>
        </article>
      ))}
      {!rows.length && (
        <p className="overview-empty-state">Nenhum alerta operacional agora.</p>
      )}
    </section>
  );
}

function HourlyChart({ values }) {
  const max = Math.max(...values, 1);
  return (
    <section className="overview-panel overview-hourly" aria-labelledby="overview-hourly-title">
      <header>
        <h2 id="overview-hourly-title">Entregas por hora</h2>
        <button type="button">Hoje</button>
      </header>
      <div className="overview-bars">
        {values.map((value, index) => (
          <span key={`${index}-${value}`} style={{ height: `${Math.max(6, (value / max) * 100)}%` }} />
        ))}
      </div>
      <div className="overview-hours"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>21h</span></div>
    </section>
  );
}

function StatusDistribution({ rows }) {
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = rows.map((item) => {
    const start = cursor;
    const size = total ? (item.value / total) * 100 : 0;
    cursor += size;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(', ');

  return (
    <section className="overview-panel overview-status-chart" aria-labelledby="overview-status-title">
      <h2 id="overview-status-title">Distribuicao por status</h2>
      <div className="overview-donut-wrap">
        <div className="overview-donut" style={{ background: `conic-gradient(${gradient})` }}>
          <span><strong>{total}</strong>Total</span>
        </div>
        <div className="overview-status-list">
          {rows.map((item) => (
            <p key={item.label}>
              <span className="overview-status-dot" style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function CourierRanking({ rows }) {
  return (
    <section className="overview-panel overview-ranking" aria-labelledby="overview-ranking-title">
      <header>
        <h2 id="overview-ranking-title">Ranking motoboys do dia</h2>
        <button type="button">Ver ranking completo</button>
      </header>
      {rows.map((row) => (
        <article key={`${row.position}-${row.courier}`}>
          <span>{row.position}</span>
          <strong>{row.courier}</strong>
          <em>{row.deliveries} entregas</em>
          <small><Star size={13} fill="currentColor" />{row.rating}</small>
        </article>
      ))}
      {!rows.length && (
        <p className="overview-empty-state">Nenhuma entrega com motoboy hoje.</p>
      )}
    </section>
  );
}

export function Overview({ city, stores = [], couriers = [] }) {
  const [onlineCouriersModalOpen, setOnlineCouriersModalOpen] = React.useState(false);
  const [onlineCouriersLoading, setOnlineCouriersLoading] = React.useState(false);
  const [onlineCouriersMessage, setOnlineCouriersMessage] = React.useState('');
  const [onlineCouriers, setOnlineCouriers] = React.useState([]);
  const [liveCity, setLiveCity] = React.useState(city);
  const [liveStores, setLiveStores] = React.useState(stores);
  const [liveCouriers, setLiveCouriers] = React.useState(couriers);
  const [activeDeliveries, setActiveDeliveries] = React.useState([]);
  const [activeDeliveriesLoading, setActiveDeliveriesLoading] = React.useState(false);
  const [activeDeliveriesMessage, setActiveDeliveriesMessage] = React.useState('');
  const [overviewAlerts, setOverviewAlerts] = React.useState([]);
  const [hourlyDeliveries, setHourlyDeliveries] = React.useState(EMPTY_HOURLY_DELIVERIES);
  const [statusDistribution, setStatusDistribution] = React.useState(() => buildStatusDistribution([], []));
  const [ranking, setRanking] = React.useState([]);
  const [mapMarkers, setMapMarkers] = React.useState([]);
  const [mapRoutes, setMapRoutes] = React.useState([]);
  const refreshTimerRef = React.useRef(null);
  const overviewRequestRef = React.useRef(0);
  const overview = React.useMemo(
    () => buildOverviewData({
      city: liveCity,
      stores: liveStores,
      couriers: liveCouriers,
      activeDeliveryRows: activeDeliveries,
      alerts: overviewAlerts,
      hourlyDeliveries,
      statusDistribution,
      ranking,
      mapMarkers,
      mapRoutes,
    }),
    [liveCity, liveStores, liveCouriers, activeDeliveries, overviewAlerts, hourlyDeliveries, statusDistribution, ranking, mapMarkers, mapRoutes],
  );

  React.useEffect(() => {
    setLiveCity(city);
    setLiveStores(stores);
    setLiveCouriers(couriers);
  }, [city, stores, couriers]);

  const loadOverviewData = React.useCallback(async ({ silent = false } = {}) => {
    const requestId = overviewRequestRef.current + 1;
    overviewRequestRef.current = requestId;
    if (!silent) setActiveDeliveriesLoading(true);
    setActiveDeliveriesMessage('');

    if (!supabase || !city?.id) {
      setLiveCity(city);
      setLiveStores(stores);
      setLiveCouriers(couriers);
      setActiveDeliveries([]);
      setActiveDeliveriesLoading(false);
      setOverviewAlerts([]);
      setHourlyDeliveries(EMPTY_HOURLY_DELIVERIES);
      setStatusDistribution(buildStatusDistribution([], []));
      setRanking([]);
      setMapMarkers([]);
      setMapRoutes([]);
      setActiveDeliveriesMessage(city?.id ? 'Nao foi possivel buscar as entregas em curso.' : 'Selecione uma cidade para acompanhar as entregas.');
      return;
    }

    const { startIso, endIso } = getTodayRange();
    const [
      storesResult,
      couriersResult,
      activeDeliveriesResult,
      todayDeliveriesResult,
    ] = await Promise.all([
      supabase
        .from('stores')
        .select(STORE_SELECT)
        .eq('city_id', city.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('couriers')
        .select(COURIER_SELECT)
        .eq('city_id', city.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('deliveries')
        .select(ACTIVE_DELIVERY_SELECT)
        .eq('city_id', city.id)
        .in('status', ACTIVE_DELIVERY_STATUSES)
        .order('created_at', { ascending: true })
        .limit(20),
      supabase
        .from('deliveries')
        .select(TODAY_DELIVERY_SELECT)
        .eq('city_id', city.id)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: true }),
    ]);

    if (overviewRequestRef.current !== requestId) return;

    const loadErrors = [
      storesResult.error,
      couriersResult.error,
      activeDeliveriesResult.error,
      todayDeliveriesResult.error,
    ].filter(Boolean);

    const storeRows = storesResult.error ? stores : (storesResult.data ?? []).map(mapStoreFromDb);
    const activeRows = activeDeliveriesResult.error ? [] : (activeDeliveriesResult.data ?? []);
    const todayRows = todayDeliveriesResult.error ? [] : (todayDeliveriesResult.data ?? []);
    const countedTodayRows = todayRows.filter((delivery) => delivery.status !== 'cancelled');
    const completedRows = todayRows.filter((delivery) => delivery.status === 'delivered');
    const deliveriesByCourier = new Map();
    for (const delivery of countedTodayRows) {
      if (delivery.courier_id) deliveriesByCourier.set(delivery.courier_id, (deliveriesByCourier.get(delivery.courier_id) || 0) + 1);
    }

    const courierIds = (couriersResult.data ?? []).map((courier) => courier.id).filter(Boolean);
    const pointsByCourier = new Map();
    if (!couriersResult.error && courierIds.length) {
      const { data: pointsData } = await supabase
        .from('courier_points')
        .select('courier_id, total_points')
        .in('courier_id', courierIds);
      for (const item of pointsData ?? []) pointsByCourier.set(item.courier_id, Number(item.total_points || 0));
    }

    if (overviewRequestRef.current !== requestId) return;

    const courierRows = couriersResult.error
      ? couriers
      : (couriersResult.data ?? []).map((courier, index) => mapCourierFromDb(courier, index, pointsByCourier, deliveriesByCourier));
    const activeDeliveryRows = activeRows.map(mapActiveDelivery);
    const revenueToday = countedTodayRows.reduce((total, delivery) => total + Number(delivery.delivery_fee || 0), 0);
    const successRate = countedTodayRows.length ? (completedRows.length / countedTodayRows.length) * 100 : 0;
    const metricsCity = {
      ...city,
      activeStores: storeRows.filter((store) => store.active !== false).length,
      availableCouriers: courierRows.filter(isOnlineCourier).length,
      activeDeliveries: activeRows.length,
      revenueToday,
      averageDeliveryMinutes: averageDeliveryMinutes(countedTodayRows),
      metrics: [
        String(countedTodayRows.length),
        String(activeRows.length),
        String(completedRows.length),
        String(successRate),
      ],
    };

    setLiveCity(metricsCity);
    setLiveStores(storeRows);
    setLiveCouriers(courierRows);
    setActiveDeliveries(activeDeliveryRows);
    setOverviewAlerts(buildOverviewAlerts(activeRows));
    setHourlyDeliveries(buildHourlyDeliveries(countedTodayRows));
    setStatusDistribution(buildStatusDistribution(activeRows, todayRows));
    setRanking(buildCourierRanking(countedTodayRows));
    setMapMarkers(buildMapMarkers(activeRows, courierRows));
    setMapRoutes(buildMapRoutes(activeRows));
    setActiveDeliveriesLoading(false);
    if (loadErrors.length) {
      setActiveDeliveriesMessage(`Atualizacao parcial: ${loadErrors.map((error) => error.message).join(' | ')}`);
    } else {
      setActiveDeliveriesMessage(activeDeliveryRows.length ? '' : 'Nenhuma entrega em curso no momento.');
    }
  }, [city, stores, couriers]);

  React.useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  const scheduleOverviewRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      loadOverviewData({ silent: true });
    }, 350);
  }, [loadOverviewData]);

  React.useEffect(() => {
    if (!supabase || !city?.id) return undefined;

    const refreshWhenCityMatches = (payload) => {
      const record = payload.new || payload.old || {};
      if (!record.city_id || record.city_id === city.id) scheduleOverviewRefresh();
    };

    const channel = supabase
      .channel(`overview-live-${city.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, refreshWhenCityMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, refreshWhenCityMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couriers' }, refreshWhenCityMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_xp_events' }, refreshWhenCityMatches)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_points' }, scheduleOverviewRefresh)
      .subscribe();

    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [city?.id, scheduleOverviewRefresh]);

  async function mapLocalOnlineCouriers() {
    const localRows = liveCouriers.filter(isOnlineCourier);
    const ids = localRows.map((courier) => courier.id).filter(Boolean);
    const pointsByCourier = new Map();

    if (supabase && ids.length) {
      const { data } = await supabase
        .from('courier_points')
        .select('courier_id, total_points')
        .in('courier_id', ids);
      for (const item of data ?? []) pointsByCourier.set(item.courier_id, Number(item.total_points || 0));
    }

    return Promise.all(localRows.map(async (courier) => {
      const totalXp = Number(pointsByCourier.get(courier.id) ?? courier.totalXp ?? 0);
      return {
        id: courier.id,
        name: courier.fullName || courier.name || 'Motoboy',
        photoUrl: await createCourierDocumentPreviewUrl(courier.facePhoto || courier.face_photo_path),
        totalXp,
        stars: calculateCourierStars(totalXp),
      };
    }));
  }

  async function openOnlineCouriersModal() {
    setOnlineCouriersModalOpen(true);
    setOnlineCouriersLoading(true);
    setOnlineCouriersMessage('');
    setOnlineCouriers([]);

    if (!supabase || !city?.id) {
      const localRows = await mapLocalOnlineCouriers();
      setOnlineCouriers(localRows);
      setOnlineCouriersLoading(false);
      setOnlineCouriersMessage(localRows.length ? 'Mostrando dados locais dos motoboys on-line.' : 'Nao foi possivel buscar os motoboys on-line.');
      return;
    }

    const { data, error } = await supabase.rpc('list_online_couriers_for_current_city', {
      target_city_id: city.id,
    });

    if (error) {
      const localRows = await mapLocalOnlineCouriers();
      setOnlineCouriers(localRows);
      setOnlineCouriersLoading(false);
      setOnlineCouriersMessage(localRows.length ? `Mostrando dados locais. Atualizacao completa indisponivel: ${error.message}` : `Nao foi possivel buscar os motoboys on-line: ${error.message}`);
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

  return (
    <section className="overview-control" aria-label="Central de controle">
      <section className="overview-metrics" aria-label="Indicadores principais">
        {overview.metrics.map((metric) => (
          <MetricCard metric={metric} key={metric.id} onOpenOnlineCouriers={openOnlineCouriersModal} />
        ))}
      </section>

      <section className="overview-main-grid">
        <OverviewMap data={overview} />
        <aside className="overview-right-rail">
          <ActiveDeliveriesTable
            rows={activeDeliveries}
            loading={activeDeliveriesLoading}
            message={activeDeliveriesMessage}
            onRefresh={loadOverviewData}
          />
          <OnlineCouriersTable rows={overview.onlineCouriers} onViewAll={openOnlineCouriersModal} />
          <AlertsTable rows={overview.alerts} />
        </aside>
      </section>

      <section className="overview-bottom-grid">
        <HourlyChart values={overview.hourlyDeliveries} />
        <StatusDistribution rows={overview.statusDistribution} />
        <CourierRanking rows={overview.ranking} />
      </section>

      {onlineCouriersModalOpen && (
        <OnlineCouriersModal
          rows={onlineCouriers}
          loading={onlineCouriersLoading}
          message={onlineCouriersMessage}
          onClose={() => setOnlineCouriersModalOpen(false)}
        />
      )}
    </section>
  );
}
