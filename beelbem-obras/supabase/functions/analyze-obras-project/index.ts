import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash';

const projectSchema = {
  type: 'OBJECT',
  properties: {
    nome: { type: 'STRING' },
    cliente: { type: 'STRING' },
    endereco: { type: 'STRING' },
    cidade: { type: 'STRING' },
    bairro: { type: 'STRING' },
    quadra: { type: 'STRING' },
    lote: { type: 'STRING' },
    areaConstruida: { type: 'STRING' },
    areaTerreno: { type: 'STRING' },
    pavimentos: { type: 'STRING' },
    responsavel: { type: 'STRING' },
    observacoes: { type: 'STRING' },
    avisos: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: [
    'nome',
    'cliente',
    'endereco',
    'cidade',
    'bairro',
    'quadra',
    'lote',
    'areaConstruida',
    'areaTerreno',
    'pavimentos',
    'responsavel',
    'observacoes',
    'avisos',
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function failure(
  motivo: string,
  codigo = 'gemini_project_error',
  modelo = '',
  extra: Record<string, unknown> = {},
) {
  return {
    ok: false,
    codigo,
    motivo,
    modelo,
    valores: null,
    avisos: ['Nenhum dado foi gravado no banco.'],
    ...extra,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const authorization = request.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Configuracao da funcao incompleta.' }, 500);
    }
    if (!authorization) {
      return json({ error: 'Sessao obrigatoria.' }, 401);
    }
    if (!geminiApiKey) {
      return json(failure('A chave do Gemini nao esta configurada na funcao.', 'gemini_api_key_missing'));
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: 'Sessao invalida.' }, 401);
    }

    const { data: currentUser, error: userError } = await adminClient
      .from('obras_users')
      .select('id, active, login_enabled')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (userError || !currentUser || !currentUser.active || !currentUser.login_enabled) {
      return json({ error: 'Usuario sem acesso ativo ao Obras.' }, 403);
    }

    const body = await request.json();
    const fileBase64 = String(body.fileBase64 || '');
    const fileName = clean(body.fileName) || 'Projeto selecionado';
    const fileSize = Number(body.fileSize || 0);
    const mimeType = clean(body.mimeType);

    if (!fileBase64 || !isSupportedMimeType(mimeType)) {
      return json(failure('Envie um PDF ou imagem valida.', 'gemini_invalid_file'));
    }
    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return json(failure('O arquivo deve ter no maximo 10 MB.', 'gemini_invalid_file'));
    }

    const models = [PRIMARY_MODEL, FALLBACK_MODEL];
    let lastFailure = failure('Nao foi possivel analisar o projeto.');

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: fileBase64,
                  },
                },
                { text: projectPrompt() },
              ],
            }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseSchema: projectSchema,
            },
          }),
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = data?.error || {};
        lastFailure = failure(
          error.message || 'Nao foi possivel analisar o projeto com Gemini.',
          'gemini_api_error',
          model,
          {
            status: error.status || '',
            httpStatus: response.status,
          },
        );
        if (shouldTryFallback(lastFailure) && model !== models.at(-1)) continue;
        return json(lastFailure);
      }

      const parsed = parseJson(extractText(data));
      if (!parsed) {
        return json(failure(
          'O Gemini respondeu, mas nao retornou dados estruturados validos.',
          'gemini_invalid_json',
          model,
        ));
      }

      const warnings = [
        'A IA pode interpretar medidas e nomes incorretamente. Confira todos os campos.',
        ...normalizeWarnings(parsed.avisos),
      ];
      if (model !== PRIMARY_MODEL) {
        warnings.push(`Analise realizada pelo modelo alternativo ${model}.`);
      }

      return json({
        ok: true,
        modelo: model,
        valores: normalizeProject(parsed),
        avisos: warnings,
        arquivo: {
          nome: fileName,
          tipo: mimeType,
          tamanhoBytes: fileSize,
        },
      });
    }

    return json(lastFailure);
  } catch (error) {
    return json(failure(
      error instanceof Error ? error.message : 'Falha inesperada na analise.',
      'gemini_function_error',
    ));
  }
});

function projectPrompt() {
  return `
Voce e um assistente de engenharia civil. Analise o PDF, planta, memorial,
documento ou fotografia anexada e extraia somente dados comprovados no arquivo.

Regras:
- Nao invente nomes, enderecos, areas, responsaveis ou medidas.
- Quando um campo nao estiver legivel ou nao existir, retorne string vazia.
- Preserve unidades nas areas, por exemplo "148 m2".
- Em pavimentos retorne apenas a quantidade quando identificada.
- Em observacoes resuma informacoes tecnicas importantes: fundacao, estrutura,
  cobertura, padrao construtivo e restricoes encontradas.
- Em avisos liste ambiguidades, paginas ilegiveis e campos que precisam de
  confirmacao humana.
- O retorno deve seguir exatamente o JSON solicitado.
`.trim();
}

function isSupportedMimeType(mimeType: string) {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

function shouldTryFallback(result: Record<string, unknown>) {
  return ['NOT_FOUND', 'UNIMPLEMENTED', 'UNAVAILABLE'].includes(String(result.status || ''))
    || [404, 503].includes(Number(result.httpStatus || 0));
}

function extractText(data: Record<string, any> | null) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part: Record<string, unknown>) => String(part?.text || ''))
    .join('')
    .trim();
}

function parseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeProject(values: Record<string, unknown> = {}) {
  return {
    nome: clean(values.nome),
    cliente: clean(values.cliente),
    endereco: clean(values.endereco),
    cidade: clean(values.cidade),
    bairro: clean(values.bairro),
    quadra: clean(values.quadra),
    lote: clean(values.lote),
    areaConstruida: clean(values.areaConstruida),
    areaTerreno: clean(values.areaTerreno),
    pavimentos: clean(values.pavimentos),
    responsavel: clean(values.responsavel),
    observacoes: clean(values.observacoes),
  };
}

function normalizeWarnings(warnings: unknown) {
  if (!Array.isArray(warnings)) return [];
  return warnings.map(clean).filter(Boolean);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}
