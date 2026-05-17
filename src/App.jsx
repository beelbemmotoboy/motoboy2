import React from 'react';
import { LoginView, ForgotPasswordView, CreateAccountView, CreatePasswordView } from './paginas/publico/AuthPublic';
import { AuthUnavailableView } from './paginas/publico/AuthUnavailableView';
import { JoinView } from './paginas/publico/JoinView';
import { PublicSignupView } from './paginas/publico/PublicSignupView';
import { LayoutAdmin } from './layouts/LayoutAdmin';
import { StoreHomeView } from './paginas/lojista/StoreHomeView';
import { CourierHomeView } from './paginas/motoboy/CourierHomeView';
import { supabase } from './supabaseClient';
import { pageFromLocation, resolveHomeByRole } from './utils/pageRouting';
import { maskCpf, maskPhone } from './utils/validators';
import beeIcon from '../imagem/icone.png';

export function App() {
  const [page, setPageState] = React.useState(pageFromLocation);
  const [authReady, setAuthReady] = React.useState(!supabase);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [currentProfile, setCurrentProfile] = React.useState(null);
  const publicPages = ['login', 'create-password', 'forgot-password', 'create-account', 'join', 'signup-store', 'signup-courier'];
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
  const selectedStore = storeList.find((store) => store.id === currentProfile?.store_id) ?? storeList[0] ?? null;
  const [cityLoading, setCityLoading] = React.useState(false);
  const [cityError, setCityError] = React.useState('');
  const setPage = (nextPage) => {
    setPageState(nextPage);
    window.location.hash = nextPage;
  };

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
      return;
    }
    if (!currentProfile || publicPages.includes(page)) return;

    const homePage = resolveHomeByRole(currentProfile.role);
    if (currentProfile.role === 'store_admin' && page !== 'store-home') {
      setPage(homePage);
      return;
    }
    if (currentProfile.role === 'courier_admin' && page !== 'courier-home') {
      setPage(homePage);
      return;
    }
    if (currentProfile.role !== 'store_admin' && page === 'store-home') {
      setPage(homePage);
      return;
    }
    if (currentProfile.role !== 'courier_admin' && page === 'courier-home') {
      setPage(homePage);
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
    return <StoreHomeView city={selectedCity} store={selectedStore} profile={currentProfile} onLogout={handleLogout} />;
  }

  if (page === 'courier-home' && currentProfile?.role === 'courier_admin') {
    return <CourierHomeView city={selectedCity} profile={currentProfile} onLogout={handleLogout} />;
  }

  if (currentProfile?.role === 'store_admin') {
    return <StoreHomeView city={selectedCity} store={selectedStore} profile={currentProfile} onLogout={handleLogout} />;
  }

  if (currentProfile?.role === 'courier_admin') {
    return <CourierHomeView city={selectedCity} profile={currentProfile} onLogout={handleLogout} />;
  }

  if (!['system_admin', 'city_admin'].includes(currentProfile?.role)) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <LayoutAdmin
      page={page}
      setPage={setPage}
      currentProfile={currentProfile}
      selectedCity={selectedCity}
      cityId={cityId}
      setCityId={setCityId}
      cityList={cityList}
      cityLoading={cityLoading}
      cityError={cityError}
      setCityList={setCityList}
      storeList={storeList}
      setStoreList={setStoreList}
      courierList={courierList}
      setCourierList={setCourierList}
      handleLogout={handleLogout}
    />
  );
}


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}


