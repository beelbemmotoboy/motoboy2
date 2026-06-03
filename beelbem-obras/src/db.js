import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

const childTables = {
  stages: 'obras_stages',
  photos: 'obras_photos',
  plsItems: 'obras_pls_items',
  issues: 'obras_issues',
  supplies: 'obras_supplies',
  tools: 'obras_tools',
  checklist: 'obras_checklist',
};

export function projectFromDb(row) {
  return {
    id: row.id,
    nome: row.nome,
    cliente: row.cliente,
    endereco: row.endereco,
    cidadeId: row.cidade_id,
    bairroId: row.bairro_id,
    cidade: row.cidade,
    bairro: row.bairro,
    percentual: row.percentual,
    status: row.status,
    proximaEtapa: row.proxima_etapa,
    pls: row.pls_status,
    pendencias: row.pendencias,
    atraso: row.atraso,
    areaConstruida: row.area_construida || '',
    areaTerreno: row.area_terreno || '',
    pavimentos: row.pavimentos || '',
    responsavel: row.responsavel || '',
    observacoes: row.observacoes || '',
  };
}

export function projectToDb(work) {
  return {
    nome: work.nome,
    cliente: work.cliente,
    endereco: work.endereco,
    cidade_id: work.cidadeId,
    bairro_id: work.bairroId,
    cidade: work.cidade,
    bairro: work.bairro,
    percentual: work.percentual ?? 0,
    status: work.status || 'Nao iniciada',
    proxima_etapa: work.proximaEtapa || 'Servicos preliminares',
    pls_status: work.pls || 'Pendente',
    pendencias: work.pendencias ?? 0,
    atraso: work.atraso ?? 0,
    area_construida: work.areaConstruida || null,
    area_terreno: work.areaTerreno || null,
    pavimentos: work.pavimentos || null,
    responsavel: work.responsavel || null,
    observacoes: work.observacoes || null,
  };
}

