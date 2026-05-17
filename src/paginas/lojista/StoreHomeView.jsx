import React from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, Bike, Camera, Clock3, MapPin, Minus, Navigation, PencilLine, Phone, Plus, Search, Store, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { createDeliveryWithQueue } from '../../cadastra_entrega';
import { isValidCep, isValidEmail, isValidPhone, maskCep, maskCnpj, maskPhone, onlyDigits } from '../../utils/validators';
import { LayoutLojista } from '../../layouts/LayoutLojista';

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskDeliveryTime(value) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function StoreHomeView({ city, store, profile, onLogout }) {
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
    estimatedMinutes: '45',
    estimatedTime: '',
    customerLatitude: '',
    customerLongitude: '',
    deliveryFee: '',
  });
  const deliveryStats = [
    { label: 'A caminho da loja', value: '01', tone: 'green', icon: <Bike size={32} /> },
    { label: 'A caminho do cliente', value: '00', tone: 'yellow', icon: <Bike size={32} /> },
    { label: 'Em atraso', value: '00', tone: 'red', icon: <AlertTriangle size={32} /> },
  ];

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
      estimatedMinutes: '45',
      estimatedTime: '',
      customerLatitude: '',
      customerLongitude: '',
      deliveryFee: '',
    });
    setRequestModalOpen(requestMode === 'modal');
    if (requestMode === 'page') setActivePanel('request');
  }

  function closeDeliveryRequest() {
    setRequestModalOpen(false);
    if (activePanel === 'request') setActivePanel('home');
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
    if (!supabase) {
      setRequestMessage('Supabase nao disponivel nesta sessao.');
      return;
    }

    setRequestSaving(true);
    try {
      const { queuedCount } = await createDeliveryWithQueue({ supabase, city, store, requestForm });
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
              <span className="request-input"><Clock3 size={20} /><input inputMode="numeric" maxLength={5} placeholder="00:00" value={requestForm.estimatedTime} onChange={(event) => setRequestForm((current) => ({ ...current, estimatedTime: maskDeliveryTime(event.target.value) }))} /></span>
            </label>
            <label className="request-field">
              <span>Taxa da entrega</span>
              <span className="request-input"><WalletCards size={20} /><input inputMode="decimal" value={requestForm.deliveryFee} onChange={(event) => setRequestForm((current) => ({ ...current, deliveryFee: event.target.value }))} placeholder="18,50" /></span>
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
              <span className="request-input"><Clock3 size={20} /><input inputMode="numeric" value={requestForm.estimatedMinutes} onChange={(event) => setRequestForm((current) => ({ ...current, estimatedMinutes: event.target.value }))} /></span>
            </label>
            <label className="request-field">
              <span>Latitude do cliente (opcional)</span>
              <span className="request-input"><MapPin size={20} /><input inputMode="decimal" value={requestForm.customerLatitude} onChange={(event) => setRequestForm((current) => ({ ...current, customerLatitude: event.target.value }))} /></span>
            </label>
            <label className="request-field">
              <span>Longitude do cliente (opcional)</span>
              <span className="request-input"><MapPin size={20} /><input inputMode="decimal" value={requestForm.customerLongitude} onChange={(event) => setRequestForm((current) => ({ ...current, customerLongitude: event.target.value }))} /></span>
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
      {statusMessage && <p className={`store-status-message ${statusMessage.startsWith('Nao') ? 'error' : 'success'}`}>{statusMessage}</p>}

      <section className="store-status-grid" aria-label="Resumo das entregas">
        {deliveryStats.map((item) => (
          <article className={`store-status-card ${item.tone}`} key={item.label}>
            <div className="store-status-card-top">
              <div className="store-status-icon">{item.icon}</div>
              <p>{item.label}</p>
            </div>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

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
        <button className="store-request-card photo" type="button" onClick={() => openDeliveryRequest('modal')}>
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
