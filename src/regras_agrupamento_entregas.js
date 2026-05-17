import {
  CONFIGURACOES_PADRAO_CORRIDA,
  arredondar,
  calcular_diferenca_direcao_graus,
  calcular_direcao_graus,
  calcular_distancia_km,
  estimar_tempo_extra_minutos,
  extrair_localizacao_destino,
  extrair_localizacao_loja,
  verificar_entrega_no_raio_do_trajeto,
} from './regras_localizacao.js';

export { CONFIGURACOES_PADRAO_CORRIDA } from './regras_localizacao.js';

export const STATUS_PERMITEM_ENTREGA_EXTRA = new Set([
  'aceita',
  'accepted',
  'assigned',
  'indo_para_loja',
  'chegou_na_loja',
  'retirada',
  'picked_up',
  'indo_para_cliente',
  'on_route',
]);

export const STATUS_NAO_PERMITEM_ENTREGA_EXTRA = new Set([
  'entregue',
  'delivered',
  'cancelada',
  'cancelled',
  'recusada',
  'rejected',
  'expirada',
  'expired',
  'pendente_manual',
]);

export const STATUS_NOVA_CORRIDA_AGRUPAVEL = new Set([
  'pending',
  'pendente',
  'waiting',
  'offered',
]);

export function verificar_entrega_mesma_loja({ corrida_aceita, nova_corrida }) {
  const lojaAceita = extrairIdLoja(corrida_aceita);
  const lojaNova = extrairIdLoja(nova_corrida);

  if (!lojaAceita || !lojaNova) {
    return {
      permitido: false,
      motivo: 'Nao foi possivel identificar a loja das corridas.',
    };
  }

  const permitido = lojaAceita === lojaNova;
  return {
    permitido,
    motivo: permitido ? 'Corridas saem da mesma loja.' : 'Corridas saem de lojas diferentes.',
  };
}

export function verificar_mesmo_sentido_entrega({
  corrida_aceita,
  nova_corrida,
  configuracoes = CONFIGURACOES_PADRAO_CORRIDA,
} = {}) {
  const localizacaoLoja = extrair_localizacao_loja(corrida_aceita) || extrair_localizacao_loja(nova_corrida);
  const destinoAceito = extrair_localizacao_destino(corrida_aceita);
  const destinoNovo = extrair_localizacao_destino(nova_corrida);

  if (!localizacaoLoja || !destinoAceito || !destinoNovo) {
    return {
      permitido: false,
      motivo: 'Coordenadas insuficientes para comparar sentido das entregas.',
      grau_compatibilidade: 0,
      desvio_estimado_km: null,
    };
  }

  const direcaoAceita = calcular_direcao_graus(localizacaoLoja, destinoAceito);
  const direcaoNova = calcular_direcao_graus(localizacaoLoja, destinoNovo);
  const diferencaDirecao = calcular_diferenca_direcao_graus(direcaoAceita, direcaoNova);
  const distanciaEntreDestinos = calcular_distancia_km(destinoAceito, destinoNovo);
  const distanciaLojaDestinoAceito = calcular_distancia_km(localizacaoLoja, destinoAceito);
  const distanciaLojaDestinoNovo = calcular_distancia_km(localizacaoLoja, destinoNovo);
  const desvio_estimado_km = calcularDesvioEstimado({
    distanciaLojaDestinoAceito,
    distanciaLojaDestinoNovo,
    distanciaEntreDestinos,
  });
  const direcaoPermitida = diferencaDirecao !== null
    && diferencaDirecao <= configuracoes.diferenca_direcao_maxima_graus;
  const desvioPermitido = desvio_estimado_km !== null
    && desvio_estimado_km <= configuracoes.desvio_maximo_permitido_km;
  const grau_compatibilidade = calcularGrauCompatibilidade({
    diferencaDirecao,
    desvio_estimado_km,
    distanciaEntreDestinos,
    configuracoes,
  });
  const permitido = direcaoPermitida && desvioPermitido;

  return {
    permitido,
    motivo: permitido
      ? 'Nova entrega segue sentido aproximado e desvio aceitavel.'
      : motivoMesmoSentido({ direcaoPermitida, desvioPermitido, configuracoes }),
    grau_compatibilidade,
    desvio_estimado_km: arredondar(desvio_estimado_km),
    diferenca_direcao_graus: arredondar(diferencaDirecao),
    distancia_entre_destinos_km: arredondar(distanciaEntreDestinos),
  };
}

