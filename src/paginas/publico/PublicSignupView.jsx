import React from 'react';
import { supabase } from '../../supabaseClient';
import { isValidCep, isValidCnpj, isValidCpf, isValidEmail, isValidPhone, maskCep, maskCnpj, maskCpf, maskPhone, onlyDigits } from '../../utils/validators';
import beeIcon from '../../../imagem/icone.png';

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

export function PublicSignupView({ type }) {
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
