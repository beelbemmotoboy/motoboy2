import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Bike,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Home,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Navigation,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  Store,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { supabase, supabaseConfigStatus } from './supabaseClient';
import { maskCep, maskCnpj, maskCpf, maskPhone, onlyDigits, passwordStrength, validateAccessUserForm, validateCourierForm, validateStoreForm } from './utils/validators';
import loginLogo from '../imagem/logo.png';
import beeIcon from '../imagem/icone.png';
import './styles.css';

const metrics = [
  { label: 'Entregas hoje', value: '128', detail: '12% vs ontem' },
  { label: 'Em andamento', value: '42', detail: 'Agora' },
  { label: 'Entregas concluidas', value: '86', detail: '8% vs ontem' },
  { label: 'Taxa de sucesso', value: '98%', detail: '2% vs ontem' },
  { label: 'Avaliacao media', value: '4.9', detail: '0,1 vs ontem', rating: true },
];

const accessProfiles = [
  {
    role: 'Admin do sistema',
    scope: 'Todas as cidades',
    permissions: 'Configura cidades, admins, lojas, motoboys, entregas e relatorios gerais.',
    badge: 'Sistema',
  },
  {
    role: 'Admin da cidade',
    scope: 'Somente cidade vinculada',
    permissions: 'Gerencia lojas, motoboys, entregas, usuarios e relatorios da propria cidade.',
    badge: 'Cidade',
  },
  {
    role: 'Admin lojista',
    scope: 'Somente loja vinculada',
    permissions: 'Cria novas entregas e visualiza pedidos, taxas e historico apenas da sua loja.',
    badge: 'Loja',
  },
  {
    role: 'Admin motoboy',
    scope: 'Proprio cadastro + lojas da cidade',
    permissions: 'Visualiza seus dados, entregas, repasses e todas as lojas ativas da cidade onde trabalha.',
    badge: 'Motoboy',
  },
];

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

function App() {
  const [page, setPageState] = React.useState(pageFromLocation);
  const [authReady, setAuthReady] = React.useState(!supabase);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [currentProfile, setCurrentProfile] = React.useState(null);
  const publicPages = ['login', 'create-password', 'forgot-password', 'create-account'];
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
  const [cityId, setCityId] = React.useState('');
  const selectedCity = cityList.find((city) => city.id === cityId) ?? cityList[0] ?? emptyCity;
  const [cityLoading, setCityLoading] = React.useState(false);
  const [cityError, setCityError] = React.useState('');
  const setPage = (nextPage) => {
    setPageState(nextPage);
    window.location.hash = nextPage;
  };

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
          .select('id, city_id, name, fantasy_name, document, responsible_name, email, whatsapp, store_type, address, address_number, district, active')
          .eq('city_id', cityId)
          .order('created_at', { ascending: false }),
        supabase
          .from('couriers')
          .select('id, city_id, name, birth_date, cpf, phone, email, face_photo_path, whatsapp_validated, vehicle_type, vehicle_plate, pix_key, pix_key_type, pix_holder_name, vehicle_notes, cnh_file_path, cnh_valid_until, internal_notes, approval_status, availability_status, rating, active')
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
          type: store.store_type,
          address: store.address,
          number: store.address_number,
          district: store.district,
          active: store.active,
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
          whatsappCode: courier.whatsapp_validated ? '000000' : '',
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
    return <LoginView />;
  }

  if (page === 'forgot-password') {
    return <ForgotPasswordView />;
  }

  if (page === 'create-account') {
    return <CreateAccountView />;
  }

  if (page === 'create-password') {
    return <CreatePasswordView />;
  }

  if (!supabase) {
    return <AuthUnavailableView />;
  }

  if (supabase && !currentProfile) {
    return <LoginView />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo brand-logo">
          <img src={beeIcon} alt="" />
          <span>BEELBEM</span>
        </div>
        <nav className="nav-list" aria-label="Menu principal">
          <button className={page === 'overview' ? 'active' : ''} onClick={() => setPage('overview')}><Home size={18} />Visao geral</button>
          <button><WalletCards size={18} />Entregas</button>
          <button className={page === 'couriers' ? 'active' : ''} onClick={() => setPage('couriers')}><UserRound size={18} />Entregadores</button>
          <button className={page === 'map' ? 'active' : ''} onClick={() => setPage('map')}><MapPin size={18} />Mapa</button>
          <button className={page === 'cities' ? 'active' : ''} onClick={() => setPage('cities')}><Store size={18} />Cidades</button>
          <button className={page === 'access' ? 'active' : ''} onClick={() => setPage('access')}><ShieldCheck size={18} />Acessos</button>
          <button className={page === 'stores' ? 'active' : ''} onClick={() => setPage('stores')}><Store size={18} />Lojas</button>
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
          <div className="top-actions">
            {currentProfile && (
              <div className="user-chip" title={currentProfile.email}>
                <span>{initials(currentProfile.name || currentProfile.email || 'Usuario')}</span>
                <strong>{currentProfile.name}</strong>
              </div>
            )}
            <button className="icon-button notification" aria-label="Notificacoes"><Bell size={21} /><span>3</span></button>
            <button className="create-button" aria-label="Nova entrega"><Plus size={22} /></button>
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
        {page === 'stores' && <StoresView city={selectedCity} stores={storeList} onChangeStores={setStoreList} />}
        {page === 'couriers' && <CouriersView city={selectedCity} cities={cityList} couriers={courierList} onChangeCouriers={setCourierList} />}
        {page === 'store-home' && <StoreHomeView city={selectedCity} />}
        {page === 'courier-home' && <CourierHomeView city={selectedCity} />}
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
  if (page === 'couriers') return 'Cadastro de entregadores';
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

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function PasswordInput({ label, value, onChange, placeholder, canCopy = false, autoComplete = 'new-password' }) {
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function copyPassword() {
    if (!value) return;
    try {
      setCopied(await copyText(String(value)));
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <label>
      {label}
      <div className="password-input-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        {canCopy && (
          <button type="button" onClick={copyPassword} aria-label="Copiar senha">
            <Copy size={17} />
          </button>
        )}
      </div>
      {canCopy && copied && <span className="field-help">Senha copiada.</span>}
    </label>
  );
}

function LoginView() {
  const savedLogin = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('beelbem.rememberLogin') || '{}');
    } catch {
      return {};
    }
  }, []);
  const [form, setForm] = React.useState({
    email: savedLogin.email || '',
    password: savedLogin.password || '',
    remember: Boolean(savedLogin.remember),
  });
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) {
      setError('Informe e-mail e senha.');
      return;
    }

    if (!supabase) {
      const missing = [
        !supabaseConfigStatus.hasUrl ? 'VITE_SUPABASE_URL' : '',
        !supabaseConfigStatus.hasAnonKey ? 'VITE_SUPABASE_ANON_KEY' : '',
      ].filter(Boolean).join(' e ');
      setError(`Supabase nao configurado. Falta ${missing} no Vercel.`);
      return;
    }

    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);

    if (signInError) {
      const message = (signInError.message || '').toLowerCase();
      if (message.includes('invalid login credentials')) {
        setError('E-mail ou senha incorretos. Verifique os dados e tente novamente.');
      } else if (message.includes('email not confirmed')) {
        setError('Este e-mail ainda nao foi confirmado. Verifique sua caixa de entrada.');
      } else {
        setError('Nao foi possivel fazer login agora. Tente novamente em alguns instantes.');
      }
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, city_id, store_id, courier_id, active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      setError('Login validado, mas nao foi possivel consultar seu perfil de acesso.');
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();
      setError('Usuario autenticado, mas sem perfil cadastrado no sistema. Peça ao administrador para liberar seu acesso.');
      return;
    }

    if (profile?.active === false) {
      await supabase.auth.signOut();
      setError('Usuario inativo. Entre em contato com o administrador.');
      return;
    }

    if (form.remember) {
      localStorage.setItem('beelbem.rememberLogin', JSON.stringify({
        remember: true,
        email: form.email.trim(),
        password: form.password,
      }));
    } else {
      localStorage.removeItem('beelbem.rememberLogin');
    }

    window.location.hash = `#${resolveHomeByRole(profile?.role)}`;
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Beelbem Delivery">
        <img src={loginLogo} alt="Beelbem Delivery" />
      </section>
      <section className="login-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Seja bem vindo!</h1>
        <p>Rapido, seguro e brasileiro.</p>
        <form onSubmit={handleLogin}>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="voce@empresa.com"
              autoComplete="email"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </label>
          <label className="remember-login">
            <span>Manter e-mail e senha neste computador</span>
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))}
            />
          </label>
          {error && <p className="field-error">{error}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="auth-links">
            <a href="#forgot-password">Esqueci minha senha</a>
            <a href="#create-account">Criar conta Ramon</a>
          </div>
        </form>
      </section>
    </main>
  );
}

