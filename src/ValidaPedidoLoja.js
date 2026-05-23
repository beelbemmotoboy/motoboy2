const MINUTOS_MINIMOS_HORARIO_PREVISTO = 10;
const MINUTOS_MAXIMOS_HORARIO_PREVISTO = 720;
const VALOR_MINIMO_ENTREGA = 5;
const VALOR_MAXIMO_ENTREGA = 100;

export function validarPedidoLoja(pedido, agora = new Date()) {
  const validacaoHorario = validarHorarioPrevistoPedidoLoja(pedido?.estimatedTime, agora);
  if (!validacaoHorario.valido) return validacaoHorario;

  const validacaoTaxa = validarTaxaEntregaPedidoLoja(pedido?.deliveryFee);
  if (!validacaoTaxa.valido) return validacaoTaxa;

  return { valido: true, motivo: '', campo: '' };
}

export function validarHorarioPrevistoPedidoLoja(horarioPrevisto, agora = new Date()) {
  const horario = String(horarioPrevisto || '').trim();
  if (!horario) return { valido: true, motivo: '', campo: 'estimatedTime' };

  const dataPrevista = calcularDataHorarioPrevistoPedidoLoja(horario, agora);
  if (!dataPrevista) {
    return {
      valido: false,
      campo: 'estimatedTime',
      motivo: 'Horario previsto invalido. Use o formato HH:MM.',
    };
  }

  const diferencaMinutos = calcularMinutosAteHorarioPrevistoPedidoLoja(horario, agora);
  if (diferencaMinutos === null) {
    return {
      valido: false,
      campo: 'estimatedTime',
      motivo: 'Horario previsto invalido. Use um horario entre 00:00 e 23:59.',
    };
  }

  if (diferencaMinutos < MINUTOS_MINIMOS_HORARIO_PREVISTO) {
    return {
      valido: false,
      campo: 'estimatedTime',
      motivo: 'Horario previsto precisa ser pelo menos 10 minutos apos o horario atual.',
    };
  }

  if (diferencaMinutos > MINUTOS_MAXIMOS_HORARIO_PREVISTO) {
    return {
      valido: false,
      campo: 'estimatedTime',
      motivo: 'Horario previsto nao pode ser maior que 12 horas do horario atual.',
    };
  }

  return { valido: true, motivo: '', campo: 'estimatedTime' };
}

export function calcularMinutosAteHorarioPrevistoPedidoLoja(horarioPrevisto, agora = new Date()) {
  const dataPrevista = calcularDataHorarioPrevistoPedidoLoja(horarioPrevisto, agora);
  if (!dataPrevista) return null;
  return Math.max(0, Math.round((dataPrevista.getTime() - agora.getTime()) / 60000));
}

function calcularDataHorarioPrevistoPedidoLoja(horarioPrevisto, agora = new Date()) {
  const partes = String(horarioPrevisto || '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!partes) return null;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return null;

  const dataPrevista = new Date(agora);
  dataPrevista.setHours(horas, minutos, 0, 0);
  if (dataPrevista < agora) dataPrevista.setDate(dataPrevista.getDate() + 1);
  return dataPrevista;
}

export function validarTaxaEntregaPedidoLoja(taxaEntrega) {
  const valor = parseValorMonetarioPedidoLoja(taxaEntrega);
  if (valor === null) {
    return {
      valido: false,
      campo: 'deliveryFee',
      motivo: 'Informe o valor da entrega.',
    };
  }

  if (valor < VALOR_MINIMO_ENTREGA) {
    return {
      valido: false,
      campo: 'deliveryFee',
      motivo: 'Valor da entrega nao pode ser menor que R$ 5,00.',
    };
  }

  if (valor > VALOR_MAXIMO_ENTREGA) {
    return {
      valido: false,
      campo: 'deliveryFee',
      motivo: 'Valor da entrega nao pode ser maior que R$ 100,00.',
    };
  }

  return { valido: true, motivo: '', campo: 'deliveryFee' };
}

export function parseValorMonetarioPedidoLoja(valor) {
  const texto = String(valor || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}