export function verificar_limite_entregas_simultaneas({
  motoboy,
  corridas_ativas_do_motoboy = [],
  limite_maximo = CONFIGURACOES_PADRAO_CORRIDA.limite_entregas_simultaneas_por_motoboy,
} = {}) {
  const quantidadeInformada = Number(motoboy?.quantidade_entregas_ativas ?? motoboy?.activeDeliveries);
  const quantidade_atual = Number.isFinite(quantidadeInformada)
    ? quantidadeInformada
    : corridas_ativas_do_motoboy.filter((corrida) => statusPermiteEntregaExtra(corrida?.status)).length;
  const permitido = quantidade_atual < limite_maximo;

  return {
    permitido,
    quantidade_atual,
    limite: limite_maximo,
    motivo: permitido
      ? 'Motoboy dentro do limite de entregas simultaneas.'
      : `Motoboy ja atingiu o limite de ${limite_maximo} entregas simultaneas.`,
  };
}

export function selecionar_entregas_compativeis_para_motoboy({
  motoboy,
  corrida_aceita,
  corridas_ativas_do_motoboy = [],
  lista_corridas_disponiveis = [],
  localizacao_atual_motoboy,
  rota_estimativa_atual,
  configuracoes = CONFIGURACOES_PADRAO_CORRIDA,
} = {}) {
  const limite = verificar_limite_entregas_simultaneas({
    motoboy,
    corridas_ativas_do_motoboy,
    limite_maximo: configuracoes.limite_entregas_simultaneas_por_motoboy,
  });

  const statusCorridaAceitaPermitido = statusPermiteEntregaExtra(corrida_aceita?.status);
  const corridas_compativeis = [];
  const corridas_rejeitadas = [];

  for (const nova_corrida of lista_corridas_disponiveis) {
    const avaliacao = avaliarCorridaExtra({
      motoboy,
      corrida_aceita,
      nova_corrida,
      localizacao_atual_motoboy,
      rota_estimativa_atual,
      limite,
      statusCorridaAceitaPermitido,
      configuracoes,
    });

    if (avaliacao.permitido) {
      corridas_compativeis.push(avaliacao);
    } else {
      corridas_rejeitadas.push({
        corrida: nova_corrida,
        motivos: avaliacao.motivos,
      });
    }
  }

  corridas_compativeis.sort(compararPrioridadeCorridaCompativel);

  return {
    corridas_compativeis,
    corridas_rejeitadas,
    sugestao_ordem_coleta_entrega: sugerirOrdemColetaEntrega(corrida_aceita, corridas_compativeis),
    impacto_estimado_tempo_total_minutos: arredondar(
      corridas_compativeis.reduce((total, item) => total + (item.tempo_extra_estimado_minutos || 0), 0)
    ),
  };
}

