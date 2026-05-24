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

function MetricCard({ metric }) {
  const Icon = metricIcons[metric.icon] || Activity;
  return (
    <article className={`overview-metric ${metric.tone}`}>
      <span className="overview-metric-icon"><Icon size={22} /></span>
      <div>
        <p>{metric.label}</p>
        <strong>{metric.value}</strong>
        <small>{metric.trend}</small>
      </div>
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

function OnlineCouriersTable({ rows }) {
  return (
    <section className="overview-panel overview-side-list" aria-labelledby="overview-couriers-title">
      <header>
        <h2 id="overview-couriers-title">Motoboys online</h2>
        <button type="button">Ver todas</button>
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
  const overview = React.useMemo(
    () => buildOverviewData({ city, stores, couriers }),
    [city, stores, couriers],
  );

  return (
    <section className="overview-control" aria-label="Central de controle">
      <section className="overview-metrics" aria-label="Indicadores principais">
        {overview.metrics.map((metric) => <MetricCard metric={metric} key={metric.id} />)}
      </section>

      <section className="overview-main-grid">
        <OverviewMap data={overview} />
        <aside className="overview-right-rail">
          <ActiveDeliveriesTable rows={overview.activeDeliveries} />
          <OnlineCouriersTable rows={overview.onlineCouriers} />
          <AlertsTable rows={overview.alerts} />
        </aside>
      </section>

      <section className="overview-bottom-grid">
        <HourlyChart values={overview.hourlyDeliveries} />
        <StatusDistribution rows={overview.statusDistribution} />
        <CourierRanking rows={overview.ranking} />
      </section>
    </section>
  );
}
