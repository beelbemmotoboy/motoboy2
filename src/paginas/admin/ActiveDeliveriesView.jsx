import React from 'react';
import { CalendarDays, ChevronRight, Clock3, MapPin, Package, RefreshCcw, Search, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatNumber } from './overview/overviewFormatters';

const ACTIVE_DELIVERY_STATUSES = ['pending', 'assigned', 'picked_up', 'on_route'];
const ACTIVE_DELIVERY_SELECT = 'id, order_code, courier_id, status, delivery_district, delivery_deadline_at, estimated_minutes, created_at, updated_at, customers(name), stores(name, fantasy_name), couriers(id, name, rating)';

function formatDateInputValue(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateFilterLabel(value) {
  if (!value) return 'Selecionar data';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return 'Selecionar data';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace('.', '');
}

function formatShortDateTime(value) {
  if (!value) return { date: '--/--', time: '--:--', dateKey: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '--/--', time: '--:--', dateKey: '' };
  return {
    date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    dateKey: formatDateInputValue(date),
  };
}

function formatUpdatedLabel(value) {
  if (!value) return 'Atualizado agora';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) return 'Atualizado agora';
  return `Atualizado ha ${minutes} min`;
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

function minutesBetween(start, end) {
  const startTime = new Date(start || '').getTime();
  const endTime = new Date(end || '').getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.max(0, Math.round((endTime - startTime) / 60000));
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

function formatDeliveryEta(delivery) {
  if (delivery.delivery_deadline_at) {
    const remaining = Math.ceil((new Date(delivery.delivery_deadline_at).getTime() - Date.now()) / 60000);
    if (Number.isFinite(remaining)) return `${Math.max(0, remaining)} min`;
  }

  const estimated = Number(delivery.estimated_minutes);
  if (Number.isFinite(estimated)) return `${Math.max(0, Math.round(estimated))} min`;
  return '--';
}

function mapActiveDelivery(delivery) {
  const started = formatShortDateTime(delivery.created_at);
  const status = deliveryStatusView(delivery.status, delivery.delivery_deadline_at);
  const rawCode = delivery.order_code || String(delivery.id || '').slice(0, 6).toUpperCase();
  return {
    id: delivery.id,
    code: String(rawCode).startsWith('PED-') ? rawCode : `PED-${rawCode}`,
    store: delivery.stores?.fantasy_name || delivery.stores?.name || 'Loja nao informada',
    courier: delivery.couriers?.name || 'Sem motoboy',
    customer: delivery.customers?.name || 'Cliente nao informado',
    district: delivery.delivery_district || 'Bairro nao informado',
    startedDate: started.date,
    startedTime: started.time,
    dateKey: started.dateKey,
    status: status.label,
    tone: status.tone,
    eta: formatDeliveryEta(delivery),
    elapsedMinutes: minutesBetween(delivery.created_at, new Date()),
  };
}

export function ActiveDeliveriesView({ city }) {
  const today = React.useMemo(() => formatDateInputValue(new Date()), []);
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [updatedAt, setUpdatedAt] = React.useState(null);
  const [search, setSearch] = React.useState('');

  const visibleRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.code,
      row.store,
      row.courier,
      row.customer,
      row.district,
      row.status,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [rows, search]);

  const delayedCount = React.useMemo(() => visibleRows.filter((row) => row.tone === 'red').length, [visibleRows]);
  const assignedCount = React.useMemo(() => visibleRows.filter((row) => row.tone === 'green').length, [visibleRows]);

  const loadActiveDeliveries = React.useCallback(async () => {
    const { startIso, endIso, startDate: normalizedStart, endDate: normalizedEnd } = dateRangeToIso(startDate, endDate);
    if (normalizedStart !== startDate) setStartDate(normalizedStart);
    if (normalizedEnd !== endDate) setEndDate(normalizedEnd);

    if (!supabase || !city?.id) {
      setRows([]);
      setMessage(city?.id ? 'Nao foi possivel buscar as entregas em andamento.' : 'Selecione uma cidade para listar as entregas.');
      setUpdatedAt(new Date().toISOString());
      return;
    }

    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('deliveries')
      .select(ACTIVE_DELIVERY_SELECT)
      .eq('city_id', city.id)
      .in('status', ACTIVE_DELIVERY_STATUSES)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true });

    if (error) {
      setRows([]);
      setMessage(`Nao foi possivel buscar as entregas em andamento: ${error.message}`);
    } else {
      const nextRows = (data ?? []).map(mapActiveDelivery);
      setRows(nextRows);
      setMessage(nextRows.length ? '' : 'Nenhuma entrega em andamento no periodo.');
    }

    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, [city?.id, endDate, startDate]);

  React.useEffect(() => {
    loadActiveDeliveries();
  }, [loadActiveDeliveries]);

  return (
    <section className="active-deliveries-page" aria-labelledby="active-deliveries-page-title">
      <section className="revenue-summary active-deliveries-summary">
        <article>
          <span><Package size={22} /></span>
          <p>Em andamento</p>
          <strong>{formatNumber(visibleRows.length)}</strong>
        </article>
        <article>
          <span><MapPin size={22} /></span>
          <p>A caminho da loja</p>
          <strong>{formatNumber(assignedCount)}</strong>
        </article>
        <article>
          <span><Clock3 size={22} /></span>
          <p>Atrasadas</p>
          <strong>{formatNumber(delayedCount)}</strong>
        </article>
      </section>

      <section className="overview-panel active-deliveries-panel">
        <header className="completed-deliveries-header active-deliveries-header">
          <div>
            <span>Entregas</span>
            <h2 id="active-deliveries-page-title">Entregas em andamento</h2>
          </div>
          <button type="button" onClick={loadActiveDeliveries} disabled={loading}>
            <RefreshCcw size={18} />Atualizar
          </button>
        </header>

        <div className="completed-deliveries-filters active-deliveries-filters">
          <label>
            <span>Periodo inicial</span>
            <div>
              <CalendarDays size={20} />
              <strong>{formatDateFilterLabel(startDate)}</strong>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value || today)} aria-label="Periodo inicial" />
              <ChevronRight size={19} />
            </div>
          </label>
          <label>
            <span>Periodo final</span>
            <div>
              <CalendarDays size={20} />
              <strong>{formatDateFilterLabel(endDate)}</strong>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value || today)} aria-label="Periodo final" />
              <ChevronRight size={19} />
            </div>
          </label>
          <label className="active-deliveries-search">
            <span>Busca</span>
            <div>
              <Search size={20} />
              <strong>{search || 'Buscar entrega'}</strong>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar entrega" />
            </div>
          </label>
        </div>

        <div className="completed-deliveries-list" aria-label="Lista de entregas em andamento">
          {visibleRows.map((delivery) => (
            <article key={delivery.id} className="completed-delivery-row active-delivery-modal-row active-deliveries-page-row">
              <span className={`completed-delivery-icon ${delivery.tone}`}><Package size={22} /></span>
              <div className="completed-delivery-main">
                <strong>{delivery.store}</strong>
                <p>
                  <span><Clock3 size={15} />{delivery.startedDate}, {delivery.startedTime}</span>
                  <i />
                  <span><User size={15} />{delivery.customer}</span>
                  <i />
                  <span><MapPin size={15} />{delivery.district}</span>
                </p>
              </div>
              <span className={`active-delivery-status ${delivery.tone}`}>{delivery.status}</span>
              <span className="completed-delivery-code">{delivery.code}</span>
              <ChevronRight className="completed-delivery-arrow" size={24} />
            </article>
          ))}
          {!visibleRows.length && (
            <p className="completed-deliveries-empty">
              {loading ? 'Buscando entregas em andamento...' : message || 'Nenhuma entrega em andamento no periodo.'}
            </p>
          )}
        </div>

        <footer className="completed-deliveries-footer">
          <span><RefreshCcw size={18} />{formatUpdatedLabel(updatedAt)}</span>
          <strong>Total: <b>{visibleRows.length}</b> entregas</strong>
        </footer>
        {message && visibleRows.length > 0 && (
          <p className="completed-deliveries-message">{message}</p>
        )}
      </section>
    </section>
  );
}