function avaliarCorridaExtra({
  motoboy,
  corrida_aceita,
  nova_corrida,
  localizacao_atual_motoboy,
  rota_estimativa_atual,
  limite,
  statusCorridaAceitaPermitido,
  configuracoes,
}) {
  const motivos = [];
  const ativa = statusCorridaAceitaPermitido;
  if (!ativa) motivos.push('Motoboy nao possui corrida em status que permita entrega extra.');
  if (!statusNovaCorridaAgrupavel(nova_corrida?.status)) motivos.push('Status da nova corrida nao permite agrupamento.');
  if (!limite.permitido) motivos.push(limite.motivo);

  const mesmaLoja = verificar_entrega_mesma_loja({ corrida_aceita, nova_corrida });
  if (configuracoes.permitir_entregas_mesma_loja && !mesmaLoja.permitido) motivos.push(mesmaLoja.motivo);

  const mesmoSentido = configuracoes.permitir_entregas_no_mesmo_sentido
    ? verificar_mesmo_sentido_entrega({ corrida_aceita, nova_corrida, configuracoes })
    : { permitido: true, grau_compatibilidade: 1, desvio_estimado_km: 0, motivo: 'Regra de mesmo sentido desativada.' };
  if (!mesmoSentido.permitido) motivos.push(mesmoSentido.motivo);

  const rota = rota_estimativa_atual || montarRotaEstimativa(corrida_aceita, localizacao_atual_motoboy);
  const raioTrajeto = verificar_entrega_no_raio_do_trajeto({
    localizacao_atual_motoboy,
    rota_estimativa_atual: rota,
    nova_corrida,
    raio_maximo_km: configuracoes.raio_maximo_para_oferecer_entrega_km,
  });
  if (!raioTrajeto.permitido) motivos.push(raioTrajeto.motivo);

  const desvioEstimado = Number(mesmoSentido.desvio_estimado_km ?? 0);
  const tempoExtra = estimar_tempo_extra_minutos(desvioEstimado, configuracoes.velocidade_media_km_h);
  const tempoExtraPermitido = tempoExtra !== null && tempoExtra <= configuracoes.tempo_extra_maximo_permitido_minutos;
  if (!tempoExtraPermitido) {
    motivos.push(`Tempo extra maior que ${configuracoes.tempo_extra_maximo_permitido_minutos} minutos.`);
  }

  const riscoAtraso = calcularRiscoAtraso({
    corrida_aceita,
    tempoExtraMinutos: tempoExtra,
    configuracoes,
  });
  if (riscoAtraso === 'alto') motivos.push('Risco de atraso alto para a entrega ja aceita.');

  const permitido = motivos.length === 0;
  return {
    permitido,
    corrida: nova_corrida,
    motivos,
    mensagem_motoboy: permitido ? 'Nova entrega compativel com sua rota' : null,
    mesma_loja: mesmaLoja.permitido,
    grau_compatibilidade: mesmoSentido.grau_compatibilidade,
    desvio_estimado_km: arredondar(desvioEstimado),
    distancia_extra_estimada_km: arredondar(desvioEstimado),
    tempo_extra_estimado_minutos: arredondar(tempoExtra),
    distancia_ate_rota_km: raioTrajeto.distancia_ate_rota_km,
    risco_atraso: riscoAtraso,
    valor_entrega: extrairValorEntrega(nova_corrida),
    criada_em: nova_corrida?.created_at || nova_corrida?.createdAt || '',
    sugestao_ordem_coleta_entrega: sugerirOrdemColetaEntrega(corrida_aceita, [{ corrida: nova_corrida }]),
  };
}

function compararPrioridadeCorridaCompativel(a, b) {
  return Number(b.mesma_loja) - Number(a.mesma_loja)
    || numeroOrdenavel(a.desvio_estimado_km) - numeroOrdenavel(b.desvio_estimado_km)
    || numeroOrdenavel(a.tempo_extra_estimado_minutos) - numeroOrdenavel(b.tempo_extra_estimado_minutos)
    || numeroOrdenavel(b.valor_entrega) - numeroOrdenavel(a.valor_entrega)
    || numeroOrdenavel(b.grau_compatibilidade) - numeroOrdenavel(a.grau_compatibilidade)
    || riscoValor(a.risco_atraso) - riscoValor(b.risco_atraso)
    || numeroOrdenavel(a.distancia_ate_rota_km) - numeroOrdenavel(b.distancia_ate_rota_km)
    || String(a.criada_em).localeCompare(String(b.criada_em));
}

function sugerirOrdemColetaEntrega(corrida_aceita, corridasCompativeis = []) {
  const entregasExtras = corridasCompativeis.map((item) => item.corrida || item);
  return {
    coleta: [
      criarReferenciaCorrida(corrida_aceita),
      ...entregasExtras.map(criarReferenciaCorrida),
    ].filter(Boolean),
    entrega: [
      criarReferenciaCorrida(corrida_aceita),
      ...entregasExtras
        .map((corrida) => ({
          corrida,
          distancia: calcular_distancia_km(extrair_localizacao_destino(corrida_aceita), extrair_localizacao_destino(corrida)),
        }))
        .sort((a, b) => numeroOrdenavel(a.distancia) - numeroOrdenavel(b.distancia))
        .map((item) => criarReferenciaCorrida(item.corrida)),
    ].filter(Boolean),
  };
}

function criarReferenciaCorrida(corrida) {
  if (!corrida) return null;
  return {
    id: corrida.id,
    codigo: corrida.code || corrida.order_code || corrida.orderCode || corrida.id,
    loja: corrida.store || corrida.storeName || corrida.stores?.fantasy_name || corrida.stores?.name || corrida.loja?.nome,
    cliente: corrida.customer || corrida.customerName || corrida.customers?.name || corrida.cliente?.nome,
  };
}

