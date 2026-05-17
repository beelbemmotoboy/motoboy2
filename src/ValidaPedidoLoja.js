const MINUTOS_MINIMOS_HORARIO_PREVISTO = 10;
const MINUTOS_MAXIMOS_HORARIO_PREVISTO = 180;

export function validarPedidoLoja(pedido, agora = new Date()) {
  const validacaoHorario = validarHorarioPrevistoPedidoLoja(pedido?.estimatedTime, agora);
  if (!validacaoHorario.valido) return validacaoHorario;

  return { valido: true, motivo: '', campo: '' };
}

export function validarHorarioPrevistoPedidoLoja(horarioPrevisto, agora = new Date()) {
  const horario = String(horarioPrevisto || '').trim();
  if (!horario) return { valido: true, motivo: '', campo: 'estimatedTime' };

  const partes = horario.match(/^(\d{2}):(\d{2})$/);
  if (!partes) {
    return {
      valido: false,
      campo: 'estimatedTime',
      motivo: 'Horario previsto invalido. Use o formato HH:MM.',
    };
  }

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) {
    return {
      valido: false,
      campo: 'estimatedTime',
      motivo: 'Horario previsto invalido. Use um horario entre 00:00 e 23:59.',
    };
  }

  const dataPrevista = new Date(agora);
  dataPrevista.setHours(horas, minutos, 0, 0);
  if (dataPrevista < agora) dataPrevista.setDate(dataPrevista.getDate() + 1);

  const diferencaMinutos = (dataPrevista.getTime() - agora.getTime()) / 60000;
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
      motivo: 'Horario previsto nao pode ser maior que 3 horas do horario atual.',
    };
  }

  return { valido: true, motivo: '', campo: 'estimatedTime' };
}
