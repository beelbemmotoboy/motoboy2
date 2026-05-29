import { supabase } from '../../../supabaseClient';

export const CARDAPIO_SELECTS = {
  mesas: 'id, empresa_id, nome, numero, descricao, status, qr_code_url, criado_em, atualizado_em',
  categorias: 'id, empresa_id, nome, descricao, ordem, status, criado_em, atualizado_em',
  produtos: 'id, empresa_id, categoria_id, nome, descricao, preco, imagem_url, status, disponivel, permite_adicionais, tempo_medio_preparo, criado_em, atualizado_em',
  ingredientes: 'id, empresa_id, nome, descricao, unidade_medida, custo_unitario, estoque_minimo, status, criado_em, atualizado_em',
  produtoIngredientes: 'id, empresa_id, produto_id, ingrediente_id, tipo, quantidade, preco_adicional, obrigatorio, ingrediente:ingredientes_cardapio(id, nome, unidade_medida)',
};

export function parseMoedaBrasileira(valor) {
  const limpo = String(valor || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const numero = Number(limpo || 0);
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0;
}

export function precoParaEntrada(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function carregarDadosGarcon({ empresaId, buscarPedidosDoDia }) {
  if (!supabase || !empresaId) throw new Error('Supabase nao disponivel para carregar o Garcon.');

  const [mesasResult, categoriasResult, produtosResult, ingredientesResult, produtoIngredientesResult, pedidosResult] = await Promise.all([
    supabase.from('mesas').select(CARDAPIO_SELECTS.mesas).eq('empresa_id', empresaId).order('numero', { ascending: true }),
    supabase.from('categorias_cardapio').select(CARDAPIO_SELECTS.categorias).eq('empresa_id', empresaId).order('ordem', { ascending: true }),
    supabase.from('produtos_cardapio').select(CARDAPIO_SELECTS.produtos).eq('empresa_id', empresaId).order('nome', { ascending: true }),
    supabase.from('ingredientes_cardapio').select(CARDAPIO_SELECTS.ingredientes).eq('empresa_id', empresaId).order('nome', { ascending: true }),
    supabase.from('produtos_ingredientes_cardapio').select(CARDAPIO_SELECTS.produtoIngredientes).eq('empresa_id', empresaId).order('tipo', { ascending: true }),
    buscarPedidosDoDia(),
  ]);

  const erros = [mesasResult.error, categoriasResult.error, produtosResult.error, ingredientesResult.error, produtoIngredientesResult.error, pedidosResult.error].filter(Boolean);
  if (erros.length) throw new Error(erros.map((erro) => erro.message).join(' | '));

  return {
    mesas: mesasResult.data ?? [],
    categorias: categoriasResult.data ?? [],
    produtos: produtosResult.data ?? [],
    ingredientes: ingredientesResult.data ?? [],
    produtoIngredientes: produtoIngredientesResult.data ?? [],
    pedidos: pedidosResult.data ?? [],
  };
}

export async function salvarCategoriaCardapio({ empresaId, categoriaId, form }) {
  const payload = {
    empresa_id: empresaId,
    nome: form.nome.trim(),
    descricao: form.descricao.trim() || null,
    ordem: Number(form.ordem || 0),
    status: form.status,
  };

  return categoriaId
    ? supabase.from('categorias_cardapio').update(payload).eq('id', categoriaId).eq('empresa_id', empresaId)
    : supabase.from('categorias_cardapio').insert(payload);
}

export async function salvarProdutoCardapio({ empresaId, produtoId, form }) {
  const preco = parseMoedaBrasileira(form.preco);
  const payload = {
    empresa_id: empresaId,
    categoria_id: form.categoria_id,
    nome: form.nome.trim(),
    descricao: form.descricao.trim() || null,
    preco,
    imagem_url: form.imagem_url.trim() || null,
    status: form.status,
    disponivel: form.disponivel === 'sim',
    permite_adicionais: form.permite_adicionais === 'sim',
    tempo_medio_preparo: form.tempo_medio_preparo ? Number(form.tempo_medio_preparo) : null,
  };

  return produtoId
    ? supabase.from('produtos_cardapio').update(payload).eq('id', produtoId).eq('empresa_id', empresaId)
    : supabase.from('produtos_cardapio').insert(payload);
}

export async function salvarIngredienteCardapio({ empresaId, ingredienteId, form }) {
  const payload = {
    empresa_id: empresaId,
    nome: form.nome.trim(),
    descricao: form.descricao.trim() || null,
    unidade_medida: form.unidade_medida.trim() || 'un',
    custo_unitario: parseMoedaBrasileira(form.custo_unitario),
    estoque_minimo: Number(form.estoque_minimo || 0),
    status: form.status,
  };

  return ingredienteId
    ? supabase.from('ingredientes_cardapio').update(payload).eq('id', ingredienteId).eq('empresa_id', empresaId)
    : supabase.from('ingredientes_cardapio').insert(payload);
}

export async function salvarIngredienteDoProduto({ empresaId, form }) {
  const payload = {
    empresa_id: empresaId,
    produto_id: form.produto_id,
    ingrediente_id: form.ingrediente_id,
    tipo: form.tipo,
    quantidade: Number(form.quantidade || 0),
    preco_adicional: parseMoedaBrasileira(form.preco_adicional),
    obrigatorio: form.obrigatorio === 'sim',
  };

  return supabase
    .from('produtos_ingredientes_cardapio')
    .upsert(payload, { onConflict: 'produto_id,ingrediente_id,tipo' });
}

export async function removerIngredienteDoProduto({ empresaId, vinculoId }) {
  return supabase
    .from('produtos_ingredientes_cardapio')
    .delete()
    .eq('id', vinculoId)
    .eq('empresa_id', empresaId);
}

export async function registrarImportacaoCardapioIa({ empresaId, arquivo, resultado }) {
  return supabase.from('importacoes_cardapio_ia').insert({
    empresa_id: empresaId,
    nome_arquivo: arquivo?.name || 'arquivo-cardapio',
    tipo_arquivo: arquivo?.type || null,
    resultado,
    status: 'analisado',
  });
}

export async function criarCategoriaSeNecessario({ empresaId, nome, descricao = '', ordem = 0 }) {
  const nomeLimpo = String(nome || '').trim();
  if (!nomeLimpo) return null;

  const { data: existente } = await supabase
    .from('categorias_cardapio')
    .select('id')
    .eq('empresa_id', empresaId)
    .ilike('nome', nomeLimpo)
    .maybeSingle();

  if (existente?.id) return existente.id;

  const { data, error } = await supabase
    .from('categorias_cardapio')
    .insert({ empresa_id: empresaId, nome: nomeLimpo, descricao: descricao || null, ordem, status: 'ativa' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function criarIngredienteSeNecessario({ empresaId, nome, unidade_medida = 'un' }) {
  const nomeLimpo = String(nome || '').trim();
  if (!nomeLimpo) return null;

  const { data: existente } = await supabase
    .from('ingredientes_cardapio')
    .select('id')
    .eq('empresa_id', empresaId)
    .ilike('nome', nomeLimpo)
    .maybeSingle();

  if (existente?.id) return existente.id;

  const { data, error } = await supabase
    .from('ingredientes_cardapio')
    .insert({ empresa_id: empresaId, nome: nomeLimpo, unidade_medida, status: 'ativo' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function aplicarSugestoesCardapioIa({ empresaId, sugestoes }) {
  const categorias = Array.isArray(sugestoes?.categorias) ? sugestoes.categorias : [];
  const produtos = Array.isArray(sugestoes?.produtos) ? sugestoes.produtos : [];
  const ingredientes = Array.isArray(sugestoes?.ingredientes) ? sugestoes.ingredientes : [];

  for (const ingrediente of ingredientes) {
    await criarIngredienteSeNecessario({
      empresaId,
      nome: ingrediente.nome,
      unidade_medida: ingrediente.unidade_medida || 'un',
    });
  }

  const categoriaIds = new Map();
  for (const [index, categoria] of categorias.entries()) {
    const id = await criarCategoriaSeNecessario({
      empresaId,
      nome: categoria.nome,
      descricao: categoria.descricao,
      ordem: categoria.ordem ?? index + 1,
    });
    if (id) categoriaIds.set(String(categoria.nome || '').toLowerCase(), id);
  }

  for (const produto of produtos) {
    const categoriaNome = String(produto.categoria || produto.categoria_nome || categorias[0]?.nome || 'Cardapio').trim();
    const categoriaId = categoriaIds.get(categoriaNome.toLowerCase())
      || await criarCategoriaSeNecessario({ empresaId, nome: categoriaNome, ordem: categoriaIds.size + 1 });

    if (!categoriaId || !produto.nome) continue;

    const { data: produtoCriado, error } = await supabase
      .from('produtos_cardapio')
      .insert({
        empresa_id: empresaId,
        categoria_id: categoriaId,
        nome: String(produto.nome).trim(),
        descricao: produto.descricao || null,
        preco: parseMoedaBrasileira(produto.preco),
        imagem_url: produto.imagem_url || null,
        status: 'ativo',
        disponivel: true,
        permite_adicionais: Boolean(produto.permite_adicionais || produto.adicionais?.length),
        tempo_medio_preparo: produto.tempo_medio_preparo ? Number(produto.tempo_medio_preparo) : null,
      })
      .select('id')
      .single();

    if (error) throw error;

    for (const nomeIngrediente of produto.ingredientes || []) {
      const ingredienteId = await criarIngredienteSeNecessario({ empresaId, nome: nomeIngrediente });
      if (ingredienteId) {
        await supabase.from('produtos_ingredientes_cardapio').upsert({
          empresa_id: empresaId,
          produto_id: produtoCriado.id,
          ingrediente_id: ingredienteId,
          tipo: 'base',
          quantidade: null,
          preco_adicional: 0,
          obrigatorio: true,
        }, { onConflict: 'produto_id,ingrediente_id,tipo' });
      }
    }

    for (const adicional of produto.adicionais || []) {
      const ingredienteId = await criarIngredienteSeNecessario({ empresaId, nome: adicional.nome || adicional });
      if (ingredienteId) {
        await supabase.from('produtos_ingredientes_cardapio').upsert({
          empresa_id: empresaId,
          produto_id: produtoCriado.id,
          ingrediente_id: ingredienteId,
          tipo: 'adicional',
          quantidade: null,
          preco_adicional: parseMoedaBrasileira(adicional.preco),
          obrigatorio: false,
        }, { onConflict: 'produto_id,ingrediente_id,tipo' });
      }
    }
  }
}
