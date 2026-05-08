import zxcvbn from 'zxcvbn';

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function maskCnpj(value) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCep(value) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/^(\d{2})(\d{3})(\d)/, '$1.$2-$3');
}

export function maskCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function maskPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

export function isValidCep(value) {
  return onlyDigits(value).length === 8;
}

export function isValidPhone(value) {
  const length = onlyDigits(value).length;
  return length === 10 || length === 11;
}

export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);
  if (!cnpj) return false;
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const digit = (base) => {
    let size = base.length;
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i -= 1) {
      sum += Number(base.charAt(size - i)) * pos;
      pos -= 1;
      if (pos < 2) pos = 9;
    }
    return String(sum % 11 < 2 ? 0 : 11 - (sum % 11));
  };

  const base = cnpj.slice(0, 12);
  const digitOne = digit(base);
  const digitTwo = digit(base + digitOne);
  return cnpj.endsWith(digitOne + digitTwo);
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const digit = (base, factor) => {
    let sum = 0;
    for (let index = 0; index < base.length; index += 1) {
      sum += Number(base[index]) * (factor - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const first = digit(cpf.slice(0, 9), 10);
  const second = digit(cpf.slice(0, 10), 11);
  return first === Number(cpf[9]) && second === Number(cpf[10]);
}

export function validateStoreForm(form) {
  const errors = {};
  if (!isValidCnpj(form.document)) errors.document = 'CNPJ invalido.';
  if (!form.name.trim()) errors.name = 'Nome da loja e obrigatorio.';
  if (!form.responsible.trim()) errors.responsible = 'Responsavel e obrigatorio.';
  if (!isValidEmail(form.email)) errors.email = 'E-mail invalido.';
  if (!isValidPhone(form.whatsapp)) errors.whatsapp = 'WhatsApp invalido.';
  if (form.landline && !isValidPhone(form.landline)) errors.landline = 'Telefone invalido.';
  if (!form.address.trim()) errors.address = 'Endereco e obrigatorio.';
  if (!form.number.trim()) errors.number = 'Numero e obrigatorio.';
  if (!form.district.trim()) errors.district = 'Bairro e obrigatorio.';
  if (!isValidCep(form.zipCode)) errors.zipCode = 'CEP invalido.';
  return errors;
}

export function validateAccessUserForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Nome e obrigatorio.';
  if (!isValidEmail(form.email)) errors.email = 'E-mail invalido.';
  if (!isValidCpf(form.cpf)) errors.cpf = 'CPF invalido.';
  if (!isValidPhone(form.whatsapp)) errors.whatsapp = 'WhatsApp invalido.';
  if (!form.addressProof) errors.addressProof = 'Comprovante de endereco e obrigatorio.';
  if (form.role === 'store_admin' && !form.store) errors.store = 'Selecione a loja.';
  if (form.role === 'courier_admin' && !form.courier) errors.courier = 'Selecione o motoboy.';
  return errors;
}

export function validateCourierForm(form) {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = 'Nome completo e obrigatorio.';
  if (!form.birthDate) errors.birthDate = 'Data de nascimento e obrigatoria.';
  if (!isValidCpf(form.cpf)) errors.cpf = 'CPF invalido.';
  if (!isValidPhone(form.phone)) errors.phone = 'Telefone/WhatsApp invalido.';
  if (!isValidEmail(form.email)) errors.email = 'E-mail invalido.';
  if (!form.vehicle) errors.vehicle = 'Selecione o veiculo.';
  if (!form.plate.trim()) errors.plate = 'Placa e obrigatoria.';
  if (!form.pix.trim()) errors.pix = 'Chave Pix e obrigatoria.';
  if (!form.pixType) errors.pixType = 'Tipo da chave Pix e obrigatorio.';
  if (!form.pixHolder.trim()) errors.pixHolder = 'Nome do favorecido Pix e obrigatorio.';
  if (!form.facePhoto) errors.facePhoto = 'Foto do rosto e obrigatoria.';
  if (!form.cnhFile) errors.cnhFile = 'CNH e obrigatoria.';
  if (!form.cnhValidUntil) errors.cnhValidUntil = 'Validade da CNH e obrigatoria.';
  return errors;
}

export function passwordStrength(password) {
  const result = zxcvbn(password || '');
  const checks = {
    length: password.length >= 6,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  return {
    checks,
    score: result.score,
    feedback: result.feedback,
    valid: result.score >= 2 && Object.values(checks).every(Boolean),
  };
}
