import React from 'react';
import { AlertTriangle, Bike, CalendarDays, Camera, Clock3, MapPin, Minus, Navigation, PencilLine, Plus, Search, ShieldCheck, Star, Store, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { isValidCep, isValidCnpj, isValidCpf, isValidEmail, isValidPhone, maskCep, maskCnpj, maskCpf, maskPhone, onlyDigits, passwordStrength, validateAccessUserForm, validateCourierForm, validateStoreForm } from '../../utils/validators';
import { ActiveDeliveriesView } from './ActiveDeliveriesView';
import { Overview as OverviewControl } from './overview/OverviewView';
import { RevenueByStoreView } from './RevenueByStoreView';

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

function safeStorageFileName(fileName) {
  return String(fileName || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 140);
}

function randomStorageId() {
  return globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(16).slice(2);
}

async function uploadStorageFile(bucket, folder, file) {
  if (!file) return '';
  if (!supabase) throw new Error('Supabase nao configurado para enviar arquivos.');

  const path = folder + '/' + Date.now() + '-' + randomStorageId() + '-' + safeStorageFileName(file.name);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;
  return path;
}

async function openStorageFile(bucket, path) {
  if (!path) throw new Error('Arquivo nao encontrado neste cadastro.');
  if (/^https?:\/\//i.test(path)) {
    window.open(path, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!path.includes('/')) {
    throw new Error('Este cadastro tem apenas o nome do arquivo antigo. Reenvie o arquivo pelo formulario para salvar no Storage.');
  }
  if (!supabase) throw new Error('Supabase nao configurado para abrir arquivos.');

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 600);

  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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

function slugifyCity(name, state) {
  return `${name}-${state}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function Overview({ city, stores, couriers, onOpenActiveDeliveries, onOpenRevenue }) {
  return <OverviewControl city={city} stores={stores} couriers={couriers} onOpenActiveDeliveries={onOpenActiveDeliveries} onOpenRevenue={onOpenRevenue} />;
}

export function ActiveDeliveriesAdminView({ city }) {
  return <ActiveDeliveriesView city={city} />;
}

export function RevenueView({ city, stores }) {
  return <RevenueByStoreView city={city} stores={stores} />;
}

export function CitiesView({ cities, selectedCityId, onSelectCity, onChangeCities, loading, error }) {
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

export function AccessView({ city, stores, couriers }) {
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

  async function setTemporaryPassword(user) {
    const password = window.prompt(`Digite a senha temporaria para ${user.name}. Exemplo: Cidade@1`);
    if (password === null) return;
    const trimmedPassword = password.trim();
    const strength = passwordStrength(trimmedPassword);

    setAccessErrors({});
    setInviteMessage('');

    if (!strength.valid) {
      setAccessErrors({ form: 'A senha temporaria precisa ter 6 caracteres, letra maiuscula, letra minuscula e simbolo. Exemplo: Cidade@1' });
      return;
    }

    setSavingAccess(true);
    const { error } = await supabase.functions.invoke('manage-access-user', {
      body: {
        action: 'set_password',
        profileId: user.id,
        updates: { password: trimmedPassword },
      },
    });
    setSavingAccess(false);

    if (error) {
      setAccessErrors({ form: await functionErrorMessage(error, 'Nao foi possivel definir a senha temporaria.') });
      return;
    }

    setUsers((current) => current.map((item) => (
      item.id === user.id ? { ...item, active: true, status: 'Ativo' } : item
    )));
    setInviteMessage(`Senha temporaria definida para ${user.email}. Saia e teste o login com essa senha.`);
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
          form: await functionErrorMessage(inviteError, 'Cadastro criado, mas nao foi possivel definir a senha temporaria.'),
        });
        return;
      }
    } else {
      setAccessErrors({ form: 'Supabase nao configurado. Nao foi possivel criar usuario com senha temporaria.' });
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
      inviteResult?.temporaryPassword
        ? `Usuario criado no Auth. Senha temporaria: ${inviteResult.temporaryPassword}`
        : 'Cadastro validado. Perfil de acesso vinculado.',
    );
    if (inviteResult?.temporaryPassword) await copyText(inviteResult.temporaryPassword);
    resetAccessForm();
  }

  const visibleUsers = typeFilter === 'Todos' ? users : users.filter((user) => user.type === typeFilter);

  return (
    <section className="access-layout">
      <form className="panel user-form" onSubmit={handleSubmit}>
        <div className="panel-header">
          <h2>{editingUser ? 'Editar usuario' : 'Cadastrar usuario'}</h2>
          <span className="count-pill">{editingUser ? 'Auth vinculado' : 'Senha temporaria'}</span>
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
            <Plus size={18} />{savingAccess ? 'Salvando...' : editingUser ? 'Salvar alteracoes' : 'Cadastrar usuario'}
          </button>
          {editingUser && (
            <button className="secondary-action" type="button" onClick={resetAccessForm}>Cancelar</button>
          )}
        </div>
        {accessErrors.form && <p className="field-error">{accessErrors.form}</p>}
        {inviteMessage && <p className="success-message">{inviteMessage}</p>}
        <p className="form-note">Este cadastro cria o usuario no Auth, define uma senha temporaria e grava o `profile` com o mesmo escopo. O envio por e-mail esta desativado.</p>
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
                      <button type="button" onClick={() => setTemporaryPassword(user)}>Senha temporaria</button>
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

export function StoresView({ city, stores, onChangeStores, storeToEdit, onEditLoaded }) {
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
  const normalizeSchedule = (schedule = {}) => Object.fromEntries(weekdays.map(([key]) => [
    key,
    {
      open: schedule?.[key]?.open ?? '',
      close: schedule?.[key]?.close ?? '',
    },
  ]));
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
    logoUrl: '',
    logoFile: null,
  });
  const [errors, setErrors] = React.useState({});
  const [cnpjMessage, setCnpjMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [editingStoreId, setEditingStoreId] = React.useState('');

  React.useEffect(() => {
    if (!storeToEdit) return;
    startEdit(storeToEdit);
    onEditLoaded?.();
  }, [storeToEdit, onEditLoaded]);

  function resetForm() {
    setForm({
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
      logoUrl: '',
      logoFile: null,
    });
    setEditingStoreId('');
    setErrors({});
    setMessage('');
  }

  function startEdit(store) {
    setEditingStoreId(store.id);
    setForm({
      name: store.name ?? '',
      fantasyName: store.fantasyName ?? '',
      document: store.document ? maskCnpj(store.document) : '',
      responsible: store.responsible ?? '',
      email: store.email ?? '',
      whatsapp: store.whatsapp ? maskPhone(store.whatsapp) : '',
      landline: store.landline ? maskPhone(store.landline) : '',
      address: store.address ?? '',
      number: store.number ?? '',
      complement: store.complement ?? '',
      district: store.district ?? '',
      zipCode: store.zipCode ? maskCep(store.zipCode) : '',
      latitude: store.latitude ?? '',
      longitude: store.longitude ?? '',
      locationReceived: store.locationReceived ?? '',
      type: store.type ?? 'Restaurante',
      schedule: normalizeSchedule(store.schedule),
      allowManualOrder: store.allowManualOrder ?? 'Sim',
      requirePickupConfirmation: store.requirePickupConfirmation ?? 'Sim',
      rateCourierAfterDelivery: store.rateCourierAfterDelivery ?? 'Sim',
      status: store.active === false ? 'Desativada' : 'Ativa',
      notes: store.notes ?? '',
      logoUrl: store.logoUrl ?? store.logo_url ?? '',
      logoFile: null,
    });
    setErrors({});
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const validationErrors = validateStoreForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    let logoUrl = form.logoUrl;
    if (form.logoFile) {
      try {
        logoUrl = await uploadStorageFile('user-documents', `stores/${city.id}/logos`, form.logoFile);
      } catch (uploadError) {
        setErrors({ form: uploadError.message || 'Nao foi possivel enviar a logo da loja.' });
        return;
      }
    }

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
      logo_url: logoUrl || null,
    };

    let newStore = {
      id: editingStoreId || slugifyCity(form.name, city.state),
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
      logoUrl: logoUrl,
    };

    if (supabase) {
      setSaving(true);
      const query = editingStoreId
        ? supabase.from('stores').update(payload).eq('id', editingStoreId)
        : supabase.from('stores').insert(payload);
      const { data, error } = await query
        .select('id, city_id, name, fantasy_name, document, responsible_name, email, whatsapp, landline, store_type, address, address_number, complement, district, zip_code, latitude, longitude, location_received, opening_hours, allow_manual_order, require_pickup_confirmation, rate_courier_after_delivery, internal_notes, active, logo_url, is_open')
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
        landline: data.landline,
        type: data.store_type,
        address: data.address,
        number: data.address_number,
        complement: data.complement,
        district: data.district,
        zipCode: data.zip_code,
        latitude: data.latitude ? String(data.latitude) : '',
        longitude: data.longitude ? String(data.longitude) : '',
        locationReceived: data.location_received,
        schedule: data.opening_hours,
        allowManualOrder: data.allow_manual_order ? 'Sim' : 'Nao',
        requirePickupConfirmation: data.require_pickup_confirmation ? 'Sim' : 'Nao',
        rateCourierAfterDelivery: data.rate_courier_after_delivery ? 'Sim' : 'Nao',
        notes: data.internal_notes,
        active: data.active,
        logoUrl: data.logo_url,
        isOpen: data.is_open,
      };
    }

    const wasEditing = Boolean(editingStoreId);
    onChangeStores((current) => (
      wasEditing
        ? current.map((store) => (store.id === editingStoreId ? { ...store, ...newStore } : store))
        : [newStore, ...current]
    ));
    resetForm();
    setMessage(wasEditing ? 'Loja atualizada no banco de dados.' : 'Loja cadastrada no banco de dados.');
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
          <h2>{editingStoreId ? `Editar loja em ${city.name}` : `Nova loja em ${city.name}`}</h2>
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
          <label>
            Logo da loja
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setForm((current) => ({
                  ...current,
                  logoFile: file,
                  logoUrl: file?.name || current.logoUrl,
                }));
              }}
            />
            {form.logoUrl && <span className="field-help">Arquivo atual: {form.logoUrl.includes('/') ? form.logoUrl.split('/').pop() : form.logoUrl}</span>}
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
        <button className="primary-action" type="submit"><Plus size={18} />{editingStoreId ? 'Salvar alteracoes' : 'Cadastrar loja'}</button>
        {editingStoreId && <button className="secondary-action" type="button" onClick={resetForm}>Cancelar edicao</button>}
        {saving && <p className="form-note">Salvando loja...</p>}
        {errors.form && <p className="field-error">{errors.form}</p>}
        {message && <p className="success-message">{message}</p>}
      </form>
    </section>
  );
}

export function CouriersView({ city, cities, couriers, onChangeCouriers, courierToEdit, onEditLoaded }) {
  const emptyCourierForm = {
    cityId: city.id,
    fullName: '',
    birthDate: '',
    cpf: '',
    phone: '',
    email: '',
    facePhoto: '',
    facePhotoFile: null,
    crlvFile: '',
    crlvFileObject: null,
    vehicle: 'Moto',
    plate: '',
    pix: '',
    pixType: 'CPF',
    pixHolder: '',
    vehicleNotes: '',
    cnhFile: '',
    cnhFileObject: null,
    cnhValidUntil: '',
    notes: '',
    approvalStatus: 'pending_approval',
    availabilityStatus: 'offline',
    active: true,
  };
  const [form, setForm] = React.useState(emptyCourierForm);
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [editingCourierId, setEditingCourierId] = React.useState('');
  const activeCities = cities.filter((item) => item.active !== false);

  React.useEffect(() => {
    if (!editingCourierId) {
      setForm((current) => ({ ...current, cityId: city.id }));
    }
  }, [city.id, editingCourierId]);

  React.useEffect(() => {
    if (!courierToEdit) return;
    startEdit(courierToEdit);
    onEditLoaded?.();
  }, [courierToEdit, onEditLoaded]);

  function resetForm() {
    setForm(emptyCourierForm);
    setEditingCourierId('');
    setErrors({});
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
      crlvFile: data.crlv_file_path ?? '',
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
      facePhotoFile: null,
      crlvFile: courier.crlvFile ?? '',
      crlvFileObject: null,
      vehicle: 'Moto',
      plate: courier.plate ?? '',
      pix: courier.pix ?? '',
      pixType: courier.pixType ?? 'CPF',
      pixHolder: courier.pixHolder ?? '',
      vehicleNotes: courier.vehicleNotes ?? '',
      cnhFile: courier.cnhFile ?? '',
      cnhFileObject: null,
      cnhValidUntil: courier.cnhValidUntil ?? '',
      notes: courier.notes ?? '',
      approvalStatus: courier.approvalStatus ?? courier.status ?? 'pending_approval',
      availabilityStatus: courier.availabilityStatus ?? courier.availability ?? 'offline',
      active: courier.active !== false,
    });
    setErrors({});
    setMessage('');
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

    let facePhotoPath = form.facePhoto;
    let crlvFilePath = form.crlvFile;
    let cnhFilePath = form.cnhFile;

    if (supabase) {
      setSaving(true);
      try {
        const folderBase = `couriers/${form.cityId || city.id}`;
        if (form.facePhotoFile) {
          facePhotoPath = await uploadStorageFile('courier-documents', `${folderBase}/face`, form.facePhotoFile);
        }
        if (form.crlvFileObject) {
          crlvFilePath = await uploadStorageFile('courier-documents', `${folderBase}/crlv`, form.crlvFileObject);
        }
        if (form.cnhFileObject) {
          cnhFilePath = await uploadStorageFile('courier-documents', `${folderBase}/cnh`, form.cnhFileObject);
        }
      } catch (uploadError) {
        setSaving(false);
        setErrors({ form: uploadError.message || 'Nao foi possivel enviar os documentos do entregador.' });
        return;
      }
    }

    const payload = {
      city_id: form.cityId || city.id,
      name: form.fullName.trim(),
      birth_date: form.birthDate,
      cpf: onlyDigits(form.cpf),
      phone: onlyDigits(form.phone),
      email: form.email.trim(),
      face_photo_path: facePhotoPath,
      whatsapp_validated: false,
      vehicle_type: 'Moto',
      vehicle_plate: form.plate.toUpperCase(),
      pix_key: form.pix.trim(),
      pix_key_type: form.pixType,
      pix_holder_name: form.pixHolder.trim(),
      vehicle_notes: form.vehicleNotes.trim(),
      crlv_file_path: crlvFilePath,
      cnh_file_path: cnhFilePath,
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
      facePhoto: facePhotoPath,
      crlvFile: crlvFilePath,
      cnhFile: cnhFilePath,
      plate: form.plate.toUpperCase(),
      status: form.approvalStatus,
      availability: form.availabilityStatus,
      rating: '0',
      totalDeliveries: '0',
    };

    if (supabase) {
      const { data, error } = editingCourierId
        ? await supabase
            .from('couriers')
            .update(payload)
            .eq('id', editingCourierId)
            .select('id, city_id, name, birth_date, cpf, phone, email, face_photo_path, whatsapp_validated, vehicle_type, vehicle_plate, pix_key, pix_key_type, pix_holder_name, vehicle_notes, crlv_file_path, cnh_file_path, cnh_valid_until, internal_notes, approval_status, availability_status, rating, active')
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
      } else if (!editingCourierId && data?.temporaryPassword) {
        await copyText(data.temporaryPassword);
        setMessage(`Entregador cadastrado. Senha temporaria: ${data.temporaryPassword}`);
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
          ? 'Entregador cadastrado. Se o e-mail ja existia no Auth, a senha temporaria foi atualizada.'
          : 'Entregador cadastrado.'
    ));
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
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setForm((current) => ({ ...current, facePhotoFile: file, facePhoto: file?.name || current.facePhoto }));
              }}
            />
            {form.facePhoto && <span className="field-help">Arquivo atual: {form.facePhoto.includes('/') ? form.facePhoto.split('/').pop() : form.facePhoto}</span>}
            {errors.facePhoto && <span className="field-error">{errors.facePhoto}</span>}
          </label>
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
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setForm((current) => ({ ...current, cnhFileObject: file, cnhFile: file?.name || current.cnhFile }));
              }}
            />
            {form.cnhFile && <span className="field-help">Arquivo atual: {form.cnhFile.includes('/') ? form.cnhFile.split('/').pop() : form.cnhFile}</span>}
            {errors.cnhFile && <span className="field-error">{errors.cnhFile}</span>}
          </label>
          <label>
            Documento do veiculo CRLV
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setForm((current) => ({ ...current, crlvFileObject: file, crlvFile: file?.name || current.crlvFile }));
              }}
            />
            {form.crlvFile && <span className="field-help">Arquivo atual: {form.crlvFile.includes('/') ? form.crlvFile.split('/').pop() : form.crlvFile}</span>}
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
    </section>
  );
}

function courierStatusLabel(courier) {
  if (courier.active === false) return 'Cadastro nao ativado';
  if ((courier.status || courier.approvalStatus) === 'approved') return 'Aprovado';
  if ((courier.status || courier.approvalStatus) === 'blocked') return 'Bloqueado';
  if ((courier.status || courier.approvalStatus) === 'rejected') return 'Rejeitado';
  return 'Pendente';
}

function courierReceivableAmount(courier, index) {
  const source = `${courier.id || courier.email || courier.fullName || index}`;
  const seed = source.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return 45 + ((seed + index * 37) % 420);
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function storeApprovalLabel(store) {
  if (store.active === false) return 'Nao aprovada';
  return 'Aprovada';
}

function storeStatusLabel(store) {
  if (store.active === false) return 'Nao aprovada';
  if (store.isOpen === false) return 'Fechada';
  return 'Aberta';
}

function storeReceivableAmount(store, index) {
  const source = `${store.id || store.email || store.name || index}`;
  const seed = source.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return 120 + ((seed + index * 53) % 980);
}

export function StoreCenterView({ city, stores, onChangeStores, onEditStore }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [message, setMessage] = React.useState('');
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStores = stores.filter((store) => {
    const status = storeStatusLabel(store);
    const searchable = [store.name, store.fantasyName, store.whatsapp, store.email, store.document].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
    const matchesFilter =
      filter === 'all'
      || (filter === 'inactive' && store.active === false)
      || (filter === 'closed' && store.isOpen === false)
      || (filter === 'active' && store.active !== false && store.isOpen !== false);
    return matchesSearch && matchesFilter;
  });
  const inactiveCount = stores.filter((store) => store.active === false).length;
  const totalReceivable = stores.reduce((total, store, index) => total + storeReceivableAmount(store, index), 0);

  async function toggleStoreApproval(store) {
    const nextActive = store.active === false;
    setMessage('');

    if (supabase) {
      const { error } = await supabase
        .from('stores')
        .update({ active: nextActive })
        .eq('id', store.id);

      if (error) {
        setMessage(error.message);
        return;
      }
    }

    onChangeStores((current) => current.map((item) => (
      item.id === store.id ? { ...item, active: nextActive } : item
    )));
    setMessage(nextActive ? 'Loja aprovada.' : 'Loja marcada como nao aprovada.');
  }

  async function deleteStore(store) {
    setMessage('');

    if (supabase) {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', store.id);

      if (error) {
        setMessage(error.message);
        return;
      }
    }

    onChangeStores((current) => current.filter((item) => item.id !== store.id));
    setMessage('Loja excluida.');
  }

  return (
    <section className="courier-center-layout store-center-layout">
      <div className="courier-center-hero panel">
        <div>
          <span className="section-eyebrow">Central de lojas</span>
          <h2>Lojas de {city.name}</h2>
          <p>Consulte cadastros, status operacional e valores vinculados as lojas.</p>
        </div>
        <div className="courier-center-summary">
          <span><strong>{stores.length}</strong> cadastros</span>
          <span><strong>{inactiveCount}</strong> nao aprovadas</span>
          <span><strong>{formatCurrency(totalReceivable)}</strong> em pedidos</span>
        </div>
      </div>

      <div className="panel courier-center-panel">
        <div className="courier-center-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Pesquisar por loja, CNPJ, telefone ou e-mail" />
          </label>
          <label className="filter-field">
            Status
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Todas</option>
              <option value="active">Aprovadas e abertas</option>
              <option value="closed">Fechadas</option>
              <option value="inactive">Nao aprovadas</option>
            </select>
          </label>
        </div>

        {message && <p className={message.includes('erro') || message.includes('permission') ? 'field-error' : 'success-message'}>{message}</p>}

        <div className="courier-center-table" role="table" aria-label="Dados das lojas">
          <div className="courier-center-head" role="row">
            <span>Loja</span>
            <span>Contato</span>
            <span>Aprovacao</span>
            <span>Valores</span>
            <span>Acoes</span>
          </div>
          {filteredStores.length === 0 && (
            <p className="empty-state">Nenhuma loja encontrada para o filtro atual.</p>
          )}
          {filteredStores.map((store, index) => {
            const status = storeStatusLabel(store);
            const needsActivation = store.active === false;
            const approval = storeApprovalLabel(store);
            return (
              <article className="courier-center-row" role="row" key={store.id || store.email}>
                <div className="courier-identity">
                  <div className="avatar small">{initials(store.fantasyName || store.name || 'Loja')}</div>
                  <div>
                    <strong>{store.fantasyName || store.name || 'Sem nome'}</strong>
                    <span>{store.type || 'Loja'} - {store.document ? maskCnpj(store.document) : 'Sem CNPJ'}</span>
                  </div>
                </div>
                <div>
                  <strong>{store.whatsapp ? maskPhone(store.whatsapp) : 'Sem telefone'}</strong>
                  <span>{store.email || 'Sem e-mail'}</span>
                </div>
                <div>
                  <mark className={`status-tag ${needsActivation ? 'pending' : 'active'}`}>{approval}</mark>
                  <span>{status}</span>
                  <span>{store.address || 'Endereco nao informado'}</span>
                </div>
                <div>
                  <strong>{formatCurrency(storeReceivableAmount(store, index))}</strong>
                  <span>Pedidos e taxas</span>
                </div>
                <div className="row-actions">
                  <button className="toggle-button" type="button" onClick={() => onEditStore(store)}>Editar</button>
                  <button className="toggle-button highlight" type="button" onClick={() => toggleStoreApproval(store)}>
                    {needsActivation ? 'Aprovar' : 'Reprovar'}
                  </button>
                  <button className="toggle-button danger" type="button" onClick={() => deleteStore(store)}>Excluir</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CourierCenterView({ city, couriers, onChangeCouriers, onEditCourier }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [passwordCourier, setPasswordCourier] = React.useState(null);
  const [temporaryPassword, setTemporaryPassword] = React.useState('');
  const [passwordMessage, setPasswordMessage] = React.useState('');
  const [fileMessage, setFileMessage] = React.useState('');
  const [savingPassword, setSavingPassword] = React.useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCouriers = couriers.filter((courier) => {
    const status = courierStatusLabel(courier);
    const searchable = [courier.fullName, courier.phone, courier.email].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
    const matchesFilter =
      filter === 'all'
      || (filter === 'inactive' && courier.active === false)
      || (filter === 'pending' && ['Pendente', 'Cadastro nao ativado'].includes(status))
      || (filter === 'approved' && status === 'Aprovado');
    return matchesSearch && matchesFilter;
  });
  const pendingCount = couriers.filter((courier) => ['Pendente', 'Cadastro nao ativado'].includes(courierStatusLabel(courier))).length;
  const totalReceivable = couriers.reduce((total, courier, index) => total + courierReceivableAmount(courier, index), 0);

  function openPasswordModal(courier) {
    setPasswordCourier(courier);
    setTemporaryPassword('');
    setPasswordMessage('');
  }

  async function handleOpenCourierFile(courier, field, label) {
    setFileMessage('');
    try {
      await openStorageFile('courier-documents', courier[field]);
    } catch (fileError) {
      setFileMessage(`${label}: ${fileError.message || 'Nao foi possivel abrir o arquivo.'}`);
    }
  }

  function closePasswordModal() {
    setPasswordCourier(null);
    setTemporaryPassword('');
    setPasswordMessage('');
    setSavingPassword(false);
  }

  async function confirmTemporaryPassword() {
    if (temporaryPassword.trim().length < 6) {
      setPasswordMessage('A senha precisa ter no minimo 6 caracteres.');
      return;
    }
    if (!supabase || !passwordCourier) {
      setPasswordMessage('Supabase nao configurado para criar senha.');
      return;
    }

    setSavingPassword(true);
    setPasswordMessage('');
    const courierPayload = {
      id: passwordCourier.id,
      city_id: passwordCourier.cityId || city.id,
      name: passwordCourier.fullName,
      birth_date: passwordCourier.birthDate || null,
      cpf: onlyDigits(passwordCourier.cpf || ''),
      phone: onlyDigits(passwordCourier.phone || ''),
      email: String(passwordCourier.email || '').trim().toLowerCase(),
      face_photo_path: passwordCourier.facePhoto || '',
      whatsapp_validated: false,
      vehicle_type: 'Moto',
      vehicle_plate: passwordCourier.plate || '',
      pix_key: passwordCourier.pix || '',
      pix_key_type: passwordCourier.pixType || 'CPF',
      pix_holder_name: passwordCourier.pixHolder || '',
      vehicle_notes: passwordCourier.vehicleNotes || '',
      crlv_file_path: passwordCourier.crlvFile || '',
      cnh_file_path: passwordCourier.cnhFile || '',
      cnh_valid_until: passwordCourier.cnhValidUntil || null,
      approval_status: 'approved',
      availability_status: passwordCourier.availability || passwordCourier.availabilityStatus || 'offline',
      internal_notes: passwordCourier.notes || '',
      active: true,
      available: (passwordCourier.availability || passwordCourier.availabilityStatus) === 'available',
    };

    const { data, error } = await supabase.functions.invoke('create-courier-invite', {
      body: {
        courier: courierPayload,
        temporaryPassword: temporaryPassword.trim(),
      },
    });
    setSavingPassword(false);

    if (error) {
      setPasswordMessage(await functionErrorMessage(error, 'Nao foi possivel criar o acesso do motoboy.'));
      return;
    }

    await copyText(temporaryPassword.trim());
    if (data?.courier) {
      onChangeCouriers((current) => current.map((courier) => (
        courier.id === passwordCourier.id
          ? {
              ...courier,
              active: true,
              status: 'approved',
              approvalStatus: 'approved',
            }
          : courier
      )));
    }
    setPasswordMessage('Senha provisoria criada no Auth e copiada. O motoboy ja pode fazer login.');
  }

  return (
    <section className="courier-center-layout">
      <div className="courier-center-hero panel">
        <div>
          <span className="section-eyebrow">Central do entregador</span>
          <h2>Entregadores de {city.name}</h2>
          <p>Consulte cadastros, status de ativacao e valores a receber dos motoboys.</p>
        </div>
        <div className="courier-center-summary">
          <span><strong>{couriers.length}</strong> cadastros</span>
          <span><strong>{pendingCount}</strong> pendentes</span>
          <span><strong>{formatCurrency(totalReceivable)}</strong> a receber</span>
        </div>
      </div>

      <div className="panel courier-center-panel">
        <div className="courier-center-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Pesquisar por nome, telefone ou e-mail" />
          </label>
          <label className="filter-field">
            Status
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="inactive">Cadastro nao ativado</option>
              <option value="pending">Pendente para concluir</option>
              <option value="approved">Aprovado</option>
            </select>
          </label>
        </div>

        <div className="courier-center-table" role="table" aria-label="Dados dos entregadores">
          <div className="courier-center-head" role="row">
            <span>Entregador</span>
            <span>Contato</span>
            <span>Status</span>
            <span>Valores</span>
            <span>Acoes</span>
          </div>
          {filteredCouriers.length === 0 && (
            <p className="empty-state">Nenhum entregador encontrado para o filtro atual.</p>
          )}
          {fileMessage && <p className="field-error">{fileMessage}</p>}
          {filteredCouriers.map((courier, index) => {
            const status = courierStatusLabel(courier);
            const needsActivation = status === 'Cadastro nao ativado' || status === 'Pendente';
            return (
              <article className="courier-center-row" role="row" key={courier.id || courier.email}>
                <div className="courier-identity">
                  <div className="avatar small">{initials(courier.fullName || 'Motoboy')}</div>
                  <div>
                    <strong>{courier.fullName || 'Sem nome'}</strong>
                    <span>{courier.plate || 'Sem placa'} - {courier.vehicle || 'Moto'}</span>
                  </div>
                </div>
                <div>
                  <strong>{courier.phone || 'Sem telefone'}</strong>
                  <span>{courier.email || 'Sem e-mail'}</span>
                </div>
                <div>
                  <mark className={`status-tag ${needsActivation ? 'pending' : 'active'}`}>{status}</mark>
                  <span>{courier.availability || courier.availabilityStatus || 'offline'}</span>
                </div>
                <div>
                  <strong>{formatCurrency(courierReceivableAmount(courier, index))}</strong>
                  <span>Repasses em aberto</span>
                </div>
                <div className="row-actions">
                  <button className="toggle-button" type="button" onClick={() => onEditCourier(courier)}>Editar</button>
                  {courier.facePhoto && (
                    <button className="toggle-button" type="button" onClick={() => handleOpenCourierFile(courier, 'facePhoto', 'Foto do rosto')}>Foto rosto</button>
                  )}
                  {courier.cnhFile && (
                    <button className="toggle-button" type="button" onClick={() => handleOpenCourierFile(courier, 'cnhFile', 'CNH')}>CNH</button>
                  )}
                  {needsActivation && (
                    <button className="toggle-button highlight" type="button" onClick={() => openPasswordModal(courier)}>Gerar senha</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {passwordCourier && (
        <div className="modal-backdrop" role="presentation">
          <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="courier-password-title">
            <div className="panel-header">
              <div>
                <span className="section-eyebrow">Senha provisoria</span>
                <h2 id="courier-password-title">Criar senha para {passwordCourier.fullName}</h2>
              </div>
              <button type="button" onClick={closePasswordModal}>Fechar</button>
            </div>
            <p className="form-note">Defina uma senha inicial para o motoboy acessar o sistema. Depois ele podera alterar a senha.</p>
            <label className="modal-password-field">
              Senha escolhida pelo admin
              <input
                value={temporaryPassword}
                onChange={(event) => {
                  setTemporaryPassword(event.target.value);
                  setPasswordMessage('');
                }}
                placeholder="Digite a senha provisoria"
                type="text"
                autoFocus
              />
            </label>
            <button className="primary-action" type="button" onClick={confirmTemporaryPassword} disabled={savingPassword}>
              {savingPassword ? 'Criando acesso...' : 'Confirmar senha provisoria'}
            </button>
            {passwordMessage && (
              <p className={passwordMessage.startsWith('Senha provisoria criada') ? 'success-message' : 'field-error'}>{passwordMessage}</p>
            )}
          </section>
        </div>
      )}
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

export function MapOnlyView({ city, couriers }) {
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
