import React from 'react';
import { CalendarDays, ChevronRight, RefreshCcw, Search, WalletCards, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatCurrency, formatNumber } from './overview/overviewFormatters';

const REVENUE_DELIVERY_SELECT = 'id, city_id, store_id, status, delivery_fee, created_at, delivered_at, updated_at, stores(id, name, fantasy_name)';
const STORE_DELIVERY_DETAIL_SELECT = 'id, order_code, courier_id, status, delivery_fee, created_at, delivered_at, updated_at, couriers!deliveries_courier_id_fkey(id, name)';
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'cancelada', 'cancelado']);
const COMPLETED_STATUSES = new Set(['delivered', 'entregue', 'completed', 'concluida', 'concluido']);

function formatDateInputValue(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  if (!value) return 'Sem data';
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace('.', '');
}

function formatUpdatedLabel(value) {
  if (!value) return 'Atualizado agora';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) return 'Atualizado agora';
  return `Atualizado ha ${minutes} min`;
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function rowDateKey(delivery) {
  const date = new Date(delivery.created_at || '');
  if (Number.isNaN(date.getTime())) return '';
  return formatDateInputValue(date);
}

function storeNameFromDelivery(delivery, fallbackStores) {
  const linkedStore = delivery.stores;
  if (linkedStore?.fantasy_name || linkedStore?.name) return linkedStore.fantasy_name || linkedStore.name;
  const localStore = fallbackStores.find((store) => store.id === delivery.store_id);
  return localStore?.fantasyName || localStore?.fantasy_name || localStore?.name || 'Loja nao informada';
}

function buildRevenueRows(deliveries, stores = []) {
  const grouped = new Map();

  for (const delivery of deliveries) {
    const dateKey = rowDateKey(delivery);
    if (!dateKey) continue;

    const status = normalizeStatus(delivery.status);
    const isCancelled = CANCELLED_STATUSES.has(status);
    const isCompleted = COMPLETED_STATUSES.has(status);
    if (!isCancelled && !isCompleted) continue;

    const storeId = delivery.store_id || delivery.stores?.id || 'sem-loja';
    const key = `${dateKey}:${storeId}`;
    const current = grouped.get(key) || {
      id: key,
      dateKey,
      dateLabel: formatDateLabel(dateKey),
      storeId,
      storeName: storeNameFromDelivery(delivery, stores),
      completedCount: 0,
      cancelledCount: 0,
      totalValue: 0,
    };

    if (isCancelled) {
      current.cancelledCount += 1;
    } else if (isCompleted) {
      current.completedCount += 1;
      current.totalValue += Number(delivery.delivery_fee || 0);
    }

    grouped.set(key, current);
  }

  return [...grouped.values()].sort((first, second) => (
    second.dateKey.localeCompare(first.dateKey) || first.storeName.localeCompare(second.storeName)
  ));
}

function normalizeDateRange(startDate, endDate) {
  if (startDate && endDate && startDate > endDate) return { startDate: endDate, endDate: startDate };
  return { startDate, endDate };
}

function dateRangeToIso(startDate, endDate) {
  const { startDate: normalizedStart, endDate: normalizedEnd } = normalizeDateRange(startDate, endDate);
  const start = normalizedStart ? new Date(`${normalizedStart}T00:00:00`) : new Date();
  const end = normalizedEnd ? new Date(`${normalizedEnd}T00:00:00`) : new Date(start);
  if (!normalizedStart) start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString(), startDate: normalizedStart, endDate: normalizedEnd };
}

function eventTime(events, status) {
  return events.find((event) => event.status === status)?.created_at || '';
}

function mapDeliveryDetail(delivery, eventsByDelivery) {
  const events = eventsByDelivery.get(delivery.id) || [];
  return {
    id: delivery.id,
    code: delivery.order_code || String(delivery.id || '').slice(0, 6).toUpperCase(),
    courier: delivery.couriers?.name || 'Sem motoboy',
    acceptedAt: eventTime(events, 'assigned') || delivery.updated_at,
    pickedUpAt: eventTime(events, 'picked_up'),
    deliveredAt: eventTime(events, 'delivered') || delivery.delivered_at,
    date: formatDateLabel(rowDateKey(delivery)),
    value: Number(delivery.delivery_fee || 0),
    paid: 'Nao informado',
  };
}

