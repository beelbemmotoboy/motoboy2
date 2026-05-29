const GEMINI_MODEL_PADRAO = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = import.meta.env?.VITE_GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || '';

export const garconMenuAiStatus = {
  hasApiKey: Boolean(GEMINI_API_KEY),
  model: GEMINI_MODEL_PADRAO,
  fallbackModel: GEMINI_FALLBACK_MODEL,
};

export async function analisarCardapioComIa({
  arquivo,
  pesquisa = '',
  apiKey = GEMINI_API_KEY,
  model = GEMINI_MODEL_PADRAO,
} = {}) {
  if (!arquivo) {
    return { ok: false, motivo: 'Envie uma foto ou PDF do cardapio para analisar.', dados: null, avisos: [] };
  }

  if (!apiKey) {
    return {
      ok: false,
      codigo: 'gemini_api_key_missing',
      motivo: 'Configure a chave VITE_GEMINI_API_KEY para analisar cardapios com IA.',
      dados: null,
      avisos: ['Nenhum dado foi gravado no banco.'],
    };
  }

  const arquivoBase64 = await arquivoParaBase64(arquivo);
  const modelosParaTentar = [...new Set([model, GEMINI_FALLBACK_MODEL].filter(Boolean))];
  let ultimaFalha = null;

  for (const modeloAtual of modelosParaTentar) {
    const { response, data } = await chamarGeminiCardapio({
      apiKey,
      model: modeloAtual,
      arquivo,
      arquivoBase64,
      pesquisa,
    });

    if (!response.ok) {
      ultimaFalha = montarFalhaGemini(data, response.status, modeloAtual);
      if (deveTentarModeloFallback(ultimaFalha) && modeloAtual !== modelosParaTentar.at(-1)) continue;
      return ultimaFalha;
    }

    const texto = extrairTextoGemini(data);
    const parsed = parseJsonGemini(texto);
    if (!parsed) {
      return {
        ok: false,
        codigo: 'gemini_invalid_json',
        motivo: 'A IA respondeu, mas nao retornou um JSON valido para cadastro do cardapio.',
        dados: null,
        modelo: modeloAtual,
        avisos: ['Nenhum dado foi gravado no banco.'],
      };
    }

    return {
      ok: true,
      modelo: modeloAtual,
      arquivo: {
        nome: arquivo.name || 'cardapio',
        tipo: arquivo.type || '',
        tamanhoBytes: arquivo.size || 0,
      },
      dados: normalizarCardapioIa(parsed),
      avisos: [
        'Analise automatica. Confira os itens antes de gravar.',
        ...(modeloAtual !== model ? [`Modelo principal indisponivel; leitura feita com ${modeloAtual}.`] : []),
        ...(Array.isArray(parsed.avisos) ? parsed.avisos.filter(Boolean).map(String) : []),
      ],
    };
  }

  return ultimaFalha;
}

async function chamarGeminiCardapio({ apiKey, model, arquivo, arquivoBase64, pesquisa }) {
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
              mime_type: arquivo.type || 'application/octet-stream',
              data: arquivoBase64,
            },
          },
          { text: promptExtracaoCardapio(pesquisa) },
        ],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

function promptExtracaoCardapio(pesquisa) {
  return `
Voce cadastra cardapios para restaurantes.
Analise a foto ou PDF enviado e retorne exclusivamente JSON valido, sem markdown.
Use a pesquisa do operador para resolver ambiguidades: "${String(pesquisa || '').trim()}".
Nao invente preco, produto, categoria, ingrediente ou foto quando nao estiver visivel.
Quando houver adicionais como iFood, coloque-os em "adicionais".

Formato obrigatorio:
{
  "categorias": [
    { "nome": "Lanches", "descricao": "", "ordem": 1 }
  ],
  "ingredientes": [
    { "nome": "Queijo", "unidade_medida": "un", "descricao": "" }
  ],
  "produtos": [
    {
      "nome": "X-Burger",
      "categoria": "Lanches",
      "descricao": "",
      "preco": "R$ 29,90",
      "imagem_url": "",
      "tempo_medio_preparo": null,
      "permite_adicionais": true,
      "ingredientes": ["Pao", "Carne", "Queijo"],
      "adicionais": [
        { "nome": "Bacon", "preco": "R$ 5,00" }
      ]
    }
  ],
  "avisos": []
}
`;
}

function montarFalhaGemini(data, httpStatus, model) {
  const error = data?.error || {};
  return {
    ok: false,
    codigo: 'gemini_api_error',
    status: error.status || '',
    httpStatus,
    modelo: model,
    motivo: error.message || 'Nao foi possivel analisar o cardapio com IA.',
    dados: null,
    avisos: ['Nenhum dado foi gravado no banco.'],
  };
}

function deveTentarModeloFallback(falha) {
  return ['NOT_FOUND', 'UNIMPLEMENTED', 'UNAVAILABLE'].includes(falha?.status)
    || [404, 503].includes(falha?.httpStatus);
}

function arquivoParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo do cardapio.'));
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

function normalizarCardapioIa(dados = {}) {
  return {
    categorias: lista(dados.categorias).map((categoria, index) => ({
      nome: texto(categoria.nome),
      descricao: texto(categoria.descricao),
      ordem: Number(categoria.ordem || index + 1),
    })).filter((categoria) => categoria.nome),
    ingredientes: lista(dados.ingredientes).map((ingrediente) => ({
      nome: texto(ingrediente.nome),
      descricao: texto(ingrediente.descricao),
      unidade_medida: texto(ingrediente.unidade_medida) || 'un',
    })).filter((ingrediente) => ingrediente.nome),
    produtos: lista(dados.produtos).map((produto) => ({
      nome: texto(produto.nome),
      categoria: texto(produto.categoria || produto.categoria_nome),
      descricao: texto(produto.descricao),
      preco: texto(produto.preco),
      imagem_url: texto(produto.imagem_url),
      tempo_medio_preparo: produto.tempo_medio_preparo || null,
      permite_adicionais: Boolean(produto.permite_adicionais || lista(produto.adicionais).length),
      ingredientes: lista(produto.ingredientes).map(texto).filter(Boolean),
      adicionais: lista(produto.adicionais).map((adicional) => (
        typeof adicional === 'string'
          ? { nome: texto(adicional), preco: '' }
          : { nome: texto(adicional.nome), preco: texto(adicional.preco) }
      )).filter((adicional) => adicional.nome),
    })).filter((produto) => produto.nome),
  };
}

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function texto(valor) {
  return String(valor || '').trim();
}