export const rowMappers = {
  stages: {
    fromDb: (row) => ({
      id: row.id,
      nome: row.nome,
      percentual: row.percentual,
      status: row.status,
      inicio: row.inicio || '',
      fim: row.fim || '',
      pendencias: row.pendencias,
      fotosFaltando: row.fotos_faltando,
    }),
    toDb: (item, index = 0) => ({
      nome: item.nome,
      percentual: item.percentual ?? 0,
      status: item.status || 'Nao iniciado',
      inicio: item.inicio || null,
      fim: item.fim || null,
      pendencias: item.pendencias ?? 0,
      fotos_faltando: item.fotosFaltando ?? 0,
      sort_order: index,
    }),
    patchToDb: (patch) => ({
      ...(patch.percentual !== undefined ? { percentual: patch.percentual } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.fotosFaltando !== undefined ? { fotos_faltando: patch.fotosFaltando } : {}),
      ...(patch.pendencias !== undefined ? { pendencias: patch.pendencias } : {}),
    }),
  },
  photos: {
    fromDb: (row) => ({
      id: row.id,
      etapa: row.etapa,
      tipo: row.tipo,
      data: row.data_label,
      usuario: row.usuario || '',
      observacao: row.observacao || '',
      cor: row.cor || 'blue',
    }),
    toDb: (item) => ({
      etapa: item.etapa,
      tipo: item.tipo,
      data_label: item.data,
      usuario: item.usuario || null,
      observacao: item.observacao || null,
      cor: item.cor || 'blue',
    }),
  },
  plsItems: {
    fromDb: (row) => ({
      id: row.id,
      etapa: row.etapa,
      percentual: row.percentual,
      fotos: row.fotos,
      status: row.status,
      vistoria: row.vistoria || '',
      observacao: row.observacao || '',
    }),
    toDb: (item) => ({
      etapa: item.etapa,
      percentual: item.percentual ?? 0,
      fotos: item.fotos || '0/0',
      status: item.status || 'Pendente',
      vistoria: item.vistoria || null,
      observacao: item.observacao || null,
    }),
    patchToDb: (patch) => ({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.percentual !== undefined ? { percentual: patch.percentual } : {}),
      ...(patch.fotos !== undefined ? { fotos: patch.fotos } : {}),
    }),
  },
  issues: {
    fromDb: (row) => ({
      id: row.id,
      descricao: row.descricao,
      etapa: row.etapa,
      responsavel: row.responsavel || '',
      prazo: row.prazo || '',
      status: row.status,
      norma: row.norma || '',
    }),
    toDb: (item) => ({
      descricao: item.descricao,
      etapa: item.etapa,
      responsavel: item.responsavel || null,
      prazo: item.prazo || null,
      status: item.status || 'Aberta',
      norma: item.norma || null,
    }),
    patchToDb: (patch) => ({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  },
  supplies: {
    fromDb: (row) => ({
      id: row.id,
      nome: row.nome,
      etapa: row.etapa,
      unidade: row.unidade || '',
      prevista: Number(row.prevista || 0),
      usada: Number(row.usada || 0),
      status: row.status,
      observacao: row.observacao || '',
    }),
    toDb: (item) => ({
      nome: item.nome,
      etapa: item.etapa,
      unidade: item.unidade || null,
      prevista: item.prevista ?? 0,
      usada: item.usada ?? 0,
      status: item.status || 'Necessario',
      observacao: item.observacao || null,
    }),
    patchToDb: (patch) => ({
      ...(patch.usada !== undefined ? { usada: patch.usada } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  },
  tools: {
    fromDb: (row) => ({
      id: row.id,
      nome: row.nome,
      etapa: row.etapa,
      tipo: row.tipo || '',
      obrigatorio: row.obrigatorio || '',
      status: row.status,
      observacao: row.observacao || '',
    }),
    toDb: (item) => ({
      nome: item.nome,
      etapa: item.etapa,
      tipo: item.tipo || null,
      obrigatorio: item.obrigatorio || null,
      status: item.status || 'Necessario',
      observacao: item.observacao || null,
    }),
    patchToDb: (patch) => ({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  },
  checklist: {
    fromDb: (row) => ({
      id: row.id,
      descricao: row.descricao,
      etapa: row.etapa,
      norma: row.norma || '',
      foto: row.foto || '',
      responsavel: row.responsavel || '',
      data: row.data_label || '',
      status: row.status,
    }),
    toDb: (item) => ({
      descricao: item.descricao,
      etapa: item.etapa,
      norma: item.norma || null,
      foto: item.foto || null,
      responsavel: item.responsavel || null,
      data_label: item.data || null,
      status: item.status || 'Nao iniciado',
    }),
    patchToDb: (patch) => ({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  },
};

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('obras_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(projectFromDb);
}

export async function fetchProjectChildren(projectId) {
  const entries = await Promise.all(
    Object.entries(childTables).map(async ([key, table]) => {
      let query = supabase.from(table).select('*').eq('project_id', projectId);
      query = key === 'stages'
        ? query.order('sort_order', { ascending: true })
        : query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return [key, (data || []).map(rowMappers[key].fromDb)];
    }),
  );

  return Object.fromEntries(entries);
}

export async function insertProject(work) {
  const { data, error } = await supabase
    .from('obras_projects')
    .insert(projectToDb(work))
    .select('*')
    .single();

  if (error) throw error;
  return projectFromDb(data);
}

export async function updateProject(projectId, patch) {
  const dbPatch = {};
  if (patch.percentual !== undefined) dbPatch.percentual = patch.percentual;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.pls !== undefined) dbPatch.pls_status = patch.pls;
  if (patch.pendencias !== undefined) dbPatch.pendencias = patch.pendencias;

  if (!Object.keys(dbPatch).length) return;
  const { error } = await supabase.from('obras_projects').update(dbPatch).eq('id', projectId);
  if (error) throw error;
}

export async function seedProjectChildren(projectId, seedData) {
  const inserts = Object.entries(childTables).map(([key, table]) => {
    const mapper = rowMappers[key];
    const rows = (seedData[key] || []).map((item, index) => ({
      project_id: projectId,
      ...mapper.toDb(item, index),
    }));
    if (!rows.length) return Promise.resolve();
    return supabase.from(table).insert(rows).then(({ error }) => {
      if (error) throw error;
    });
  });

  await Promise.all(inserts);
}

export async function insertChild(collection, projectId, item) {
  const table = childTables[collection];
  const mapper = rowMappers[collection];
  const { data, error } = await supabase
    .from(table)
    .insert({ project_id: projectId, ...mapper.toDb(item) })
    .select('*')
    .single();

  if (error) throw error;
  return mapper.fromDb(data);
}

export async function updateChild(collection, id, patch) {
  const table = childTables[collection];
  const mapper = rowMappers[collection];
  const dbPatch = mapper.patchToDb ? mapper.patchToDb(patch) : patch;
  if (!Object.keys(dbPatch).length) return;

  const { error } = await supabase.from(table).update(dbPatch).eq('id', id);
  if (error) throw error;
}
