import React from 'react';
import {
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  Home,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Store,
  Sun,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { AccessView, ActiveDeliveriesAdminView, CitiesView, CourierCenterView, CouriersView, MapOnlyView, Overview, RevenueView, StoreCenterView, StoresView } from '../paginas/admin/AdminPages';
import beeIcon from '../../imagem/icone.png';

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
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
  if (page === 'active-deliveries') return 'Entregas em andamento';
  if (page === 'daily-revenue') return 'Faturamento do dia';
  return 'Visao geral';
}

function roleLabel(role) {
  if (role === 'system_admin') return 'Admin do sistema';
  if (role === 'city_admin') return 'Admin da cidade';
  if (role === 'store_admin') return 'Admin lojista';
  if (role === 'courier_admin') return 'Admin motoboy';
  return 'Usuario';
}

export function LayoutAdmin({
  page,
  setPage,
  currentProfile,
  selectedCity,
  cityId,
  setCityId,
  cityList,
  cityLoading,
  cityError,
  setCityList,
  storeList,
  setStoreList,
  courierList,
  setCourierList,
  handleLogout,
}) {
  const [storeToEdit, setStoreToEdit] = React.useState(null);
  const [courierToEdit, setCourierToEdit] = React.useState(null);
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('beelbem-theme') === 'dark');
  const currentUserRole = currentProfile?.role;

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;
      localStorage.setItem('beelbem-theme', next ? 'dark' : 'light');
      return next;
    });
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
          <button className={['active-deliveries', 'daily-revenue'].includes(page) ? 'active' : ''} onClick={() => setPage('active-deliveries')}><WalletCards size={18} />Entregas</button>
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
        {page === 'active-deliveries' && <ActiveDeliveriesAdminView city={selectedCity} />}
        {page === 'daily-revenue' && <RevenueView city={selectedCity} stores={storeList} />}
        {page === 'overview' && <Overview city={selectedCity} stores={storeList} couriers={courierList} onOpenActiveDeliveries={() => setPage('active-deliveries')} onOpenRevenue={() => setPage('daily-revenue')} />}
      </main>
    </div>
  );
}
