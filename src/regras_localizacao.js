export const CONFIGURACOES_PADRAO_CORRIDA = {
  raio_maximo_para_oferecer_entrega_km: 3,
  limite_entregas_simultaneas_por_motoboy: 3,
  desvio_maximo_permitido_km: 3,
  tempo_extra_maximo_permitido_minutos: 10,
  permitir_entregas_mesma_loja: true,
  permitir_entregas_no_mesmo_sentido: true,
  velocidade_media_km_h: 24,
  diferenca_direcao_maxima_graus: 55,
};

const RAIO_TERRA_KM = 6371;

export function normalizar_localizacao(localizacao) {
  if (!localizacao) return null;

  const latitude = parseNumeroCoordenada(
    localizacao.latitude
      ?? localizacao.lat
      ?? localizacao.customerLatitude
      ?? localizacao.storeLatitude
      ?? localizacao.customer_latitude
      ?? localizacao.latitude_cliente
      ?? localizacao.latitude_loja
  );
  const longitude = parseNumeroCoordenada(
    localizacao.longitude
      ?? localizacao.lng
      ?? localizacao.lon
      ?? localizacao.customerLongitude
      ?? localizacao.storeLongitude
      ?? localizacao.customer_longitude
      ?? localizacao.longitude_cliente
      ?? localizacao.longitude_loja
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function calcular_distancia_km(origem, destino) {
  const pontoOrigem = normalizar_localizacao(origem);
  const pontoDestino = normalizar_localizacao(destino);
  if (!pontoOrigem || !pontoDestino) return null;

  const deltaLat = grausParaRadianos(pontoDestino.latitude - pontoOrigem.latitude);
  const deltaLng = grausParaRadianos(pontoDestino.longitude - pontoOrigem.longitude);
  const lat1 = grausParaRadianos(pontoOrigem.latitude);
  const lat2 = grausParaRadianos(pontoDestino.latitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAIO_TERRA_KM * c;
}

export function calcular_direcao_graus(origem, destino) {
  const pontoOrigem = normalizar_localizacao(origem);
  const pontoDestino = normalizar_localizacao(destino);
  if (!pontoOrigem || !pontoDestino) return null;

  const lat1 = grausParaRadianos(pontoOrigem.latitude);
  const lat2 = grausParaRadianos(pontoDestino.latitude);
  const deltaLng = grausParaRadianos(pontoDestino.longitude - pontoOrigem.longitude);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (radianosParaGraus(Math.atan2(y, x)) + 360) % 360;
}

export function calcular_diferenca_direcao_graus(direcaoA, direcaoB) {
  if (!Number.isFinite(direcaoA) || !Number.isFinite(direcaoB)) return null;
  const diferenca = Math.abs(direcaoA - direcaoB) % 360;
  return diferenca > 180 ? 360 - diferenca : diferenca;
}

export function estimar_tempo_extra_minutos(distanciaKm, velocidadeMediaKmH = CONFIGURACOES_PADRAO_CORRIDA.velocidade_media_km_h) {
  if (!Number.isFinite(distanciaKm) || distanciaKm < 0 || !Number.isFinite(velocidadeMediaKmH) || velocidadeMediaKmH <= 0) {
    return null;
  }
  return (distanciaKm / velocidadeMediaKmH) * 60;
}

export function calcular_distancia_ponto_segmento_km(ponto, inicioSegmento, fimSegmento) {
  const pontoNormalizado = normalizar_localizacao(ponto);
  const inicio = normalizar_localizacao(inicioSegmento);
  const fim = normalizar_localizacao(fimSegmento);
  if (!pontoNormalizado || !inicio || !fim) return null;

  const referenciaLat = grausParaRadianos((inicio.latitude + fim.latitude + pontoNormalizado.latitude) / 3);
  const projetar = (localizacao) => ({
    x: RAIO_TERRA_KM * grausParaRadianos(localizacao.longitude) * Math.cos(referenciaLat),
    y: RAIO_TERRA_KM * grausParaRadianos(localizacao.latitude),
  });
  const p = projetar(pontoNormalizado);
  const a = projetar(inicio);
  const b = projetar(fim);
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const ab2 = abX ** 2 + abY ** 2;
  if (ab2 === 0) return calcular_distancia_km(pontoNormalizado, inicio);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abX + (p.y - a.y) * abY) / ab2));
  const maisProximo = {
    x: a.x + t * abX,
    y: a.y + t * abY,
  };
  return Math.hypot(p.x - maisProximo.x, p.y - maisProximo.y);
}

export function calcular_distancia_ponto_rota_km(ponto, rotaEstimativaAtual = []) {
  const pontoNormalizado = normalizar_localizacao(ponto);
  const rota = normalizar_rota_estimativa(rotaEstimativaAtual);
  if (!pontoNormalizado || rota.length === 0) return null;
  if (rota.length === 1) return calcular_distancia_km(pontoNormalizado, rota[0]);

  return rota.slice(0, -1).reduce((menorDistancia, inicio, index) => {
    const distancia = calcular_distancia_ponto_segmento_km(pontoNormalizado, inicio, rota[index + 1]);
    if (distancia === null) return menorDistancia;
    return Math.min(menorDistancia, distancia);
  }, Infinity);
}