function montarRotaEstimativa(corrida, localizacaoAtual) {
  return [
    localizacaoAtual,
    extrair_localizacao_loja(corrida),
    extrair_localizacao_destino(corrida),
  ].filter(Boolean);
}

function calcularDesvioEstimado({ distanciaLojaDestinoAceito, distanciaLojaDestinoNovo, distanciaEntreDestinos }) {
  if (![distanciaLojaDestinoAceito, distanciaLojaDestinoNovo, distanciaEntreDestinos].every(Number.isFinite)) return null;
  const rotaComNovaEntrega = Math.min(
    distanciaLojaDestinoNovo + distanciaEntreDestinos,
    distanciaLojaDestinoAceito + distanciaEntreDestinos
  );
  const rotaOriginal = distanciaLojaDestinoAceito;
  return Math.max(0, rotaComNovaEntrega - rotaOriginal);
}

function calcularGrauCompatibilidade({ diferencaDirecao, desvio_estimado_km, distanciaEntreDestinos, configuracoes }) {
  if (![diferencaDirecao, desvio_estimado_km, distanciaEntreDestinos].every(Number.isFinite)) return 0;
  const direcaoScore = Math.max(0, 1 - (diferencaDirecao / 180));
  const desvioScore = Math.max(0, 1 - (desvio_estimado_km / Math.max(1, configuracoes.desvio_maximo_permitido_km)));
  const destinoScore = Math.max(0, 1 - (distanciaEntreDestinos / Math.max(1, configuracoes.raio_maximo_para_oferecer_entrega_km * 2)));
  return arredondar((direcaoScore * 0.45) + (desvioScore * 0.4) + (destinoScore * 0.15), 3);
}

function calcularRiscoAtraso({ corrida_aceita, tempoExtraMinutos, configuracoes }) {
  if (!Number.isFinite(tempoExtraMinutos)) return 'indefinido';
  if (tempoExtraMinutos > configuracoes.tempo_extra_maximo_permitido_minutos) return 'alto';
  const prazo = corrida_aceita?.deadlineAt || corrida_aceita?.delivery_deadline_at;
  if (!prazo) return tempoExtraMinutos > configuracoes.tempo_extra_maximo_permitido_minutos * 0.8 ? 'medio' : 'baixo';

  const minutosRestantes = (new Date(prazo).getTime() - Date.now()) / 60000;
  if (!Number.isFinite(minutosRestantes)) return 'indefinido';
  if (minutosRestantes - tempoExtraMinutos <= 3) return 'alto';
  if (minutosRestantes - tempoExtraMinutos <= 8) return 'medio';
  return 'baixo';
}

function statusPermiteEntregaExtra(status) {
  return STATUS_PERMITEM_ENTREGA_EXTRA.has(String(status || '').toLowerCase());
}

function statusNovaCorridaAgrupavel(status) {
  return STATUS_NOVA_CORRIDA_AGRUPAVEL.has(String(status || 'pending').toLowerCase())
    && !STATUS_NAO_PERMITEM_ENTREGA_EXTRA.has(String(status || '').toLowerCase());
}

function motivoMesmoSentido({ direcaoPermitida, desvioPermitido, configuracoes }) {
  if (!direcaoPermitida) return `Destino em sentido oposto ou acima de ${configuracoes.diferenca_direcao_maxima_graus} graus de diferenca.`;
  if (!desvioPermitido) return `Desvio maior que ${configuracoes.desvio_maximo_permitido_km} km.`;
  return 'Nova entrega nao atende aos criterios de mesmo sentido.';
}

function extrairIdLoja(corrida) {
  return corrida?.store_id
    || corrida?.storeId
    || corrida?.store?.id
    || corrida?.stores?.id
    || corrida?.loja?.id
    || corrida?.store;
}

function extrairValorEntrega(corrida) {
  const valor = corrida?.numericFee ?? corrida?.delivery_fee ?? corrida?.fee ?? corrida?.valor_entrega;
  if (typeof valor === 'string') {
    const normalizado = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  }
  return Number.isFinite(Number(valor)) ? Number(valor) : 0;
}

function numeroOrdenavel(valor) {
  return Number.isFinite(Number(valor)) ? Number(valor) : Number.POSITIVE_INFINITY;
}

function riscoValor(risco) {
  if (risco === 'baixo') return 0;
  if (risco === 'medio') return 1;
  if (risco === 'alto') return 2;
  return 3;
}
