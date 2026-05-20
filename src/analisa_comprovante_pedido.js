import { extrairCoordenadasDoLinkLocalizacao } from './cadastra_entrega.js';

const COMPROVANTE_IFOOD_TESTE = `
iFood
Senes Burger
EXPEDICAO
9869
Entrega Propria
CODIGO DE COLETA PARCEIRA: 5106
Data: 15/04/2026 - 21:37:59
Entrega prevista: 22:11
Localizador: 7204 3976
Primeiro pedido!
Oracio Silva
0800 700 3021 ID: 72043976
Endereco: R. Caiapo Q 32, 793
Comp: Casa
Bairro: Gameleira
Cidade: Rio Verde - GO - CEP: 75906737
ITENS DO PEDIDO (1)
1x Original Burger R$ 43,90
Valor total do pedido: R$ 43,90
Taxa de servico: R$ 0,99
Taxa de entrega: R$ 0,00
Cobrar do cliente: R$ 0,00
`;

export function analisarComprovantePedidoTeste({ arquivo, textoExtraido = '', linkLocalizacao = '' } = {}) {
  if (!arquivo && !String(textoExtraido || '').trim()) {
    return {
      ok: false,
      motivo: 'Envie uma foto do comprovante para analisar.',
      valores: null,
      coordenadas: null,
      avisos: [],
    };
  }

  const texto = String(textoExtraido || '').trim() || COMPROVANTE_IFOOD_TESTE;
  const valores = extrairValoresComprovanteIfood(texto);
  const coordenadas = extrairCoordenadasDoLinkLocalizacao(linkLocalizacao);
  const avisos = [
    'Leitura em modo teste. Nenhum dado foi gravado no banco.',
    'OCR real ainda nao esta conectado; esta tela valida o retorno visual do comprovante.',
  ];

  if (linkLocalizacao && !coordenadas) {
    avisos.push('Nao foi possivel extrair latitude e longitude do link informado.');
  }

  if (!valores.telefoneCliente) {
    avisos.push('Telefone do cliente nao encontrado no comprovante.');
  }

  return {
    ok: true,
    modo: 'teste',
    arquivo: arquivo ? {
      nome: arquivo.name || 'Foto selecionada',
      tipo: arquivo.type || '',
      tamanhoBytes: arquivo.size || 0,
    } : null,
    valores,
    coordenadas,
    avisos,
  };
}

export function transformarAnaliseEmPedidoLoja(analise) {
  const valores = analise?.valores || {};
  return {
    orderCode: valores.numeroPedido ? `IFOOD-${valores.numeroPedido}` : '',
    customerName: valores.cliente || '',
    customerPhone: valores.telefoneCliente || '',
    deliveryAddress: valores.endereco || '',
    deliveryDistrict: valores.bairro || '',
    deliveryComplement: valores.complemento || '',
    estimatedTime: valores.entregaPrevista || '',
    estimatedMinutes: '',
    customerLocationUrl: '',
    deliveryFee: '',
  };
}

function extrairValoresComprovanteIfood(texto) {
  const linhas = String(texto || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  return {
    origem: 'iFood',
    loja: extrairLinhaDepoisDe(linhas, 'iFood') || 'Senes Burger',
    numeroPedido: extrairNumeroPedido(linhas),
    codigoColeta: extrairMatch(texto, /CODIGO DE COLETA PARCEIRA:\s*(\d+)/i),
    entregaPrevista: extrairMatch(texto, /Entrega prevista:\s*(\d{2}:\d{2})/i),
    localizador: extrairMatch(texto, /Localizador:\s*([\d\s]+)/i)?.replace(/\s+/g, ' ').trim() || '',
    cliente: extrairCliente(linhas),
    telefoneCliente: '',
    endereco: extrairMatch(texto, /Endereco:\s*(.+)/i),
    complemento: extrairMatch(texto, /Comp:\s*(.+)/i),
    bairro: extrairMatch(texto, /Bairro:\s*(.+)/i),
    cidade: extrairCidade(texto),
    cep: extrairMatch(texto, /CEP:\s*(\d+)/i),
    itemPrincipal: extrairItemPrincipal(linhas),
    valorPedido: formatarMoedaExtraida(extrairMatch(texto, /Valor total do pedido:\s*R?\$?\s*([\d.,]+)/i)),
    taxaServico: formatarMoedaExtraida(extrairMatch(texto, /Taxa de servico:\s*R?\$?\s*([\d.,]+)/i)),
    taxaEntrega: formatarMoedaExtraida(extrairMatch(texto, /Taxa de entrega:\s*R?\$?\s*([\d.,]+)/i)),
    cobrarCliente: formatarMoedaExtraida(extrairMatch(texto, /Cobrar do cliente:\s*R?\$?\s*([\d.,]+)/i)),
  };
}

function extrairNumeroPedido(linhas) {
  const indiceExpedicao = linhas.findIndex((linha) => /^EXPEDICAO$/i.test(linha));
  if (indiceExpedicao >= 0) {
    const proximaLinhaNumerica = linhas.slice(indiceExpedicao + 1).find((linha) => /^\d{3,8}$/.test(linha));
    if (proximaLinhaNumerica) return proximaLinhaNumerica;
  }
  return linhas.find((linha) => /^\d{3,8}$/.test(linha)) || '';
}

function extrairCliente(linhas) {
  const indicePrimeiroPedido = linhas.findIndex((linha) => /^Primeiro pedido!?$/i.test(linha));
  if (indicePrimeiroPedido >= 0) return linhas[indicePrimeiroPedido + 1] || '';

  const indiceLocalizador = linhas.findIndex((linha) => /^Localizador:/i.test(linha));
  if (indiceLocalizador >= 0) {
    const candidato = linhas.slice(indiceLocalizador + 1).find((linha) => /^[A-Za-z\s]{3,}$/.test(linha));
    return candidato || '';
  }

  return '';
}

function extrairCidade(texto) {
  const cidadeLinha = extrairMatch(texto, /Cidade:\s*(.+?)(?:\s*-\s*CEP:|$)/i);
  return cidadeLinha ? cidadeLinha.trim() : '';
}

function extrairItemPrincipal(linhas) {
  const item = linhas.find((linha) => /^\d+x\s+/i.test(linha));
  if (!item) return '';
  return item.replace(/\s+R\$\s*[\d.,]+$/i, '').trim();
}

function extrairLinhaDepoisDe(linhas, marcador) {
  const indice = linhas.findIndex((linha) => linha.toLowerCase() === marcador.toLowerCase());
  return indice >= 0 ? linhas[indice + 1] || '' : '';
}

function extrairMatch(texto, regex) {
  const match = String(texto || '').match(regex);
  return match?.[1]?.trim() || '';
}

function formatarMoedaExtraida(valor) {
  if (!valor) return '';
  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero)) return '';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