export function normalizar_rota_estimativa(rotaEstimativaAtual = []) {
  const rota = Array.isArray(rotaEstimativaAtual)
    ? rotaEstimativaAtual
    : [rotaEstimativaAtual.origem, ...(rotaEstimativaAtual.paradas || []), rotaEstimativaAtual.destino];
  return rota.map(normalizar_localizacao).filter(Boolean);
}

export function verificar_motoboy_proximo_da_loja({ localizacao_motoboy, localizacao_loja, raio_maximo_km = CONFIGURACOES_PADRAO_CORRIDA.raio_maximo_para_oferecer_entrega_km }) {
  const distancia_km = calcular_distancia_km(localizacao_motoboy, localizacao_loja);
  if (distancia_km === null) {
    return {
      permitido: false,
      distancia_km: null,
      motivo: 'Localizacao do motoboy ou da loja indisponivel.',
    };
  }

  const permitido = distancia_km <= raio_maximo_km;
  return {
    permitido,
    distancia_km: arredondar(distancia_km),
    motivo: permitido
      ? 'Motoboy dentro do raio permitido da loja.'
      : `Motoboy fora do raio permitido da loja (${raio_maximo_km} km).`,
  };
}

export function verificar_entrega_no_raio_do_trajeto({ localizacao_atual_motoboy, rota_estimativa_atual = [], nova_corrida, raio_maximo_km = CONFIGURACOES_PADRAO_CORRIDA.raio_maximo_para_oferecer_entrega_km }) {
  const localizacaoLoja = extrair_localizacao_loja(nova_corrida);
  const localizacaoDestino = extrair_localizacao_destino(nova_corrida);
  const rota = normalizar_rota_estimativa(rota_estimativa_atual);
  const pontosParaAvaliar = [
    { tipo: 'loja', localizacao: localizacaoLoja },
    { tipo: 'destino', localizacao: localizacaoDestino },
  ].filter((item) => item.localizacao);

  if (!normalizar_localizacao(localizacao_atual_motoboy) && rota.length === 0) {
    return {
      permitido: false,
      distancia_ate_rota_km: null,
      motivo: 'Localizacao atual ou rota estimada indisponivel.',
    };
  }
  if (pontosParaAvaliar.length === 0) {
    return {
      permitido: false,
      distancia_ate_rota_km: null,
      motivo: 'Nova corrida sem coordenadas de loja ou destino.',
    };
  }

  const distancias = pontosParaAvaliar.flatMap((item) => {
    const distanciaAtual = calcular_distancia_km(localizacao_atual_motoboy, item.localizacao);
    const distanciaRota = calcular_distancia_ponto_rota_km(item.localizacao, rota);
    return [
      distanciaAtual !== null ? { tipo: item.tipo, origem: 'posicao_atual', distancia: distanciaAtual } : null,
      distanciaRota !== null ? { tipo: item.tipo, origem: 'rota', distancia: distanciaRota } : null,
    ].filter(Boolean);
  });

  if (distancias.length === 0) {
    return {
      permitido: false,
      distancia_ate_rota_km: null,
      motivo: 'Nao foi possivel medir distancia ate a rota.',
    };
  }

  const menor = distancias.reduce((melhor, item) => (item.distancia < melhor.distancia ? item : melhor), distancias[0]);
  const permitido = menor.distancia <= raio_maximo_km;
  return {
    permitido,
    distancia_ate_rota_km: arredondar(menor.distancia),
    ponto_referencia: menor.tipo,
    origem_referencia: menor.origem,
    motivo: permitido
      ? 'Nova corrida dentro do raio permitido da rota ou posicao atual.'
      : `Nova corrida fora do raio maximo de ${raio_maximo_km} km da rota ou posicao atual.`,
  };
}

export function extrair_localizacao_loja(corrida) {
  return normalizar_localizacao(
    corrida?.localizacao_loja
      ?? corrida?.loja
      ?? corrida?.store
      ?? corrida?.stores
      ?? {
        latitude: corrida?.storeLatitude ?? corrida?.store_latitude ?? corrida?.latitude_loja,
        longitude: corrida?.storeLongitude ?? corrida?.store_longitude ?? corrida?.longitude_loja,
      }
  );
}

export function extrair_localizacao_destino(corrida) {
  return normalizar_localizacao(
    corrida?.localizacao_destino
      ?? corrida?.destino
      ?? corrida?.cliente
      ?? corrida?.customer
      ?? corrida?.customers
      ?? {
        latitude: corrida?.customerLatitude ?? corrida?.customer_latitude ?? corrida?.latitude_cliente,
        longitude: corrida?.customerLongitude ?? corrida?.customer_longitude ?? corrida?.longitude_cliente,
      }
  );
}

export function arredondar(valor, casas = 2) {
  if (!Number.isFinite(valor)) return valor;
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function parseNumeroCoordenada(value) {
  if (value === null || value === undefined || value === '') return null;
  const numero = Number(String(value).replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function grausParaRadianos(graus) {
  return graus * (Math.PI / 180);
}

function radianosParaGraus(radianos) {
  return radianos * (180 / Math.PI);
}