function ForgotPasswordView() {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }
    if (!supabase) {
      setError('Supabase nao configurado. Redefinicao bloqueada.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/#create-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message || 'Nao foi possivel enviar o link.');
      return;
    }
    setStatus('Enviamos um link de redefinicao para o e-mail informado.');
  }

  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Redefinir senha</h1>
        <p>Informe o e-mail cadastrado. O Supabase enviara um link seguro para criar uma nova senha.</p>
        <form onSubmit={handleSubmit}>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com"
            />
          </label>
          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
          <div className="auth-links single">
            <a href="#login">Voltar para login</a>
          </div>
        </form>
      </section>
    </main>
  );
}

function CreateAccountView() {
  const [form, setForm] = React.useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const strength = passwordStrength(form.password);
  const passwordsMatch = form.password && form.password === form.confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Informe nome e e-mail.');
      return;
    }
    if (!strength.valid) {
      setError('A senha ainda nao atende aos requisitos de seguranca.');
      return;
    }
    if (!passwordsMatch) {
      setError('A confirmacao da senha nao confere.');
      return;
    }
    if (!supabase) {
      setError('Supabase nao configurado. Criacao de conta bloqueada.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name.trim() },
        emailRedirectTo: `${window.location.origin}/#login`,
      },
    });
    setLoading(false);

    if (signUpError) {
      const message = signUpError.message || '';
      if (message.toLowerCase().includes('confirmation email')) {
        setError('O Supabase nao conseguiu enviar o e-mail de confirmacao. Use o cadastro pelo administrador em Acessos ou configure o SMTP do Supabase.');
      } else {
        setError(message || 'Nao foi possivel criar a conta.');
      }
      return;
    }

    setStatus('Conta criada no Auth. Agora o administrador precisa liberar seu perfil de acesso.');
    setForm({ name: '', email: '', password: '', confirmPassword: '' });
  }

  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Criar conta</h1>
        <p>Crie o acesso inicial. A entrada no sistema so sera liberada depois que um administrador vincular seu perfil.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Nome
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Seu nome"
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="voce@empresa.com"
            />
          </label>
          <PasswordInput
            label="Senha"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Digite uma senha forte"
            canCopy
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirmar senha"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Repita a senha"
            autoComplete="new-password"
          />
          <div className="password-rules">
            <span className={strength.checks.length ? 'ok' : ''}>6 caracteres ou mais</span>
            <span className={strength.checks.upper ? 'ok' : ''}>Letra maiuscula</span>
            <span className={strength.checks.lower ? 'ok' : ''}>Letra minuscula</span>
            <span className={strength.checks.symbol ? 'ok' : ''}>Simbolo</span>
            <span className={passwordsMatch ? 'ok' : ''}>Confirmacao igual</span>
          </div>
          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
          <div className="auth-links single">
            <a href="#login">Voltar para login</a>
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

function StoreHomeView({ city }) {
  return (
    <section className="role-home">
      <article className="role-welcome">
        <span>Lojista</span>
        <h2>Pedidos da sua loja</h2>
        <p>Crie novas entregas e acompanhe apenas os pedidos, taxas e historico da sua loja em {city.name}.</p>
      </article>
      <div className="availability-grid">
        <article className="availability-card"><p>Entregas hoje</p><strong>12</strong></article>
        <article className="availability-card"><p>Em andamento</p><strong>3</strong></article>
        <article className="availability-card"><p>Concluidas</p><strong>9</strong></article>
        <article className="availability-card"><p>Total em taxas</p><strong>R$ 148</strong></article>
      </div>
    </section>
  );
}

function CourierHomeView({ city }) {
  return (
    <section className="role-home">
      <article className="role-welcome">
        <span>Motoboy</span>
        <h2>Minha operacao</h2>
        <p>Veja seus dados, entregas, repasses e as lojas ativas da cidade onde voce trabalha: {city.name}.</p>
      </article>
      <div className="availability-grid">
        <article className="availability-card"><p>Status</p><strong>Disponivel</strong></article>
        <article className="availability-card"><p>Entregas hoje</p><strong>7</strong></article>
        <article className="availability-card"><p>Repasses</p><strong>R$ 92</strong></article>
        <article className="availability-card"><p>Lojas da cidade</p><strong>{city.activeStores ?? 0}</strong></article>
      </div>
    </section>
  );
}

