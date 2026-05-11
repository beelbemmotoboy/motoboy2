import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  AlertTriangle,
  Bell,
  Bike,
  CalendarDays,
  Camera,
  ChartNoAxesCombined,
  CircleHelp,
  Clock3,
  Home,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Minus,
  Moon,
  Navigation,
  PencilLine,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Sun,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { LoginView, ForgotPasswordView, CreateAccountView, CreatePasswordView } from './paginas/publico/AuthPublic';
import { AccessView, CitiesView, CourierCenterView, CouriersView, MapOnlyView, Overview, StoreCenterView, StoresView } from './paginas/admin/AdminPages';
import { InicioLojista } from './paginas/lojista/InicioLojista';
import { InicioMotoboy } from './paginas/motoboy/InicioMotoboy';
import { supabase } from './supabaseClient';
import { isValidCep, isValidCnpj, isValidCpf, isValidEmail, isValidPhone, maskCep, maskCnpj, maskCpf, maskPhone, onlyDigits } from './utils/validators';
import beeIcon from '../imagem/icone.png';
import './styles.css';

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
}

function hasSupabaseAuthCallback() {
  const routeHash = window.location.hash.replace(/^#/, '');
  const paramsText = `${window.location.search}&${routeHash}`;
  return [
    'access_token=',
    'refresh_token=',
    'token_hash=',
    'type=invite',
    'type=recovery',
    'type=signup',
    'error=',
    'error_code=',
    'code=',
  ].some((part) => paramsText.includes(part));
}

function pageFromLocation() {
  if (hasSupabaseAuthCallback()) return 'create-password';
  return window.location.hash.replace(/^#/, '') || 'login';
}

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors, usually private mode or full storage.
  }
}

