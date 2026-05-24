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

function initials(name) {
  return String(name || 'BB')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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

function ActiveDeliveriesTable({ rows }) {
  return (
    <section className="overview-panel overview-side-list" aria-labelledby="overview-active-title">
      <header>
        <h2 id="overview-active-title">Entregas em curso</h2>
        <button type="button">Ver todas</button>
      </header>
      <div className="overview-delivery-list">
        {rows.map((row) => (
          <article key={row.code}>
            <StatusDot tone={row.tone} />
            <strong>{row.code}</strong>
            <div>
              <span>{row.store}</span>
              <small>{row.courier}</small>
            </div>
            <span>{row.district}</span>
            <mark className={row.tone}>{row.status}</mark>
            <em>ETA {row.eta}</em>
          </article>
        ))}
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
    </section>
  );
}

export function Overview({ city, stores = [], couriers = [] }) {
  const [onlineCouriersModalOpen, setOnlineCouriersModalOpen] = React.useState(false);
  const [onlineCouriersLoading, setOnlineCouriersLoading] = React.useState(false);
  const [onlineCouriersMessage, setOnlineCouriersMessage] = React.useState('');
  const [onlineCouriers, setOnlineCouriers] = React.useState([]);
  const overview = React.useMemo(
    () => buildOverviewData({ city, stores, couriers }),
    [city, stores, couriers],
  );

  async function mapLocalOnlineCouriers() {
    const localRows = couriers.filter(isOnlineCourier);
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
          <ActiveDeliveriesTable rows={overview.activeDeliveries} />
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