async function fetchStoreDeliveryDetails({ cityId, row }) {
  if (!supabase || !cityId || !row?.storeId || !row?.dateKey) {
    throw new Error('Nao foi possivel buscar os dados das entregas.');
  }

  const start = new Date(`${row.dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await supabase
    .from('deliveries')
    .select(STORE_DELIVERY_DETAIL_SELECT)
    .eq('city_id', cityId)
    .eq('store_id', row.storeId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .in('status', ['delivered', 'cancelled'])
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Nao foi possivel buscar as entregas da loja: ${error.message}`);

  const deliveries = data ?? [];
  const deliveryIds = deliveries.map((delivery) => delivery.id).filter(Boolean);
  const eventsByDelivery = new Map();

  if (deliveryIds.length) {
    const { data: eventsData, error: eventsError } = await supabase
      .from('delivery_events')
      .select('delivery_id, status, created_at')
      .in('delivery_id', deliveryIds)
      .in('status', ['assigned', 'picked_up', 'delivered'])
      .order('created_at', { ascending: true });

    if (eventsError) throw new Error(`Nao foi possivel buscar os horarios das entregas: ${eventsError.message}`);

    for (const event of eventsData ?? []) {
      const current = eventsByDelivery.get(event.delivery_id) || [];
      current.push(event);
      eventsByDelivery.set(event.delivery_id, current);
    }
  }

  return deliveries.map((delivery) => mapDeliveryDetail(delivery, eventsByDelivery));
}

function StoreDeliveryDetailsModal({ row, rows, loading, message, onClose }) {
  const total = rows.reduce((sum, delivery) => sum + delivery.value, 0);

  return (
    <div className="courier-data-modal completed-deliveries-modal store-delivery-details-modal" role="dialog" aria-modal="true" aria-labelledby="store-delivery-details-title">
      <section>
        <header className="completed-deliveries-header">
          <div>
            <span>Dados das entregas lojista</span>
            <h2 id="store-delivery-details-title">{row.storeName}</h2>
          </div>
          <button type="button" onClick={onClose}><X size={19} />Fechar</button>
        </header>

        <div className="store-delivery-details-meta">
          <span>{row.dateLabel}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <div className="store-delivery-details-table" role="table" aria-label="Dados das entregas do lojista">
          <div className="store-delivery-details-row store-delivery-details-head" role="row">
            <span>Motoboy</span>
            <span>Aceite</span>
            <span>Retirada</span>
            <span>Entrega</span>
            <span>Data</span>
            <span>Valor</span>
            <span>Pagamento</span>
          </div>
          {rows.map((delivery) => (
            <div className="store-delivery-details-row" role="row" key={delivery.id}>
              <strong>{delivery.courier}</strong>
              <span>{formatTime(delivery.acceptedAt)}</span>
              <span>{formatTime(delivery.pickedUpAt)}</span>
              <span>{formatTime(delivery.deliveredAt)}</span>
              <span>{delivery.date}</span>
              <span>{formatCurrency(delivery.value)}</span>
              <mark>{delivery.paid}</mark>
            </div>
          ))}
          {!rows.length && (
            <p className="completed-deliveries-empty">
              {loading ? 'Buscando dados das entregas...' : message || 'Nenhuma entrega encontrada.'}
            </p>
          )}
        </div>

        {message && rows.length > 0 && (
          <p className="completed-deliveries-message">{message}</p>
        )}
      </section>
    </div>
  );
}