function slugifyCity(name, state) {
  return `${name}-${state}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function CreatePasswordView() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const strength = passwordStrength(password);
  const passwordsMatch = password && password === confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');

    if (!strength.valid) {
      setError('A senha ainda nao atende aos requisitos de seguranca.');
      return;
    }
    if (!passwordsMatch) {
      setError('A confirmacao da senha nao confere.');
      return;
    }
    if (!supabase) {
      setStatus('Senha validada. Configure o Supabase para salvar a senha no Auth.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || 'Link expirado ou invalido. Solicite um novo convite.');
      return;
    }

    await supabase.functions.invoke('complete-password-setup');
    setStatus('Senha criada com sucesso. Agora voce ja pode acessar o sistema.');
  }

  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Criar senha</h1>
        <p>Este link de confirmacao expira em 1 hora. Use uma senha forte para proteger sua conta.</p>
        <form onSubmit={handleSubmit}>
          <PasswordInput
            label="Nova senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite uma senha forte"
            canCopy
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirmar senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a senha"
            autoComplete="new-password"
          />
          <div className="password-rules">
            <span className={strength.checks.length ? 'ok' : ''}>6 caracteres ou mais</span>
            <span className={strength.checks.upper ? 'ok' : ''}>Letra maiuscula</span>
            <span className={strength.checks.lower ? 'ok' : ''}>Letra minuscula</span>
            <span className={strength.checks.symbol ? 'ok' : ''}>Simbolo</span>
            <span className={passwordsMatch ? 'ok' : ''}>Confirmacao igual</span>
          </div>
          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit">Salvar senha</button>
        </form>
      </section>
    </main>
  );
}

function Overview({ city }) {
  const cityMetrics = metrics.map((metric, index) => ({ ...metric, value: city.metrics[index] }));
  const cityDeliveries = [];
  const cityCompleted = [];
  const cityActivity = [];

  return (
    <>
      <section className="metrics-grid" aria-label="Indicadores">
        {cityMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}{metric.rating && <Star className="star" size={18} fill="currentColor" />}</strong>
            <span>▲ {metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="work-grid">
        <div className="panel active-deliveries">
          <div className="panel-header">
            <h2>Entregas em andamento</h2>
            <button>Ver todas</button>
          </div>
          {cityDeliveries.map((delivery) => (
            <article className="delivery-row" key={delivery.order}>
              <div className="avatar">{initials(delivery.courier)}</div>
              <div className="delivery-main">
                <strong>
                  {delivery.courier}
                  <span><Star size={15} fill="currentColor" />{delivery.rating}</span>
                  <mark className={delivery.status === 'Saiu da loja' ? 'amber' : ''}>{delivery.status}</mark>
                </strong>
                <p>{delivery.store} · Pedido {delivery.order}</p>
                <p>{delivery.address}</p>
              </div>
              <div className="delivery-meta">
                <span>{delivery.eta}</span>
                <span>{delivery.distance}</span>
              </div>
            </article>
          ))}
        </div>

        <DeliveryMap />

        <aside className="side-column">
          <div className="panel">
            <h2>Desempenho dos entregadores</h2>
            {cityDeliveries.map((item) => (
              <div className="ranking-row" key={item.courier}>
                <div className="avatar small">{initials(item.courier)}</div>
                <strong>{item.courier}</strong>
                <span><Star size={15} fill="currentColor" />{item.rating}</span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Atividade recente</h2>
            {cityActivity.map(([, order, status, time, color]) => (
              <div className="activity-row" key={order}>
                <div className={`activity-dot ${color}`}><Clock3 size={14} /></div>
                <div>
                  <strong>Pedido {order}</strong>
                  <p className={color}>{status} · {time}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <h2>Entregas concluidas</h2>
          <button>Ver todas</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Loja</th>
                <th>Entregador</th>
                <th>Entregue em</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {cityCompleted.map((row) => (
                <tr key={row[1]}>
                  {row.slice(1).map((cell) => <td key={cell}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CitiesView({ cities, selectedCityId, onSelectCity, onChangeCities, loading, error }) {
  const [form, setForm] = React.useState({ name: '', state: 'GO' });
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setLocalError('');
    const name = form.name.trim();
    const state = form.state.trim().toUpperCase();
    if (!name || !state) return;

    const newCity = {
      id: slugifyCity(name, state),
      name,
      state,
      active: true,
      availableCouriers: 0,
      activeDeliveries: 0,
      pausedCouriers: 0,
      activeStores: 0,
      metrics: ['0', '0', '0', '0%', '0.0'],
    };

    if (supabase) {
      setSaving(true);
      const { data, error: insertError } = await supabase
        .from('cities')
        .insert({ name, state, slug: newCity.id, active: true })
        .select('id, name, state, slug, active')
        .single();
      setSaving(false);

      if (insertError) {
        setLocalError(insertError.message);
        return;
      }

      const cityFromDb = {
        ...data,
        availableCouriers: 0,
        activeDeliveries: 0,
        pausedCouriers: 0,
        activeStores: 0,
        metrics: ['0', '0', '0', '0%', '0.0'],
      };
      onChangeCities((current) => [...current, cityFromDb]);
      onSelectCity(cityFromDb.id);
      setForm({ name: '', state });
      setMessage('Cidade cadastrada no Supabase.');
      return;
    }

    onChangeCities((current) => {
      if (current.some((city) => city.id === newCity.id)) return current;
      return [...current, newCity];
    });
    onSelectCity(newCity.id);
    setForm({ name: '', state });
  }

  async function toggleCity(cityId) {
    setMessage('');
    setLocalError('');
    const city = cities.find((item) => item.id === cityId);
    if (!city) return;
    const nextActive = city.active === false;

    if (supabase) {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('cities')
        .update({ active: nextActive })
        .eq('id', cityId);
      setSaving(false);

      if (updateError) {
        setLocalError(updateError.message);
        return;
      }
    }

    onChangeCities((current) =>
      current.map((city) =>
        city.id === cityId ? { ...city, active: city.active === false } : city,
      ),
    );
    if (city?.active !== false && cityId === selectedCityId) {
      const fallback = cities.find((item) => item.id !== cityId && item.active !== false);
      if (fallback) onSelectCity(fallback.id);
    }
    setMessage(nextActive ? 'Cidade ativada.' : 'Cidade desativada.');
  }

  return (
    <section className="cities-layout">
      <form className="panel city-form" onSubmit={handleSubmit}>
        <h2>Nova cidade</h2>
        <div className="form-grid">
          <label>
            Cidade
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Rio Verde"
            />
          </label>
          <label>
            UF
            <input
              value={form.state}
              maxLength={2}
              onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
              placeholder="GO"
            />
          </label>
        </div>
        <button className="primary-action" type="submit"><Plus size={18} />Cadastrar cidade</button>
        {saving && <p className="form-note">Salvando...</p>}
        {(error || localError) && <p className="field-error">{error || localError}</p>}
        {message && <p className="success-message">{message}</p>}
        <p className="form-note">Todos os proximos cadastros usam a cidade selecionada como chave estrangeira.</p>
      </form>

      <div className="panel cities-panel">
        <div className="panel-header">
          <h2>Cidades cadastradas</h2>
          <span className="count-pill">{cities.length} cidades</span>
        </div>
        {loading && <p className="form-note">Carregando cidades do Supabase...</p>}
        <div className="city-list">
          {!loading && cities.length === 0 && (
            <p className="empty-state">Nenhuma cidade cadastrada no Supabase.</p>
          )}
          {cities.map((city) => (
            <article className={`city-row ${city.id === selectedCityId ? 'selected' : ''}`} key={city.id}>
              <button type="button" onClick={() => onSelectCity(city.id)} disabled={city.active === false}>
                <strong>{city.name}</strong>
                <span>{city.state} · {city.active === false ? 'Inativa' : 'Ativa'}</span>
              </button>
              <div className="city-stats">
                <span>{city.activeStores} lojas</span>
                <span>{city.availableCouriers} motoboys</span>
                <span>{city.activeDeliveries} entregas</span>
              </div>
              <button className="toggle-button" type="button" onClick={() => toggleCity(city.id)}>
                {city.active === false ? 'Ativar' : 'Desativar'}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessView({ city, stores, couriers }) {
  const [users, setUsers] = React.useState([]);
  const [typeFilter, setTypeFilter] = React.useState('Todos');
  const [accessErrors, setAccessErrors] = React.useState({});
  const [usersLoadError, setUsersLoadError] = React.useState('');
  const [inviteMessage, setInviteMessage] = React.useState('');
  const [editingUser, setEditingUser] = React.useState(null);
  const [savingAccess, setSavingAccess] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    cpf: '',
    whatsapp: '',
    addressProof: '',
    active: true,
    role: 'city_admin',
    store: stores[0]?.id ?? '',
    courier: couriers[0]?.id ?? '',
  });

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      store: editingUser ? current.store : stores[0]?.id ?? '',
      courier: editingUser ? current.courier : couriers[0]?.id ?? '',
    }));
  }, [city.id, stores, couriers, editingUser]);

  React.useEffect(() => {
    async function loadUsers() {
      if (!supabase) return;
      setUsersLoadError('');
      let { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, cpf, whatsapp, address_proof_path, role, city_id, store_id, courier_id, active')
        .order('created_at', { ascending: false });

      if (error && (error.message || '').includes('email')) {
        const fallback = await supabase
          .from('profiles')
          .select('id, name, cpf, whatsapp, address_proof_path, role, city_id, store_id, courier_id, active')
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
        if (!error) {
          setUsersLoadError('A coluna profiles.email ainda nao existe no Supabase. Rode o schema.sql atualizado para sincronizar o e-mail do Auth.');
        }
      }

      if (error) {
        setUsers([]);
        setUsersLoadError(error.message);
        return;
      }

      setUsers((data ?? []).map((profile) => ({
        id: profile.id,
        type: typeLabel(profile.role),
        name: profile.name,
        email: profile.email || 'E-mail nao sincronizado',
        role: profile.role,
        profileLabel: accessLabel(profile.role),
        scope: profile.role === 'system_admin' ? 'Todas' : city.name,
        cityId: profile.city_id,
        storeId: profile.store_id,
        courierId: profile.courier_id,
        cpf: maskCpf(profile.cpf ?? ''),
        whatsapp: maskPhone(profile.whatsapp ?? ''),
        addressProof: profile.address_proof_path ?? '',
        active: profile.active,
        status: profile.active ? 'Ativo' : 'Inativo',
      })));
    }

    loadUsers();
  }, [city.id]);

  function accessLabel(role) {
    if (role === 'system_admin') return 'Admin do sistema';
    if (role === 'city_admin') return 'Admin da cidade';
    if (role === 'store_admin') return 'Admin lojista';
    return 'Admin motoboy';
  }

  function typeLabel(role) {
    if (role === 'system_admin') return 'Sistema';
    if (role === 'city_admin') return 'Cidade';
    if (role === 'store_admin') return 'Loja';
    return 'Motoboy';
  }

  function scopeLabel() {
    if (form.role === 'system_admin') return 'Todas';
    if (form.role === 'store_admin') return `${city.name} / ${stores.find((store) => store.id === form.store)?.name ?? 'Loja'}`;
    if (form.role === 'courier_admin') return `${city.name} / ${couriers.find((courier) => courier.id === form.courier)?.fullName ?? 'Motoboy'}`;
    return city.name;
  }

  function resetAccessForm() {
    setEditingUser(null);
    setForm((current) => ({
      ...current,
      name: '',
      email: '',
      cpf: '',
      whatsapp: '',
      addressProof: '',
      active: true,
      role: 'city_admin',
      store: stores[0]?.id ?? '',
      courier: couriers[0]?.id ?? '',
    }));
  }

  function editUser(user) {
    setAccessErrors({});
    setInviteMessage('');
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email === 'E-mail nao sincronizado' ? '' : user.email,
      cpf: user.cpf,
      whatsapp: user.whatsapp,
      addressProof: user.addressProof,
      active: user.active,
      role: user.role,
      store: user.storeId ?? '',
      courier: user.courierId ?? '',
    });
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(`Excluir o acesso de ${user.name}? Isso remove o usuario do Auth e da tabela profiles.`);
    if (!confirmed) return;

    setAccessErrors({});
    setInviteMessage('');
    setSavingAccess(true);
    const { data, error } = await supabase.functions.invoke('manage-access-user', {
      body: { action: 'delete', profileId: user.id },
    });
    setSavingAccess(false);

    if (error) {
      setAccessErrors({ form: await functionErrorMessage(error, 'Nao foi possivel excluir o usuario.') });
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== user.id));
    if (editingUser?.id === user.id) resetAccessForm();
    setInviteMessage(data?.warning || 'Usuario excluido do Supabase Auth e do perfil de acesso.');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = editingUser
      ? {
          ...(!form.name.trim() ? { name: 'Nome e obrigatorio.' } : {}),
          ...(form.cpf && onlyDigits(form.cpf).length !== 11 ? { cpf: 'CPF invalido.' } : {}),
          ...(form.whatsapp && ![10, 11].includes(onlyDigits(form.whatsapp).length) ? { whatsapp: 'WhatsApp invalido.' } : {}),
        }
      : validateAccessUserForm(form);
    setAccessErrors(validationErrors);
    setInviteMessage('');
    if (Object.keys(validationErrors).length) return;

    if (editingUser) {
      setSavingAccess(true);
      const { error } = await supabase.functions.invoke('manage-access-user', {
        body: {
          action: 'update',
          profileId: editingUser.id,
          updates: {
            name: form.name.trim(),
            cpf: onlyDigits(form.cpf),
            whatsapp: onlyDigits(form.whatsapp),
            address_proof_path: form.addressProof,
            active: form.active,
          },
        },
      });
      setSavingAccess(false);

      if (error) {
        setAccessErrors({ form: await functionErrorMessage(error, 'Nao foi possivel atualizar o usuario.') });
        return;
      }

      setUsers((current) => current.map((user) => (
        user.id === editingUser.id
          ? {
              ...user,
              name: form.name.trim(),
              cpf: form.cpf,
              whatsapp: form.whatsapp,
              addressProof: form.addressProof,
              active: form.active,
              status: form.active ? 'Ativo' : 'Inativo',
            }
          : user
      )));
      setInviteMessage('Usuario atualizado no profile e no Auth.');
      resetAccessForm();
      return;
    }

    let inviteResult = null;
    if (supabase) {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        cpf: onlyDigits(form.cpf),
        whatsapp: onlyDigits(form.whatsapp),
        address_proof_path: form.addressProof,
        role: form.role,
        city_id: form.role === 'system_admin' ? null : city.id,
        store_id: form.role === 'store_admin' ? form.store : null,
        courier_id: form.role === 'courier_admin' ? form.courier : null,
        user_active: form.active,
        status: 'pending',
      };
      const { data: invite, error } = await supabase
        .from('access_invites')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        setAccessErrors({ form: error.message });
        return;
      }

      const { data: sentInvite, error: inviteError } = await supabase.functions.invoke('send-access-invite', {
        body: { inviteId: invite.id },
      });
      inviteResult = sentInvite;

      if (inviteError) {
        setAccessErrors({
          form: await functionErrorMessage(inviteError, 'Convite criado, mas nao foi possivel enviar o e-mail.'),
        });
        return;
      }
    } else {
      setAccessErrors({ form: 'Supabase nao configurado. Nao foi possivel enviar o e-mail de convite.' });
      return;
    }

    setUsers((current) => [{
      id: inviteResult?.authUserId ?? form.email.trim(),
      type: typeLabel(form.role),
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      profileLabel: accessLabel(form.role),
      scope: scopeLabel(),
      cityId: form.role === 'system_admin' ? null : city.id,
      storeId: form.role === 'store_admin' ? form.store : null,
      courierId: form.role === 'courier_admin' ? form.courier : null,
      cpf: form.cpf,
      whatsapp: form.whatsapp,
      addressProof: form.addressProof,
      active: form.active,
      status: form.active ? 'Ativo' : 'Inativo',
    }, ...current]);
    setInviteMessage(
      inviteResult?.linkType === 'existing_user'
        ? 'Usuario ja existia no Auth. Perfil de acesso vinculado sem enviar novo e-mail.'
        : inviteResult?.setupLink
          ? 'Usuario criado no Auth. Link de criacao de senha copiado para a area de transferencia.'
          : 'Cadastro validado. Perfil de acesso vinculado.',
    );
    if (inviteResult?.setupLink) await copyText(inviteResult.setupLink);
    resetAccessForm();
  }

  const visibleUsers = typeFilter === 'Todos' ? users : users.filter((user) => user.type === typeFilter);

  return (
    <section className="access-layout">
      <form className="panel user-form" onSubmit={handleSubmit}>
        <div className="panel-header">
          <h2>{editingUser ? 'Editar usuario' : 'Cadastrar usuario'}</h2>
          <span className="count-pill">{editingUser ? 'Auth vinculado' : 'Convite'}</span>
        </div>
        <div className="user-form-grid">
          <label>
            Nome
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome do usuario"
            />
            {accessErrors.name && <span className="field-error">{accessErrors.name}</span>}
          </label>
          <label>
            E-mail
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="email@empresa.com"
              type="email"
              disabled={Boolean(editingUser)}
            />
            {editingUser && <span className="field-help">E-mail vem do Supabase Auth e fica apenas para exibicao.</span>}
            {accessErrors.email && <span className="field-error">{accessErrors.email}</span>}
          </label>
          <label>
            CPF
            <input
              value={form.cpf}
              onChange={(event) => setForm((current) => ({ ...current, cpf: maskCpf(event.target.value) }))}
              placeholder="000.000.000-00"
            />
            {accessErrors.cpf && <span className="field-error">{accessErrors.cpf}</span>}
          </label>
          <label>
            WhatsApp
            <input
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: maskPhone(event.target.value) }))}
              placeholder="(00) 00000-0000"
            />
            {accessErrors.whatsapp && <span className="field-error">{accessErrors.whatsapp}</span>}
          </label>
          <label>
            Perfil
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} disabled={Boolean(editingUser)}>
              <option value="system_admin">Admin do sistema</option>
              <option value="city_admin">Admin da cidade</option>
              <option value="store_admin">Admin lojista</option>
              <option value="courier_admin">Admin motoboy</option>
            </select>
          </label>
          <label>
            Cidade
            <input value={form.role === 'system_admin' ? 'Todas as cidades' : city.name} disabled />
          </label>
          {form.role === 'store_admin' && (
            <label>
              Loja
              <select value={form.store} onChange={(event) => setForm((current) => ({ ...current, store: event.target.value }))}>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
              {accessErrors.store && <span className="field-error">{accessErrors.store}</span>}
            </label>
          )}
          {form.role === 'courier_admin' && (
            <label>
              Motoboy
              <select value={form.courier} onChange={(event) => setForm((current) => ({ ...current, courier: event.target.value }))}>
              {couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.fullName}</option>)}
              </select>
              {accessErrors.courier && <span className="field-error">{accessErrors.courier}</span>}
            </label>
          )}
          <label>
            Status do usuario
            <select value={form.active ? 'Ativo' : 'Inativo'} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'Ativo' }))}>
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </label>
          <label className="wide">
            Comprovante de endereco
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => setForm((current) => ({
                ...current,
                addressProof: event.target.files?.[0]?.name || '',
              }))}
            />
            {accessErrors.addressProof && <span className="field-error">{accessErrors.addressProof}</span>}
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-action" type="submit" disabled={savingAccess}>
            <Plus size={18} />{savingAccess ? 'Salvando...' : editingUser ? 'Salvar alteracoes' : 'Cadastrar convite'}
          </button>
          {editingUser && (
            <button className="secondary-action" type="button" onClick={resetAccessForm}>Cancelar</button>
          )}
        </div>
        {accessErrors.form && <p className="field-error">{accessErrors.form}</p>}
        {inviteMessage && <p className="success-message">{inviteMessage}</p>}
        <p className="form-note">Este cadastro grava o convite, envia o e-mail para criar senha e cria o `profile` com o mesmo escopo.</p>
      </form>

      <div className="access-grid">
        {accessProfiles.map((profile) => (
          <article className="access-card" key={profile.role}>
            <span>{profile.badge}</span>
            <h2>{profile.role}</h2>
            <p>{profile.scope}</p>
            <strong>{profile.permissions}</strong>
          </article>
        ))}
      </div>

      <div className="panel access-panel">
        <div className="panel-header">
          <h2>Usuarios e escopos</h2>
          <label className="type-filter">
            Tipo
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>Todos</option>
              <option>Sistema</option>
              <option>Cidade</option>
              <option>Loja</option>
              <option>Motoboy</option>
            </select>
          </label>
        </div>
        {usersLoadError && <p className="field-error">Erro ao consultar usuarios no Supabase: {usersLoadError}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Escopo</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.type}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.profileLabel}</td>
                  <td>{user.scope}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => editUser(user)}>Editar</button>
                      <button className="danger" type="button" onClick={() => deleteUser(user)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel rules-panel">
        <h2>Regras implementadas no banco</h2>
        <div className="rule-list">
          <p><strong>system_admin</strong> sem cidade, loja ou motoboy. Acesso global.</p>
          <p><strong>city_admin</strong> exige `city_id`. Acesso restrito a uma cidade.</p>
          <p><strong>store_admin</strong> exige `city_id` e `store_id`. Cria entregas e ve somente sua loja.</p>
          <p><strong>courier_admin</strong> exige `city_id` e `courier_id`. Ve seus dados e lojas da cidade.</p>
        </div>
      </div>
    </section>
  );
}

function StoresView({ city, stores, onChangeStores }) {
  const weekdays = [
    ['mon', 'Segunda'],
    ['tue', 'Terca'],
    ['wed', 'Quarta'],
    ['thu', 'Quinta'],
    ['fri', 'Sexta'],
    ['sat', 'Sabado'],
    ['sun', 'Domingo'],
  ];
  const emptySchedule = Object.fromEntries(weekdays.map(([key]) => [key, { open: '', close: '' }]));
  const [form, setForm] = React.useState({
    name: '',
    fantasyName: '',
    document: '',
    responsible: '',
    email: '',
    whatsapp: '',
    landline: '',
    address: '',
    number: '',
    complement: '',
    district: '',
    zipCode: '',
    latitude: '',
    longitude: '',
    locationReceived: '',
    type: 'Restaurante',
    schedule: emptySchedule,
    allowManualOrder: 'Sim',
    requirePickupConfirmation: 'Sim',
    rateCourierAfterDelivery: 'Sim',
    status: 'Ativa',
    notes: '',
  });
  const [errors, setErrors] = React.useState({});
  const [cnpjMessage, setCnpjMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const validationErrors = validateStoreForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    const payload = {
      city_id: city.id,
      name: form.name.trim(),
      fantasy_name: form.fantasyName.trim(),
      document: onlyDigits(form.document),
      responsible_name: form.responsible.trim(),
      email: form.email.trim(),
      whatsapp: onlyDigits(form.whatsapp),
      landline: onlyDigits(form.landline),
      store_type: form.type.trim(),
      address: form.address.trim(),
      address_number: form.number.trim(),
      complement: form.complement.trim(),
      district: form.district.trim(),
      zip_code: onlyDigits(form.zipCode),
      latitude: form.latitude ? Number(form.latitude.replace(',', '.')) : null,
      longitude: form.longitude ? Number(form.longitude.replace(',', '.')) : null,
      location_received: form.locationReceived.trim(),
      opening_hours: form.schedule,
      allow_manual_order: form.allowManualOrder === 'Sim',
      require_pickup_confirmation: form.requirePickupConfirmation === 'Sim',
      rate_courier_after_delivery: form.rateCourierAfterDelivery === 'Sim',
      internal_notes: form.notes.trim(),
      active: form.status === 'Ativa',
    };

    let newStore = {
      id: slugifyCity(form.name, city.state),
      cityId: city.id,
      name: payload.name,
      fantasyName: payload.fantasy_name,
      document: form.document.trim(),
      responsible: payload.responsible_name,
      email: payload.email,
      whatsapp: form.whatsapp.trim(),
      landline: form.landline.trim(),
      type: payload.store_type,
      address: payload.address,
      number: payload.address_number,
      complement: payload.complement,
      district: payload.district,
      zipCode: form.zipCode.trim(),
      latitude: form.latitude.trim(),
      longitude: form.longitude.trim(),
      locationReceived: payload.location_received,
      schedule: form.schedule,
      allowManualOrder: form.allowManualOrder,
      requirePickupConfirmation: form.requirePickupConfirmation,
      rateCourierAfterDelivery: form.rateCourierAfterDelivery,
      notes: payload.internal_notes,
      active: payload.active,
    };

    if (supabase) {
      setSaving(true);
      const { data, error } = await supabase
        .from('stores')
        .insert(payload)
        .select('id, city_id, name, fantasy_name, document, responsible_name, email, whatsapp, store_type, address, address_number, district, active')
        .single();
      setSaving(false);

      if (error) {
        setErrors({ form: error.message });
        return;
      }

      newStore = {
        id: data.id,
        cityId: data.city_id,
        name: data.name,
        fantasyName: data.fantasy_name,
        document: data.document,
        responsible: data.responsible_name,
        email: data.email,
        whatsapp: data.whatsapp,
        type: data.store_type,
        address: data.address,
        number: data.address_number,
        district: data.district,
        active: data.active,
      };
    }

    onChangeStores((current) => [newStore, ...current]);
    setForm((current) => ({
      ...current,
      name: '',
      fantasyName: '',
      document: '',
      responsible: '',
      email: '',
      whatsapp: '',
      landline: '',
      address: '',
      number: '',
      complement: '',
      district: '',
      zipCode: '',
      latitude: '',
      longitude: '',
      locationReceived: '',
      schedule: emptySchedule,
      notes: '',
    }));
    setMessage('Loja cadastrada no banco de dados.');
  }

  async function consultCnpj() {
    setCnpjMessage('');
    setErrors((current) => ({ ...current, document: undefined }));

    const cnpj = onlyDigits(form.document);
    if (cnpj.length !== 14) {
      setErrors((current) => ({ ...current, document: 'Informe um CNPJ com 14 digitos.' }));
      return;
    }

    try {
      setCnpjMessage('Consultando CNPJ...');
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error('CNPJ nao encontrado.');
      const data = await response.json();
      setForm((current) => ({
        ...current,
        name: data.razao_social || current.name,
        fantasyName: data.nome_fantasia || data.razao_social || current.fantasyName,
        email: data.email || current.email,
        whatsapp: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : current.whatsapp,
        address: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' ') || current.address,
        number: data.numero || current.number,
        complement: data.complemento || current.complement,
        district: data.bairro || current.district,
        zipCode: data.cep ? maskCep(data.cep) : current.zipCode,
        type: data.cnae_fiscal_descricao?.toLowerCase().includes('farmacia') ? 'Farmacia' : current.type,
      }));
      setCnpjMessage('Dados preenchidos pela consulta do CNPJ.');
    } catch (error) {
      setCnpjMessage(error.message || 'Erro ao consultar CNPJ.');
    }
  }

  return (
    <section className="stores-layout">
      <form className="panel store-form" onSubmit={handleSubmit}>
        <div className="panel-header">
          <h2>Nova loja em {city.name}</h2>
          <span className="count-pill">city_id</span>
        </div>
        <div className="form-section-title">Dados da loja</div>
        <div className="store-form-grid">
          <label className="wide">
            CNPJ
            <div className="inline-field">
              <input
                value={form.document}
                onChange={(event) => setForm((current) => ({ ...current, document: maskCnpj(event.target.value) }))}
                placeholder="00.000.000/0000-00"
              />
              <button type="button" onClick={consultCnpj}>Consultar</button>
            </div>
            {errors.document && <span className="field-error">{errors.document}</span>}
            {cnpjMessage && <span className="field-help">{cnpjMessage}</span>}
          </label>
          <label>
            Nome da loja
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Pizzaria Central"
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label>
            Nome fantasia
            <input
              value={form.fantasyName}
              onChange={(event) => setForm((current) => ({ ...current, fantasyName: event.target.value }))}
              placeholder="Nome conhecido pelo cliente"
            />
          </label>
          <label>
            Responsavel da loja
            <input
              value={form.responsible}
              onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))}
              placeholder="Nome do responsavel"
            />
            {errors.responsible && <span className="field-error">{errors.responsible}</span>}
          </label>
          <label>
            E-mail da loja
            <input
              value={form.email}
              type="email"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="loja@email.com"
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>
            WhatsApp da loja
            <input
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: maskPhone(event.target.value) }))}
              placeholder="(00) 00000-0000"
            />
            {errors.whatsapp && <span className="field-error">{errors.whatsapp}</span>}
          </label>
          <label>
            Telefone fixo
            <input
              value={form.landline}
              onChange={(event) => setForm((current) => ({ ...current, landline: maskPhone(event.target.value) }))}
              placeholder="(00) 0000-0000"
            />
            {errors.landline && <span className="field-error">{errors.landline}</span>}
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option>Ativa</option>
              <option>Desativada</option>
              <option>Bloqueada</option>
            </select>
          </label>
        </div>

        <div className="form-section-title">Endereco de retirada</div>
        <div className="store-form-grid">
          <label>
            Endereco
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Rua, avenida, etc."
            />
            {errors.address && <span className="field-error">{errors.address}</span>}
          </label>
          <label>
            Numero
            <input
              value={form.number}
              onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
              placeholder="123"
            />
            {errors.number && <span className="field-error">{errors.number}</span>}
          </label>
          <label>
            Complemento
            <input
              value={form.complement}
              onChange={(event) => setForm((current) => ({ ...current, complement: event.target.value }))}
            />
          </label>
          <label>
            Bairro
            <input
              value={form.district}
              onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}
            />
            {errors.district && <span className="field-error">{errors.district}</span>}
          </label>
          <label>
            Cidade
            <input value={city.name} disabled />
          </label>
          <label>
            Estado
            <input value={city.state} disabled />
          </label>
          <label>
            CEP
            <input
              value={form.zipCode}
              onChange={(event) => setForm((current) => ({ ...current, zipCode: maskCep(event.target.value) }))}
              placeholder="00.000-000"
            />
            {errors.zipCode && <span className="field-error">{errors.zipCode}</span>}
          </label>
          <label>
            Latitude
            <input
              value={form.latitude}
              onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
              placeholder="Gerado pelo mapa depois"
            />
          </label>
          <label>
            Longitude
            <input
              value={form.longitude}
              onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
              placeholder="Gerado pelo mapa depois"
            />
          </label>
          <label className="wide">
            Localizacao confirmada pelo lojista
            <input
              value={form.locationReceived}
              onChange={(event) => setForm((current) => ({ ...current, locationReceived: event.target.value }))}
              placeholder="Cole o link do mapa ou coordenadas enviadas pelo lojista"
            />
          </label>
        </div>

        <div className="form-section-title">Operacao da loja</div>
        <div className="store-form-grid">
          <label>
            Tipo de loja
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              <option>Restaurante</option>
              <option>Pizzaria</option>
              <option>Hamburgueria</option>
              <option>Mercado</option>
              <option>Farmacia</option>
              <option>Loja geral</option>
              <option>Outro</option>
            </select>
          </label>
          <label>
            Permitir pedido manual?
            <select value={form.allowManualOrder} onChange={(event) => setForm((current) => ({ ...current, allowManualOrder: event.target.value }))}>
              <option>Sim</option>
              <option>Nao</option>
            </select>
          </label>
          <label>
            Exigir confirmacao de retirada?
            <select value={form.requirePickupConfirmation} onChange={(event) => setForm((current) => ({ ...current, requirePickupConfirmation: event.target.value }))}>
              <option>Sim</option>
              <option>Nao</option>
            </select>
          </label>
          <label>
            Avaliar entregador apos entrega?
            <select value={form.rateCourierAfterDelivery} onChange={(event) => setForm((current) => ({ ...current, rateCourierAfterDelivery: event.target.value }))}>
              <option>Sim</option>
              <option>Nao</option>
            </select>
          </label>
        </div>

        <div className="schedule-grid">
          {weekdays.map(([key, label]) => (
            <div className="schedule-row" key={key}>
              <strong>{label}</strong>
              <input
                type="time"
                value={form.schedule[key].open}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  schedule: { ...current.schedule, [key]: { ...current.schedule[key], open: event.target.value } },
                }))}
              />
              <input
                type="time"
                value={form.schedule[key].close}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  schedule: { ...current.schedule, [key]: { ...current.schedule[key], close: event.target.value } },
                }))}
              />
            </div>
          ))}
        </div>

        <label className="notes-field">
          Observacoes internas
          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Observacoes sobre funcionamento, acesso, retirada, etc."
          />
        </label>
        <button className="primary-action" type="submit"><Plus size={18} />Cadastrar loja</button>
        {saving && <p className="form-note">Salvando loja...</p>}
        {errors.form && <p className="field-error">{errors.form}</p>}
        {message && <p className="success-message">{message}</p>}
        <p className="form-note">Toda loja cadastrada aqui fica vinculada a cidade selecionada no topo e sera gravada com `city_id`.</p>
      </form>
    </section>
  );
}

function CouriersView({ city, cities, couriers, onChangeCouriers }) {
  const whatsappCodeRef = React.useRef(null);
  const emptyCourierForm = {
    cityId: city.id,
    fullName: '',
    birthDate: '',
    cpf: '',
    phone: '',
    email: '',
    facePhoto: '',
    whatsappCode: '',
    vehicle: 'Moto',
    plate: '',
    pix: '',
    pixType: 'CPF',
    pixHolder: '',
    vehicleNotes: '',
    cnhFile: '',
    cnhValidUntil: '',
    notes: '',
    approvalStatus: 'pending_approval',
    availabilityStatus: 'offline',
    active: true,
  };
  const [form, setForm] = React.useState(emptyCourierForm);
  const [errors, setErrors] = React.useState({});
  const [whatsappMessage, setWhatsappMessage] = React.useState('WhatsApp ainda nao validado.');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [editingCourierId, setEditingCourierId] = React.useState('');
  const activeCities = cities.filter((item) => item.active !== false);

  React.useEffect(() => {
    if (!editingCourierId) {
      setForm((current) => ({ ...current, cityId: city.id }));
    }
  }, [city.id, editingCourierId]);

  function resetForm() {
    setForm(emptyCourierForm);
    setEditingCourierId('');
    setErrors({});
    setWhatsappMessage('WhatsApp ainda nao validado.');
  }

  function mapCourierFromDb(data) {
    return {
      id: data.id,
      cityId: data.city_id,
      fullName: data.name,
      birthDate: data.birth_date ?? '',
      cpf: maskCpf(data.cpf ?? ''),
      phone: maskPhone(data.phone ?? ''),
      email: data.email,
      facePhoto: data.face_photo_path ?? '',
      whatsappCode: data.whatsapp_validated ? '000000' : '',
      whatsappValidated: data.whatsapp_validated,
      vehicle: data.vehicle_type,
      plate: data.vehicle_plate,
      pix: data.pix_key,
      pixType: data.pix_key_type,
      pixHolder: data.pix_holder_name,
      vehicleNotes: data.vehicle_notes ?? '',
      cnhFile: data.cnh_file_path ?? '',
      cnhValidUntil: data.cnh_valid_until ?? '',
      notes: data.internal_notes ?? '',
      status: data.approval_status,
      availability: data.availability_status,
      rating: data.rating,
      active: data.active,
      approvalStatus: data.approval_status,
      availabilityStatus: data.availability_status,
    };
  }

  function startEdit(courier) {
    setEditingCourierId(courier.id);
    setForm({
      cityId: courier.cityId ?? city.id,
      fullName: courier.fullName ?? '',
      birthDate: courier.birthDate ?? '',
      cpf: courier.cpf ?? '',
      phone: courier.phone ?? '',
      email: courier.email ?? '',
      facePhoto: courier.facePhoto ?? '',
      whatsappCode: courier.whatsappCode || (courier.whatsappValidated ? '000000' : ''),
      vehicle: 'Moto',
      plate: courier.plate ?? '',
      pix: courier.pix ?? '',
      pixType: courier.pixType ?? 'CPF',
      pixHolder: courier.pixHolder ?? '',
      vehicleNotes: courier.vehicleNotes ?? '',
      cnhFile: courier.cnhFile ?? '',
      cnhValidUntil: courier.cnhValidUntil ?? '',
      notes: courier.notes ?? '',
      approvalStatus: courier.approvalStatus ?? courier.status ?? 'pending_approval',
      availabilityStatus: courier.availabilityStatus ?? courier.availability ?? 'offline',
      active: courier.active !== false,
    });
    setErrors({});
    setMessage('');
    setWhatsappMessage(courier.whatsappValidated ? 'WhatsApp ja validado.' : 'WhatsApp ainda nao validado.');
    window.location.hash = '#couriers';
  }

  async function toggleCourierActive(courier) {
    setMessage('');
    setErrors({});
    const nextActive = courier.active === false;

    if (supabase) {
      const { error } = await supabase
        .from('couriers')
        .update({ active: nextActive })
        .eq('id', courier.id);

      if (error) {
        setErrors({ form: error.message });
        return;
      }
    }

    onChangeCouriers((current) =>
      current.map((item) => item.id === courier.id ? { ...item, active: nextActive } : item),
    );
    setMessage(nextActive ? 'Entregador ativado.' : 'Entregador desativado.');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const validationErrors = validateCourierForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    const payload = {
      city_id: form.cityId || city.id,
      name: form.fullName.trim(),
      birth_date: form.birthDate,
      cpf: onlyDigits(form.cpf),
      phone: onlyDigits(form.phone),
      email: form.email.trim(),
      face_photo_path: form.facePhoto,
      whatsapp_validated: false,
      vehicle_type: 'Moto',
      vehicle_plate: form.plate.toUpperCase(),
      pix_key: form.pix.trim(),
      pix_key_type: form.pixType,
      pix_holder_name: form.pixHolder.trim(),
      vehicle_notes: form.vehicleNotes.trim(),
      cnh_file_path: form.cnhFile,
      cnh_valid_until: form.cnhValidUntil,
      approval_status: form.approvalStatus,
      availability_status: form.availabilityStatus,
      internal_notes: form.notes.trim(),
      active: form.active,
      available: form.availabilityStatus === 'available',
    };

    let newCourier = {
      id: slugifyCity(form.fullName, city.state),
      cityId: form.cityId || city.id,
      ...form,
      plate: form.plate.toUpperCase(),
      status: form.approvalStatus,
      availability: form.availabilityStatus,
      rating: '0',
      totalDeliveries: '0',
    };

    if (supabase) {
      setSaving(true);
      const { data, error } = editingCourierId
        ? await supabase
            .from('couriers')
            .update(payload)
            .eq('id', editingCourierId)
            .select('id, city_id, name, birth_date, cpf, phone, email, face_photo_path, whatsapp_validated, vehicle_type, vehicle_plate, pix_key, pix_key_type, pix_holder_name, vehicle_notes, cnh_file_path, cnh_valid_until, internal_notes, approval_status, availability_status, rating, active')
            .single()
        : await supabase.functions.invoke('create-courier-invite', {
            body: { courier: payload },
          });

      setSaving(false);

      if (error) {
        setErrors({ form: await functionErrorMessage(error, 'Nao foi possivel salvar o entregador.') });
        return;
      }

      const courierData = editingCourierId ? data : data?.courier;
      if (!courierData) {
        setErrors({ form: 'Cadastro enviado, mas nao foi possivel carregar o entregador retornado.' });
        return;
      }

      newCourier = mapCourierFromDb(courierData);
      if (!editingCourierId && data?.warning) {
        setMessage(data.warning);
      } else if (!editingCourierId && data?.setupLink) {
        await copyText(data.setupLink);
        setMessage('Entregador cadastrado. Link de criacao de senha copiado para a area de transferencia.');
      }
    }

    onChangeCouriers((current) => {
      if (editingCourierId) {
        if (newCourier.cityId !== city.id) {
          return current.filter((courier) => courier.id !== editingCourierId);
        }
        return current.map((courier) => courier.id === editingCourierId ? newCourier : courier);
      }
      return newCourier.cityId === city.id ? [newCourier, ...current] : current;
    });
    resetForm();
    setMessage((current) => current || (
      editingCourierId
        ? 'Dados do entregador atualizados.'
        : newCourier.email
          ? 'Entregador cadastrado. Se o e-mail ja existia no Auth, o perfil foi vinculado sem novo convite.'
          : 'Entregador cadastrado.'
    ));
  }

  function sendWhatsappCode() {
    if (!form.phone) {
      setErrors((current) => ({ ...current, phone: 'Informe o WhatsApp antes de enviar o codigo.' }));
      return;
    }
    setWhatsappMessage('Voce receberá um número no seu WhatsApp para confirmação. Digite ou cole ele aqui.');
    whatsappCodeRef.current?.focus();
  }

  return (
    <section className="courier-layout">
      <form className="panel courier-form" onSubmit={handleSubmit}>
        <div className="panel-header">
          <h2>{editingCourierId ? 'Editar entregador' : `Novo entregador em ${city.name}`}</h2>
          <span className="count-pill">{editingCourierId ? 'edicao' : 'city_id'}</span>
        </div>
        <p className="form-note">O entregador fica vinculado a cidade selecionada e entra como pendente ate aprovacao.</p>

        <div className="form-section-title">Dados do entregador</div>
        <div className="store-form-grid">
          <label>
            Cidade vinculada
            <select value={form.cityId || city.id} onChange={(event) => setForm((current) => ({ ...current, cityId: event.target.value }))}>
              {activeCities.map((item) => (
                <option value={item.id} key={item.id}>{item.name} - {item.state}</option>
              ))}
            </select>
          </label>
          <label>
            Situacao inicial
            <select value={form.approvalStatus} onChange={(event) => setForm((current) => ({ ...current, approvalStatus: event.target.value }))}>
              <option value="pending_approval">Pendente de aprovacao</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </label>
          <label>
            Disponibilidade
            <select value={form.availabilityStatus} onChange={(event) => setForm((current) => ({ ...current, availabilityStatus: event.target.value }))}>
              <option value="offline">Offline</option>
              <option value="available">Disponivel</option>
              <option value="on_delivery">Em entrega</option>
              <option value="paused">Pausado</option>
            </select>
          </label>
          <label>
            Cadastro ativo
            <select value={form.active ? 'Sim' : 'Nao'} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'Sim' }))}>
              <option>Sim</option>
              <option>Nao</option>
            </select>
          </label>
          <label>
            Nome completo
            <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nome do entregador" />
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </label>
          <label>
            Data de nascimento
            <input type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
            {errors.birthDate && <span className="field-error">{errors.birthDate}</span>}
          </label>
          <label>
            CPF
            <input value={form.cpf} onChange={(event) => setForm((current) => ({ ...current, cpf: maskCpf(event.target.value) }))} placeholder="000.000.000-00" />
            {errors.cpf && <span className="field-error">{errors.cpf}</span>}
          </label>
          <label>
            Telefone / WhatsApp
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: maskPhone(event.target.value), whatsappValidated: false }))} placeholder="(00) 00000-0000" />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label>
            E-mail
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="entregador@email.com" />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>
            Foto do rosto
            <input type="file" accept="image/*" onChange={(event) => setForm((current) => ({ ...current, facePhoto: event.target.files?.[0]?.name || '' }))} />
            {errors.facePhoto && <span className="field-error">{errors.facePhoto}</span>}
          </label>
          <label>
            Confirmacao do WhatsApp
            <input ref={whatsappCodeRef} value={form.whatsappCode} maxLength={6} onChange={(event) => setForm((current) => ({ ...current, whatsappCode: event.target.value }))} placeholder="Codigo recebido" />
            {errors.whatsappCode && <span className="field-error">{errors.whatsappCode}</span>}
            <span className="field-help">{whatsappMessage}</span>
          </label>
          <button className="secondary-inline-button" type="button" onClick={sendWhatsappCode}>Enviar codigo</button>
        </div>

        <div className="form-section-title">Veiculo e pagamento</div>
        <div className="store-form-grid">
          <label>
            Veiculo
            <select value={form.vehicle} onChange={(event) => setForm((current) => ({ ...current, vehicle: event.target.value }))}>
              <option>Moto</option>
            </select>
            {errors.vehicle && <span className="field-error">{errors.vehicle}</span>}
          </label>
          <label>
            Placa
            <input value={form.plate} onChange={(event) => setForm((current) => ({ ...current, plate: event.target.value.toUpperCase() }))} placeholder="ABC1D23" />
            {errors.plate && <span className="field-error">{errors.plate}</span>}
          </label>
          <label>
            Chave Pix
            <input value={form.pix} onChange={(event) => setForm((current) => ({ ...current, pix: event.target.value }))} placeholder="CPF, e-mail, telefone ou chave aleatoria" />
            {errors.pix && <span className="field-error">{errors.pix}</span>}
          </label>
          <label>
            Tipo da chave Pix
            <select value={form.pixType} onChange={(event) => setForm((current) => ({ ...current, pixType: event.target.value }))}>
              <option>CPF</option>
              <option>E-mail</option>
              <option>Telefone</option>
              <option>Aleatoria</option>
            </select>
          </label>
          <label>
            Nome do favorecido Pix
            <input value={form.pixHolder} onChange={(event) => setForm((current) => ({ ...current, pixHolder: event.target.value }))} placeholder="Nome de quem recebe o Pix" />
            {errors.pixHolder && <span className="field-error">{errors.pixHolder}</span>}
          </label>
          <label>
            Observações
            <input value={form.vehicleNotes} onChange={(event) => setForm((current) => ({ ...current, vehicleNotes: event.target.value }))} placeholder="Bau, mochila, restricoes etc." />
          </label>
          <label>
            Foto ou copia da CNH
            <input type="file" accept="image/*,.pdf" onChange={(event) => setForm((current) => ({ ...current, cnhFile: event.target.files?.[0]?.name || '' }))} />
            {errors.cnhFile && <span className="field-error">{errors.cnhFile}</span>}
          </label>
          <label>
            Validade da CNH
            <input type="date" value={form.cnhValidUntil} onChange={(event) => setForm((current) => ({ ...current, cnhValidUntil: event.target.value }))} />
            {errors.cnhValidUntil && <span className="field-error">{errors.cnhValidUntil}</span>}
          </label>
        </div>

        <label className="notes-field">
          Observacoes internas
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Documentos pendentes, historico, restricoes etc." />
        </label>

        <div className="form-actions">
          <button className="primary-action" type="submit"><Plus size={18} />{editingCourierId ? 'Atualizar entregador' : 'Salvar entregador'}</button>
          {editingCourierId && (
            <button className="secondary-action" type="button" onClick={resetForm}>Cancelar edicao</button>
          )}
        </div>
        {saving && <p className="form-note">Salvando entregador...</p>}
        {errors.form && <p className="field-error">{errors.form}</p>}
        {message && <p className="success-message">{message}</p>}
      </form>

      <div className="panel courier-list-panel">
        <div className="panel-header">
          <h2>Entregadores de {city.name}</h2>
          <span className="count-pill">{couriers.length} cadastros</span>
        </div>
        <div className="courier-list">
          {couriers.length === 0 && (
            <p className="empty-state">Nenhum entregador cadastrado nesta cidade.</p>
          )}
          {couriers.map((courier) => (
            <article className="courier-row" key={courier.id}>
              <div className="avatar small">{initials(courier.fullName || 'Motoboy')}</div>
              <div>
                <strong>{courier.fullName}</strong>
                <span>{courier.phone || 'Sem WhatsApp'} · {courier.email || 'Sem e-mail'}</span>
                <span>{courier.plate || 'Sem placa'} · {courier.active === false ? 'Inativo' : 'Ativo'} · {courier.status || 'pending_approval'}</span>
              </div>
              <div className="row-actions">
                <button className="toggle-button" type="button" onClick={() => startEdit(courier)}>Editar</button>
                <button className="toggle-button" type="button" onClick={() => toggleCourierActive(courier)}>
                  {courier.active === false ? 'Ativar' : 'Desativar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeliveryMap({ large = false }) {
  return (
    <div className={`map-panel ${large ? 'large' : ''}`} aria-label="Mapa de entregas">
      <div className="map-grid"></div>
      <div className="route green r1"></div>
      <div className="route blue r2"></div>
      <div className="route yellow r3"></div>
      <div className="route green r4"></div>
      <div className="marker store"><Store size={26} /></div>
      <div className="marker rider rider-a"><Bike size={22} /></div>
      <div className="marker rider rider-b"><Bike size={22} /></div>
      <div className="marker rider rider-c"><Bike size={22} /></div>
      <div className="marker rider rider-d"><Bike size={22} /></div>
      <div className="map-controls">
        <button aria-label="Aumentar zoom"><Plus size={20} /></button>
        <button aria-label="Diminuir zoom"><Minus size={20} /></button>
        <button aria-label="Centralizar"><Navigation size={19} /></button>
      </div>
    </div>
  );
}

function MapOnlyView({ city, couriers }) {
  const availability = [
    ['Motoboys disponiveis', String(city.availableCouriers)],
    ['Em entrega', String(city.activeDeliveries)],
    ['Pausados', String(city.pausedCouriers)],
    ['Lojas ativas', String(city.activeStores)],
  ];
  const availableCouriers = couriers.filter((courier) => (
    courier.active !== false && ['available', 'Disponivel'].includes(courier.availability)
  ));

  return (
    <>
      <section className="availability-grid" aria-label="Disponibilidade de motoboys">
        {availability.map(([label, value]) => (
          <article className="availability-card" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="map-screen">
        <DeliveryMap large />
        <aside className="panel map-list">
          <h2>Motoboys disponiveis em {city.name}</h2>
          {availableCouriers.map((courier) => (
            <div className="ranking-row" key={courier.id}>
              <div className="avatar small">{initials(courier.fullName)}</div>
              <strong>{courier.fullName}</strong>
              <span>Disponivel</span>
            </div>
          ))}
          {availableCouriers.length === 0 && (
            <p className="empty-state">Nenhum motoboy disponivel nesta cidade.</p>
          )}
        </aside>
      </section>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
