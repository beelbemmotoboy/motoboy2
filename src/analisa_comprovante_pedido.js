import { extrairCoordenadasDoLinkLocalizacao } from './cadastra_entrega.js';

const GEMINI_MODEL_PADRAO = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || '';

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

export const geminiConfigStatus = {
  hasApiKey: Boolean(GEMINI_API_KEY),
  model: GEMINI_MODEL_PADRAO,
};

export async function analisarComprovantePedidoComGemini({
  arquivo,
  linkLocalizacao = '',
  apiKey = GEMINI_API_KEY,
  model = GEMINI_MODEL_PADRAO,
} = {}) {
  if (!arquivo) {
    return {
      ok: false,
      motivo: 'Tire ou envie uma foto do comprovante para analisar.',
      valores: null,
      coordenadas: null,
      avisos: [],
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      motivo: 'Configure a chave VITE_GEMINI_API_KEY para analisar a foto com Gemini.',
      valores: null,
      coordenadas: null,
      avisos: ['Nenhum dado foi gravado no banco.'],
    };
  }

  try {
    const imageData = await arquivoParaBase64(arquivo);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: arquivo.type || 'image/jpeg',
                data: imageData,
              },
            },
            { text: promptExtracaoComprovante() },
          ],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const motivo = data?.error?.message || 'Nao foi possivel analisar a foto com Gemini.';
      return {
        ok: false,
        motivo,
        valores: null,
        coordenadas: null,
        avisos: ['Nenhum dado foi gravado no banco.'],
      };
    }

    const text = extrairTextoGemini(data);
    const parsed = parseJsonGemini(text);
    if (!parsed) {
      return {
        ok: false,
        motivo: 'Gemini respondeu, mas nao retornou um JSON valido para o comprovante.',
        valores: null,
        coordenadas: null,
        avisos: ['Nenhum dado foi gravado no banco.'],
      };
    }

    const valores = normalizarValoresGemini(parsed);
    const coordenadas = extrairCoordenadasDoLinkLocalizacao(linkLocalizacao);
    const avisos = [
      'Leitura realizada pelo Gemini. Nenhum dado foi gravado no banco.',
      'Confira os campos antes de usar no formulario do pedido.',
    ];

    if (linkLocalizacao && !coordenadas) {
      avisos.push('Nao foi possivel extrair latitude e longitude do link informado.');
    }
    if (!valores.telefoneCliente) {
      avisos.push('Telefone do cliente nao encontrado no comprovante.');
    }
    if (Array.isArray(parsed.observacoes)) {
      avisos.push(...parsed.observacoes.filter(Boolean).map(String));
    }

    return {
      ok: true,
      modo: 'gemini',
      modelo: model,
      arquivo: {
        nome: arquivo.name || 'Foto selecionada',
        tipo: arquivo.type || '',
        tamanhoBytes: arquivo.size || 0,
      },
      valores,
      coordenadas,
      avisos,
      bruto: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      motivo: `Nao foi possivel chamar o Gemini: ${error.message}`,
      valores: null,
      coordenadas: null,
      avisos: ['Nenhum dado foi gravado no banco.'],
    };
  }
}

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

function promptExtracaoComprovante() {
  return `
Voce e um leitor de comprovantes de pedidos de delivery.
Extraia os dados visiveis da foto e retorne exclusivamente JSON valido, sem markdown.
Use string vazia quando um campo nao existir ou estiver ilegivel.
Nunca invente dados.

Formato obrigatorio:
{
  "origem": "iFood, WhatsApp, loja ou outro",
  "loja": "",
  "numeroPedido": "",
  "codigoColeta": "",
  "entregaPrevista": "HH:MM",
  "localizador": "",
  "cliente": "",
  "telefoneCliente": "",
  "endereco": "",
  "complemento": "",
  "bairro": "",
  "cidade": "",
  "cep": "",
  "itemPrincipal": "",
  "valorPedido": "R$ 0,00",
  "taxaServico": "R$ 0,00",
  "taxaEntrega": "R$ 0,00",
  "cobrarCliente": "R$ 0,00",
  "observacoes": []
}
`;
}

function arquivoParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(arquivo);
  });
}

function extrairTextoGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function parseJsonGemini(texto) {
  const cleanText = String(texto || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

function normalizarValoresGemini(valores = {}) {
  return {
    origem: textoOuVazio(valores.origem),
    loja: textoOuVazio(valores.loja),
    numeroPedido: textoOuVazio(valores.numeroPedido),
    codigoColeta: textoOuVazio(valores.codigoColeta),
    entregaPrevista: textoOuVazio(valores.entregaPrevista),
    localizador: textoOuVazio(valores.localizador),
    cliente: textoOuVazio(valores.cliente),
    telefoneCliente: textoOuVazio(valores.telefoneCliente),
    endereco: textoOuVazio(valores.endereco),
    complemento: textoOuVazio(valores.complemento),
    bairro: textoOuVazio(valores.bairro),
    cidade: textoOuVazio(valores.cidade),
    cep: textoOuVazio(valores.cep),
    itemPrincipal: textoOuVazio(valores.itemPrincipal),
    valorPedido: normalizarMoeda(valores.valorPedido),
    taxaServico: normalizarMoeda(valores.taxaServico),
    taxaEntrega: normalizarMoeda(valores.taxaEntrega),
    cobrarCliente: normalizarMoeda(valores.cobrarCliente),
  };
}

function textoOuVazio(valor) {
  return String(valor || '').trim();
}

function normalizarMoeda(valor) {
  const texto = textoOuVazio(valor);
  if (!texto) return '';
  if (/^R\$\s*\d/.test(texto)) return texto;
  return formatarMoedaExtraida(texto) || texto;
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
