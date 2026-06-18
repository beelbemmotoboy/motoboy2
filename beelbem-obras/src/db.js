import { createClient } from '@supabase/supabase-js';

const obrasSupabaseUrl = import.meta.env.VITE_OBRAS_SUPABASE_URL || '';
const obrasSupabaseAnonKey = import.meta.env.VITE_OBRAS_SUPABASE_ANON_KEY || '';
const legacySupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const legacySupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseUrl = obrasSupabaseUrl || legacySupabaseUrl;
const supabaseAnonKey = obrasSupabaseAnonKey || legacySupabaseAnonKey;
const photoBucket = 'obras-photos';
const userAvatarBucket = 'obras-user-avatars';
const accountLogoBucket = 'obras-account-logos';
const photoThumbnailTable = 'obras_photo_thumbnails';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const usingLegacySupabaseConfig = Boolean(
  !obrasSupabaseUrl
  && !obrasSupabaseAnonKey
  && legacySupabaseUrl
  && legacySupabaseAnonKey,
);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: 'beelbem-obras-auth-token',
      },
    })
  : null;

const childTables = {
  stages: 'obras_stages',
  scheduleItems: 'obras_project_schedule_items',
  scheduleLogs: 'obras_schedule_daily_logs',
  photos: 'obras_photos',
  plsItems: 'obras_pls_items',
  issues: 'obras_issues',
  supplies: 'obras_supplies',
  tools: 'obras_tools',
  checklist: 'obras_checklist',
  checklistResults: 'obras_schedule_checklist_results',
  rdoReports: 'obras_rdo_reports',
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
    quadra: row.quadra || '',
    lote: row.lote || '',
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
    quadra: work.quadra || null,
    lote: work.lote || null,
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

export function obrasAccountFromDb(row) {
  return {
    id: row.id,
    nome: row.nome || '',
    documento: row.documento || '',
    responsavel: row.responsavel || '',
    email: row.email || '',
    telefone: row.telefone || '',
    endereco: row.endereco || '',
    cidadeId: row.cidade_id || '',
    cidade: row.cidade || '',
    plano: row.plano || 'basico',
    status: row.status || 'Ativa',
    logoStoragePath: row.logo_storage_path || '',
    logoFileName: row.logo_file_name || '',
    logoMimeType: row.logo_mime_type || '',
    logoFileSize: Number(row.logo_file_size || 0),
    logoUrl: '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function obrasAccountPatchToDb(values) {
  return {
    ...(values.nome !== undefined ? { nome: String(values.nome || '').trim() } : {}),
    ...(values.documento !== undefined ? { documento: String(values.documento || '').trim() || null } : {}),
    ...(values.responsavel !== undefined ? { responsavel: String(values.responsavel || '').trim() || null } : {}),
    ...(values.email !== undefined ? { email: String(values.email || '').trim().toLowerCase() || null } : {}),
    ...(values.telefone !== undefined ? { telefone: String(values.telefone || '').trim() || null } : {}),
    ...(values.endereco !== undefined ? { endereco: String(values.endereco || '').trim() || null } : {}),
    ...(values.cidadeId !== undefined ? { cidade_id: values.cidadeId } : {}),
    ...(values.cidade !== undefined ? { cidade: values.cidade } : {}),
    ...(values.plano !== undefined ? { plano: values.plano || 'basico' } : {}),
    ...(values.status !== undefined ? { status: values.status || 'Ativa' } : {}),
    ...(values.logoStoragePath !== undefined ? { logo_storage_path: values.logoStoragePath || null } : {}),
    ...(values.logoFileName !== undefined ? { logo_file_name: values.logoFileName || null } : {}),
    ...(values.logoMimeType !== undefined ? { logo_mime_type: values.logoMimeType || null } : {}),
    ...(values.logoFileSize !== undefined ? { logo_file_size: values.logoFileSize || null } : {}),
  };
}

export function obrasUserFromDb(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id || '',
    accountId: row.account_id || '',
    nome: row.nome || '',
    email: row.email || '',
    telefone: row.telefone || '',
    cpf: row.cpf || '',
    professionalRegistry: row.professional_registry || '',
    cidadeId: row.cidade_id || '',
    cidade: row.cidade || '',
    role: row.role || 'operador',
    active: row.active !== false,
    loginEnabled: row.login_enabled !== false,
    avatarStoragePath: row.avatar_storage_path || '',
    avatarFileName: row.avatar_file_name || '',
    avatarMimeType: row.avatar_mime_type || '',
    avatarFileSize: Number(row.avatar_file_size || 0),
    avatarUrl: '',
    createdAt: row.created_at || '',
  };
}

export function obrasUserToDb(user, accountId) {
  return {
    ...(accountId ? { account_id: accountId } : {}),
    ...(user.nome !== undefined ? { nome: user.nome } : {}),
    ...(user.email !== undefined ? { email: String(user.email || '').trim().toLowerCase() } : {}),
    ...(user.telefone !== undefined ? { telefone: user.telefone || null } : {}),
    ...(user.cpf !== undefined ? { cpf: user.cpf || null } : {}),
    ...(user.professionalRegistry !== undefined ? { professional_registry: user.professionalRegistry || null } : {}),
    ...(user.cidadeId !== undefined ? { cidade_id: user.cidadeId } : {}),
    ...(user.cidade !== undefined ? { cidade: user.cidade } : {}),
    ...(user.role !== undefined ? { role: user.role || 'operador' } : {}),
    ...(user.active !== undefined ? { active: user.active !== false } : {}),
    ...(user.loginEnabled !== undefined ? { login_enabled: user.loginEnabled !== false } : {}),
    ...(user.avatarStoragePath !== undefined ? { avatar_storage_path: user.avatarStoragePath || null } : {}),
    ...(user.avatarFileName !== undefined ? { avatar_file_name: user.avatarFileName || null } : {}),
    ...(user.avatarMimeType !== undefined ? { avatar_mime_type: user.avatarMimeType || null } : {}),
    ...(user.avatarFileSize !== undefined ? { avatar_file_size: user.avatarFileSize || null } : {}),
  };
}

export function commercialPlanFromDb(row) {
  return {
    id: row.id,
    nome: row.nome || '',
    descricao: row.descricao || '',
    tipo: row.tipo || 'empresa',
    valorMensal: Number(row.valor_mensal || 0),
    limiteObras: row.limite_obras ?? null,
    limiteUsuarios: row.limite_usuarios ?? null,
    recursos: Array.isArray(row.recursos) ? row.recursos : [],
    active: row.active !== false,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at || '',
  };
}

export function signupRequestFromDb(row) {
  return {
    id: row.id,
    accountType: row.account_type || 'empresa',
    nomeResponsavel: row.nome_responsavel || '',
    empresa: row.empresa || '',
    documento: row.documento || '',
    email: row.email || '',
    telefone: row.telefone || '',
    cidade: row.cidade || '',
    estado: row.estado || '',
    planId: row.plan_id || '',
    observacoes: row.observacoes || '',
    status: row.status || 'novo',
    convertedAccountId: row.converted_account_id || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function signupRequestToDb(values) {
  return {
    account_type: values.accountType || 'empresa',
    nome_responsavel: String(values.nomeResponsavel || '').trim(),
    empresa: String(values.empresa || '').trim() || null,
    documento: String(values.documento || '').trim() || null,
    email: String(values.email || '').trim().toLowerCase(),
    telefone: String(values.telefone || '').trim(),
    cidade: String(values.cidade || '').trim(),
    estado: String(values.estado || 'GO').trim().toUpperCase(),
    plan_id: values.planId || null,
    observacoes: String(values.observacoes || '').trim() || null,
    ...(values.status ? { status: values.status } : {}),
    ...(values.convertedAccountId !== undefined ? { converted_account_id: values.convertedAccountId || null } : {}),
  };
}

export function signupRequestPatchToDb(values) {
  return {
    ...(values.accountType !== undefined ? { account_type: values.accountType || 'empresa' } : {}),
    ...(values.nomeResponsavel !== undefined ? { nome_responsavel: String(values.nomeResponsavel || '').trim() } : {}),
    ...(values.empresa !== undefined ? { empresa: String(values.empresa || '').trim() || null } : {}),
    ...(values.documento !== undefined ? { documento: String(values.documento || '').trim() || null } : {}),
    ...(values.email !== undefined ? { email: String(values.email || '').trim().toLowerCase() } : {}),
    ...(values.telefone !== undefined ? { telefone: String(values.telefone || '').trim() } : {}),
    ...(values.cidade !== undefined ? { cidade: String(values.cidade || '').trim() } : {}),
    ...(values.estado !== undefined ? { estado: String(values.estado || 'GO').trim().toUpperCase() } : {}),
    ...(values.planId !== undefined ? { plan_id: values.planId || null } : {}),
    ...(values.observacoes !== undefined ? { observacoes: String(values.observacoes || '').trim() || null } : {}),
    ...(values.status !== undefined ? { status: values.status } : {}),
    ...(values.convertedAccountId !== undefined ? { converted_account_id: values.convertedAccountId || null } : {}),
  };
}

export function subscriptionFromDb(row) {
  return {
    id: row.id,
    accountId: row.account_id || '',
    planId: row.plan_id || '',
    status: row.status || 'trial',
    startedAt: row.started_at || '',
    trialEndsAt: row.trial_ends_at || '',
    currentPeriodEndsAt: row.current_period_ends_at || '',
    cancelledAt: row.cancelled_at || '',
    limiteObras: row.limite_obras ?? null,
    limiteUsuarios: row.limite_usuarios ?? null,
    valorMensal: Number(row.valor_mensal || 0),
    paymentProvider: row.payment_provider || '',
    externalReference: row.external_reference || '',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
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
      sortOrder: row.sort_order ?? 0,
    }),
    toDb: (item, index = 0) => ({
      nome: item.nome,
      percentual: item.percentual ?? 0,
      status: item.status || 'Nao iniciado',
      inicio: item.inicio || null,
      fim: item.fim || null,
      pendencias: item.pendencias ?? 0,
      fotos_faltando: item.fotosFaltando ?? 0,
      sort_order: item.sortOrder ?? index,
    }),
    patchToDb: (patch) => ({
      ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
      ...(patch.percentual !== undefined ? { percentual: patch.percentual } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.inicio !== undefined ? { inicio: patch.inicio || null } : {}),
      ...(patch.fim !== undefined ? { fim: patch.fim || null } : {}),
      ...(patch.fotosFaltando !== undefined ? { fotos_faltando: patch.fotosFaltando } : {}),
      ...(patch.pendencias !== undefined ? { pendencias: patch.pendencias } : {}),
      ...(patch.sortOrder !== undefined ? { sort_order: patch.sortOrder } : {}),
    }),
  },
  scheduleItems: {
    fromDb: (row) => ({
      id: row.id,
      libraryItemId: row.library_item_id || '',
      parentId: row.parent_item_id || '',
      nome: row.nome,
      itemType: row.item_type || 'task',
      inicioPrevisto: row.inicio_previsto || '',
      fimPrevisto: row.fim_previsto || '',
      inicioReal: row.inicio_real || '',
      fimReal: row.fim_real || '',
      status: row.status || 'Nao iniciado',
      percentual: row.percentual ?? 0,
      sortOrder: row.sort_order ?? 0,
      visible: row.visible !== false,
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    }),
    toDb: (item, index = 0) => ({
      ...(item.libraryItemId ? { library_item_id: item.libraryItemId } : {}),
      parent_item_id: item.parentId || null,
      nome: item.nome,
      item_type: item.itemType || 'task',
      inicio_previsto: item.inicioPrevisto || null,
      fim_previsto: item.fimPrevisto || null,
      inicio_real: item.inicioReal || null,
      fim_real: item.fimReal || null,
      status: item.status || 'Nao iniciado',
      percentual: item.percentual ?? 0,
      sort_order: item.sortOrder ?? index,
      visible: item.visible !== false,
    }),
    patchToDb: (patch) => ({
      ...(patch.parentId !== undefined ? { parent_item_id: patch.parentId || null } : {}),
      ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
      ...(patch.inicioPrevisto !== undefined ? { inicio_previsto: patch.inicioPrevisto || null } : {}),
      ...(patch.fimPrevisto !== undefined ? { fim_previsto: patch.fimPrevisto || null } : {}),
      ...(patch.inicioReal !== undefined ? { inicio_real: patch.inicioReal || null } : {}),
      ...(patch.fimReal !== undefined ? { fim_real: patch.fimReal || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.percentual !== undefined ? { percentual: patch.percentual } : {}),
      ...(patch.sortOrder !== undefined ? { sort_order: patch.sortOrder } : {}),
      ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
    }),
  },
  scheduleLogs: {
    fromDb: (row) => ({
      id: row.id,
      scheduleItemId: row.schedule_item_id,
      visitDate: row.visit_date || '',
      checklist: row.checklist || '',
      observacoes: row.observacoes || '',
      pedidoMaterial: row.pedido_material || '',
      ferramentas: row.ferramentas || '',
      maoObra: row.mao_obra || '',
      fotosObservacao: row.fotos_observacao || '',
      createdBy: row.created_by || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    }),
    toDb: (item) => ({
      schedule_item_id: item.scheduleItemId,
      visit_date: item.visitDate || new Date().toISOString().slice(0, 10),
      checklist: item.checklist || null,
      observacoes: item.observacoes || null,
      pedido_material: item.pedidoMaterial || null,
      ferramentas: item.ferramentas || null,
      mao_obra: item.maoObra || null,
      fotos_observacao: item.fotosObservacao || null,
    }),
    patchToDb: (patch) => ({
      ...(patch.visitDate !== undefined ? { visit_date: patch.visitDate } : {}),
      ...(patch.checklist !== undefined ? { checklist: patch.checklist || null } : {}),
      ...(patch.observacoes !== undefined ? { observacoes: patch.observacoes || null } : {}),
      ...(patch.pedidoMaterial !== undefined ? { pedido_material: patch.pedidoMaterial || null } : {}),
      ...(patch.ferramentas !== undefined ? { ferramentas: patch.ferramentas || null } : {}),
      ...(patch.maoObra !== undefined ? { mao_obra: patch.maoObra || null } : {}),
      ...(patch.fotosObservacao !== undefined ? { fotos_observacao: patch.fotosObservacao || null } : {}),
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
      storagePath: row.storage_path || '',
      fileName: row.file_name || '',
      mimeType: row.mime_type || '',
      fileSize: Number(row.file_size || 0),
    }),
    toDb: (item) => ({
      etapa: item.etapa,
      tipo: item.tipo,
      data_label: item.data,
      usuario: item.usuario || null,
      observacao: item.observacao || null,
      cor: item.cor || 'blue',
      storage_path: item.storagePath || null,
      file_name: item.fileName || null,
      mime_type: item.mimeType || null,
      file_size: item.fileSize || null,
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
      scheduleItemId: row.schedule_item_id || '',
      titulo: row.titulo || row.descricao || 'Checklist tecnico',
      descricao: row.descricao,
      procedimento: row.procedimento || '',
      itens: checklistItemsFromDb(row.itens),
      etapa: row.etapa,
      norma: row.norma || '',
      foto: row.foto || '',
      responsavel: row.responsavel || '',
      data: row.data_label || '',
      status: row.status,
    }),
    toDb: (item) => ({
      schedule_item_id: item.scheduleItemId || null,
      titulo: item.titulo || item.descricao || 'Checklist tecnico',
      descricao: item.descricao || item.titulo || 'Checklist tecnico',
      procedimento: item.procedimento || null,
      itens: checklistItemsToDb(item.itens),
      etapa: item.etapa,
      norma: item.norma || null,
      foto: item.foto || null,
      responsavel: item.responsavel || null,
      data_label: item.data || null,
      status: item.status || 'Nao iniciado',
    }),
    patchToDb: (patch) => ({
      ...(patch.scheduleItemId !== undefined ? { schedule_item_id: patch.scheduleItemId || null } : {}),
      ...(patch.titulo !== undefined ? { titulo: patch.titulo || 'Checklist tecnico' } : {}),
      ...(patch.descricao !== undefined ? { descricao: patch.descricao || patch.titulo || 'Checklist tecnico' } : {}),
      ...(patch.procedimento !== undefined ? { procedimento: patch.procedimento || null } : {}),
      ...(patch.itens !== undefined ? { itens: checklistItemsToDb(patch.itens) } : {}),
      ...(patch.etapa !== undefined ? { etapa: patch.etapa } : {}),
      ...(patch.norma !== undefined ? { norma: patch.norma || null } : {}),
      ...(patch.foto !== undefined ? { foto: patch.foto || null } : {}),
      ...(patch.responsavel !== undefined ? { responsavel: patch.responsavel || null } : {}),
      ...(patch.data !== undefined ? { data_label: patch.data || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }),
  },
  checklistResults: {
    fromDb: (row) => ({
      id: row.id,
      scheduleItemId: row.schedule_item_id,
      scheduleLogId: row.schedule_log_id || '',
      checklistId: row.checklist_id || '',
      checklistItemId: row.checklist_item_id,
      checked: row.checked === true,
      checkedBy: row.checked_by || '',
      checkedAt: row.checked_at || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    }),
    toDb: (item) => ({
      schedule_item_id: item.scheduleItemId,
      schedule_log_id: item.scheduleLogId || null,
      checklist_id: item.checklistId || null,
      checklist_item_id: item.checklistItemId,
      checked: item.checked === true,
      ...(item.checkedBy ? { checked_by: item.checkedBy } : {}),
      checked_at: item.checked ? (item.checkedAt || new Date().toISOString()) : null,
    }),
    patchToDb: (patch) => ({
      ...(patch.checked !== undefined ? { checked: patch.checked === true } : {}),
      ...(patch.checkedBy !== undefined ? { checked_by: patch.checkedBy || null } : {}),
      ...(patch.checkedAt !== undefined ? { checked_at: patch.checkedAt || null } : {}),
    }),
  },
  rdoReports: {
    fromDb: (row) => ({
      id: row.id,
      reportDate: row.report_date || '',
      titulo: row.titulo || 'Relatorio diario de obra',
      clima: row.clima || '',
      equipe: row.equipe || '',
      resumo: row.resumo || '',
      servicosExecutados: row.servicos_executados || '',
      materiais: row.materiais || '',
      ferramentas: row.ferramentas || '',
      ocorrencias: row.ocorrencias || '',
      fotosCount: Number(row.fotos_count || 0),
      payload: row.payload || {},
      createdBy: row.created_by || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    }),
    toDb: (item) => ({
      report_date: item.reportDate,
      titulo: item.titulo || 'Relatorio diario de obra',
      clima: item.clima || null,
      equipe: item.equipe || null,
      resumo: item.resumo || null,
      servicos_executados: item.servicosExecutados || null,
      materiais: item.materiais || null,
      ferramentas: item.ferramentas || null,
      ocorrencias: item.ocorrencias || null,
      fotos_count: item.fotosCount ?? 0,
      payload: item.payload || {},
    }),
    patchToDb: (patch) => ({
      ...(patch.reportDate !== undefined ? { report_date: patch.reportDate } : {}),
      ...(patch.titulo !== undefined ? { titulo: patch.titulo || 'Relatorio diario de obra' } : {}),
      ...(patch.clima !== undefined ? { clima: patch.clima || null } : {}),
      ...(patch.equipe !== undefined ? { equipe: patch.equipe || null } : {}),
      ...(patch.resumo !== undefined ? { resumo: patch.resumo || null } : {}),
      ...(patch.servicosExecutados !== undefined ? { servicos_executados: patch.servicosExecutados || null } : {}),
      ...(patch.materiais !== undefined ? { materiais: patch.materiais || null } : {}),
      ...(patch.ferramentas !== undefined ? { ferramentas: patch.ferramentas || null } : {}),
      ...(patch.ocorrencias !== undefined ? { ocorrencias: patch.ocorrencias || null } : {}),
      ...(patch.fotosCount !== undefined ? { fotos_count: patch.fotosCount ?? 0 } : {}),
      ...(patch.payload !== undefined ? { payload: patch.payload || {} } : {}),
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

export async function updateCurrentUserPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}

export async function claimObrasUser() {
  const { data, error } = await supabase.rpc('obras_claim_user');
  if (error) throw error;
  return data?.id ? withSignedObrasUserAvatar(obrasUserFromDb(data)) : null;
}

export async function bootstrapObrasOwner({ nome, cidadeId, cidade }) {
  const { data, error } = await supabase.rpc('obras_bootstrap_owner', {
    p_nome: nome,
    p_cidade_id: cidadeId,
    p_cidade: cidade,
  });

  if (error) throw error;
  return data?.id ? withSignedObrasUserAvatar(obrasUserFromDb(data)) : null;
}

export async function fetchCurrentObrasUser(authUserId) {
  const { data, error } = await supabase
    .from('obras_users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? withSignedObrasUserAvatar(obrasUserFromDb(data)) : null;
}

export async function fetchObrasUsers() {
  const { data, error } = await supabase
    .from('obras_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Promise.all((data || []).map((row) => withSignedObrasUserAvatar(obrasUserFromDb(row))));
}

export async function fetchObrasAccounts() {
  const { data, error } = await supabase
    .from('obras_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Promise.all((data || []).map((row) => withSignedObrasAccountLogo(obrasAccountFromDb(row))));
}

export async function updateObrasAccount(accountId, patch) {
  const dbPatch = obrasAccountPatchToDb(patch);
  if (!Object.keys(dbPatch).length) return null;

  const { data, error } = await supabase
    .from('obras_accounts')
    .update(dbPatch)
    .eq('id', accountId)
    .select('*')
    .single();

  if (error) throw error;
  return withSignedObrasAccountLogo(obrasAccountFromDb(data));
}

export async function insertObrasUser(accountId, user) {
  if (supabaseConfigured) {
    return syncObrasUserAccess(accountId, user);
  }

  const { data, error } = await supabase
    .from('obras_users')
    .insert(obrasUserToDb(user, accountId))
    .select('*')
    .single();

  if (error) throw error;
  return withSignedObrasUserAvatar(obrasUserFromDb(data));
}

export async function updateObrasUser(userId, patch) {
  if (supabaseConfigured && patch.loginEnabled !== false && (patch.password || !patch.authUserId)) {
    if (!patch.password) {
      throw new Error('Informe uma senha temporaria para criar ou corrigir o login deste usuario.');
    }
    return syncObrasUserAccess(patch.accountId, patch);
  }

  const { data, error } = await supabase
    .from('obras_users')
    .update(obrasUserToDb(patch))
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return withSignedObrasUserAvatar(obrasUserFromDb(data));
}

export async function updateCurrentObrasUserProfile(patch) {
  const { data, error } = await supabase.rpc('obras_update_my_profile', {
    p_nome: patch.nome,
    p_telefone: patch.telefone || '',
    p_cpf: patch.cpf || '',
    p_professional_registry: patch.professionalRegistry || '',
    p_cidade_id: patch.cidadeId,
    p_cidade: patch.cidade,
    p_avatar_storage_path: patch.avatarStoragePath || '',
    p_avatar_file_name: patch.avatarFileName || '',
    p_avatar_mime_type: patch.avatarMimeType || '',
    p_avatar_file_size: patch.avatarFileSize || null,
  });

  if (error) throw error;
  return data?.id ? withSignedObrasUserAvatar(obrasUserFromDb(data)) : null;
}

async function syncObrasUserAccess(accountId, user) {
  const { data, error } = await supabase.functions.invoke('invite-obras-user', {
    body: {
      accountId,
      nome: user.nome,
      email: String(user.email || '').trim().toLowerCase(),
      telefone: user.telefone || '',
      cpf: user.cpf || '',
      professionalRegistry: user.professionalRegistry || '',
      cidadeId: user.cidadeId,
      cidade: user.cidade,
      role: user.role || 'operador',
      active: user.active !== false,
      loginEnabled: user.loginEnabled !== false,
      password: user.password || '',
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    },
  });

  if (error) throw error;
  if (!data?.user) throw new Error(data?.error || 'Nao foi possivel sincronizar o login do usuario.');
  return withSignedObrasUserAvatar(obrasUserFromDb(data.user));
}

export async function fetchCommercialPlans({ includeInactive = false } = {}) {
  let query = supabase
    .from('obras_plans')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('valor_mensal', { ascending: true });

  if (!includeInactive) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(commercialPlanFromDb);
}

export async function insertSignupRequest(values) {
  const { data, error } = await supabase
    .from('obras_signup_requests')
    .insert(signupRequestToDb(values))
    .select('*')
    .single();

  if (error) throw error;
  return signupRequestFromDb(data);
}

export async function fetchSignupRequests() {
  const { data, error } = await supabase
    .from('obras_signup_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(signupRequestFromDb);
}

export async function updateSignupRequest(requestId, patch) {
  const dbPatch = signupRequestPatchToDb(patch);
  if (!Object.keys(dbPatch).length) return null;

  const { data, error } = await supabase
    .from('obras_signup_requests')
    .update(dbPatch)
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw error;
  return signupRequestFromDb(data);
}

export async function fetchObrasSubscriptions() {
  const { data, error } = await supabase
    .from('obras_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(subscriptionFromDb);
}

export async function isObrasPlatformAdmin() {
  const { data, error } = await supabase.rpc('obras_is_platform_admin');
  if (error) throw error;
  return Boolean(data);
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('obras_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(projectFromDb);
}

export async function fetchProjectChildren(projectId, options = {}) {
  const requestedCollections = new Set(options.collections || Object.keys(childTables));
  const signPhotoUrls = options.signPhotoUrls !== false;
  const entries = await Promise.all(
    Object.entries(childTables).filter(([key]) => requestedCollections.has(key)).map(async ([key, table]) => {
      let query = supabase.from(table).select('*').eq('project_id', projectId);
      query = ['stages', 'scheduleItems'].includes(key)
        ? query.order('sort_order', { ascending: true })
        : key === 'scheduleLogs'
          ? query.order('visit_date', { ascending: false })
          : key === 'rdoReports'
            ? query.order('report_date', { ascending: false })
            : query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      let rows = (data || []).map(rowMappers[key].fromDb);
      if (key === 'photos' && signPhotoUrls) rows = await withSignedPhotoUrls(rows, projectId);
      return [key, rows];
    }),
  );

  return Object.fromEntries(entries);
}

export async function ensureProjectSchedule(projectId, blueprint) {
  const { data, error } = await supabase.rpc('obras_apply_schedule_blueprint', {
    p_project_id: projectId,
    p_blueprint: blueprint,
  });
  if (error) throw error;
  return Number(data || 0);
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
  if (patch.nome !== undefined) dbPatch.nome = patch.nome;
  if (patch.cliente !== undefined) dbPatch.cliente = patch.cliente;
  if (patch.endereco !== undefined) dbPatch.endereco = patch.endereco;
  if (patch.cidadeId !== undefined) dbPatch.cidade_id = patch.cidadeId;
  if (patch.bairroId !== undefined) dbPatch.bairro_id = patch.bairroId;
  if (patch.cidade !== undefined) dbPatch.cidade = patch.cidade;
  if (patch.bairro !== undefined) dbPatch.bairro = patch.bairro;
  if (patch.quadra !== undefined) dbPatch.quadra = patch.quadra || null;
  if (patch.lote !== undefined) dbPatch.lote = patch.lote || null;
  if (patch.percentual !== undefined) dbPatch.percentual = patch.percentual;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.proximaEtapa !== undefined) dbPatch.proxima_etapa = patch.proximaEtapa;
  if (patch.pls !== undefined) dbPatch.pls_status = patch.pls;
  if (patch.pendencias !== undefined) dbPatch.pendencias = patch.pendencias;
  if (patch.atraso !== undefined) dbPatch.atraso = patch.atraso;
  if (patch.areaConstruida !== undefined) dbPatch.area_construida = patch.areaConstruida || null;
  if (patch.areaTerreno !== undefined) dbPatch.area_terreno = patch.areaTerreno || null;
  if (patch.pavimentos !== undefined) dbPatch.pavimentos = patch.pavimentos || null;
  if (patch.responsavel !== undefined) dbPatch.responsavel = patch.responsavel || null;
  if (patch.observacoes !== undefined) dbPatch.observacoes = patch.observacoes || null;

  if (!Object.keys(dbPatch).length) return;
  const { error } = await supabase.from('obras_projects').update(dbPatch).eq('id', projectId);
  if (error) throw error;
}

export async function deleteProject(projectId) {
  const { error } = await supabase.from('obras_projects').delete().eq('id', projectId);
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
  const row = mapper.fromDb(data);
  if (collection === 'photos') return withSignedPhotoUrl(row);
  return row;
}

export async function updateChild(collection, id, patch) {
  const table = childTables[collection];
  const mapper = rowMappers[collection];
  const dbPatch = mapper.patchToDb ? mapper.patchToDb(patch) : patch;
  if (!Object.keys(dbPatch).length) return;

  const { error } = await supabase.from(table).update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function deleteChild(collection, id) {
  const table = childTables[collection];
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function replaceScheduleChecklistResults(projectId, scheduleLogId, results = []) {
  const table = childTables.checklistResults;
  const mapper = rowMappers.checklistResults;
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq('project_id', projectId)
    .eq('schedule_log_id', scheduleLogId);

  if (deleteError) throw deleteError;

  const rows = (results || [])
    .filter((item) => item.scheduleItemId && item.checklistItemId)
    .map((item) => ({
      project_id: projectId,
      ...mapper.toDb({ ...item, scheduleLogId }),
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from(table)
    .insert(rows)
    .select('*');

  if (error) throw error;
  return (data || []).map(mapper.fromDb);
}

export async function insertScheduleItemChecklistResults(projectId, results = []) {
  const table = childTables.checklistResults;
  const mapper = rowMappers.checklistResults;
  const rows = (results || [])
    .filter((item) => item.scheduleItemId && item.checklistItemId && item.checked === true)
    .map((item) => ({
      project_id: projectId,
      ...mapper.toDb({ ...item, scheduleLogId: '' }),
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from(table)
    .insert(rows)
    .select('*');

  if (error) throw error;
  return (data || []).map(mapper.fromDb);
}

export async function deletePhotoRecord(photo) {
  const storagePaths = [];
  if (photo.storagePath) storagePaths.push(photo.storagePath);
  if (photo.thumbnailStoragePath) {
    storagePaths.push(photo.thumbnailStoragePath);
  } else {
    const { data: thumbnails, error: thumbnailError } = await supabase
      .from(photoThumbnailTable)
      .select('storage_path')
      .eq('photo_id', photo.id);
    if (thumbnailError) throw thumbnailError;
    storagePaths.push(...(thumbnails || []).map((item) => item.storage_path).filter(Boolean));
  }

  const { error } = await supabase.from(childTables.photos).delete().eq('id', photo.id);
  if (error) throw error;
  if (!storagePaths.length) return '';

  const { error: storageError } = await supabase.storage.from(photoBucket).remove(storagePaths);
  return storageError?.message || '';
}

export async function uploadObrasUserAvatar({ accountId, userId, file, previousPath }) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = safeFileName(file.name || `${id}.jpg`);
  const storagePath = `${accountId}/${userId}/${id}-${fileName}`;
  const { error } = await supabase.storage.from(userAvatarBucket).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(userAvatarBucket).remove([previousPath]);
  }

  return {
    avatarStoragePath: storagePath,
    avatarFileName: fileName,
    avatarMimeType: file.type || 'image/jpeg',
    avatarFileSize: file.size || 0,
    avatarUrl: await createSignedAvatarUrl(storagePath),
  };
}

export async function uploadObrasAccountLogo({ accountId, file, previousPath }) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = safeFileName(file.name || `${id}.jpg`);
  const storagePath = `${accountId}/logo/${id}-${fileName}`;
  const { error } = await supabase.storage.from(accountLogoBucket).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(accountLogoBucket).remove([previousPath]);
  }

  return {
    logoStoragePath: storagePath,
    logoFileName: fileName,
    logoMimeType: file.type || 'image/jpeg',
    logoFileSize: file.size || 0,
    logoUrl: await createSignedAccountLogoUrl(storagePath),
  };
}

export async function uploadPhotoFile({ userId, projectId, file, thumbnailFile }) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const upload = await uploadPhotoStorageObject({
    userId,
    projectId,
    id,
    file,
  });

  if (!thumbnailFile) return upload;

  const thumbnail = await uploadPhotoStorageObject({
    userId,
    projectId,
    id,
    file: thumbnailFile,
    folder: 'thumbs',
  });

  return { ...upload, thumbnail };
}

export async function insertPhotoThumbnail(projectId, photoId, thumbnail) {
  const { data, error } = await supabase
    .from(photoThumbnailTable)
    .insert({
      project_id: projectId,
      photo_id: photoId,
      storage_path: thumbnail.storagePath,
      file_name: thumbnail.fileName || null,
      mime_type: thumbnail.mimeType || 'image/jpeg',
      file_size: thumbnail.fileSize || null,
      width: thumbnail.width || null,
      height: thumbnail.height || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return withSignedThumbnailUrl(photoThumbnailFromDb(data));
}

async function uploadPhotoStorageObject({ userId, projectId, id, file, folder = '' }) {
  const fileName = safeFileName(file.name || `${id}.jpg`);
  const storagePath = `${userId}/${projectId}/${id}-${fileName}`;
  const targetPath = folder ? `${userId}/${projectId}/${folder}/${id}-${fileName}` : storagePath;
  const { error } = await supabase.storage.from(photoBucket).upload(targetPath, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;

  return {
    storagePath: targetPath,
    fileName,
    mimeType: file.type || 'image/jpeg',
    fileSize: file.size || 0,
    photoUrl: await createSignedPhotoUrl(targetPath),
  };
}

async function withSignedPhotoUrls(photos, projectId) {
  const thumbnailsByPhotoId = await fetchPhotoThumbnailsByProject(projectId);
  return Promise.all(photos.map((photo) => withSignedPhotoUrl({
    ...photo,
    ...(thumbnailsByPhotoId.get(photo.id) || {}),
  })));
}

async function withSignedPhotoUrl(photo) {
  const nextPhoto = { ...photo };
  if (photo.storagePath) {
    try {
      nextPhoto.photoUrl = await createSignedPhotoUrl(photo.storagePath);
    } catch {
      // Keep the photo visible as metadata if the signed URL fails.
    }
  }
  if (photo.thumbnailStoragePath) {
    try {
      nextPhoto.thumbnailUrl = await createSignedPhotoUrl(photo.thumbnailStoragePath);
    } catch {
      // Fall back to the full image URL.
    }
  }
  return nextPhoto;
}

async function fetchPhotoThumbnailsByProject(projectId) {
  const { data, error } = await supabase
    .from(photoThumbnailTable)
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;

  return new Map((data || []).map((row) => {
    const thumbnail = photoThumbnailFromDb(row);
    return [thumbnail.photoId, thumbnail];
  }));
}

async function withSignedThumbnailUrl(thumbnail) {
  const storagePath = thumbnail.thumbnailStoragePath || thumbnail.storagePath;
  if (!storagePath) return thumbnail;
  return {
    ...thumbnail,
    thumbnailUrl: await createSignedPhotoUrl(storagePath),
  };
}

async function createSignedPhotoUrl(storagePath) {
  const { data, error } = await supabase.storage.from(photoBucket).createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}

async function withSignedObrasAccountLogo(account) {
  if (!account?.logoStoragePath) return account;
  try {
    return {
      ...account,
      logoUrl: await createSignedAccountLogoUrl(account.logoStoragePath),
    };
  } catch {
    return account;
  }
}

async function withSignedObrasUserAvatar(user) {
  if (!user?.avatarStoragePath) return user;
  try {
    return {
      ...user,
      avatarUrl: await createSignedAvatarUrl(user.avatarStoragePath),
    };
  } catch {
    return user;
  }
}

async function createSignedAccountLogoUrl(storagePath) {
  const { data, error } = await supabase.storage.from(accountLogoBucket).createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}

async function createSignedAvatarUrl(storagePath) {
  const { data, error } = await supabase.storage.from(userAvatarBucket).createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}

function photoThumbnailFromDb(row) {
  return {
    thumbnailId: row.id,
    photoId: row.photo_id,
    thumbnailStoragePath: row.storage_path || '',
    thumbnailFileName: row.file_name || '',
    thumbnailMimeType: row.mime_type || '',
    thumbnailFileSize: Number(row.file_size || 0),
    thumbnailWidth: Number(row.width || 0),
    thumbnailHeight: Number(row.height || 0),
  };
}

function checklistItemsFromDb(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `item-${index + 1}`,
          texto: item.trim(),
          obrigatorio: true,
        };
      }
      return {
        id: String(item?.id || `item-${index + 1}`),
        texto: String(item?.texto || item?.text || '').trim(),
        obrigatorio: item?.obrigatorio !== false,
      };
    })
    .filter((item) => item.texto);
}

function checklistItemsToDb(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: String(item?.id || `item-${index + 1}`),
      texto: String(item?.texto || item?.text || '').trim(),
      obrigatorio: item?.obrigatorio !== false,
    }))
    .filter((item) => item.texto);
}

function safeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'foto.jpg';
}
