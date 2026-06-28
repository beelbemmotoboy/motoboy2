const BRASIL_API_CNPJ_URL = 'https://brasilapi.com.br/api/cnpj/v1';

export function onlyCnpjDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 14);
}

export function isValidCnpj(value) {
  const digits = onlyCnpjDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  const calculateDigit = (base, weights) => {
    const total = base
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(`${digits.slice(0, 12)}${firstDigit}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${firstDigit}${secondDigit}`);
}

export function formatCnpj(value) {
  const digits = onlyCnpjDigits(value);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function joinPhone(areaCode, number) {
  const digits = `${areaCode || ''}${number || ''}`.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

export function mapCnpjCompany(data = {}) {
  const phone = data.ddd_telefone_1 || data.ddd_telefone_2 || '';
  const [areaCode = '', phoneNumber = ''] = String(phone).split(/\s+/);
  return {
    cnpj: formatCnpj(data.cnpj || ''),
    razaoSocial: data.razao_social || '',
    nomeFantasia: data.nome_fantasia || '',
    telefone: joinPhone(areaCode, phoneNumber) || phone,
    email: String(data.email || '').toLowerCase(),
    cep: String(data.cep || ''),
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    uf: data.uf || '',
  };
}

export async function lookupCnpj(cnpj) {
  const digits = onlyCnpjDigits(cnpj);
  if (!isValidCnpj(digits)) throw new Error('Informe um CNPJ valido.');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${BRASIL_API_CNPJ_URL}/${digits}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.name || 'CNPJ nao encontrado.');
    }
    return mapCnpjCompany(payload);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A consulta do CNPJ demorou demais. Tente novamente.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
