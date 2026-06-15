import { supabase, supabaseConfigured } from './db.js';

const MAX_INLINE_FILE_SIZE = 10 * 1024 * 1024;

export const geminiProjectConfig = {
  configured: supabaseConfigured,
  maxFileSize: MAX_INLINE_FILE_SIZE,
};

export async function analisarProjetoComGemini({ arquivo } = {}) {
  const validationError = validateFile(arquivo);
  if (validationError) return failure(validationError);
  if (!supabase) {
    return failure(
      'O Supabase do Obras nao esta configurado neste ambiente.',
      'gemini_function_missing',
    );
  }

  try {
    const fileBase64 = await fileToBase64(arquivo);
    const { data, error } = await supabase.functions.invoke('analyze-obras-project', {
      body: {
        fileBase64,
        fileName: arquivo.name || 'Projeto selecionado',
        fileSize: arquivo.size || 0,
        mimeType: arquivo.type || 'application/pdf',
      },
    });

    if (error) {
      return failure(
        `Nao foi possivel acessar a analise protegida: ${error.message}`,
        'gemini_function_error',
      );
    }
    if (!data?.ok) {
      return data || failure('A funcao de analise nao retornou dados validos.');
    }

    return data;
  } catch (error) {
    return failure(
      `Nao foi possivel enviar o projeto para analise: ${error.message}`,
      'gemini_function_error',
    );
  }
}

function validateFile(file) {
  if (!file) return 'Selecione um PDF ou uma imagem do projeto.';
  const mimeType = file.type || '';
  if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) {
    return 'Formato nao suportado. Envie PDF, JPG, PNG, WEBP ou uma foto.';
  }
  if (file.size > MAX_INLINE_FILE_SIZE) {
    return 'O arquivo deve ter no maximo 10 MB para analise.';
  }
  return '';
}

function failure(reason, code = 'gemini_project_error') {
  return {
    ok: false,
    codigo: code,
    motivo: reason,
    modelo: '',
    valores: null,
    avisos: ['Nenhum dado foi gravado no banco.'],
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}