export function RevenueByStoreView({ city, stores = [] }) {
  const today = React.useMemo(() => formatDateInputValue(new Date()), []);
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [updatedAt, setUpdatedAt] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [detailsRow, setDetailsRow] = React.useState(null);
  const [details, setDetails] = React.useState([]);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsMessage, setDetailsMessage] = React.useState('');

  const visibleRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.storeName.toLowerCase().includes(term) || row.dateLabel.toLowerCase().includes(term));
  }, [rows, search]);

  const totals = React.useMemo(() => visibleRows.reduce((acc, row) => ({
    completed: acc.completed + row.completedCount,
    cancelled: acc.cancelled + row.cancelledCount,
    value: acc.value + row.totalValue,
  }), { completed: 0, cancelled: 0, value: 0 }), [visibleRows]);

  const loadRevenueRows = React.useCallback(async () => {
    const { startIso, endIso, startDate: normalizedStart, endDate: normalizedEnd } = dateRangeToIso(startDate, endDate);
    if (normalizedStart !== startDate) setStartDate(normalizedStart);
    if (normalizedEnd !== endDate) setEndDate(normalizedEnd);

    if (!supabase || !city?.id) {
      setRows([]);
      setMessage(city?.id ? 'Nao foi possivel buscar o faturamento.' : 'Selecione uma cidade para listar o faturamento.');
      setUpdatedAt(new Date().toISOString());
      return;
    }

    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('deliveries')
      .select(REVENUE_DELIVERY_SELECT)
      .eq('city_id', city.id)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false });

    if (error) {
      setRows([]);
      setMessage(`Nao foi possivel buscar o faturamento: ${error.message}`);
    } else {
      const nextRows = buildRevenueRows(data ?? [], stores);
      setRows(nextRows);
      setMessage(nextRows.length ? '' : 'Nenhum faturamento encontrado no periodo.');
    }

    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, [city?.id, endDate, startDate, stores]);

  React.useEffect(() => {
    loadRevenueRows();
  }, [loadRevenueRows]);

  async function openStoreDeliveryData(row) {
    setDetailsRow(row);
    setDetails([]);
    setDetailsMessage('');
    setDetailsLoading(true);

    try {
      const detailRows = await fetchStoreDeliveryDetails({ cityId: city.id, row });
      setDetails(detailRows);
      setDetailsMessage(detailRows.length ? '' : 'Nenhuma entrega encontrada para esta loja no dia selecionado.');
    } catch (error) {
      setDetailsMessage(error.message);
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <section className="revenue-page" aria-labelledby="revenue-page-title">
      <section className="revenue-summary">
        <article>
          <span><WalletCards size={22} /></span>
          <p>Valor total</p>
          <strong>{formatCurrency(totals.value)}</strong>
        </article>
        <article>
          <span><ChevronRight size={22} /></span>
          <p>Entregas realizadas</p>
          <strong>{formatNumber(totals.completed)}</strong>
        </article>
        <article>
          <span><ChevronRight size={22} /></span>
          <p>Canceladas</p>
          <strong>{formatNumber(totals.cancelled)}</strong>
        </article>
      </section>

      <section className="overview-panel revenue-table-panel">
        <header className="revenue-table-header">
          <div>
            <h2 id="revenue-page-title">Faturamento por loja</h2>
            <span>{formatUpdatedLabel(updatedAt)}</span>
          </div>
          <button type="button" onClick={loadRevenueRows} disabled={loading}>
            <RefreshCcw size={17} />Atualizar
          </button>
        </header>

        <div className="revenue-toolbar">
          <label className="revenue-search">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar loja ou dia" />
          </label>
          <label>
            <span>Inicio</span>
            <div>
              <CalendarDays size={18} />
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value || today)} />
            </div>
          </label>
          <label>
            <span>Fim</span>
            <div>
              <CalendarDays size={18} />
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value || today)} />
            </div>
          </label>
        </div>

        <div className="revenue-table" role="table" aria-label="Faturamento do dia separado por loja">
          <div className="revenue-table-row revenue-table-head" role="row">
            <span>Dia</span>
            <span>Loja</span>
            <span>Realizadas</span>
            <span>Canceladas</span>
            <span>Valor total</span>
            <span>Dados</span>
          </div>
          {visibleRows.map((row) => (
            <div className="revenue-table-row" role="row" key={row.id}>
              <span>{row.dateLabel}</span>
              <strong>{row.storeName}</strong>
              <span>{formatNumber(row.completedCount)}</span>
              <span>{formatNumber(row.cancelledCount)}</span>
              <span>{formatCurrency(row.totalValue)}</span>
              <button type="button" onClick={() => openStoreDeliveryData(row)}>
                dados_das_entregas_lojista
              </button>
            </div>
          ))}
          {!visibleRows.length && (
            <p className="revenue-empty">
              {loading ? 'Buscando faturamento...' : message || 'Nenhum dado encontrado.'}
            </p>
          )}
        </div>
      </section>

      {detailsRow && (
        <StoreDeliveryDetailsModal
          row={detailsRow}
          rows={details}
          loading={detailsLoading}
          message={detailsMessage}
          onClose={() => setDetailsRow(null)}
        />
      )}
    </section>
  );
}