function removeLocalJson(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

function App() {
  const [page, setPageState] = React.useState(pageFromLocation);
  const [authReady, setAuthReady] = React.useState(!supabase);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [currentProfile, setCurrentProfile] = React.useState(null);
  const publicPages = ['login', 'create-password', 'forgot-password', 'create-account', 'join', 'signup-store', 'signup-courier'];
  const currentUserRole = currentProfile?.role;
  const emptyCity = {
    id: '',
    name: 'Nenhuma cidade',
    state: '',
    active: false,
    availableCouriers: 0,
    activeDeliveries: 0,
    pausedCouriers: 0,
    activeStores: 0,
    metrics: ['0', '0', '0', '0%', '0.0'],
  };
  const [cityList, setCityList] = React.useState([]);
  const [storeList, setStoreList] = React.useState([]);
  const [courierList, setCourierList] = React.useState([]);
  const [storeToEdit, setStoreToEdit] = React.useState(null);
  const [courierToEdit, setCourierToEdit] = React.useState(null);
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('beelbem-theme') === 'dark');
  const [cityId, setCityId] = React.useState('');
  const selectedCity = cityList.find((city) => city.id === cityId) ?? cityList[0] ?? emptyCity;
  const selectedStore = storeList.find((store) => store.id === currentProfile?.store_id) ?? storeList[0] ?? null;
  const [cityLoading, setCityLoading] = React.useState(false);
  const [cityError, setCityError] = React.useState('');
  const setPage = (nextPage) => {
    setPageState(nextPage);
    window.location.hash = nextPage;
  };

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;
      localStorage.setItem('beelbem-theme', next ? 'dark' : 'light');
      return next;
    });
  }

  function handleLoginSuccess(user, profile) {
    setCurrentUser(user);
    setCurrentProfile({ ...profile, email: user.email });
    if (profile.role !== 'system_admin' && profile.city_id) {
      setCityId(profile.city_id);
    }
    setPage(resolveHomeByRole(profile.role));
  }

  async function loadCurrentProfile(session) {
    const user = session?.user ?? null;
    setCurrentUser(user);
    if (!user || !supabase) {
      setCurrentProfile(null);
      setAuthReady(true);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, city_id, store_id, courier_id, active')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data || data.active === false) {
      setCurrentProfile(null);
      setAuthReady(true);
      if (data?.active === false) await supabase.auth.signOut();
      return;
    }

    setCurrentProfile({ ...data, email: user.email });
    if (data.role !== 'system_admin' && data.city_id) {
      setCityId(data.city_id);
    }
    setAuthReady(true);
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentProfile(null);
    setPage('login');
  }

  React.useEffect(() => {
    const onHashChange = () => setPageState(pageFromLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  React.useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) loadCurrentProfile(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) loadCurrentProfile(session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!supabase || !authReady) return;
    if (!currentProfile && !publicPages.includes(page)) {
      setPage('login');
    }
    if (currentProfile?.role !== 'store_admin' && page === 'store-home') {
      setPage(resolveHomeByRole(currentProfile.role));
    }
    if (currentProfile?.role !== 'courier_admin' && page === 'courier-home') {
      setPage(resolveHomeByRole(currentProfile.role));
    }
  }, [authReady, currentProfile, page]);

  React.useEffect(() => {
    async function loadCities() {
      if (!supabase || !authReady || !currentProfile) return;
      setCityLoading(true);
      setCityError('');
      setCityList([]);
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, state, slug, active')
        .order('name', { ascending: true });

      setCityLoading(false);
      if (error) {
        setCityError(error.message);
        setCityList([]);
        setCityId('');
        return;
      }

      const mapped = (data ?? []).map((city) => ({
        ...city,
        availableCouriers: 0,
        activeDeliveries: 0,
        pausedCouriers: 0,
        activeStores: 0,
        metrics: ['0', '0', '0', '0%', '0.0'],
      }));
      setCityList(mapped);
      setCityId((current) => {
        if (currentProfile.role !== 'system_admin' && currentProfile.city_id) return currentProfile.city_id;
        if (mapped.some((city) => city.id === current)) return current;
        return mapped[0]?.id ?? '';
      });
    }

    loadCities();
  }, [authReady, currentProfile]);

  React.useEffect(() => {
    async function loadCityRecords() {
      if (!supabase || !authReady || !currentProfile) return;
      setStoreList([]);
      setCourierList([]);
      if (!cityId) return;
      setCityError('');

      const [
        { data: storesData, error: storesError },
        { data: couriersData, error: couriersError },
        { count: activeDeliveriesCount, error: activeDeliveriesError },
        { count: completedDeliveriesCount, error: completedDeliveriesError },
      ] = await Promise.all([
        supabase
          .from('stores')
          .select('id, city_id, name, fantasy_name, document, responsible_name, email, whatsapp, landline, store_type, address, address_number, complement, district, zip_code, latitude, longitude, location_received, opening_hours, allow_manual_order, require_pickup_confirmation, rate_courier_after_delivery, internal_notes, active, logo_url, is_open')
          .eq('city_id', cityId)
          .order('created_at', { ascending: false }),
        supabase
          .from('couriers')
          .select('id, city_id, name, birth_date, cpf, phone, email, face_photo_path, whatsapp_validated, vehicle_type, vehicle_plate, pix_key, pix_key_type, pix_holder_name, vehicle_notes, crlv_file_path, cnh_file_path, cnh_valid_until, internal_notes, approval_status, availability_status, rating, active')
          .eq('city_id', cityId)
          .order('created_at', { ascending: false }),
        supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('city_id', cityId)
          .in('status', ['pending', 'assigned', 'picked_up', 'on_route']),
        supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('city_id', cityId)
          .eq('status', 'delivered'),
      ]);

      const loadErrors = [storesError, couriersError, activeDeliveriesError, completedDeliveriesError]
        .filter(Boolean)
        .map((error) => error.message);
      if (loadErrors.length) {
        setCityError(loadErrors.join(' | '));
      }

      if (!storesError) {
        setStoreList((storesData ?? []).map((store) => ({
          id: store.id,
          cityId: store.city_id,
          name: store.name,
          fantasyName: store.fantasy_name,
          document: store.document,
          responsible: store.responsible_name,
          email: store.email,
          whatsapp: store.whatsapp,
          landline: store.landline,
          type: store.store_type,
          address: store.address,
          number: store.address_number,
          complement: store.complement,
          district: store.district,
          zipCode: store.zip_code,
          latitude: store.latitude ? String(store.latitude) : '',
          longitude: store.longitude ? String(store.longitude) : '',
          locationReceived: store.location_received,
          schedule: store.opening_hours,
          allowManualOrder: store.allow_manual_order ? 'Sim' : 'Nao',
          requirePickupConfirmation: store.require_pickup_confirmation ? 'Sim' : 'Nao',
          rateCourierAfterDelivery: store.rate_courier_after_delivery ? 'Sim' : 'Nao',
          notes: store.internal_notes,
          active: store.active,
          logoUrl: store.logo_url,
          isOpen: store.is_open,
        })));
      }

      if (!couriersError) {
        setCourierList((couriersData ?? []).map((courier) => ({
          id: courier.id,
          cityId: courier.city_id,
          fullName: courier.name,
          birthDate: courier.birth_date ?? '',
          cpf: maskCpf(courier.cpf ?? ''),
          phone: maskPhone(courier.phone ?? ''),
          email: courier.email,
          facePhoto: courier.face_photo_path ?? '',
          crlvFile: courier.crlv_file_path ?? '',
          whatsappValidated: courier.whatsapp_validated,
          vehicle: courier.vehicle_type,
          plate: courier.vehicle_plate,
          pix: courier.pix_key,
          pixType: courier.pix_key_type,
          pixHolder: courier.pix_holder_name,
          vehicleNotes: courier.vehicle_notes ?? '',
          cnhFile: courier.cnh_file_path ?? '',
          cnhValidUntil: courier.cnh_valid_until ?? '',
          notes: courier.internal_notes ?? '',
          status: courier.approval_status,
          availability: courier.availability_status,
          rating: courier.rating,
          active: courier.active,
        })));
      }

      if (!storesError || !couriersError || !activeDeliveriesError || !completedDeliveriesError) {
        setCityList((current) => current.map((city) => (
          city.id === cityId
            ? {
                ...city,
                activeStores: storesError ? city.activeStores : (storesData ?? []).filter((store) => store.active !== false).length,
                availableCouriers: couriersError ? city.availableCouriers : (couriersData ?? []).filter((courier) => courier.active !== false && courier.availability_status === 'available').length,
                pausedCouriers: couriersError ? city.pausedCouriers : (couriersData ?? []).filter((courier) => courier.availability_status === 'paused').length,
                activeDeliveries: activeDeliveriesError ? city.activeDeliveries : activeDeliveriesCount ?? 0,
                metrics: [
                  String((activeDeliveriesCount ?? 0) + (completedDeliveriesCount ?? 0)),
                  String(activeDeliveriesCount ?? 0),
                  String(completedDeliveriesCount ?? 0),
                  completedDeliveriesCount || activeDeliveriesCount
                    ? `${Math.round(((completedDeliveriesCount ?? 0) / ((activeDeliveriesCount ?? 0) + (completedDeliveriesCount ?? 0))) * 100)}%`
                    : '0%',
                  '0.0',
                ],
              }
            : city
        )));
      }
    }

    loadCityRecords();
  }, [authReady, currentProfile, cityId]);

  if (supabase && !authReady) {
    return (
      <main className="loading-page">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <p>Carregando acesso...</p>
      </main>
    );
  }

  if (page === 'login') {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (page === 'forgot-password') {
    return <ForgotPasswordView />;
  }

  if (page === 'create-account') {
    return <CreateAccountView />;
  }

  if (page === 'join') {
    return <JoinView />;
  }

  if (page === 'signup-store') {
    return <PublicSignupView type="store" />;
  }

  if (page === 'signup-courier') {
    return <PublicSignupView type="courier" />;
  }

  if (page === 'create-password') {
    return <CreatePasswordView />;
  }

  if (!supabase) {
    return <AuthUnavailableView />;
  }

  if (supabase && !currentProfile) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (page === 'store-home' && currentProfile?.role === 'store_admin') {
    return <InicioLojista city={selectedCity} store={selectedStore} profile={currentProfile} onLogout={handleLogout} />;
  }

  if (page === 'courier-home' && currentProfile?.role === 'courier_admin') {
    return <InicioMotoboy city={selectedCity} profile={currentProfile} onLogout={handleLogout} />;
  }

  return (
    <div className={`app-shell ${darkMode ? 'dark-mode' : ''}`}>
      <aside className="sidebar">
        <div className="logo brand-logo">
          <img src={beeIcon} alt="" />
          <span>BEELBEM</span>
        </div>
        <nav className="nav-list" aria-label="Menu principal">
          <button className={page === 'overview' ? 'active' : ''} onClick={() => setPage('overview')}><Home size={18} />Visao geral</button>
          <button><WalletCards size={18} />Entregas</button>
          <button className={['couriers', 'courier-center'].includes(page) ? 'active' : ''} onClick={() => setPage('courier-center')}><UserRound size={18} />Entregadores</button>
          <button className={page === 'map' ? 'active' : ''} onClick={() => setPage('map')}><MapPin size={18} />Mapa</button>
          <button className={page === 'cities' ? 'active' : ''} onClick={() => setPage('cities')}><Store size={18} />Cidades</button>
          <button className={page === 'access' ? 'active' : ''} onClick={() => setPage('access')}><ShieldCheck size={18} />Acessos</button>
          <button className={['stores', 'store-center'].includes(page) ? 'active' : ''} onClick={() => setPage('store-center')}><Store size={18} />Lojas</button>
          <button><UsersRound size={18} />Clientes</button>
          <button><ChartNoAxesCombined size={18} />Relatorios</button>
          <button><Settings size={18} />Configuracoes</button>
        </nav>
        <div className="sidebar-footer">
          <a className="help-link" href="#"><CircleHelp size={19} />Ajuda</a>
          {currentProfile && (
            <div className="sidebar-user" title={currentProfile.email}>
              <span>{initials(currentProfile.name || currentProfile.email || 'Usuario')}</span>
              <div>
                <strong>{currentProfile.name}</strong>
                <small>{roleLabel(currentProfile.role)} · {currentProfile.email}</small>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <button className="icon-button" aria-label="Abrir menu"><Menu size={22} /></button>
          <div className="title-group">
            <h1>{pageTitle(page)}</h1>
            <button className="date-filter"><CalendarDays size={17} />Hoje</button>
            {currentUserRole === 'system_admin' ? (
              <label className="city-select">
                <MapPin size={17} />
                <select value={cityId} onChange={(event) => setCityId(event.target.value)}>
                  {cityList.filter((city) => city.active !== false).map((city) => (
                    <option value={city.id} key={city.id}>{city.name} - {city.state}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="city-locked"><MapPin size={17} />{selectedCity.name} - {selectedCity.state}</div>
            )}
          </div>
          {page === 'couriers' && (
            <button className="top-secondary-button top-page-switch" type="button" onClick={() => setPage('courier-center')}>
              <UserRound size={17} />Central do entregador
            </button>
          )}
          {page === 'courier-center' && (
            <button className="top-secondary-button top-page-switch" type="button" onClick={() => setPage('couriers')}>
              <Plus size={17} />Novo entregador
            </button>
          )}
          {page === 'stores' && (
            <button className="top-secondary-button top-page-switch" type="button" onClick={() => setPage('store-center')}>
              <Store size={17} />Central de lojas
            </button>
          )}
          {page === 'store-center' && (
            <button className="top-secondary-button top-page-switch" type="button" onClick={() => setPage('stores')}>
              <Plus size={17} />Nova loja
            </button>
          )}
          <div className="top-actions">
            <button className="icon-button theme-toggle" type="button" onClick={toggleDarkMode} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="icon-button notification" aria-label="Notificacoes"><Bell size={21} /><span>3</span></button>
            <button className="icon-button" type="button" onClick={handleLogout} aria-label="Sair"><LogOut size={20} /></button>
          </div>
        </header>

        {page === 'map' && <MapOnlyView city={selectedCity} couriers={courierList} />}
        {page === 'cities' && (
          <CitiesView
            cities={cityList}
            selectedCityId={cityId}
            onSelectCity={setCityId}
            onChangeCities={setCityList}
            loading={cityLoading}
            error={cityError}
          />
        )}
        {page === 'access' && <AccessView city={selectedCity} stores={storeList} couriers={courierList} />}
        {page === 'stores' && <StoresView city={selectedCity} stores={storeList} onChangeStores={setStoreList} storeToEdit={storeToEdit} onEditLoaded={() => setStoreToEdit(null)} />}
        {page === 'store-center' && <StoreCenterView city={selectedCity} stores={storeList} onChangeStores={setStoreList} onEditStore={(store) => { setStoreToEdit(store); setPage('stores'); }} />}
        {page === 'couriers' && <CouriersView city={selectedCity} cities={cityList} couriers={courierList} onChangeCouriers={setCourierList} courierToEdit={courierToEdit} onEditLoaded={() => setCourierToEdit(null)} />}
        {page === 'courier-center' && <CourierCenterView city={selectedCity} couriers={courierList} onChangeCouriers={setCourierList} onEditCourier={(courier) => { setCourierToEdit(courier); setPage('couriers'); }} />}
        {page === 'store-home' && currentProfile?.role === 'store_admin' && <InicioLojista city={selectedCity} store={selectedStore} profile={currentProfile} onLogout={handleLogout} />}
        {page === 'courier-home' && currentProfile?.role === 'courier_admin' && <InicioMotoboy city={selectedCity} profile={currentProfile} onLogout={handleLogout} />}
        {page === 'overview' && <Overview city={selectedCity} />}
      </main>
    </div>
  );
}

function pageTitle(page) {
  if (page === 'store-home') return 'Inicio lojista';
  if (page === 'courier-home') return 'Inicio motoboy';
  if (page === 'map') return 'Mapa operacional';
  if (page === 'cities') return 'Cidades';
  if (page === 'access') return 'Controle de acesso';
  if (page === 'stores') return 'Cadastro de lojas';
  if (page === 'store-center') return 'Central de lojas';
  if (page === 'couriers') return 'Cadastro de entregadores';
  if (page === 'courier-center') return 'Central do entregador';
  return 'Visao geral';
}

function resolveHomeByRole(role) {
  if (role === 'store_admin') return 'store-home';
  if (role === 'courier_admin') return 'courier-home';
  return 'overview';
}

function roleLabel(role) {
  if (role === 'system_admin') return 'Admin do sistema';
  if (role === 'city_admin') return 'Admin da cidade';
  if (role === 'store_admin') return 'Admin lojista';
  if (role === 'courier_admin') return 'Admin motoboy';
  return 'Usuario';
}

async function functionErrorMessage(error, fallback) {
  if (!error) return fallback;
  const response = error.context;
  if (response?.clone) {
    try {
      const data = await response.clone().json();
      if (data?.error) return data.error;
      if (data?.message) return data.message;
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch {
        // Keep the fallback below.
      }
    }
  }

  if (error.message && !error.message.includes('non-2xx')) return error.message;
  return fallback;
}

function JoinView() {
  return (
    <main className="password-page">
      <section className="password-panel join-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Faça parte!</h1>
        <p>Escolha como deseja se cadastrar. Depois do cadastro aprovado, voce recebera um link para criar sua senha de acesso.</p>
        <div className="join-options">
          <a className="join-card" href="#signup-store">
            <Store size={28} />
            <strong>Sou lojista</strong>
            <span>Cadastro para lojas que querem solicitar entregas.</span>
          </a>
          <a className="join-card" href="#signup-courier">
            <Bike size={30} />
            <strong>Sou motoboy</strong>
            <span>Cadastro para entregadores trabalharem na cidade.</span>
          </a>
        </div>
        <div className="auth-links single">
          <a href="#login">Voltar para login</a>
        </div>
      </section>
    </main>
  );
}

function PublicSignupView({ type }) {
  const isStore = type === 'store';
  const draftKey = `beelbem-public-signup-${type}`;
  const defaultStoreForm = {
    cityId: '',
    document: '',
    name: '',
    fantasyName: '',
    responsible: '',
    email: '',
    whatsapp: '',
    zipCode: '',
    address: '',
    number: '',
    district: '',
    locationReceived: '',
  };
  const defaultCourierForm = {
    cityId: '',
    fullName: '',
    birthDate: '',
    cpf: '',
    phone: '',
    email: '',
    plate: '',
    facePhoto: '',
    crlvFile: '',
    cnhFile: '',
    pix: '',
    pixType: 'CPF',
    pixHolder: '',
  };
  const defaultForm = isStore ? defaultStoreForm : defaultCourierForm;
  const [cities, setCities] = React.useState([]);
  const [loadingCities, setLoadingCities] = React.useState(Boolean(supabase));
  const [submitting, setSubmitting] = React.useState(false);
  const [cnpjLoading, setCnpjLoading] = React.useState(false);
  const [cnpjStatus, setCnpjStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [locationLocked, setLocationLocked] = React.useState(false);
  const [form, setForm] = React.useState(() => readLocalJson(draftKey, defaultForm));

  React.useEffect(() => {
    writeLocalJson(draftKey, form);
  }, [draftKey, form]);

  React.useEffect(() => {
    let mounted = true;

    async function loadPublicCities() {
      if (!supabase) {
        setLoadingCities(false);
        return;
      }

      setLoadingCities(true);
      const { data, error: cityError } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('active', true)
        .order('name', { ascending: true });

      if (!mounted) return;
      setLoadingCities(false);

      if (cityError) {
        setError('Nao foi possivel carregar as cidades cadastradas.');
        return;
      }

      const cityOptions = data ?? [];
      setCities(cityOptions);
      setForm((current) => ({ ...current, cityId: current.cityId || cityOptions[0]?.id || '' }));
    }

    loadPublicCities();
    return () => {
      mounted = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function geolocationErrorMessage(error) {
    if (error?.code === 1) {
      return 'Permissao de localizacao negada. Autorize a localizacao no navegador ou cole o link do Google Maps.';
    }
    if (error?.code === 2) {
      return 'Localizacao indisponivel no momento. Verifique GPS/Wi-Fi/dados moveis ou cole o link do Google Maps.';
    }
    if (error?.code === 3) {
      return 'Tempo esgotado para obter a localizacao. Tente novamente em local aberto ou cole o link do Google Maps.';
    }
    if (!window.isSecureContext) {
      return 'A localizacao exige conexao segura HTTPS. Cole o link do Google Maps manualmente.';
    }
    return 'Nao foi possivel obter a localizacao. Cole o link do mapa manualmente.';
  }

  async function lookupCnpj() {
    if (!isStore) return;
    setError('');
    setCnpjStatus('');
    const cnpj = onlyDigits(form.document);
    if (!isValidCnpj(cnpj)) {
      setError('CNPJ invalido.');
      return;
    }

    setCnpjLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'CNPJ nao encontrado.');
      }

      setForm((current) => ({
        ...current,
        document: maskCnpj(data.cnpj || cnpj),
        name: data.razao_social || current.name,
        fantasyName: data.nome_fantasia || current.fantasyName,
        email: data.email || current.email,
        whatsapp: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : current.whatsapp,
        zipCode: data.cep ? maskCep(data.cep) : current.zipCode,
        address: data.logradouro || current.address,
        number: data.numero || current.number,
        district: data.bairro || current.district,
      }));
      setCnpjStatus('Dados do CNPJ preenchidos.');
    } catch (lookupError) {
      setError(lookupError.message || 'Nao foi possivel consultar o CNPJ agora.');
    } finally {
      setCnpjLoading(false);
    }
  }

  function validatePublicForm() {
    const errors = [];
    if (!form.cityId) errors.push('Selecione a cidade.');
    if (isStore) {
      if (!isValidCnpj(form.document)) errors.push('CNPJ invalido.');
      if (!form.name.trim()) errors.push('Informe o nome da loja.');
      if (!form.responsible.trim()) errors.push('Informe o responsavel.');
      if (!isValidEmail(form.email)) errors.push('E-mail invalido.');
      if (!isValidPhone(form.whatsapp)) errors.push('WhatsApp invalido.');
      if (!isValidCep(form.zipCode)) errors.push('CEP invalido.');
      if (!form.address.trim()) errors.push('Informe o endereco.');
      if (!form.number.trim()) errors.push('Informe o numero.');
      if (!form.district.trim()) errors.push('Informe o bairro.');
      if (!form.locationReceived.trim()) errors.push('Informe ou envie a localizacao da loja.');
    } else {
      if (!form.fullName.trim()) errors.push('Informe o nome completo.');
      if (!form.birthDate) errors.push('Informe a data de nascimento.');
      if (!isValidCpf(form.cpf)) errors.push('CPF invalido.');
      if (!isValidPhone(form.phone)) errors.push('WhatsApp invalido.');
      if (!isValidEmail(form.email)) errors.push('E-mail invalido.');
      if (!form.plate.trim()) errors.push('Informe a placa da moto.');
      if (!form.facePhoto) errors.push('Informe a foto do rosto.');
      if (!form.crlvFile) errors.push('Informe o documento do veiculo CRLV.');
      if (!form.cnhFile) errors.push('Informe a CNH.');
      if (!form.pix.trim()) errors.push('Informe a chave Pix.');
      if (!form.pixHolder.trim()) errors.push('Informe o favorecido do Pix.');
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');

    const errors = validatePublicForm();
    if (errors.length) {
      setError(errors[0]);
      return;
    }

    if (!supabase) {
      setError('Supabase nao configurado. Cadastro bloqueado.');
      return;
    }

    setSubmitting(true);
    const payload = isStore
      ? {
          city_id: form.cityId,
          document: onlyDigits(form.document),
          name: form.name.trim(),
          fantasy_name: form.fantasyName.trim(),
          responsible_name: form.responsible.trim(),
          email: form.email.trim().toLowerCase(),
          whatsapp: onlyDigits(form.whatsapp),
          zip_code: onlyDigits(form.zipCode),
          address: form.address.trim(),
          address_number: form.number.trim(),
          district: form.district.trim(),
          location_received: form.locationReceived.trim(),
          store_type: 'Restaurante',
          internal_notes: 'Pre-cadastro publico. Validar documentos e liberar acesso pelo painel.',
          active: false,
        }
      : {
          city_id: form.cityId,
          name: form.fullName.trim(),
          birth_date: form.birthDate,
          cpf: onlyDigits(form.cpf),
          phone: onlyDigits(form.phone),
          email: form.email.trim().toLowerCase(),
          face_photo_path: form.facePhoto,
          vehicle_type: 'Moto',
          vehicle_plate: form.plate.trim().toUpperCase(),
          crlv_file_path: form.crlvFile,
          cnh_file_path: form.cnhFile,
          pix_key: form.pix.trim(),
          pix_key_type: form.pixType,
          pix_holder_name: form.pixHolder.trim(),
          approval_status: 'pending_approval',
          availability_status: 'offline',
          internal_notes: 'Pre-cadastro publico. Validar documentos e liberar acesso pelo painel.',
          active: false,
          available: false,
        };

    const { error: submitError } = isStore
      ? await supabase.from('stores').insert(payload)
      : await supabase.from('couriers').insert(payload);
    setSubmitting(false);

    if (submitError) {
      setError(await functionErrorMessage(submitError, 'Nao foi possivel enviar o cadastro.'));
      return;
    }

    setStatus(isStore
      ? 'Cadastro da loja enviado. A equipe Beelbem vai analisar e liberar o acesso.'
      : 'Cadastro de motoboy enviado. A equipe Beelbem vai analisar e liberar o acesso.');
    removeLocalJson(draftKey);
  }

  return (
    <main className="password-page public-signup-page">
      <section className="password-panel public-signup-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>{isStore ? 'Cadastro de lojista' : 'Cadastro de motoboy'}</h1>
        <p>{isStore ? 'Informe os dados da loja. O cadastro ficara pendente ate a validacao.' : 'Informe seus dados. O cadastro ficara pendente ate a validacao.'}</p>
        <form onSubmit={handleSubmit}>
          <label>
            Cidade
            <select value={form.cityId} onChange={(event) => updateField('cityId', event.target.value)} disabled={loadingCities}>
              <option value="">{loadingCities ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
              {cities.map((city) => (
                <option value={city.id} key={city.id}>{city.name} - {city.state}</option>
              ))}
            </select>
          </label>

          {isStore ? (
            <>
              <label>
                CNPJ
                <div className="lookup-field">
                  <input
                    value={form.document}
                    onBlur={() => {
                      if (onlyDigits(form.document).length === 14 && !form.name) lookupCnpj();
                    }}
                    onChange={(event) => {
                      setCnpjStatus('');
                      updateField('document', maskCnpj(event.target.value));
                    }}
                    placeholder="00.000.000/0000-00"
                  />
                  <button type="button" onClick={lookupCnpj} disabled={cnpjLoading}>
                    {cnpjLoading ? 'Buscando...' : 'Consultar'}
                  </button>
                </div>
                {cnpjStatus && <span className="field-help success">{cnpjStatus}</span>}
              </label>
              <label>Nome da loja<input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Nome da loja" /></label>
              <label>Nome fantasia<input value={form.fantasyName} onChange={(event) => updateField('fantasyName', event.target.value)} placeholder="Nome conhecido pelo cliente" /></label>
              <label>Responsavel<input value={form.responsible} onChange={(event) => updateField('responsible', event.target.value)} placeholder="Nome do responsavel" /></label>
              <label>E-mail<input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="loja@email.com" /></label>
              <label>WhatsApp<input value={form.whatsapp} onChange={(event) => updateField('whatsapp', maskPhone(event.target.value))} placeholder="(00) 00000-0000" /></label>
              <label>CEP<input value={form.zipCode} onChange={(event) => updateField('zipCode', maskCep(event.target.value))} placeholder="00.000-000" /></label>
              <label>Endereco<input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Rua, avenida..." /></label>
              <label>Numero<input value={form.number} onChange={(event) => updateField('number', event.target.value)} placeholder="Numero" /></label>
              <label>Bairro<input value={form.district} onChange={(event) => updateField('district', event.target.value)} placeholder="Bairro" /></label>
              <label className="wide">
                Localizacao da loja
                <div className="lookup-field">
                  <input
                    value={form.locationReceived}
                    onChange={(event) => {
                      setLocationLocked(false);
                      updateField('locationReceived', event.target.value);
                    }}
                    placeholder="Cole o link do Google Maps ou use o botao ao lado"
                    disabled={locationLocked}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setError('Este navegador nao permite enviar localizacao.');
                        return;
                      }
                      setError('');
                      setLocationLocked(false);
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords;
                          updateField('locationReceived', `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`);
                          setLocationLocked(true);
                        },
                        (geoError) => {
                          setLocationLocked(false);
                          setError(geolocationErrorMessage(geoError));
                        },
                        { enableHighAccuracy: true, timeout: 10000 },
                      );
                    }}
                  >
                    {locationLocked ? 'Localizacao enviada' : 'Enviar localizacao'}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <>
              <label>Nome completo<input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} placeholder="Nome completo" /></label>
              <label>Data de nascimento<input type="date" value={form.birthDate} onChange={(event) => updateField('birthDate', event.target.value)} /></label>
              <label>CPF<input value={form.cpf} onChange={(event) => updateField('cpf', maskCpf(event.target.value))} placeholder="000.000.000-00" /></label>
              <label>WhatsApp<input value={form.phone} onChange={(event) => updateField('phone', maskPhone(event.target.value))} placeholder="(00) 00000-0000" /></label>
              <label>E-mail<input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="motoboy@email.com" /></label>
              <label>Veiculo<input value="Moto" disabled /></label>
              <label>Placa<input value={form.plate} onChange={(event) => updateField('plate', event.target.value)} placeholder="ABC1D23" /></label>
              <label>Foto do rosto<input type="file" accept="image/*" onChange={(event) => updateField('facePhoto', event.target.files?.[0]?.name || '')} /></label>
              <label>Documento do veiculo CRLV<input type="file" accept="image/*,.pdf" onChange={(event) => updateField('crlvFile', event.target.files?.[0]?.name || '')} /></label>
              <label>CNH imagem ou PDF<input type="file" accept="image/*,.pdf" onChange={(event) => updateField('cnhFile', event.target.files?.[0]?.name || '')} /></label>
              <label>Tipo da chave Pix<select value={form.pixType} onChange={(event) => updateField('pixType', event.target.value)}><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Chave aleatoria</option></select></label>
              <label>Chave Pix<input value={form.pix} onChange={(event) => updateField('pix', event.target.value)} placeholder="CPF, e-mail, telefone ou chave" /></label>
              <label>Favorecido Pix<input value={form.pixHolder} onChange={(event) => updateField('pixHolder', event.target.value)} placeholder="Nome de quem recebe o Pix" /></label>
            </>
          )}

          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit" disabled={submitting || Boolean(status)}>
            {submitting ? 'Enviando...' : 'Enviar cadastro'}
          </button>
          <div className="auth-links single">
            <a href="#join">Voltar</a>
            <a href="#login">Ir para login</a>
          </div>
        </form>
      </section>
    </main>
  );
}

function AuthUnavailableView() {
  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Acesso bloqueado</h1>
        <p>O Supabase nao esta configurado nesta instalacao. Por seguranca, nenhuma area interna sera aberta sem autenticacao real.</p>
        <a className="primary-link" href="#login">Voltar para login</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
