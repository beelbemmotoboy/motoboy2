import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ContractScheduleBuilder from './ContractScheduleBuilder.jsx';
import ContractWork from './ContractWork.jsx';
import { Contractors, ServiceCategories } from './catalogScreens.jsx';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Circle,
  ClipboardCheck,
  Clock3,
  Database,
  Trash2,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  GripVertical,
  Hammer,
  HardHat,
  Home,
  ImagePlus,
  KeyRound,
  Landmark,
  Layers3,
  Library,
  LogIn,
  LogOut,
  MapPinned,
  Menu,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  bootstrapObrasOwner,
  claimObrasUser,
  deleteChild,
  deleteDocumentRecord,
  deleteProject,
  deletePhotoRecord,
  fetchChecklistPhotos,
  fetchProjectChildren,
  fetchProjects,
  fetchCommercialPlans,
  fetchContractors,
  fetchObrasAccounts,
  fetchObrasNotifications,
  fetchObrasSubscriptions,
  fetchObrasUsers,
  fetchNeighborhoods,
  fetchSignupRequests,
  fetchServiceCategories,
  getSession,
  ensureProjectSchedule,
  insertContractor,
  insertScheduleItemChecklistResults,
  insertChild,
  insertChecklistPhoto,
  insertNeighborhood,
  insertPhotoThumbnail,
  insertObrasNotification,
  insertObrasUser,
  insertProject,
  insertServiceCategory,
  insertSignupRequest,
  isObrasPlatformAdmin,
  onAuthStateChange,
  replaceScheduleChecklistResults,
  signIn,
  signOut,
  subscribeObrasNotifications,
  supabaseConfigured,
  sendObrasPushNotification,
  updateCurrentObrasUserProfile,
  updateCurrentUserPassword,
  updateChild,
  updateContractor,
  updateObrasAccount,
  updateObrasUser,
  updateProject,
  updateServiceCategory,
  updateSignupRequest,
  upsertObrasPushSubscription,
  uploadObrasAccountLogo,
  uploadObrasDocumentFile,
  uploadObrasUserAvatar,
  uploadPhotoFile,
} from './db.js';
import { getBestPhotoUrl, prepareAvatarUpload, prepareLogoUpload, preparePhotoUpload } from './photoFunctions.js';
import { enableObrasPushNotifications, getPushSupportStatus, showObrasBrowserNotification } from './pushNotifications.js';
import {
  DEFAULT_SCHEDULE_SOURCE,
  buildScheduleCopyPlan,
  buildScheduleSourceOptions,
} from './scheduleFunctions.js';
import { buildLocalScheduleItems, defaultScheduleBlueprint } from './scheduleBlueprint.js';
import loginBackground from './assets/login-background.jpg';
import obrasLogo from './assets/beelbem-obras-logo.jpg';
import './styles.css';

const STORAGE_KEY = 'beelbem-obras-local-v1';
const MAX_CHECKLIST_PHOTOS_PER_ITEM = 20;

const statusClasses = {
  Concluida: 'success',
  Conferido: 'success',
  Aprovado: 'success',
  Corrigido: 'success',
  Comprado: 'success',
  Disponivel: 'success',
  Resolvida: 'success',
  Ativo: 'success',
  'Em andamento': 'warning',
  Atencao: 'warning',
  Pendente: 'danger',
  Atrasada: 'danger',
  Reprovado: 'danger',
  Aberta: 'danger',
  'Em falta': 'danger',
  'Nao iniciada': 'neutral',
  'Nao iniciado': 'neutral',
  Necessario: 'neutral',
  Inativo: 'neutral',
  'Pronto para enviar': 'info',
  Enviado: 'info',
  IA: 'ai',
  'Analise IA': 'ai',
  Novo: 'neutral',
  'Em analise': 'warning',
  Rejeitado: 'danger',
  Convertido: 'info',
  Trial: 'info',
  Ativa: 'success',
  Suspensa: 'warning',
  Bloqueada: 'danger',
  Cancelada: 'neutral',
  Vencida: 'danger',
};

const cityCatalog = [
  { id: 'rio-verde', nome: 'Rio Verde' },
  { id: 'jatai', nome: 'Jatai' },
  { id: 'mineiros', nome: 'Mineiros' },
  { id: 'santa-helena', nome: 'Santa Helena' },
];

const neighborhoodCatalog = {
  'rio-verde': [
    { id: 'centro', nome: 'Centro' },
    { id: 'jardim-presidente', nome: 'Jardim Presidente' },
    { id: 'popular', nome: 'Popular' },
    { id: 'morada-do-sol', nome: 'Morada do Sol' },
  ],
  jatai: [
    { id: 'setor-central', nome: 'Setor Central' },
    { id: 'vila-sofia', nome: 'Vila Sofia' },
    { id: 'epaminondas', nome: 'Epaminondas' },
  ],
  mineiros: [
    { id: 'centro-mineiros', nome: 'Centro' },
    { id: 'nova-republica', nome: 'Nova Republica' },
  ],
  'santa-helena': [
    { id: 'centro-santa', nome: 'Centro' },
    { id: 'sul', nome: 'Setor Sul' },
  ],
};

function buildNeighborhoodSlug(name) {
  return normalizeSearch(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'bairro';
}

function getNeighborhoodOptions(cityId, customNeighborhoods = []) {
  const byId = new Map();
  (neighborhoodCatalog[cityId] || []).forEach((neighborhood) => {
    byId.set(neighborhood.id, { ...neighborhood, cidadeId: cityId, source: 'catalog' });
  });
  (customNeighborhoods || [])
    .filter((neighborhood) => neighborhood.ativo !== false && neighborhood.cidadeId === cityId)
    .forEach((neighborhood) => {
      byId.set(neighborhood.id, { ...neighborhood, source: 'custom' });
    });
  return Array.from(byId.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

function getAllNeighborhoodOptions(customNeighborhoods = []) {
  return cityCatalog.flatMap((city) => getNeighborhoodOptions(city.id, customNeighborhoods));
}

const projectCollections = ['stages', 'scheduleItems', 'scheduleLogs', 'photos', 'plsItems', 'issues', 'supplies', 'tools', 'checklist', 'checklistResults', 'checklistPhotos', 'rdoReports', 'documents', 'contractorAssignments'];
const emptyProjectCollections = Object.fromEntries(projectCollections.map((collection) => [collection, []]));
const documentTypeOptions = [
  'Projetos da obra',
  'Documentos clientes',
  'Contratos Mao de Obra',
  'Outros documentos',
];
const projectScreenRequirements = {
  stages: { collections: ['scheduleItems', 'scheduleLogs', 'photos', 'issues'], signPhotoUrls: false, normalizeSchedule: false },
  stageDetail: { collections: ['stages'], signPhotoUrls: false },
  photos: { collections: ['scheduleItems', 'photos'], signPhotoUrls: true, normalizeSchedule: false },
  pls: { collections: ['plsItems'], signPhotoUrls: false },
  schedule: { collections: ['scheduleItems', 'scheduleLogs', 'checklist', 'checklistResults', 'contractorAssignments'], signPhotoUrls: false, normalizeSchedule: true },
  contractWork: { collections: ['scheduleItems', 'contractorAssignments'], signPhotoUrls: false, normalizeSchedule: true },
  contractScheduleBuilder: { collections: ['scheduleItems', 'contractorAssignments'], signPhotoUrls: false, normalizeSchedule: true },
  issues: { collections: ['issues'], signPhotoUrls: false },
  supplies: { collections: ['supplies'], signPhotoUrls: false },
  tools: { collections: ['tools'], signPhotoUrls: false },
  checklist: { collections: ['scheduleItems', 'scheduleLogs', 'checklist', 'checklistResults'], signPhotoUrls: false, normalizeSchedule: false },
  notifications: { collections: ['scheduleItems', 'scheduleLogs', 'photos', 'plsItems', 'issues', 'checklist', 'checklistResults', 'rdoReports'], signPhotoUrls: false, normalizeSchedule: false },
  reports: { collections: ['scheduleItems', 'scheduleLogs', 'photos', 'issues', 'checklist', 'checklistResults', 'rdoReports'], signPhotoUrls: false, normalizeSchedule: false },
  documents: { collections: ['documents'], signPhotoUrls: false },
  standards: { collections: ['documents'], signPhotoUrls: false },
  workPanel: { collections: ['scheduleItems', 'scheduleLogs'], signPhotoUrls: false, normalizeSchedule: false },
  stageLibrary: { collections: ['stages'], signPhotoUrls: false },
};

function getProjectScreenRequirement(screen) {
  return projectScreenRequirements[screen] || { collections: [], signPhotoUrls: false };
}

const initialData = {
  works: [
    {
      id: 'casa-joao',
      nome: 'Casa Joao Silva',
      cliente: 'Joao Silva',
      endereco: 'Rua 12, Qd. 8, Lt. 4',
      cidadeId: 'rio-verde',
      bairroId: 'centro',
      cidade: 'Rio Verde',
      bairro: 'Centro',
      percentual: 64,
      status: 'Em andamento',
      proximaEtapa: 'Instalacao eletrica',
      pls: 'Pendente',
      pendencias: 3,
      atraso: 2,
      areaConstruida: '148 m2',
      areaTerreno: '300 m2',
      pavimentos: '1',
      responsavel: 'Eng. Ana Prado',
      observacoes: 'Projeto residencial com acompanhamento PLS Caixa.',
    },
    {
      id: 'sobrado-lote-12',
      nome: 'Sobrado Lote 12',
      cliente: 'Construtora Alfa',
      endereco: 'Av. Presidente, Qd. 12',
      cidadeId: 'rio-verde',
      bairroId: 'jardim-presidente',
      cidade: 'Rio Verde',
      bairro: 'Jardim Presidente',
      percentual: 42,
      status: 'Atrasada',
      proximaEtapa: 'Cobertura',
      pls: 'Pronto para enviar',
      pendencias: 5,
      atraso: 7,
      areaConstruida: '210 m2',
      areaTerreno: '360 m2',
      pavimentos: '2',
      responsavel: 'Eng. Ana Prado',
      observacoes: 'Atraso em cobertura aguardando insumos.',
    },
    {
      id: 'obra-maria',
      nome: 'Obra Maria Santos',
      cliente: 'Maria Santos',
      endereco: 'Rua 4, Qd. 2, Lt. 9',
      cidadeId: 'rio-verde',
      bairroId: 'popular',
      cidade: 'Rio Verde',
      bairro: 'Popular',
      percentual: 88,
      status: 'Concluida',
      proximaEtapa: 'Entrega da obra',
      pls: 'Aprovado',
      pendencias: 0,
      atraso: 0,
      areaConstruida: '96 m2',
      areaTerreno: '240 m2',
      pavimentos: '1',
      responsavel: 'Eng. Ana Prado',
      observacoes: 'Obra em finalizacao.',
    },
  ],
  stages: [
    { id: 'servicos', nome: 'Servicos preliminares', percentual: 100, status: 'Concluida', inicio: '02/06', fim: '06/06', pendencias: 0, fotosFaltando: 0 },
    { id: 'locacao', nome: 'Locacao da obra', percentual: 100, status: 'Concluida', inicio: '07/06', fim: '08/06', pendencias: 0, fotosFaltando: 0 },
    { id: 'terreno', nome: 'Corte do terreno', percentual: 100, status: 'Concluida', inicio: '09/06', fim: '11/06', pendencias: 0, fotosFaltando: 0 },
    { id: 'aterro', nome: 'Aterro', percentual: 80, status: 'Em andamento', inicio: '12/06', fim: '15/06', pendencias: 1, fotosFaltando: 1 },
    { id: 'arrimo', nome: 'Muro de arrimo', percentual: 60, status: 'Atencao', inicio: '16/06', fim: '22/06', pendencias: 2, fotosFaltando: 2 },
    { id: 'fundacao', nome: 'Fundacao', percentual: 54, status: 'Em andamento', inicio: '23/06', fim: '30/06', pendencias: 1, fotosFaltando: 2 },
    { id: 'estacas', nome: 'Estacas', percentual: 40, status: 'Em andamento', inicio: '01/07', fim: '03/07', pendencias: 0, fotosFaltando: 1 },
    { id: 'blocos', nome: 'Blocos', percentual: 20, status: 'Nao iniciado', inicio: '04/07', fim: '07/07', pendencias: 0, fotosFaltando: 3 },
    { id: 'baldrame', nome: 'Baldrame', percentual: 0, status: 'Nao iniciado', inicio: '08/07', fim: '12/07', pendencias: 0, fotosFaltando: 3 },
    { id: 'alvenaria', nome: 'Alvenaria', percentual: 0, status: 'Nao iniciado', inicio: '16/07', fim: '30/07', pendencias: 0, fotosFaltando: 4 },
    { id: 'cobertura', nome: 'Cobertura', percentual: 0, status: 'Nao iniciado', inicio: '04/08', fim: '14/08', pendencias: 0, fotosFaltando: 4 },
    { id: 'eletrica', nome: 'Instalacao eletrica', percentual: 0, status: 'Nao iniciado', inicio: '01/09', fim: '08/09', pendencias: 0, fotosFaltando: 3 },
    { id: 'entrega', nome: 'Entrega da obra', percentual: 0, status: 'Nao iniciado', inicio: '04/11', fim: '05/11', pendencias: 0, fotosFaltando: 1 },
  ],
  scheduleItems: buildLocalScheduleItems(),
  scheduleLogs: [],
  checklistResults: [],
  checklistPhotos: [],
  rdoReports: [],
  documents: [],
  photos: [
    { id: 'foto-1', etapa: 'Fundacao', tipo: 'Durante', data: '03/06/2026', usuario: 'Carlos Lima', observacao: 'Armadura conferida', cor: 'blue' },
    { id: 'foto-2', etapa: 'Muro de arrimo', tipo: 'Problema', data: '03/06/2026', usuario: 'Ana Prado', observacao: 'Dreno pendente', cor: 'red' },
    { id: 'foto-3', etapa: 'Aterro', tipo: 'PLS Caixa', data: '03/06/2026', usuario: 'Marcos Reis', observacao: 'Registro para vistoria', cor: 'purple' },
  ],
  plsItems: [
    { id: 'pls-1', etapa: 'Fundacao', percentual: 54, fotos: '4/6', status: 'Pendente', vistoria: '10/06', observacao: 'Faltam fotos de concretagem' },
    { id: 'pls-2', etapa: 'Aterro', percentual: 80, fotos: '6/6', status: 'Pronto para enviar', vistoria: '06/06', observacao: 'Conjunto completo' },
    { id: 'pls-3', etapa: 'Servicos preliminares', percentual: 100, fotos: '5/5', status: 'Aprovado', vistoria: '02/06', observacao: 'Aprovado sem ressalvas' },
  ],
  issues: [
    { id: 'pend-1', descricao: 'Regularizar dreno do muro', etapa: 'Muro de arrimo', responsavel: 'Equipe estrutural', prazo: '07/06', status: 'Aberta', norma: 'ABNT NBR 6122' },
    { id: 'pend-2', descricao: 'Enviar foto do gabarito', etapa: 'Locacao da obra', responsavel: 'Mestre de obras', prazo: '04/06', status: 'Resolvida', norma: 'Checklist interno' },
    { id: 'pend-3', descricao: 'Conferir impermeabilizacao', etapa: 'Baldrame', responsavel: 'Eng. Ana', prazo: '14/06', status: 'Em andamento', norma: 'ABNT NBR 9575' },
  ],
  supplies: [
    { id: 'ins-1', nome: 'Cimento CP II', etapa: 'Fundacao', unidade: 'saco', prevista: 80, usada: 52, status: 'Comprado', observacao: 'Estoque local' },
    { id: 'ins-2', nome: 'Aco CA-50', etapa: 'Estacas', unidade: 'kg', prevista: 420, usada: 120, status: 'Em falta', observacao: 'Comprar ate sexta' },
    { id: 'ins-3', nome: 'Bloco ceramico', etapa: 'Alvenaria', unidade: 'un', prevista: 5600, usada: 0, status: 'Necessario', observacao: 'Aguardando medicao' },
  ],
  tools: [
    { id: 'fer-1', nome: 'Betoneira', etapa: 'Fundacao', tipo: 'Equipamento', obrigatorio: 'Obrigatorio', status: 'Disponivel', observacao: 'No canteiro' },
    { id: 'fer-2', nome: 'Nivel a laser', etapa: 'Locacao da obra', tipo: 'Ferramenta', obrigatorio: 'Obrigatorio', status: 'Disponivel', observacao: 'Conferido' },
    { id: 'fer-3', nome: 'Compactador', etapa: 'Aterro', tipo: 'Equipamento', obrigatorio: 'Obrigatorio', status: 'Em falta', observacao: 'Solicitar locacao' },
  ],
  checklist: [
    { id: 'chk-1', descricao: 'Conferir prumo e esquadro', etapa: 'Alvenaria', norma: 'ABNT NBR 8545', foto: 'Obrigatoria', responsavel: 'Eng. Ana', data: '16/07', status: 'Nao iniciado' },
    { id: 'chk-2', descricao: 'Verificar cobrimento da armadura', etapa: 'Fundacao', norma: 'ABNT NBR 6118', foto: 'Obrigatoria', responsavel: 'Carlos Lima', data: '03/06', status: 'Conferido' },
    { id: 'chk-3', descricao: 'Registrar impermeabilizacao', etapa: 'Baldrame', norma: 'ABNT NBR 9574', foto: 'Obrigatoria', responsavel: 'Marcos Reis', data: '13/07', status: 'Em andamento' },
  ],
  serviceCategories: [
    { id: 'cat-fundacao', nome: 'Fundacao', descricao: 'Servicos de fundacao, estacas, blocos e sapatas.', ativo: true },
    { id: 'cat-alvenaria', nome: 'Alvenaria', descricao: 'Execucao de paredes, pilares, vergas e respaldo.', ativo: true },
    { id: 'cat-estrutura', nome: 'Estrutura', descricao: 'Laje, vigas, pilares e cobertura estrutural.', ativo: true },
    { id: 'cat-hidraulica', nome: 'Hidraulica', descricao: 'Instalacoes hidraulicas e sanitarias.', ativo: true },
    { id: 'cat-eletrica', nome: 'Eletrica', descricao: 'Instalacoes eletricas brutas e finais.', ativo: true },
    { id: 'cat-acabamento', nome: 'Acabamento', descricao: 'Revestimentos, pintura, forro e limpeza final.', ativo: true },
  ],
  neighborhoods: [],
  contractors: [],
  contractorAssignments: [],
};

const remoteInitialData = {
  ...initialData,
  works: [],
  serviceCategories: [],
  neighborhoods: [],
  contractors: [],
  ...emptyProjectCollections,
};

const quickRoutes = [
  { id: 'dashboard', label: 'Inicio', Icon: Home },
  { id: 'cities', label: 'Cidades', Icon: MapPinned },
  { id: 'works', label: 'Obras', Icon: Building2 },
  { id: 'issues', label: 'Pendencias', Icon: AlertTriangle },
  { id: 'profile', label: 'Perfil', Icon: UserRound },
];

const sidebarRoutes = [
  ...quickRoutes,
  { id: 'companies', label: 'Empresas', Icon: Landmark },
  { id: 'users', label: 'Usuarios', Icon: UsersRound },
  { id: 'serviceCategories', label: 'Categorias', Icon: FolderKanban },
  { id: 'contractors', label: 'Empreiteiros', Icon: HardHat },
  { id: 'commercial', label: 'Assinaturas', Icon: Landmark, disabled: true },
  { id: 'pls', label: 'PLS Caixa', Icon: FileCheck2 },
  { id: 'reports', label: 'Relatorios', Icon: BarChart3 },
  { id: 'stageLibrary', label: 'Cadastro etapas', Icon: Library },
];

const obrasRoles = [
  { value: 'owner', label: 'Proprietario' },
  { value: 'admin', label: 'Administrador' },
  { value: 'engenheiro', label: 'Engenheiro' },
  { value: 'arquiteto', label: 'Arquiteto' },
  { value: 'operador', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

const localCommercialPlans = [
  {
    id: 'engenheiro-individual',
    nome: 'Engenheiro individual',
    descricao: 'Para profissional autonomo acompanhar obras residenciais.',
    tipo: 'engenheiro',
    valorMensal: 79.90,
    limiteObras: 8,
    limiteUsuarios: 3,
    recursos: ['Cronograma inteligente', 'Fotos por etapa', 'Pendencias', 'Relatorios basicos'],
    active: true,
  },
  {
    id: 'empresa-campo',
    nome: 'Empresa de obras',
    descricao: 'Para empresas com equipe propria e varias obras em andamento.',
    tipo: 'empresa',
    valorMensal: 149.90,
    limiteObras: 30,
    limiteUsuarios: 12,
    recursos: ['Multiusuarios', 'Cronograma por obra', 'PLS Caixa', 'Fotos com miniatura', 'Relatorios'],
    active: true,
  },
  {
    id: 'construtora',
    nome: 'Construtora',
    descricao: 'Para operacao com varias cidades, gestores e padroes de cronograma.',
    tipo: 'construtora',
    valorMensal: 299.90,
    limiteObras: null,
    limiteUsuarios: null,
    recursos: ['Obras ilimitadas', 'Usuarios ilimitados', 'Padroes de cronograma', 'Gestao comercial', 'Suporte prioritario'],
    active: true,
  },
];

const localObrasAccounts = [
  {
    id: 'local-account',
    nome: 'Empresa de obras',
    documento: '',
    responsavel: 'Eng. Ana Prado',
    email: 'engenharia@beelbem.com.br',
    telefone: '',
    endereco: '',
    cidadeId: 'rio-verde',
    cidade: 'Rio Verde',
    plano: 'empresa-campo',
    status: 'Ativa',
    logoStoragePath: '',
    logoFileName: '',
    logoMimeType: '',
    logoFileSize: 0,
    logoUrl: '',
    createdAt: '',
    updatedAt: '',
  },
];

const localObrasUsers = [
  {
    id: 'local-owner',
    authUserId: '',
    accountId: 'local-account',
    nome: 'Eng. Ana Prado',
    email: 'engenharia@beelbem.com.br',
    telefone: '',
    cidadeId: 'rio-verde',
    cidade: 'Rio Verde',
    role: 'owner',
    active: true,
    loginEnabled: true,
    createdAt: '',
  },
];

const workPanelRoutes = [
  { id: 'photos', label: 'Fotos', Icon: Camera },
  { id: 'pls', label: 'PLS', Icon: FileCheck2 },
  { id: 'contractWork', label: 'Empreita', Icon: HardHat },
  { id: 'schedule', label: 'Cronograma', Icon: CalendarDays },
  { id: 'issues', label: 'Mais', Icon: Menu },
];

function loadData() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialData, ...JSON.parse(saved) } : initialData;
  } catch {
    return initialData;
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function today() {
  return new Intl.DateTimeFormat('pt-BR').format(new Date());
}

function StatusPill({ status }) {
  return <span className={`status ${statusClasses[status] || 'neutral'}`}>{status}</span>;
}

function ActionButton({ children, Icon, variant = 'primary', onClick, type = 'button', disabled = false }) {
  return (
    <button className={`action-button ${variant}`} type={type} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={20} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function IconButton({ label, Icon, onClick }) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>
      <Icon size={22} aria-hidden="true" />
    </button>
  );
}

function MetricCard({ label, value, Icon, tone = 'neutral', onIconClick, iconLabel }) {
  const content = (
    <>
      <span className="metric-action-icon" aria-hidden="true">
        <Icon size={22} aria-hidden="true" />
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </>
  );

  if (onIconClick) {
    return (
      <button className={`metric-card metric-card-clickable tone-${tone}`} type="button" aria-label={iconLabel || label} title={iconLabel || label} onClick={onIconClick}>
        {content}
      </button>
    );
  }

  return (
    <article className={`metric-card tone-${tone}`}>
      {content}
    </article>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="progress" aria-label={`${value}% executado`}>
      <span style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} />
    </div>
  );
}

const NavigationContext = createContext(null);

function PageTitle({ eyebrow, title, subtitle, children, onBack }) {
  const navigation = useContext(NavigationContext);
  const backAction = navigation?.canGoBack ? navigation.goBack : onBack;

  return (
    <header className="page-title">
      <div>
        <div className="title-row">
          {backAction ? <IconButton label="Voltar" Icon={ChevronLeft} onClick={backAction} /> : null}
          <span>{eyebrow}</span>
        </div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children ? <div className="title-actions">{children}</div> : null}
    </header>
  );
}

function EmptyNotice({ Icon = Sparkles, title, text }) {
  return (
    <section className="empty-notice">
      <Icon size={30} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatIssuePrazo(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || '';
  return `${match[3]}/${match[2]}`;
}

function getFirstName(value) {
  return String(value || '').trim().split(/\s+/)[0] || 'Cliente';
}

function getEffectiveWorkStatus(work) {
  const status = String(work?.status || '').trim();
  const normalizedStatus = normalizeSearch(status);
  const percentual = Math.min(100, Math.max(0, Number(work?.percentual) || 0));

  if (percentual >= 100) return 'Concluida';
  if (normalizedStatus.includes('atrasad')) return 'Atrasada';
  if (normalizedStatus.includes('paralisad')) return status;
  if (normalizedStatus.includes('concluid')) return 'Concluida';
  if (percentual > 0 || normalizedStatus.includes('andamento')) return 'Em andamento';
  return status || 'Nao iniciada';
}

function getWorkCardTone(work) {
  const status = normalizeSearch(getEffectiveWorkStatus(work));
  const pls = normalizeSearch(work.pls);
  const percentual = Number(work.percentual) || 0;
  const pendencias = Number(work.pendencias) || 0;
  const atraso = Number(work.atraso) || 0;

  if (status.includes('paralisad')) return 'black';
  if (status.includes('nao iniciad') || percentual <= 0) return 'white';
  if (status.includes('atrasad') || atraso > 0) return 'red';
  if (pendencias > 0 || pls.includes('atras') || pls.includes('vencid') || pls.includes('reprovad')) return 'yellow';
  return 'green';
}

function roleLabel(role) {
  return obrasRoles.find((item) => item.value === role)?.label || 'Operador';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (!size) return 'Tamanho nao informado';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBr(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value || '';
}

function normalizeDateKey(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return text;
  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return text;
}

function compareDateKeys(a, b) {
  return String(normalizeDateKey(a)).localeCompare(String(normalizeDateKey(b)));
}

function isDateInRange(value, startDate, endDate) {
  const dateKey = normalizeDateKey(value);
  const startKey = normalizeDateKey(startDate);
  const endKey = normalizeDateKey(endDate);
  if (!dateKey || !startKey || !endKey) return false;
  return dateKey >= startKey && dateKey <= endKey;
}

function normalizeDateRange(startDate, endDate) {
  const startKey = normalizeDateKey(startDate) || todayIso();
  const endKey = normalizeDateKey(endDate) || startKey;
  return compareDateKeys(startKey, endKey) <= 0
    ? { startDate: startKey, endDate: endKey }
    : { startDate: endKey, endDate: startKey };
}

function formatDateRangeBr(startDate, endDate) {
  const range = normalizeDateRange(startDate, endDate);
  return range.startDate === range.endDate
    ? formatDateBr(range.startDate)
    : `${formatDateBr(range.startDate)} a ${formatDateBr(range.endDate)}`;
}

function activityDateKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function activityTimeLabel(value) {
  const text = String(value || '').trim();
  if (!text || /^\d{4}-\d{2}-\d{2}$/.test(text) || /^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return 'Sem horario';
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return 'Sem horario';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function activityTimestamp(...values) {
  for (const value of values) {
    const time = Date.parse(value || '');
    if (Number.isFinite(time)) return time;
  }

  const key = values.map(activityDateKey).find(Boolean);
  return key ? Date.parse(`${key}T00:00:00`) : 0;
}

function activityUserName(value, users = [], fallback = 'Usuario nao informado') {
  const text = String(value || '').trim();
  if (!text) return fallback;

  const match = users.find((user) => (
    user.id === text
    || user.authUserId === text
    || normalizeSearch(user.email) === normalizeSearch(text)
    || normalizeSearch(user.nome) === normalizeSearch(text)
  ));
  return match?.nome || fallback;
}

function requestStatusLabel(status) {
  return {
    novo: 'Novo',
    em_analise: 'Em analise',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    convertido: 'Convertido',
  }[status] || 'Novo';
}

function subscriptionStatusLabel(status) {
  return {
    trial: 'Trial',
    active: 'Ativa',
    past_due: 'Vencida',
    blocked: 'Bloqueada',
    cancelled: 'Cancelada',
  }[status] || 'Trial';
}

function Field({ label, name, value, type = 'text', wide = false, required = false, disabled = false }) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <input type={type} name={name} defaultValue={value || ''} required={required} disabled={disabled} />
    </label>
  );
}

function SelectField({ label, name, value, options, disabled = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value} disabled={disabled}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function NeighborhoodField({
  cityId,
  value = '',
  neighborhoods = [],
  disabled = false,
  onAddNeighborhood,
}) {
  const options = getNeighborhoodOptions(cityId, neighborhoods);
  const optionKey = options.map((option) => option.id).join('|');
  const [selectedId, setSelectedId] = useState(value || options[0]?.id || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const availableIds = new Set(options.map((option) => option.id));
    setSelectedId((current) => {
      if (current && availableIds.has(current)) return current;
      if (value && availableIds.has(value)) return value;
      return options[0]?.id || '';
    });
  }, [cityId, value, optionKey]);

  async function saveNeighborhood(name) {
    if (!onAddNeighborhood) return;
    setSaving(true);
    setError('');
    try {
      const saved = await onAddNeighborhood({ cidadeId: cityId, nome: name });
      if (saved?.id) setSelectedId(saved.id);
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'Nao foi possivel cadastrar o bairro.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <label className="field neighborhood-field">
        <span>Bairro</span>
        <div className="select-with-action">
          <select name="bairroId" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={disabled}>
            {options.map((neighborhood) => (
              <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.nome}</option>
            ))}
          </select>
          <button
            type="button"
            className="inline-add-button"
            onClick={() => {
              setError('');
              setModalOpen(true);
            }}
            disabled={disabled || !cityId}
          >
            <Plus size={18} aria-hidden="true" />
            <span>Bairro</span>
          </button>
        </div>
      </label>
      {modalOpen ? (
        <NeighborhoodModal
          city={cityCatalog.find((city) => city.id === cityId) || cityCatalog[0]}
          saving={saving}
          error={error}
          onClose={() => {
            if (!saving) setModalOpen(false);
          }}
          onSave={saveNeighborhood}
        />
      ) : null}
    </>
  );
}

function NeighborhoodModal({ city, saving, error, onClose, onSave }) {
  const [name, setName] = useState('');

  function submit() {
    const nome = name.trim();
    if (!nome) return;
    onSave(nome);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="photo-modal neighborhood-modal" role="dialog" aria-modal="true" aria-labelledby="neighborhood-modal-title">
        <div className="modal-head">
          <div>
            <span>Cadastrar bairro</span>
            <h2 id="neighborhood-modal-title">{city?.nome || 'Cidade'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        {error ? <p className="auth-message error">{error}</p> : null}
        <div className="form-grid modal-fields">
          <label className="field">
            <span>Nome do bairro</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              disabled={saving}
              autoFocus
            />
          </label>
        </div>
        <div className="form-actions">
          <ActionButton Icon={Save} onClick={submit} disabled={saving || !name.trim()}>
            {saving ? 'Salvando...' : 'Salvar bairro'}
          </ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </section>
    </div>
  );
}

function TextAreaField({ label, name, value, disabled = false }) {
  return (
    <label className="field wide">
      <span>{label}</span>
      <textarea name={name} defaultValue={value || ''} rows={4} disabled={disabled} />
    </label>
  );
}

function ScheduleSourceField({ works = [] }) {
  const options = buildScheduleSourceOptions(works);

  return (
    <label className="field wide schedule-source-field">
      <span>Cronograma</span>
      <select name="scheduleSourceProjectId" defaultValue={DEFAULT_SCHEDULE_SOURCE}>
        <option value={DEFAULT_SCHEDULE_SOURCE}>Usar cronograma padrao</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>Copiar de {option.label}</option>
        ))}
      </select>
      <small>
        {options.length
          ? 'Escolha uma obra existente para copiar apenas etapas e subitens. Datas, fotos, diario e andamento comecam em branco.'
          : 'Nenhuma obra existente para copiar. A nova obra usara o cronograma padrao.'}
      </small>
    </label>
  );
}

function getScheduleDateBoundary(items, field, boundary) {
  const dates = items
    .map((item) => item[field])
    .filter(Boolean)
    .sort();

  if (!dates.length) return '';
  return boundary === 'start' ? dates[0] : dates[dates.length - 1];
}

function calculateScheduleStageProgress(children) {
  if (!children.length) return 0;
  return Math.round(
    children.reduce(
      (total, item) => total + Math.min(100, Math.max(0, Number(item.percentual) || 0)),
      0,
    ) / children.length,
  );
}

function normalizeMoneyValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const rawValue = String(value || '').trim();
  const normalized = rawValue.includes(',')
    ? rawValue.replace(/\./g, '').replace(',', '.')
    : rawValue;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function calculateScheduleStagePayments(children) {
  return children.reduce((totals, item) => {
    const itemValue = normalizeMoneyValue(item.valorMaoObra);
    const percentual = Math.min(100, Math.max(0, Number(item.percentual) || 0));
    return {
      total: totals.total + itemValue,
      executed: totals.executed + (itemValue * (percentual / 100)),
    };
  }, { total: 0, executed: 0 });
}

function calculateSchedulePayments(items = []) {
  return calculateScheduleStagePayments(
    items.filter((item) => item.parentId && item.visible !== false),
  );
}

function deriveScheduleStages(items) {
  const nextItems = items.map((item) => ({ ...item }));
  const stages = nextItems.filter((item) => !item.parentId);

  stages.forEach((stage) => {
    const children = nextItems
      .filter((item) => item.parentId === stage.id && item.visible !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (!children.length) return;

    const percentual = calculateScheduleStageProgress(children);
    const status = percentual >= 100
      ? 'Concluida'
      : children.some((item) => item.status === 'Atencao')
        ? 'Atencao'
        : percentual > 0 || children.some((item) => item.status === 'Em andamento')
          ? 'Em andamento'
          : 'Nao iniciado';
    const target = nextItems.find((item) => item.id === stage.id);
    target.percentual = percentual;
    target.status = status;
    target.inicioPrevisto = getScheduleDateBoundary(children, 'inicioPrevisto', 'start');
    target.fimPrevisto = getScheduleDateBoundary(children, 'fimPrevisto', 'end');
    target.inicioReal = getScheduleDateBoundary(children, 'inicioReal', 'start');
    target.fimReal = getScheduleDateBoundary(children, 'fimReal', 'end');
  });

  return nextItems;
}

function calculateScheduleProgress(items) {
  const stages = items.filter((item) => !item.parentId && item.visible !== false);
  if (!stages.length) return 0;
  return Math.round(
    stages.reduce((total, item) => total + Math.min(100, Math.max(0, Number(item.percentual) || 0)), 0)
    / stages.length,
  );
}

function getDerivedStageUpdates(previousItems, nextItems) {
  return nextItems
    .filter((item) => !item.parentId)
    .filter((item) => {
      const previous = previousItems.find((candidate) => candidate.id === item.id);
      return previous
        && (
          previous.percentual !== item.percentual
          || previous.status !== item.status
          || previous.inicioPrevisto !== item.inicioPrevisto
          || previous.fimPrevisto !== item.fimPrevisto
          || previous.inicioReal !== item.inicioReal
          || previous.fimReal !== item.fimReal
        );
    })
    .map((item) => ({
      id: item.id,
      patch: {
        percentual: item.percentual,
        status: item.status,
        inicioPrevisto: item.inicioPrevisto,
        fimPrevisto: item.fimPrevisto,
        inicioReal: item.inicioReal,
        fimReal: item.fimReal,
      },
    }));
}

function Shell({ screen, setScreen, children, activeWork, selectedCity, cities, onCityChange, currentUser, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (screen === 'login' || screen === 'signup') return children;
  const currentUserName = currentUser?.nome || currentUser?.email?.split('@')[0] || 'Usuario Obras';

  function logoutAndCloseMenu() {
    setMobileMenuOpen(false);
    onLogout();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><HardHat size={30} aria-hidden="true" /></div>
          <div>
            <strong>Beelbem Obras</strong>
            <span>Controle inteligente</span>
          </div>
        </div>
        <nav aria-label="Menu principal">
          {sidebarRoutes.map(({ id, label, Icon, disabled }) => (
            <button
              className={screen === id && !disabled ? 'active' : ''}
              type="button"
              key={id}
              disabled={disabled}
              title={disabled ? 'Temporariamente desativado' : undefined}
              onClick={() => setScreen(id)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-logout" type="button" onClick={onLogout}>
          <LogOut size={20} aria-hidden="true" />
          <span>Sair</span>
        </button>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <button className="menu-button user-menu-button" type="button" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}>
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" aria-hidden="true" />
            ) : (
              <UserRound size={24} aria-hidden="true" />
            )}
          </button>
          <div className="topbar-title">
            <div className="topbar-identity">
              <strong>{currentUserName}</strong>
              {activeWork?.nome ? <span className="topbar-work">{activeWork.nome}</span> : null}
            </div>
            <label className="topbar-city">
              <MapPinned size={15} aria-hidden="true" />
              <select value={selectedCity?.id || ''} aria-label="Selecionar cidade" onChange={(event) => onCityChange(event.target.value)}>
                {cities.map((city) => (
                  <option value={city.id} key={city.id}>{city.nome}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="topbar-notifications" type="button" onClick={() => setScreen('notifications')} title="Atividades de hoje" aria-label="Abrir atividades de hoje">
            <Bell size={19} aria-hidden="true" />
          </button>
        </header>

        {mobileMenuOpen ? (
          <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-drawer" role="dialog" aria-label="Menu" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <div className="drawer-head">
                <strong>Beelbem Obras</strong>
                <IconButton label="Fechar menu" Icon={X} onClick={() => setMobileMenuOpen(false)} />
              </div>
              {sidebarRoutes.map(({ id, label, Icon, disabled }) => (
                <button
                  className={screen === id && !disabled ? 'active' : ''}
                  type="button"
                  key={id}
                  disabled={disabled}
                  title={disabled ? 'Temporariamente desativado' : undefined}
                  onClick={() => {
                    setScreen(id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
              <button className="drawer-logout" type="button" onClick={logoutAndCloseMenu}>
                <LogOut size={20} aria-hidden="true" />
                <span>Sair do Obras</span>
                {currentUser?.email ? <small>{currentUser.email}</small> : null}
              </button>
            </div>
          </div>
        ) : null}

        <main>{children}</main>

        <nav className="bottom-nav" aria-label="Menu inferior">
          {quickRoutes.map(({ id, label, Icon }) => (
            <button className={screen === id ? 'active' : ''} type="button" key={id} onClick={() => setScreen(id)}>
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, authError, authLoading, dbAvailable, onOpenSignup }) {
  return (
    <main
      className="login-page"
      style={{
        '--login-background': `url("${loginBackground}")`,
        '--login-logo': `url("${obrasLogo}")`,
      }}
    >
      <section className="login-visual" aria-label="Beelbem Obras">
        <div className="login-badge">
          <div className="login-logo-full" role="img" aria-label="Beelbem Obras - Controle inteligente de obras" />
        </div>
      </section>
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <div className="login-brand-logo" role="img" aria-label="Beelbem Obras" />
        </div>
        <form onSubmit={onLogin}>
          <label>
            <span>E-mail</span>
            <input type="email" name="email" placeholder="engenheiro@beelbem.com.br" autoComplete="email" required={dbAvailable} />
          </label>
          <label>
            <span>Senha</span>
            <input type="password" name="password" placeholder="Sua senha" autoComplete="current-password" required={dbAvailable} />
          </label>
          <ActionButton Icon={LogIn} type="submit">{authLoading ? 'Entrando...' : dbAvailable ? 'Entrar online' : 'Entrar local'}</ActionButton>
          <p className={authError ? 'auth-message error' : 'auth-message'}>
            {authError || (dbAvailable ? 'Banco Supabase conectado.' : 'Banco nao configurado. Usando dados locais.')}
          </p>
          <button className="link-button" type="button">
            <KeyRound size={18} aria-hidden="true" />
            <span>Esqueci minha senha</span>
          </button>
          <button className="link-button" type="button" onClick={onOpenSignup}>
            <Landmark size={18} aria-hidden="true" />
            <span>Solicitar assinatura do Obras</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function SignupRequestScreen({ dbAvailable, onBack }) {
  const [plans, setPlans] = useState(localCommercialPlans);
  const [loading, setLoading] = useState(Boolean(dbAvailable));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!dbAvailable) {
      setLoading(false);
      setPlans(localCommercialPlans);
      return undefined;
    }

    let mounted = true;
    fetchCommercialPlans()
      .then((items) => {
        if (mounted) setPlans(items.length ? items : localCommercialPlans);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.message || 'Nao foi possivel carregar os planos.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [dbAvailable]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const form = event.currentTarget;
    const values = {
      accountType: form.elements.accountType.value,
      nomeResponsavel: form.elements.nomeResponsavel.value.trim(),
      empresa: form.elements.empresa.value.trim(),
      documento: form.elements.documento.value.trim(),
      email: form.elements.email.value.trim(),
      telefone: form.elements.telefone.value.trim(),
      cidade: form.elements.cidade.value.trim(),
      estado: form.elements.estado.value.trim(),
      planId: form.elements.planId.value,
      observacoes: form.elements.observacoes.value.trim(),
    };

    if (!values.nomeResponsavel || !values.email || !values.telefone || !values.cidade) {
      setError('Preencha nome, e-mail, telefone e cidade.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError('Informe um e-mail valido.');
      return;
    }

    setSaving(true);
    try {
      if (dbAvailable) {
        await insertSignupRequest(values);
      }
      form.reset();
      setMessage(dbAvailable
        ? 'Solicitacao enviada. Ela ja aparece no painel de assinaturas para analise.'
        : 'Solicitacao registrada no modo local. Configure o Supabase para salvar online.');
    } catch (requestError) {
      setError(requestError.message || 'Nao foi possivel enviar a solicitacao.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-panel">
        <PageTitle eyebrow="Assinatura" title="Solicitar acesso ao Beelbem Obras" subtitle="Cadastro unico para empresas e engenheiros interessados no sistema." onBack={onBack} />
        {error ? (
          <section className="warning-strip">
            <AlertTriangle size={22} aria-hidden="true" />
            <span>{error}</span>
          </section>
        ) : null}
        {message ? (
          <section className="success-strip">
            <CheckCircle2 size={22} aria-hidden="true" />
            <span>{message}</span>
          </section>
        ) : null}
        <section className="plan-grid">
          {plans.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <span>{plan.tipo}</span>
              <strong>{plan.nome}</strong>
              <p>{plan.descricao}</p>
              <b>{formatCurrency(plan.valorMensal)} / mes</b>
              <small>{plan.limiteObras ? `${plan.limiteObras} obras` : 'Obras ilimitadas'} - {plan.limiteUsuarios ? `${plan.limiteUsuarios} usuarios` : 'Usuarios ilimitados'}</small>
            </article>
          ))}
        </section>
        <form className="commercial-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Tipo de cadastro</span>
              <select name="accountType" defaultValue="empresa">
                <option value="empresa">Empresa</option>
                <option value="engenheiro">Engenheiro</option>
              </select>
            </label>
            <label className="field">
              <span>Plano desejado</span>
              <select name="planId" defaultValue={plans[1]?.id || plans[0]?.id || ''} disabled={loading}>
                {plans.map((plan) => (
                  <option value={plan.id} key={plan.id}>{plan.nome}</option>
                ))}
              </select>
            </label>
            <Field label="Nome do responsavel" name="nomeResponsavel" required />
            <Field label="Empresa ou escritorio" name="empresa" />
            <Field label="CPF/CNPJ" name="documento" />
            <Field label="E-mail" name="email" type="email" required />
            <Field label="Telefone/WhatsApp" name="telefone" required />
            <Field label="Cidade" name="cidade" required />
            <Field label="UF" name="estado" value="GO" required />
            <label className="field wide">
              <span>Observacoes</span>
              <textarea name="observacoes" rows={4} placeholder="Informe quantidade de obras, equipe e necessidade principal." />
            </label>
          </div>
          <div className="form-actions">
            <ActionButton Icon={Save} type="submit" disabled={saving || loading}>
              {saving ? 'Enviando...' : 'Enviar solicitacao'}
            </ActionButton>
            <ActionButton Icon={LogIn} variant="ghost" onClick={onBack} disabled={saving}>Voltar ao login</ActionButton>
          </div>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ data, setScreen }) {
  const cityCount = new Set(data.works.map((work) => work.cidadeId)).size;
  const openIssues = data.works.reduce((total, work) => total + (Number(work.pendencias) || 0), 0);
  const pendingPls = data.works.filter((work) => !['aprovado', 'enviado'].includes(normalizeSearch(work.pls))).length;
  const metrics = [
    { label: 'Cidades', value: cityCount, Icon: MapPinned, tone: 'info', onIconClick: () => setScreen('cities'), iconLabel: 'Abrir cadastro e visualizacao de cidades' },
    { label: 'Obras', value: data.works.filter((work) => getEffectiveWorkStatus(work) === 'Em andamento').length, Icon: Clock3, tone: 'warning', onIconClick: () => setScreen('works'), iconLabel: 'Abrir obras em andamento' },
    { label: 'Atrasadas', value: data.works.filter((work) => getEffectiveWorkStatus(work) === 'Atrasada').length, Icon: AlertTriangle, tone: 'danger', onIconClick: () => setScreen('works'), iconLabel: 'Abrir obras atrasadas' },
    { label: 'PLS', value: pendingPls, Icon: FileCheck2, tone: 'danger', onIconClick: () => setScreen('pls'), iconLabel: 'Abrir PLS Caixa' },
    { label: 'Pendencias', value: openIssues, Icon: ClipboardCheck, tone: 'danger', onIconClick: () => setScreen('issues'), iconLabel: 'Abrir pendencias' },
  ];

  return (
    <>
      <PageTitle eyebrow="Painel geral" title="Visao de campo" subtitle="Indicadores principais das obras residenciais.">
        <ActionButton Icon={Plus} onClick={() => setScreen('newWork')}>Nova obra</ActionButton>
      </PageTitle>
      <section className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="quick-grid">
        {[
          ['Nova obra', Plus, 'newWork'],
          ['Ver pendencias', AlertTriangle, 'issues'],
          ['Empresas', Landmark, 'companies'],
          ['Usuarios', UsersRound, 'users'],
          ['Categorias', FolderKanban, 'serviceCategories'],
          ['Empreiteiros', HardHat, 'contractors'],
          ['Assinaturas', Landmark, 'commercial'],
          ['Ver PLS Caixa', FileCheck2, 'pls'],
          ['Relatorios', BarChart3, 'reports'],
        ].map(([label, Icon, route]) => (
          <button className="quick-card" type="button" key={label} onClick={() => setScreen(route)}>
            <Icon size={32} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </section>
    </>
  );
}

function getCitySummary(works, customNeighborhoods = []) {
  return cityCatalog.map((city) => {
    const local = works.filter((work) => work.cidadeId === city.id);
    const neighborhoods = getNeighborhoodOptions(city.id, customNeighborhoods);
    return {
      ...city,
      obras: local.length,
      bairros: new Set(local.map((work) => work.bairroId)).size || neighborhoods.length,
      atrasadas: local.filter((work) => getEffectiveWorkStatus(work) === 'Atrasada').length,
    };
  });
}

function getNeighborhoodSummary(works, city, customNeighborhoods = []) {
  return getNeighborhoodOptions(city?.id || 'rio-verde', customNeighborhoods).map((bairro) => {
    const local = works.filter((work) => work.bairroId === bairro.id);
    return {
      ...bairro,
      obras: local.length,
      andamento: local.filter((work) => getEffectiveWorkStatus(work) === 'Em andamento').length,
      atrasadas: local.filter((work) => getEffectiveWorkStatus(work) === 'Atrasada').length,
    };
  });
}

function Cities({ works, neighborhoods = [], openCity }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const cities = getCitySummary(works, neighborhoods);
  const filteredCities = normalizedQuery
    ? cities.filter((city) => normalizeSearch(city.nome).includes(normalizedQuery))
    : cities;

  return (
    <>
      <PageTitle eyebrow="Cidades" title="Obras por cidade" subtitle="Mapa operacional por municipio." />
      <div className="toolbar">
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <input value={query} placeholder="Buscar cidade" aria-label="Buscar cidade" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      {filteredCities.length ? (
        <section className="item-grid">
          {filteredCities.map((city) => (
            <button className="city-card" type="button" key={city.id} onClick={() => openCity(city)}>
              <MapPinned size={34} aria-hidden="true" />
              <strong>{city.nome}</strong>
              <span>{city.bairros} bairros</span>
              <span>{city.obras} obras</span>
              {city.atrasadas ? <StatusPill status="Atrasada" /> : <StatusPill status="Conferido" />}
            </button>
          ))}
        </section>
      ) : (
        <EmptyNotice Icon={MapPinned} title="Nenhuma cidade encontrada" text="Ajuste a busca pelo nome da cidade." />
      )}
    </>
  );
}

function Neighborhoods({ works, selectedCity, neighborhoods: customNeighborhoods = [], openNeighborhood, setScreen }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const neighborhoods = getNeighborhoodSummary(works, selectedCity, customNeighborhoods);
  const filteredNeighborhoods = normalizedQuery
    ? neighborhoods.filter((bairro) => normalizeSearch(bairro.nome).includes(normalizedQuery))
    : neighborhoods;

  return (
    <>
      <PageTitle eyebrow="Bairros" title={selectedCity?.nome || 'Rio Verde'} subtitle="Obras agrupadas por bairro." onBack={() => setScreen('cities')} />
      <div className="toolbar">
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <input value={query} placeholder="Buscar bairro" aria-label="Buscar bairro" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      {filteredNeighborhoods.length ? (
        <section className="item-grid">
          {filteredNeighborhoods.map((bairro) => (
            <button className="item-card as-button" type="button" key={bairro.id} onClick={() => openNeighborhood(bairro)}>
              <Landmark size={32} aria-hidden="true" />
              <strong>{bairro.nome}</strong>
              <span>{bairro.obras} obras</span>
              <span>{bairro.andamento} em andamento</span>
              {bairro.atrasadas ? <StatusPill status="Atrasada" /> : <StatusPill status="Conferido" />}
            </button>
          ))}
        </section>
      ) : (
        <EmptyNotice Icon={Landmark} title="Nenhum bairro encontrado" text="Ajuste a busca pelo nome do bairro." />
      )}
    </>
  );
}

function Works({ selectedCity, selectedNeighborhood, works, openWork, setScreen }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const filtered = works.filter((obra) => {
    if (selectedNeighborhood && obra.bairroId !== selectedNeighborhood.id) return false;
    if (!selectedNeighborhood && selectedCity && obra.cidadeId !== selectedCity.id) return false;
    if (status !== 'Todos' && getEffectiveWorkStatus(obra) !== status) return false;
    return `${obra.nome} ${obra.cliente} ${obra.endereco} ${obra.bairro} ${obra.cidade}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <PageTitle
        eyebrow="Obras"
        title={selectedNeighborhood?.nome || selectedCity?.nome || 'Todas as obras'}
        subtitle="Andamento, PLS e pendencias."
        onBack={selectedNeighborhood ? () => setScreen('neighborhoods') : undefined}
      >
        <ActionButton Icon={Plus} onClick={() => setScreen('newWork')}>Nova obra</ActionButton>
      </PageTitle>
      <div className="toolbar">
        {['Todos', 'Em andamento', 'Atrasada', 'Concluida', 'Nao iniciada'].map((item) => (
          <button className={status === item ? 'active-filter' : ''} type="button" key={item} onClick={() => setStatus(item)}>
            <Filter size={18} aria-hidden="true" /> {item}
          </button>
        ))}
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <input value={query} placeholder="Buscar obra" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <section className="work-list">
        {filtered.map((obra) => (
          <button className={`work-card work-card-${getWorkCardTone(obra)}`} type="button" key={obra.id} onClick={() => openWork(obra)} aria-label={`Abrir painel de ${obra.nome}`}>
            <strong>{getFirstName(obra.cliente)}</strong>
            <span>{obra.endereco}</span>
            <b>{obra.percentual}%</b>
            <ProgressBar value={obra.percentual} />
          </button>
        ))}
        {!filtered.length ? <EmptyNotice title="Nenhuma obra encontrada" text="Ajuste a busca ou os filtros." /> : null}
      </section>
    </>
  );
}

function NewWork({ createWork, setScreen, selectedCity, onProjectAnalyzed, works = [], neighborhoods = [], onAddNeighborhood }) {
  const [cityId, setCityId] = useState(selectedCity?.id || cityCatalog[0].id);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const manualFormRef = useRef(null);

  function submit(event) {
    event.preventDefault();
    createWork(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  async function analyzeFile(file) {
    if (!file) return;
    setAiLoading(true);
    setAiError('');
    setSelectedFileName(file.name || 'Arquivo selecionado');

    let result;
    try {
      const { analisarProjetoComGemini } = await import('./analisa_projeto_gemini.js');
      result = await analisarProjetoComGemini({ arquivo: file });
    } catch (error) {
      setAiLoading(false);
      setAiError(`Nao foi possivel carregar a analise por IA: ${error.message}`);
      return;
    }
    setAiLoading(false);

    if (!result.ok) {
      setAiError(formatGeminiProjectError(result));
      return;
    }

    const formCity = cityCatalog.find((city) => city.id === cityId) || selectedCity;
    onProjectAnalyzed(buildAiProjectDraft(result, formCity, neighborhoods));
    setScreen('extractedData');
  }

  function handleFileInput(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    void analyzeFile(file);
  }

  function openManualForm() {
    manualFormRef.current?.querySelector('input')?.focus();
    manualFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <form onSubmit={submit}>
      {aiLoading ? <AiAnalysisLoader fileName={selectedFileName} /> : null}
      <PageTitle eyebrow="Nova obra" title="Cadastro de obra" subtitle="Dados principais para abrir o painel da obra." onBack={() => setScreen('works')} />
      <section className="ai-panel">
        <div>
          <StatusPill status="Analise IA" />
          <h2>Cadastro inteligente por IA</h2>
          <p>Envie um PDF ou imagem de ate 10 MB e confira os dados antes da criacao.</p>
        </div>
        <div className="upload-grid">
          <button type="button" disabled={aiLoading} onClick={() => pdfInputRef.current?.click()}><Upload size={30} aria-hidden="true" /> Enviar PDF do projeto</button>
          <button type="button" disabled={aiLoading} onClick={() => imageInputRef.current?.click()}><ImagePlus size={30} aria-hidden="true" /> Enviar imagem da planta</button>
          <button type="button" disabled={aiLoading} onClick={() => cameraInputRef.current?.click()}><Camera size={30} aria-hidden="true" /> Tirar foto do projeto</button>
          <button type="button" disabled={aiLoading} onClick={openManualForm}><Pencil size={30} aria-hidden="true" /> Cadastrar manualmente</button>
        </div>
        <input ref={pdfInputRef} className="visually-hidden" type="file" accept="application/pdf" onChange={handleFileInput} />
        <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleFileInput} />
        <input ref={cameraInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={handleFileInput} />
        <div className="ai-panel-status" aria-live="polite">
          {aiLoading ? <span>Analisando {selectedFileName || 'projeto'} com Gemini...</span> : null}
          {!aiLoading && aiError ? <span className="ai-panel-error">{aiError}</span> : null}
          {!aiLoading && !aiError && !supabaseConfigured ? <span>Gemini ainda nao configurado neste ambiente.</span> : null}
        </div>
      </section>
      <section ref={manualFormRef} className="form-grid">
        <Field label="Nome da obra" name="nome" required />
        <Field label="Cliente" name="cliente" required />
        <label className="field">
          <span>Cidade</span>
          <select name="cidadeId" value={cityId} onChange={(event) => setCityId(event.target.value)}>
            {cityCatalog.map((city) => (
              <option value={city.id} key={city.id}>{city.nome}</option>
            ))}
          </select>
        </label>
        <NeighborhoodField
          cityId={cityId}
          neighborhoods={neighborhoods}
          onAddNeighborhood={onAddNeighborhood}
        />
        <Field label="Endereco" name="endereco" wide required />
        <Field label="Quadra" name="quadra" />
        <Field label="Lote" name="lote" />
        <Field label="Area construida" name="areaConstruida" />
        <Field label="Area do terreno" name="areaTerreno" />
        <Field label="Numero de pavimentos" name="pavimentos" />
        <Field label="Responsavel tecnico" name="responsavel" />
        <ScheduleSourceField works={works} />
        <TextAreaField label="Observacoes" name="observacoes" />
      </section>
      <div className="form-actions">
        <ActionButton Icon={Save} type="submit">Salvar obra</ActionButton>
        <ActionButton Icon={Bot} variant="secondary" disabled={aiLoading} onClick={() => pdfInputRef.current?.click()}>Analisar com IA</ActionButton>
        <ActionButton Icon={XCircle} variant="ghost" onClick={() => setScreen('works')}>Cancelar</ActionButton>
      </div>
    </form>
  );
}

function AiAnalysisLoader({ fileName }) {
  return (
    <div className="ai-analysis-backdrop" role="status" aria-live="assertive" aria-label="Analise do projeto em andamento">
      <section className="ai-analysis-loader">
        <svg className="building-loader" viewBox="0 0 300 210" aria-hidden="true">
          <rect className="building-ground" x="25" y="184" width="250" height="12" rx="6" />
          <g className="building-foundation">
            <rect x="55" y="169" width="190" height="15" rx="3" />
          </g>
          <g className="building-skeleton building-skeleton-one">
            <rect x="67" y="126" width="9" height="43" />
            <rect x="224" y="126" width="9" height="43" />
            <rect x="64" y="122" width="172" height="9" />
          </g>
          <g className="building-skeleton building-skeleton-two">
            <rect x="67" y="83" width="9" height="43" />
            <rect x="224" y="83" width="9" height="43" />
            <rect x="64" y="79" width="172" height="9" />
          </g>
          <g className="building-skeleton building-skeleton-three">
            <rect x="67" y="40" width="9" height="43" />
            <rect x="224" y="40" width="9" height="43" />
            <rect x="64" y="36" width="172" height="9" />
            <rect x="145" y="40" width="9" height="129" />
          </g>
          <g className="building-wall building-wall-one">
            <rect x="77" y="132" width="67" height="36" />
            <rect x="155" y="132" width="68" height="36" />
          </g>
          <g className="building-wall building-wall-two">
            <rect x="77" y="89" width="67" height="32" />
            <rect x="155" y="89" width="68" height="32" />
          </g>
          <g className="building-wall building-wall-three">
            <rect x="77" y="46" width="67" height="32" />
            <rect x="155" y="46" width="68" height="32" />
          </g>
          <g className="building-finish building-finish-one">
            <rect x="91" y="139" width="24" height="29" rx="2" />
            <rect x="174" y="139" width="30" height="18" rx="2" />
          </g>
          <g className="building-finish building-finish-two">
            <rect x="91" y="96" width="30" height="18" rx="2" />
            <rect x="174" y="96" width="30" height="18" rx="2" />
          </g>
          <g className="building-finish building-finish-three">
            <rect x="91" y="53" width="30" height="18" rx="2" />
            <rect x="174" y="53" width="30" height="18" rx="2" />
            <rect className="building-roof" x="57" y="27" width="186" height="10" rx="3" />
          </g>
        </svg>
        <div className="construction-stage" aria-hidden="true">
          <span>Montando a estrutura</span>
          <span>Fechando as paredes</span>
          <span>Finalizando o predio</span>
        </div>
        <strong>A IA esta analisando o projeto</strong>
        <span>{fileName || 'Preparando o arquivo...'}</span>
        <div className="ai-loading-dots" aria-hidden="true"><i /><i /><i /></div>
        <small>Aguarde. Esta janela fecha automaticamente quando a leitura terminar.</small>
      </section>
    </div>
  );
}

function ExtractedData({ createWork, setScreen, draft, works = [], neighborhoods = [], onAddNeighborhood }) {
  const initialCityId = draft?.cidadeId || cityCatalog[0].id;
  const [cityId, setCityId] = useState(initialCityId);

  if (!draft) {
    return (
      <>
        <PageTitle eyebrow="IA" title="Nenhuma analise disponivel" subtitle="Envie um PDF ou imagem para iniciar." onBack={() => setScreen('newWork')} />
        <EmptyNotice Icon={Bot} title="Projeto nao analisado" text="A IA ainda nao recebeu um arquivo para leitura." />
      </>
    );
  }

  function submit(event) {
    event.preventDefault();
    createWork(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  return (
    <form onSubmit={submit}>
      <PageTitle eyebrow="IA" title="Conferir dados extraidos" subtitle="Revise antes de criar a obra." onBack={() => setScreen('newWork')} />
      <section className="warning-strip">
        <AlertTriangle size={22} aria-hidden="true" />
        <span>A IA pode cometer erros. Confira os dados antes de criar a obra.</span>
      </section>
      <section className="ai-result-summary">
        <strong>{draft.arquivo?.nome || 'Projeto analisado'}</strong>
        <span>Modelo: {draft.modelo}</span>
        {(draft.avisos || []).map((warning) => <p key={warning}>{warning}</p>)}
      </section>
      <section className="form-grid">
        <Field label="Nome da obra" name="nome" value={draft.nome} required />
        <Field label="Cliente" name="cliente" value={draft.cliente} required />
        <label className="field">
          <span>Cidade</span>
          <select name="cidadeId" value={cityId} onChange={(event) => setCityId(event.target.value)}>
            {cityCatalog.map((city) => <option value={city.id} key={city.id}>{city.nome}</option>)}
          </select>
        </label>
        <NeighborhoodField
          cityId={cityId}
          value={cityId === draft.cidadeId ? draft.bairroId : ''}
          neighborhoods={neighborhoods}
          onAddNeighborhood={onAddNeighborhood}
        />
        <Field label="Endereco" name="endereco" value={draft.endereco} wide required />
        <Field label="Quadra" name="quadra" value={draft.quadra} />
        <Field label="Lote" name="lote" value={draft.lote} />
        <Field label="Area construida" name="areaConstruida" value={draft.areaConstruida} />
        <Field label="Area do terreno" name="areaTerreno" value={draft.areaTerreno} />
        <Field label="Numero de pavimentos" name="pavimentos" value={draft.pavimentos} />
        <Field label="Responsavel tecnico" name="responsavel" value={draft.responsavel} />
        <ScheduleSourceField works={works} />
        <TextAreaField label="Observacoes tecnicas" name="observacoes" value={draft.observacoes} />
      </section>
      <div className="form-actions">
        <ActionButton Icon={CheckCircle2} type="submit">Confirmar e criar obra</ActionButton>
        <ActionButton Icon={Pencil} variant="secondary" onClick={() => setScreen('newWork')}>Corrigir manualmente</ActionButton>
        <ActionButton Icon={XCircle} variant="ghost" onClick={() => setScreen('dashboard')}>Cancelar</ActionButton>
      </div>
    </form>
  );
}

function getTimestamp(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
}

function buildLastScheduleUpdate(data, fallbackLabel = '') {
  const items = data.scheduleItems || [];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const candidates = [];

  items
    .filter((item) => item.visible !== false)
    .forEach((item) => {
      const timestamp = Math.max(getTimestamp(item.updatedAt), getTimestamp(item.createdAt));
      if (!timestamp) return;
      const parent = item.parentId ? itemsById.get(item.parentId) : null;
      candidates.push({
        timestamp,
        stageName: parent?.nome || item.nome,
        subitemName: parent ? item.nome : '',
        source: 'Cronograma',
      });
    });

  (data.scheduleLogs || []).forEach((log) => {
    const timestamp = Math.max(getTimestamp(log.updatedAt), getTimestamp(log.createdAt), getTimestamp(log.visitDate));
    if (!timestamp) return;
    const item = itemsById.get(log.scheduleItemId);
    const parent = item?.parentId ? itemsById.get(item.parentId) : null;
    candidates.push({
      timestamp,
      stageName: parent?.nome || item?.nome || 'Cronograma',
      subitemName: parent ? item.nome : '',
      source: 'Diario da obra',
    });
  });

  if (!candidates.length) {
    return {
      stageName: fallbackLabel || 'Sem atualizacao',
      subitemName: '',
      source: 'Cronograma',
      updatedAt: '',
    };
  }

  const latest = candidates.sort((a, b) => b.timestamp - a.timestamp)[0];
  return {
    ...latest,
    updatedAt: new Date(latest.timestamp).toISOString(),
  };
}

function WorkPanel({ obra, data, setScreen }) {
  const lastUpdate = buildLastScheduleUpdate(data, obra.proximaEtapa);
  const laborPayments = calculateSchedulePayments(data.scheduleItems);
  const cards = [
    ['Fotos', Camera, 'photos'],
    ['Cronograma', CalendarDays, 'schedule'],
    ['Empreita', HardHat, 'contractWork'],
    ['PLS Caixa', FileCheck2, 'pls'],
    ['Insumos', PackageCheck, 'supplies'],
    ['Ferramentas', Wrench, 'tools'],
    ['Checklist tecnico', ClipboardCheck, 'checklist'],
    ['Documentos', FileText, 'documents'],
    ['Pendencias', AlertTriangle, 'issues'],
    ['Relatorios', BarChart3, 'reports'],
    ['Dados da obra', FileText, 'workProfile'],
  ];
  return (
    <>
      <PageTitle eyebrow="Painel da obra" title={obra.nome} subtitle={`${obra.cliente} - ${obra.bairro}, ${obra.cidade}`}>
        <StatusPill status={getEffectiveWorkStatus(obra)} />
      </PageTitle>
      <section className="work-hero">
        <div>
          <span>Ultima atualizacao</span>
          <strong>{lastUpdate.stageName}</strong>
          {lastUpdate.subitemName ? <small>Subitem: {lastUpdate.subitemName}</small> : null}
          <small>{lastUpdate.updatedAt ? `${lastUpdate.source} - ${formatDateTime(lastUpdate.updatedAt)}` : 'Sem atualizacao registrada'}</small>
        </div>
        <div>
          <span>Executado</span>
          <strong>{obra.percentual}%</strong>
          <ProgressBar value={obra.percentual} />
          <small>Total mao de obra: {formatCurrency(laborPayments.total)}</small>
          <small>Total executado: {formatCurrency(laborPayments.executed)}</small>
        </div>
      </section>
      <section className="module-grid work-panel-grid">
        {cards.map(([label, Icon, route]) => (
          <button className="module-card" type="button" key={label} onClick={() => setScreen(route)}>
            <Icon size={30} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </section>
      <nav className="work-tabs" aria-label="Menu da obra">
        {workPanelRoutes.map(({ id, label, Icon }) => (
          <button type="button" key={id} onClick={() => setScreen(id)}>
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function getScheduleActivityContext(scheduleItemId, itemsById) {
  const item = itemsById.get(scheduleItemId);
  const parent = item?.parentId ? itemsById.get(item.parentId) : null;
  return {
    stageName: parent?.nome || item?.nome || 'Cronograma',
    subitemName: parent ? item.nome : '',
  };
}

function buildTodayActivities({ data, users = [], currentUser = null, activeWork = null, dateKey = todayIso() }) {
  const fallbackUser = currentUser?.nome || currentUser?.email || 'Usuario nao informado';
  const itemsById = new Map((data.scheduleItems || []).map((item) => [item.id, item]));
  const checklistById = new Map((data.checklist || []).map((entry) => [entry.id, entry]));
  const checklistItemsById = new Map();
  (data.checklist || []).forEach((checklist) => {
    (checklist.itens || []).forEach((item) => {
      checklistItemsById.set(item.id, item);
    });
  });
  const activities = [];

  function addActivity({
    id,
    title,
    description = '',
    dateValues = [],
    user = '',
    Icon = Bell,
    tone = 'info',
    stageName = '',
    subitemName = '',
    sourceType = 'info',
  }) {
    const dates = dateValues.filter(Boolean);
    if (!dates.some((value) => activityDateKey(value) === dateKey)) return;
    const timeSource = dates.find((value) => activityDateKey(value) === dateKey) || dates[0];
    const timestamp = Math.max(0, ...dates.map((value) => activityTimestamp(value)));

    activities.push({
      id,
      title,
      description,
      time: activityTimeLabel(timeSource),
      timestamp,
      user: activityUserName(user, users, fallbackUser),
      Icon,
      tone,
      stageName,
      subitemName,
      sourceType,
    });
  }

  (data.scheduleLogs || []).forEach((log) => {
    const context = getScheduleActivityContext(log.scheduleItemId, itemsById);
    addActivity({
      id: `log-${log.id}`,
      title: 'Diario da obra',
      description: log.observacoes || log.maoObra || log.pedidoMaterial || 'Registro diario atualizado.',
      dateValues: [log.updatedAt, log.createdAt, log.visitDate],
      user: log.usuario || log.createdBy || log.updatedBy,
      Icon: ClipboardCheck,
      tone: 'primary',
      sourceType: 'daily_log',
      ...context,
    });
  });

  (data.photos || []).forEach((photo) => {
    addActivity({
      id: `photo-${photo.id}`,
      title: 'Foto adicionada',
      description: photo.observacao || photo.fileName || photo.nome || 'Registro fotografico da obra.',
      dateValues: [photo.updatedAt, photo.createdAt, photo.data],
      user: photo.usuario || photo.createdBy || photo.updatedBy,
      Icon: Camera,
      tone: 'photo',
      stageName: photo.etapa || 'Fotos',
      sourceType: 'photo_added',
    });
  });

  (data.issues || []).forEach((issue) => {
    addActivity({
      id: `issue-${issue.id}`,
      title: 'Pendencia registrada',
      description: issue.descricao || issue.norma || 'Pendencia da obra.',
      dateValues: [issue.updatedAt, issue.createdAt, issue.data],
      user: issue.usuario || issue.createdBy || issue.updatedBy || issue.responsavel,
      Icon: AlertTriangle,
      tone: 'danger',
      stageName: issue.etapa || 'Pendencias',
      sourceType: 'issue_added',
    });
  });

  (data.plsItems || []).forEach((item) => {
    addActivity({
      id: `pls-${item.id}`,
      title: 'PLS Caixa atualizado',
      description: item.observacao || item.status || 'Registro de vistoria PLS.',
      dateValues: [item.updatedAt, item.createdAt, item.vistoria],
      user: item.usuario || item.createdBy || item.updatedBy,
      Icon: FileCheck2,
      tone: 'info',
      stageName: item.etapa || 'PLS Caixa',
      sourceType: 'pls_updated',
    });
  });

  (data.checklistResults || []).forEach((result) => {
    if (!result.checked) return;
    const checklist = checklistById.get(result.checklistId);
    const checklistItem = checklistItemsById.get(result.checklistItemId);
    const context = getScheduleActivityContext(result.scheduleItemId, itemsById);
    addActivity({
      id: `check-result-${result.id || `${result.checklistItemId}-${result.checkedAt}`}`,
      title: 'Checklist conferido',
      description: checklistItem?.texto || checklist?.titulo || 'Item de checklist marcado.',
      dateValues: [result.checkedAt, result.updatedAt, result.createdAt],
      user: result.checkedBy || result.usuario || result.createdBy || result.updatedBy,
      Icon: CheckCircle2,
      tone: 'success',
      sourceType: 'checklist_checked',
      ...context,
    });
  });

  (data.scheduleItems || [])
    .filter((item) => item.visible !== false)
    .forEach((item) => {
      const context = getScheduleActivityContext(item.id, itemsById);
      addActivity({
        id: `schedule-${item.id}`,
        title: item.parentId ? 'Subitem do cronograma atualizado' : 'Etapa do cronograma atualizada',
        description: item.status || 'Cronograma atualizado.',
        dateValues: [item.updatedAt, item.createdAt],
        user: item.usuario || item.createdBy || item.updatedBy,
        Icon: CalendarDays,
        tone: 'schedule',
        sourceType: 'subitem_updated',
        ...context,
      });
    });

  (data.rdoReports || []).forEach((report) => {
    addActivity({
      id: `rdo-${report.id}`,
      title: 'RDO salvo',
      description: report.titulo || activeWork?.nome || 'Relatorio diario de obra.',
      dateValues: [report.updatedAt, report.createdAt, report.generatedAt, report.reportDate],
      user: report.usuario || report.createdBy || report.updatedBy,
      Icon: FileText,
      tone: 'report',
      stageName: activeWork?.nome || 'RDO',
      sourceType: 'rdo_saved',
    });
  });

  return activities.sort((a, b) => b.timestamp - a.timestamp);
}

function buildStoredNotificationActivities({ notifications = [], users = [], currentUser = null, dateKey = todayIso() }) {
  const fallbackUser = currentUser?.nome || currentUser?.email || 'Usuario nao informado';
  return (notifications || [])
    .filter((notification) => activityDateKey(notification.createdAt) === dateKey)
    .map((notification) => ({
      id: `notification-${notification.id}`,
      title: notification.title || 'Atividade no Obras',
      description: notification.body || '',
      time: activityTimeLabel(notification.createdAt),
      timestamp: activityTimestamp(notification.createdAt),
      user: activityUserName(notification.actorUserId, users, notification.payload?.actorName || fallbackUser),
      Icon: {
        photo_added: Camera,
        new_work: Building2,
        daily_log: ClipboardCheck,
        subitem_updated: CalendarDays,
        issue_added: AlertTriangle,
        checklist_checked: CheckCircle2,
      }[notification.type] || Bell,
      tone: {
        photo_added: 'photo',
        new_work: 'success',
        daily_log: 'primary',
        subitem_updated: 'schedule',
        issue_added: 'danger',
        checklist_checked: 'success',
      }[notification.type] || 'info',
      stageName: notification.payload?.stageName || notification.payload?.workName || '',
      subitemName: notification.payload?.subitemName || '',
      sourceType: notification.type || 'info',
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function Notifications({
  data,
  activeWork,
  users,
  currentUser,
  selectedCity,
  notifications = [],
  pushSupport,
  pushMessage,
  onEnablePush,
  setScreen,
}) {
  const [activityDate, setActivityDate] = useState(todayIso());
  const [userFilter, setUserFilter] = useState('all');
  const fallbackActivities = useMemo(
    () => buildTodayActivities({ data, users, currentUser, activeWork, dateKey: activityDate }),
    [data, users, currentUser, activeWork, activityDate],
  );
  const storedActivities = useMemo(
    () => buildStoredNotificationActivities({ notifications, users, currentUser, dateKey: activityDate }),
    [notifications, users, currentUser, activityDate],
  );
  const storedSourceTypes = useMemo(
    () => new Set(storedActivities.map((activity) => activity.sourceType).filter(Boolean)),
    [storedActivities],
  );
  const allActivities = useMemo(() => {
    const derivedActivities = fallbackActivities.filter((activity) => !storedSourceTypes.has(activity.sourceType));
    return [...storedActivities, ...derivedActivities].sort((a, b) => b.timestamp - a.timestamp);
  }, [fallbackActivities, storedActivities, storedSourceTypes]);
  const userOptions = useMemo(() => {
    const names = new Set();
    users.forEach((user) => {
      const label = user.nome || user.email;
      if (label) names.add(label);
    });
    allActivities.forEach((activity) => {
      if (activity.user) names.add(activity.user);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [users, allActivities]);
  useEffect(() => {
    if (userFilter !== 'all' && !userOptions.includes(userFilter)) {
      setUserFilter('all');
    }
  }, [userFilter, userOptions]);

  const activities = userFilter === 'all'
    ? allActivities
    : allActivities.filter((activity) => activity.user === userFilter);
  const activityUsers = new Set(activities.map((activity) => activity.user).filter(Boolean));
  const canEnablePush = pushSupport !== 'unsupported' && pushSupport !== 'granted';
  const pushStatusText = {
    granted: 'Push ativo neste navegador',
    denied: 'Permissao de push bloqueada no navegador',
    default: 'Push ainda nao ativado neste navegador',
    unsupported: 'Este navegador nao suporta push',
  }[pushSupport] || 'Status do push desconhecido';

  return (
    <>
      <PageTitle
        eyebrow="Notificacoes"
        title="Atividades da obra"
        subtitle={`${formatDateBr(activityDate)} - ${activeWork?.nome || selectedCity?.nome || 'Obras'}`}
        onBack={() => setScreen(activeWork ? 'workPanel' : 'dashboard')}
      >
        <StatusPill status={`${activities.length} registro${activities.length === 1 ? '' : 's'}`} />
      </PageTitle>

      <section className="notifications-filter-panel" aria-label="Filtros das atividades">
        <label>
          <span>Data</span>
          <input
            type="date"
            value={activityDate}
            onChange={(event) => setActivityDate(event.target.value || todayIso())}
          />
        </label>
        <label>
          <span>Usuario</span>
          <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
            <option value="all">Todos os usuarios</option>
            {userOptions.map((userName) => (
              <option value={userName} key={userName}>{userName}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="notifications-summary">
        <span>{activities.length} atividades</span>
        <span>{activityUsers.size} usuarios</span>
        <span>{activeWork?.nome || selectedCity?.nome || 'Todas'}</span>
      </section>

      <section className="push-permission-card">
        <div>
          <strong>Notificacoes push</strong>
          <span>{pushMessage || pushStatusText}</span>
        </div>
        {canEnablePush ? (
          <button type="button" onClick={onEnablePush}>
            <Bell size={18} aria-hidden="true" /> Ativar push
          </button>
        ) : null}
      </section>

      {activities.length ? (
        <section className="notification-list" aria-label="Atividades realizadas hoje">
          {activities.map(({ id, title, description, time, user, Icon, tone, stageName, subitemName }) => (
            <article className={`notification-card ${tone}`} key={id}>
              <div className="notification-icon">
                <Icon size={22} aria-hidden="true" />
              </div>
              <div>
                <header>
                  <span className="notification-title">{title}</span>
                  <span>{time}</span>
                </header>
                <p>{description}</p>
                <div className="notification-meta">
                  <small>{user}</small>
                  {stageName ? <small>{stageName}</small> : null}
                  {subitemName ? <small>{subitemName}</small> : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyNotice
          Icon={Bell}
          title="Nenhuma atividade encontrada"
          text="Ajuste a data ou o usuario para consultar registros de diario, fotos, checklist, pendencias e subitens alterados."
        />
      )}
    </>
  );
}

function Stages({ scheduleItems = [], logs = [], photos = [], issues = [], addPhoto, addIssue, setScreen }) {
  const visibleItems = scheduleItems.filter((item) => item.visible !== false);
  const stages = visibleItems
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function childrenFor(stageId) {
    return visibleItems
      .filter((item) => item.parentId === stageId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function stageStats(stage) {
    const children = childrenFor(stage.id);
    const names = new Set([stage.nome, ...children.map((item) => item.nome)]);
    const ids = new Set([stage.id, ...children.map((item) => item.id)]);
    const photoCount = photos.filter((photo) => names.has(photo.etapa)).length;
    const logCount = logs.filter((log) => ids.has(log.scheduleItemId)).length;
    const openIssueCount = issues.filter((issue) => issue.status !== 'Resolvida' && names.has(issue.etapa)).length;
    const firstPhotoTarget = children[0]?.nome || stage.nome;

    return {
      children,
      firstPhotoTarget,
      logCount,
      openIssueCount,
      photoCount,
      progress: calculateScheduleStageProgress(children),
    };
  }

  return (
    <>
      <PageTitle eyebrow="Etapas da obra" title="Resumo do cronograma" subtitle="Etapas principais vindas do cronograma inteligente." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={CalendarDays} onClick={() => setScreen('schedule')}>Editar cronograma</ActionButton>
      </PageTitle>
      <section className="stage-list">
        {stages.map((stage) => {
          const stats = stageStats(stage);
          return (
            <article className="stage-card" key={stage.id}>
              <div className="stage-main">
                <div>
                  <h2>{stage.nome}</h2>
                  <span>{stats.children.length} subitem{stats.children.length === 1 ? '' : 's'} do cronograma</span>
                </div>
                <StatusPill status={stage.status} />
              </div>
              <ScheduleDates item={stage} />
              <ProgressBar value={stats.progress} />
              <div className="stage-meta">
                <span>{stats.progress}% executado</span>
                <span>{stats.openIssueCount} pendencia{stats.openIssueCount === 1 ? '' : 's'}</span>
                <span>{stats.photoCount} foto{stats.photoCount === 1 ? '' : 's'}</span>
                <span>{stats.logCount} registro{stats.logCount === 1 ? '' : 's'} de visita</span>
              </div>
              <div className="stage-subitem-preview">
                {stats.children.slice(0, 4).map((child) => (
                  <span key={child.id}>{child.nome}</span>
                ))}
                {stats.children.length > 4 ? <span>+ {stats.children.length - 4} subitens</span> : null}
                {!stats.children.length ? <span>Sem subitens cadastrados</span> : null}
              </div>
              <div className="button-row">
                <button type="button" onClick={() => setScreen('schedule')}><Eye size={18} aria-hidden="true" /> Ver no cronograma</button>
                <button type="button" onClick={() => addPhoto(stats.firstPhotoTarget)}><Camera size={18} aria-hidden="true" /> Adicionar foto</button>
                <button type="button" onClick={() => addIssue(stage.nome)}><AlertTriangle size={18} aria-hidden="true" /> Pendencia</button>
                <button type="button" onClick={() => setScreen('checklist')}><ClipboardCheck size={18} aria-hidden="true" /> Checklist</button>
                <button type="button" onClick={() => setScreen('supplies')}><PackageCheck size={18} aria-hidden="true" /> Materiais</button>
              </div>
            </article>
          );
        })}
        {!stages.length ? <EmptyNotice Icon={Layers3} title="Cronograma sem etapas" text="Cadastre as etapas no cronograma inteligente desta obra." /> : null}
      </section>
    </>
  );
}

function StageDetail({ stage, updateStage, addPhoto, addIssue, setScreen }) {
  const blocks = [
    ['Servicos', Hammer, '5 itens', 'schedule'],
    ['Insumos', PackageCheck, '8 previstos', 'supplies'],
    ['Ferramentas', Wrench, '3 obrigatorias', 'tools'],
    ['Fotos obrigatorias', Camera, `${stage.fotosFaltando} faltando`, 'photos'],
    ['Checklist tecnico', ClipboardCheck, '12 itens', 'checklist'],
    ['Documentos', FileText, 'Arquivos da obra', 'documents'],
    ['Pendencias da etapa', AlertTriangle, `${stage.pendencias} abertas`, 'issues'],
  ];
  return (
    <>
      <PageTitle eyebrow="Detalhe da etapa" title={stage.nome} subtitle={`${stage.inicio} ate ${stage.fim}`} onBack={() => setScreen('stages')}>
        <StatusPill status={stage.status} />
      </PageTitle>
      <section className="work-hero">
        <div>
          <span>Percentual executado</span>
          <strong>{stage.percentual}%</strong>
          <ProgressBar value={stage.percentual} />
        </div>
        <div>
          <span>Data real</span>
          <strong>{stage.status === 'Concluida' ? stage.fim : 'Em aberto'}</strong>
        </div>
      </section>
      <section className="detail-note">
        <strong>Observacoes</strong>
        <p>Equipe em campo deve anexar fotos obrigatorias e conferir checklist tecnico antes de avancar.</p>
      </section>
      <section className="module-grid">
        {blocks.map(([label, Icon, value, route]) => (
          <button className="module-card" type="button" key={label} onClick={() => setScreen(route)}>
            <Icon size={30} aria-hidden="true" />
            <span>{label}</span>
            <small>{value}</small>
          </button>
        ))}
      </section>
      <div className="form-actions">
        <ActionButton Icon={Pencil} onClick={() => updateStage(stage.id, { percentual: Math.min(100, stage.percentual + 10), status: stage.percentual + 10 >= 100 ? 'Concluida' : 'Em andamento' })}>Avancar 10%</ActionButton>
        <ActionButton Icon={Camera} variant="secondary" onClick={() => addPhoto(stage.nome)}>Adicionar foto</ActionButton>
        <ActionButton Icon={AlertTriangle} variant="secondary" onClick={() => addIssue(stage.nome)}>Adicionar pendencia</ActionButton>
        <ActionButton Icon={CheckCircle2} variant="ghost" onClick={() => updateStage(stage.id, { percentual: 100, status: 'Concluida', fotosFaltando: 0 })}>Marcar como concluida</ActionButton>
      </div>
    </>
  );
}

function Photos({
  photos,
  scheduleItems,
  addPhoto,
  deletePhoto,
  deletingPhotoId,
  error,
  setScreen,
}) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const groups = buildPhotoGroups(photos, scheduleItems);
  const firstSubitem = scheduleItems.find((item) => item.parentId && item.visible !== false);

  function openPhoto(photo) {
    if (getBestPhotoUrl(photo)) setSelectedPhoto(photo);
  }

  return (
    <>
      <PageTitle eyebrow="Fotos da obra" title="Registros por etapa e subitem" subtitle="Somente etapas e subitens que possuem fotos." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={Camera} onClick={() => addPhoto(firstSubitem?.nome)}>Adicionar foto</ActionButton>
      </PageTitle>
      {error ? (
        <section className="warning-strip" role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}
      <section className="photo-stage-groups">
        {groups.map((stage) => (
          <details className="photo-stage-group" key={stage.id} open>
            <summary>
              <div>
                <strong>{stage.nome}</strong>
                <span>{stage.photoCount} foto{stage.photoCount === 1 ? '' : 's'}</span>
              </div>
            </summary>
            <div className="photo-subitem-groups">
              {stage.subitems.map((subitem) => (
                <section className="photo-subitem-group" key={subitem.id}>
                  <header>
                    <div>
                      <span>Subitem</span>
                      <h2>{subitem.nome}</h2>
                    </div>
                    <button type="button" onClick={() => addPhoto(subitem.nome)}><Camera size={17} /> Adicionar foto</button>
                  </header>
                  <div className="photo-date-groups">
                    {subitem.dateGroups.map((dateGroup) => (
                      <section className="photo-date-group" key={dateGroup.date}>
                        <h3>{dateGroup.date}</h3>
                        <div className="photo-grid">
                          {dateGroup.photos.map((photo) => (
                            <PhotoCard
                              photo={photo}
                              deleting={deletingPhotoId === photo.id}
                              onOpen={() => openPhoto(photo)}
                              onDelete={() => deletePhoto(photo)}
                              key={photo.id}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </details>
        ))}
        {!groups.length ? <EmptyNotice Icon={Camera} title="Nenhuma foto cadastrada" text="Adicione fotos nos subitens do cronograma." /> : null}
      </section>
      <div className="form-actions">
        <ActionButton Icon={Camera} onClick={() => addPhoto(firstSubitem?.nome)}>Tirar foto</ActionButton>
        <ActionButton Icon={Upload} variant="secondary" onClick={() => addPhoto('PLS Caixa')}>Enviar da galeria</ActionButton>
      </div>
      {selectedPhoto ? (
        <PhotoViewerModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      ) : null}
    </>
  );
}

function PhotoCard({ photo, deleting, onOpen, onDelete }) {
  const photoUrl = getBestPhotoUrl(photo);
  return (
    <article className="photo-card">
      <button
        className={`photo-thumb ${photo.cor}`}
        type="button"
        disabled={!photoUrl}
        onClick={onOpen}
        aria-label={`Abrir foto de ${photo.etapa}`}
      >
        {photoUrl ? <img src={photoUrl} alt={`Foto ${photo.etapa}`} /> : <Camera size={34} aria-hidden="true" />}
      </button>
      <button
        className="photo-delete-button"
        type="button"
        aria-label={`Excluir foto de ${photo.etapa}`}
        title="Excluir foto"
        disabled={deleting}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </article>
  );
}

function PhotoViewerModal({ photo, onClose }) {
  const [shareMessage, setShareMessage] = useState('');
  const photoUrl = photo.photoUrl || getBestPhotoUrl(photo);

  async function sharePhoto() {
    if (!photoUrl) return;
    const shareData = {
      title: `Foto da obra - ${photo.etapa}`,
      text: `Foto da etapa ${photo.etapa}`,
      url: photoUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard?.writeText(photoUrl);
      setShareMessage('Link da foto copiado.');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setShareMessage('Nao foi possivel compartilhar esta foto.');
    }
  }

  return (
    <div className="modal-backdrop photo-viewer-backdrop" role="presentation" onClick={onClose}>
      <section className="photo-viewer-modal" role="dialog" aria-modal="true" aria-label={`Foto de ${photo.etapa}`} onClick={(event) => event.stopPropagation()}>
        <div className="photo-viewer-head">
          <div>
            <span>{photo.data || 'Foto da obra'}</span>
            <h2>{photo.etapa}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="photo-viewer-image">
          {photoUrl ? <img src={photoUrl} alt={`Foto ampliada de ${photo.etapa}`} /> : <Camera size={42} aria-hidden="true" />}
        </div>
        <div className="photo-viewer-actions">
          <button type="button" onClick={sharePhoto}>
            <Share2 size={18} aria-hidden="true" /> Compartilhar
          </button>
          {shareMessage ? <span>{shareMessage}</span> : null}
        </div>
      </section>
    </div>
  );
}

function groupPhotosByDate(photos) {
  const groups = new Map();
  photos.forEach((photo) => {
    const date = photo.data || 'Sem data';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(photo);
  });

  return [...groups.entries()]
    .map(([date, datePhotos]) => ({ date, photos: datePhotos }))
    .sort((a, b) => photoDateTimestamp(b.date) - photoDateTimestamp(a.date));
}

function photoDateTimestamp(value) {
  const text = String(value || '');
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilian) {
    return new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1])).getTime();
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  }
  return 0;
}

function buildPhotoGroups(photos, scheduleItems) {
  const visibleItems = scheduleItems.filter((item) => item.visible !== false);
  const stages = visibleItems
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const assigned = new Set();

  const groups = stages.map((stage) => {
    const children = visibleItems
      .filter((item) => item.parentId === stage.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const subitems = children.map((child) => {
      const childPhotos = photos.filter((photo) => {
        if (assigned.has(photo.id) || photo.etapa !== child.nome) return false;
        assigned.add(photo.id);
        return true;
      });
      return { ...child, photos: childPhotos };
    });

    const legacyStagePhotos = photos.filter((photo) => {
      if (assigned.has(photo.id) || photo.etapa !== stage.nome) return false;
      assigned.add(photo.id);
      return true;
    });
    if (legacyStagePhotos.length && subitems.length) {
      subitems[0].photos = [...subitems[0].photos, ...legacyStagePhotos];
    }

    const visibleSubitems = subitems
      .filter((item) => item.photos.length)
      .map((item) => ({ ...item, dateGroups: groupPhotosByDate(item.photos) }));
    return {
      ...stage,
      subitems: visibleSubitems,
      photoCount: visibleSubitems.reduce((total, item) => total + item.photos.length, 0),
    };
  }).filter((stage) => stage.photoCount);

  const unmatched = photos.filter((photo) => !assigned.has(photo.id));
  if (unmatched.length) {
    groups.push({
      id: 'outros-registros',
      nome: 'Outros registros',
      photoCount: unmatched.length,
      subitems: [{
        id: 'outros-registros-subitem',
        nome: 'Sem subitem identificado',
        photos: unmatched,
        dateGroups: groupPhotosByDate(unmatched),
      }],
    });
  }
  return groups;
}

function PhotoUploadModal({ etapa, scheduleItems, saving, error, onClose, onSave }) {
  const [files, setFiles] = useState([]);
  const stageOptions = [...new Set([
    etapa,
    ...scheduleItems.filter((item) => item.parentId && item.visible !== false).map((item) => item.nome),
    'PLS Caixa',
  ].filter(Boolean))];
  const [previewUrls, setPreviewUrls] = useState([]);

  useEffect(() => {
    if (!files.length) {
      setPreviewUrls([]);
      return undefined;
    }

    const nextUrls = files.map((item) => URL.createObjectURL(item));
    setPreviewUrls(nextUrls);
    return () => nextUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const selectedFiles = Array.from(form.elements.photoFile.files || []);
    if (!selectedFiles.length) return;
    onSave({
      etapa: form.elements.etapa.value,
      tipo: form.elements.tipo.value,
      observacao: form.elements.observacao.value,
      files: selectedFiles,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Foto da obra</span>
            <h2>Enviar registro</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="photo-upload-layout">
          <div className="photo-upload-side">
            <label className="photo-picker">
              {previewUrls.length ? (
                <div className="selected-photo-preview" aria-hidden="true">
                  {previewUrls.slice(0, 4).map((url) => (
                    <img src={url} alt="" key={url} />
                  ))}
                </div>
              ) : (
                <Camera size={40} aria-hidden="true" />
              )}
              <span>{files.length ? `${files.length} imagem${files.length > 1 ? 's' : ''} selecionada${files.length > 1 ? 's' : ''}` : 'Selecionar imagens'}</span>
              <input
                type="file"
                name="photoFile"
                accept="image/*"
                multiple
                required
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
            </label>
            {files.length ? (
              <ul className="selected-file-list">
                {files.map((item) => (
                  <li key={`${item.name}-${item.size}`}>
                    <span>{item.name}</span>
                    <small>{Math.max(1, Math.round(item.size / 1024))} KB</small>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="form-grid modal-fields">
            <label className="field">
              <span>Etapa</span>
              <select name="etapa" defaultValue={etapa}>
                {stageOptions.map((item) => (
                  <option value={item} key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tipo</span>
              <select name="tipo" defaultValue={etapa === 'PLS Caixa' ? 'PLS Caixa' : 'Durante'}>
                {['Durante', 'Antes', 'Depois', 'Problema', 'PLS Caixa'].map((item) => (
                  <option value={item} key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Observacao</span>
              <textarea name="observacao" rows={3} defaultValue={`Registro incluido em ${etapa}`} />
            </label>
          </div>
        </div>
        {error ? <p className="auth-message error">{error}</p> : null}
        <div className="form-actions">
          <ActionButton Icon={Upload} type="submit" disabled={saving}>{saving ? 'Enviando...' : files.length > 1 ? `Salvar ${files.length} fotos` : 'Salvar foto'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function Pls({ plsItems, updatePls, addPhoto, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="PLS Caixa" title="Controle de vistorias" subtitle="Etapas, fotos obrigatorias, status e observacoes tecnicas." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={Plus} onClick={() => updatePls('Pronto para enviar')}>Nova PLS</ActionButton>
      </PageTitle>
      <section className="table-cards">
        {plsItems.map((item) => (
          <article className="table-card" key={item.id}>
            <div>
              <strong>{item.etapa}</strong>
              <span>{item.percentual}% - fotos {item.fotos}</span>
            </div>
            <StatusPill status={item.status} />
            <span>Vistoria: {item.vistoria}</span>
            <p>{item.observacao}</p>
          </article>
        ))}
      </section>
      <div className="form-actions">
        <ActionButton Icon={Camera} onClick={() => addPhoto('PLS Caixa')}>Adicionar fotos PLS</ActionButton>
        <ActionButton Icon={FileText} variant="secondary" onClick={() => window.print()}>Gerar relatorio PLS</ActionButton>
        <ActionButton Icon={CheckCircle2} variant="ghost" onClick={() => updatePls('Enviado')}>Marcar como enviado</ActionButton>
      </div>
    </>
  );
}

const defaultScheduleChecklistItems = [
  'Conferiu nivel do baldrame',
  'Conferiu largura',
  'Conferiu ferragens',
  'Conferiu cobrimento',
  'Conferiu arranques dos pilares',
  'Conferiu impermeabilizacao',
  'Fotos antes da concretagem',
  'Fotos apos concretagem',
  'Liberado para proxima etapa',
];

function makeChecklistItem(text, index = 0) {
  return {
    id: `chk-item-${index + 1}`,
    texto: String(text || '').trim(),
    obrigatorio: true,
  };
}

function checklistItemsToText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item?.texto || item || '').trim())
    .filter(Boolean)
    .join('\n');
}

function checklistItemsFromText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\[[ xX]\])\s*/, '').trim())
    .filter(Boolean)
    .map(makeChecklistItem);
}

function defaultChecklistForScheduleItem(item) {
  return {
    id: '',
    scheduleItemId: item.id,
    titulo: 'Checklist tecnico',
    descricao: 'Checklist tecnico',
    procedimento: '',
    itens: [],
    etapa: item.nome,
    norma: 'Checklist interno',
    foto: 'Obrigatoria',
    responsavel: '',
    data: '',
    status: 'Nao iniciado',
  };
}

function findChecklistForScheduleItem(checklists, item) {
  return (checklists || []).find((entry) => entry.scheduleItemId === item.id)
    || (checklists || []).find((entry) => !entry.scheduleItemId && normalizeSearch(entry.etapa) === normalizeSearch(item.nome))
    || null;
}

function checklistExecutionInitialIds(checklist, results, log) {
  const checkedIds = new Set(
    (results || [])
      .filter((result) => result.checked)
      .map((result) => result.checklistItemId)
      .filter(Boolean),
  );
  if (checkedIds.size || !log?.checklist || !checklist?.itens?.length) return checkedIds;

  const legacyCheckedText = new Set(
    String(log.checklist || '')
      .split(/\r?\n/)
      .map((line) => normalizeSearch(line))
      .filter(Boolean),
  );

  checklist.itens.forEach((item) => {
    if (legacyCheckedText.has(normalizeSearch(item.texto))) checkedIds.add(item.id);
  });
  return checkedIds;
}

function subitemChecklistResults(checklistResults, item, checklist) {
  return (checklistResults || []).filter((result) => (
    result.scheduleItemId === item.id
    && !result.scheduleLogId
    && (!checklist?.id || result.checklistId === checklist.id)
  ));
}

function checkedChecklistIds(results) {
  return new Set(
    (results || [])
      .filter((result) => result.checked)
      .map((result) => result.checklistItemId)
      .filter(Boolean),
  );
}

function checklistCheckedDetails(checklist, results, logs) {
  const detailByItemId = new Map();

  (results || [])
    .filter((result) => result.checked)
    .forEach((result) => {
      const previous = detailByItemId.get(result.checklistItemId);
      if (!previous || String(result.checkedAt || '') > String(previous.checkedAt || '')) {
        detailByItemId.set(result.checklistItemId, result);
      }
    });

  if (!checklist?.itens?.length) return detailByItemId;

  (logs || []).forEach((log) => {
    const legacyCheckedIds = checklistExecutionInitialIds(checklist, [], log);
    legacyCheckedIds.forEach((itemId) => {
      if (!detailByItemId.has(itemId)) {
        detailByItemId.set(itemId, {
          checklistItemId: itemId,
          checked: true,
          checkedAt: log.updatedAt || log.createdAt || log.visitDate || '',
        });
      }
    });
  });

  return detailByItemId;
}

function ChecklistOverview({ scheduleItems = [], checklist = [], checklistResults = [], scheduleLogs = [], setScreen }) {
  const visibleItems = scheduleItems.filter((item) => item.visible !== false);
  const itemsById = new Map(visibleItems.map((item) => [item.id, item]));
  const stages = visibleItems
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const stageGroups = stages
    .map((stage) => {
      const subitems = visibleItems
        .filter((item) => item.parentId === stage.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => {
          const itemChecklist = findChecklistForScheduleItem(checklist, item);
          if (!itemChecklist) return null;
          const itemResults = (checklistResults || []).filter((result) => (
            result.scheduleItemId === item.id
            && (!itemChecklist.id || result.checklistId === itemChecklist.id)
          ));
          const itemLogs = (scheduleLogs || []).filter((log) => log.scheduleItemId === item.id);
          const checkedDetails = checklistCheckedDetails(itemChecklist, itemResults, itemLogs);
          const totalItems = itemChecklist.itens?.length || 0;
          const checkedItems = (itemChecklist.itens || []).filter((checkItem) => checkedDetails.has(checkItem.id)).length;
          return {
            item,
            checklist: itemChecklist,
            checkedDetails,
            totalItems,
            checkedItems,
          };
        })
        .filter(Boolean);

      return { stage, subitems };
    })
    .filter((group) => group.subitems.length);

  const orphanSubitems = visibleItems
    .filter((item) => item.parentId && !itemsById.has(item.parentId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => {
      const itemChecklist = findChecklistForScheduleItem(checklist, item);
      if (!itemChecklist) return null;
      const itemResults = (checklistResults || []).filter((result) => (
        result.scheduleItemId === item.id
        && (!itemChecklist.id || result.checklistId === itemChecklist.id)
      ));
      const itemLogs = (scheduleLogs || []).filter((log) => log.scheduleItemId === item.id);
      const checkedDetails = checklistCheckedDetails(itemChecklist, itemResults, itemLogs);
      return {
        item,
        checklist: itemChecklist,
        checkedDetails,
        totalItems: itemChecklist.itens?.length || 0,
        checkedItems: (itemChecklist.itens || []).filter((checkItem) => checkedDetails.has(checkItem.id)).length,
      };
    })
    .filter(Boolean);

  if (orphanSubitems.length) {
    stageGroups.push({
      stage: { id: 'sem-etapa', nome: 'Sem etapa principal' },
      subitems: orphanSubitems,
    });
  }

  const totalChecklists = stageGroups.reduce((total, group) => total + group.subitems.length, 0);
  const totalItems = stageGroups.reduce((total, group) => total + group.subitems.reduce((sum, entry) => sum + entry.totalItems, 0), 0);
  const totalChecked = stageGroups.reduce((total, group) => total + group.subitems.reduce((sum, entry) => sum + entry.checkedItems, 0), 0);
  const todayDate = parseScheduleDate(todayIso());
  const checklistStageState = (group) => {
    const groupTotalItems = group.subitems.reduce((sum, entry) => sum + entry.totalItems, 0);
    const groupCheckedItems = group.subitems.reduce((sum, entry) => sum + entry.checkedItems, 0);
    if (groupTotalItems > 0 && groupCheckedItems >= groupTotalItems) return 'done';
    const hasOverduePending = group.subitems.some(({ item, totalItems: itemTotal, checkedItems }) => {
      if (itemTotal > 0 && checkedItems >= itemTotal) return false;
      const plannedEnd = parseScheduleDate(item.fimPrevisto);
      return plannedEnd && todayDate && plannedEnd < todayDate;
    });
    return hasOverduePending ? 'late' : 'open';
  };

  return (
    <>
      <PageTitle
        eyebrow="Checklist tecnico"
        title="Conferencias por subitem"
        subtitle="Checklists cadastrados nesta obra e o que ja foi executado."
        onBack={() => setScreen('workPanel')}
      />
      <section className="schedule-toolbar checklist-overview-toolbar">
        <span><strong>{totalChecklists}</strong> checklists</span>
        <span><strong>{totalChecked}</strong> itens feitos</span>
        <span><strong>{Math.max(0, totalItems - totalChecked)}</strong> pendentes</span>
      </section>

      {stageGroups.length ? (
        <section className="checklist-overview">
          {stageGroups.map((group) => {
            const groupState = checklistStageState(group);
            return (
              <details className={`checklist-stage-group checklist-stage-${groupState}`} key={group.stage.id}>
                <summary>
                  <h2>{group.stage.nome}</h2>
                  <span>{group.subitems.length} subitem{group.subitems.length === 1 ? '' : 's'} com checklist</span>
                </summary>
                <div>
                  {group.subitems.map(({ item, checklist: itemChecklist, checkedDetails, totalItems: itemTotal, checkedItems }) => {
                    const percent = itemTotal ? Math.round((checkedItems / itemTotal) * 100) : 0;
                    return (
                      <article className="checklist-subitem-card" key={item.id}>
                        <div className="checklist-subitem-head">
                          <div>
                            <strong>{item.nome}</strong>
                            <span>{itemChecklist.titulo || 'Checklist tecnico'}</span>
                          </div>
                          <StatusPill status={checkedItems >= itemTotal && itemTotal > 0 ? 'Concluida' : checkedItems ? 'Em andamento' : 'Nao iniciado'} />
                        </div>
                        {itemChecklist.procedimento ? <p>{itemChecklist.procedimento}</p> : null}
                        <div className="checklist-progress-line">
                          <span>{checkedItems} de {itemTotal} feitos</span>
                          <strong>{percent}%</strong>
                        </div>
                        <ProgressBar value={percent} />
                        <div className="checklist-item-status-list">
                          {(itemChecklist.itens || []).map((checkItem) => {
                            const detail = checkedDetails.get(checkItem.id);
                            return (
                              <div className={detail ? 'done' : ''} key={checkItem.id}>
                                {detail ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                                <span>{checkItem.texto}</span>
                                <small>{detail ? `Feito${detail.checkedAt ? ` - ${formatDateTime(detail.checkedAt)}` : ''}` : 'Pendente'}</small>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </section>
      ) : (
        <EmptyNotice Icon={ClipboardCheck} title="Nenhum checklist cadastrado" text="Cadastre checklists nos subitens do cronograma desta obra." />
      )}
    </>
  );
}

function Schedule({
  items,
  logs,
  checklist = [],
  checklistResults = [],
  serviceCategories = [],
  contractors = [],
  contractorAssignments = [],
  saving,
  error,
  onSaveItem,
  onUpdateItem,
  onSetVisibility,
  onSaveLog,
  onDeleteLog,
  onSaveChecklist,
  onDeleteChecklist,
  onSaveChecklistCheck,
  onLoadChecklistPhotos,
  onSaveChecklistPhotos,
  onSaveContractorAssignment,
  onReorderItem,
  addPhoto,
  setScreen,
}) {
  const [itemModal, setItemModal] = useState(null);
  const [logItem, setLogItem] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [ganttOpen, setGanttOpen] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState(null);
  const [checklistItem, setChecklistItem] = useState(null);
  const [checklistCheckItem, setChecklistCheckItem] = useState(null);
  const [contractorItem, setContractorItem] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const pointerDragRef = useRef(null);
  const visibleItems = items.filter((item) => item.visible !== false);
  const categoriesById = useMemo(() => new Map(serviceCategories.map((category) => [category.id, category])), [serviceCategories]);
  const contractorsById = useMemo(() => new Map(contractors.map((contractor) => [contractor.id, contractor])), [contractors]);
  const assignmentsBySubitem = useMemo(() => {
    const next = new Map();
    contractorAssignments
      .filter((assignment) => assignment.ativo !== false)
      .forEach((assignment) => {
        next.set(assignment.scheduleItemId, assignment);
      });
    return next;
  }, [contractorAssignments]);
  const removedItems = items.filter((item) => item.visible === false);
  const removedEntries = removedItems.filter((item) => (
    !item.parentId || items.find((parent) => parent.id === item.parentId)?.visible !== false
  ));
  const stages = visibleItems
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const scheduleDurationDays = calculateScheduleDurationDays(visibleItems);
  const scheduleDurationLabel = scheduleDurationDays === 1 ? 'dia de obra' : 'dias de obra';
  const scheduleRemainingDays = calculateScheduleRemainingDays(visibleItems);
  const scheduleRemainingLabel = scheduleRemainingDays === 1 ? 'dia restante' : 'dias restantes';

  function childrenFor(parentId) {
    return visibleItems
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function logsFor(itemId) {
    return logs.filter((log) => log.scheduleItemId === itemId);
  }

  async function setVisibility(item, visible) {
    await onSetVisibility(item.id, visible);
  }

  function requestRemove(item) {
    setRemoveCandidate(item);
  }

  async function confirmRemove() {
    if (!removeCandidate || saving) return;
    const removed = await onSetVisibility(removeCandidate.id, false);
    if (removed) setRemoveCandidate(null);
  }

  function startDrag(event, item) {
    if (saving) return;
    const dragInfo = { id: item.id, parentId: item.parentId || '' };
    setDraggedItem(dragInfo);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);
  }

  function canDropOn(target) {
    return draggedItem
      && draggedItem.id !== target.id
      && draggedItem.parentId === (target.parentId || '');
  }

  function allowDrop(event, target) {
    if (!canDropOn(target)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  async function dropItem(event, target) {
    if (!canDropOn(target)) return;
    event.preventDefault();
    const sourceId = draggedItem?.id || event.dataTransfer.getData('text/plain');
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
    setDraggedItem(null);
    await onReorderItem(sourceId, target.id, placement);
  }

  function startPointerDrag(event, item) {
    if (saving) return;
    event.preventDefault();
    event.stopPropagation();
    const dragInfo = { id: item.id, parentId: item.parentId || '' };
    pointerDragRef.current = dragInfo;
    setDraggedItem(dragInfo);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  async function finishPointerDrag(event) {
    const dragInfo = pointerDragRef.current;
    pointerDragRef.current = null;
    setDraggedItem(null);
    if (!dragInfo) return;

    event.preventDefault();
    event.stopPropagation();
    const dropElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-schedule-drop-id]');
    if (!dropElement) return;

    const targetId = dropElement.dataset.scheduleDropId;
    const targetParentId = dropElement.dataset.scheduleParentId || '';
    if (!targetId || targetId === dragInfo.id || targetParentId !== dragInfo.parentId) return;

    const bounds = dropElement.getBoundingClientRect();
    const placement = event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
    await onReorderItem(dragInfo.id, targetId, placement);
  }

  function cancelPointerDrag(event) {
    if (!pointerDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    pointerDragRef.current = null;
    setDraggedItem(null);
  }

  function renderDragHandle(item, size = 18) {
    return (
      <span
        className="schedule-drag-handle"
        role="button"
        tabIndex={-1}
        aria-label="Arrastar para reordenar"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => startPointerDrag(event, item)}
        onPointerUp={finishPointerDrag}
        onPointerCancel={cancelPointerDrag}
      >
        <GripVertical size={size} aria-hidden="true" />
      </span>
    );
  }

  return (
    <>
      <PageTitle eyebrow="Cronograma" title="Cronograma" subtitle="Etapas, subitens e diario de campo especificos desta obra." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={CalendarDays} variant="secondary" onClick={() => setScreen('contractScheduleBuilder')}>Criar cronograma</ActionButton>
        <ActionButton Icon={Plus} onClick={() => setItemModal({ itemType: 'stage' })}>Adicionar etapa</ActionButton>
      </PageTitle>
      <section className="schedule-toolbar">
        <span><strong>{scheduleRemainingDays}</strong> {scheduleRemainingLabel}</span>
        <span><strong>{scheduleDurationDays}</strong> {scheduleDurationLabel}</span>
        <span><strong>{logs.length}</strong> registros de visita</span>
        <button className="schedule-gantt-link" type="button" onClick={() => setGanttOpen(true)}>
          <BarChart3 size={17} /> Abrir cronograma Gantt
        </button>
        {removedEntries.length ? (
          <button type="button" onClick={() => setShowRemoved((current) => !current)}>
            {showRemoved ? 'Ocultar removidos' : `Removidos (${removedEntries.length})`}
          </button>
        ) : null}
      </section>

      {error ? <p className="auth-message error">{error}</p> : null}

      <section className="smart-schedule">
        {stages.map((stage) => {
          const children = childrenFor(stage.id);
          const stageProgress = calculateScheduleStageProgress(children);
          const stagePayments = calculateScheduleStagePayments(children);
          const stageState = ganttStageState(stage);
          return (
            <details className={`schedule-stage-group schedule-stage-${stageState} ${draggedItem?.id === stage.id ? 'dragging' : ''}`} key={stage.id}>
              <summary
                draggable={!saving}
                data-schedule-drop-id={stage.id}
                data-schedule-parent-id=""
                onDragStart={(event) => startDrag(event, stage)}
                onDragOver={(event) => allowDrop(event, stage)}
                onDrop={(event) => dropItem(event, stage)}
                onDragEnd={() => setDraggedItem(null)}
              >
                {renderDragHandle(stage, 20)}
                <div className="schedule-summary-title">
                  <strong>{stage.nome}</strong>
                  <span>{children.length} subitem{children.length === 1 ? '' : 's'}</span>
                  <span className="schedule-payment-line">
                    Total a pagar {formatCurrency(stagePayments.total)} - Executado {formatCurrency(stagePayments.executed)}
                  </span>
                </div>
                <div className="schedule-summary-progress">
                  <ProgressBar value={stageProgress} />
                  <strong>{stageProgress}%</strong>
                </div>
              </summary>
              <div className="schedule-stage-body">
                <ScheduleDates item={stage} />
                <div className="schedule-actions stage-only">
                  <button type="button" onClick={() => setItemModal(stage)}><Pencil size={17} /> Editar descricao</button>
                  <button type="button" onClick={() => setItemModal({ itemType: 'task', parentId: stage.id })}><Plus size={17} /> Subitem</button>
                  <button className="danger" type="button" disabled={saving} onClick={() => requestRemove(stage)}><Minus size={17} /> Remover</button>
                </div>

                <div className="schedule-subitems">
                  {children.map((item) => {
                    const itemLogs = logsFor(item.id);
                    const itemChecklist = findChecklistForScheduleItem(checklist, item);
                    const itemCategory = categoriesById.get(item.categoriaServicoId);
                    const itemAssignment = assignmentsBySubitem.get(item.id);
                    const itemContractor = itemAssignment ? contractorsById.get(itemAssignment.contractorId) : null;
                    return (
                      <details className={`schedule-subitem ${draggedItem?.id === item.id ? 'dragging' : ''}`} key={item.id}>
                        <summary
                          className="schedule-subitem-main"
                          draggable={!saving}
                          data-schedule-drop-id={item.id}
                          data-schedule-parent-id={item.parentId || ''}
                          onDragStart={(event) => startDrag(event, item)}
                          onDragOver={(event) => allowDrop(event, item)}
                          onDrop={(event) => dropItem(event, item)}
                          onDragEnd={() => setDraggedItem(null)}
                        >
                          {renderDragHandle(item, 18)}
                          <button
                            className={`schedule-check ${item.status === 'Concluida' ? 'checked' : ''}`}
                            type="button"
                            aria-label={item.status === 'Concluida' ? 'Reabrir subitem' : 'Concluir subitem'}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onUpdateItem(item.id, {
                                status: item.status === 'Concluida' ? 'Nao iniciado' : 'Concluida',
                                percentual: item.status === 'Concluida' ? 0 : 100,
                                fimReal: item.status === 'Concluida' ? '' : new Date().toISOString().slice(0, 10),
                              });
                            }}
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <div>
                            <strong>{item.nome}</strong>
                            <span>
                              {itemLogs.length} registros - {scheduleDateLabel(item.inicioPrevisto)} ate {scheduleDateLabel(item.fimPrevisto)}
                              {' - '}Valor {formatCurrency(item.valorMaoObra)}
                            </span>
                            {(itemCategory || itemContractor) ? (
                              <span className="schedule-subitem-meta">
                                {itemCategory ? `Categoria: ${itemCategory.nome}` : ''}
                                {itemCategory && itemContractor ? ' - ' : ''}
                                {itemContractor ? `Empreiteiro: ${itemContractor.nome}` : ''}
                              </span>
                            ) : null}
                          </div>
                          <StatusPill status={item.status} />
                        </summary>
                        <div className="schedule-subitem-body">
                          <ScheduleQuickDates item={item} saving={saving} onSave={onUpdateItem} />
                          <div className="schedule-actions compact">
                            <button type="button" onClick={() => setItemModal(item)}><Pencil size={16} /> Editar</button>
                            <button type="button" onClick={() => setLogItem(item)}><ClipboardCheck size={16} /> Diario</button>
                            <button type="button" onClick={() => addPhoto(item.nome)}><Camera size={16} /> Foto</button>
                            <button type="button" onClick={() => setContractorItem(item)}><HardHat size={16} /> Empreiteiro</button>
                            <button type="button" onClick={() => setChecklistItem(item)}>
                              <ClipboardCheck size={16} /> Adicionar checklist
                            </button>
                            <button type="button" disabled={!itemChecklist} onClick={() => setChecklistCheckItem(item)}>
                              <CheckCircle2 size={16} /> Conferir checklist
                            </button>
                            <button className="danger" type="button" disabled={saving} onClick={() => requestRemove(item)}><Minus size={16} /> Remover</button>
                          </div>
                          {itemLogs.slice(0, 2).map((log) => (
                            <ScheduleLogSummary
                              log={log}
                              key={log.id}
                              saving={saving}
                              onEdit={() => {
                                setEditingLog(log);
                                setLogItem(item);
                              }}
                            />
                          ))}
                        </div>
                      </details>
                    );
                  })}
                  {!children.length ? <p className="schedule-empty">Nenhum subitem. Use + Subitem para detalhar esta etapa.</p> : null}
                </div>
              </div>
            </details>
          );
        })}
        {!stages.length ? <EmptyNotice Icon={CalendarDays} title="Cronograma vazio" text="Adicione uma etapa ou monte o modelo padrao." /> : null}
      </section>

      {showRemoved ? (
        <section className="schedule-removed">
          <h2>Itens removidos desta obra</h2>
          <p>Os registros continuam no banco. Restaurar apenas devolve o item ao cronograma.</p>
          {removedEntries.map((item) => (
            <div key={item.id}>
              <span>{item.itemType === 'stage' ? 'Etapa' : 'Subitem'}: <strong>{item.nome}</strong></span>
              <button type="button" disabled={saving} onClick={() => setVisibility(item, true)}><Plus size={16} /> Restaurar</button>
            </div>
          ))}
        </section>
      ) : null}

      {itemModal ? (
        <ScheduleItemModal
          item={itemModal}
          serviceCategories={serviceCategories}
          saving={saving}
          onClose={() => setItemModal(null)}
          onSave={async (values) => {
            const saved = await onSaveItem(values);
            if (saved) setItemModal(null);
          }}
        />
      ) : null}

      {contractorItem ? (
        <ScheduleContractorModal
          item={contractorItem}
          contractors={contractors}
          assignment={assignmentsBySubitem.get(contractorItem.id)}
          saving={saving}
          onClose={() => {
            if (!saving) setContractorItem(null);
          }}
          onSave={async (values) => {
            const saved = await onSaveContractorAssignment(values);
            if (saved) setContractorItem(null);
          }}
        />
      ) : null}

      {logItem ? (
        <ScheduleLogModal
          item={logItem}
          log={editingLog}
          saving={saving}
          onClose={() => {
            setLogItem(null);
            setEditingLog(null);
          }}
          onSave={async (values, addPhotoAfter) => {
            const saved = await onSaveLog(values);
            if (!saved) return;
            setLogItem(null);
            setEditingLog(null);
            if (addPhotoAfter) addPhoto(logItem.nome);
          }}
          onDelete={editingLog ? async () => {
            const deleted = await onDeleteLog(editingLog.id);
            if (!deleted) return;
            setLogItem(null);
            setEditingLog(null);
          } : null}
        />
      ) : null}

      {checklistItem ? (
        <ScheduleChecklistModal
          item={checklistItem}
          checklist={findChecklistForScheduleItem(checklist, checklistItem)}
          saving={saving}
          onClose={() => {
            if (!saving) setChecklistItem(null);
          }}
          onSave={async (values) => {
            const saved = await onSaveChecklist(values);
            if (saved) setChecklistItem(null);
          }}
          onDelete={async (targetChecklist) => {
            const deleted = await onDeleteChecklist(targetChecklist);
            if (deleted) setChecklistItem(null);
          }}
        />
      ) : null}

      {checklistCheckItem ? (
        <ScheduleChecklistCheckModal
          item={checklistCheckItem}
          checklist={findChecklistForScheduleItem(checklist, checklistCheckItem)}
          checklistResults={subitemChecklistResults(
            checklistResults,
            checklistCheckItem,
            findChecklistForScheduleItem(checklist, checklistCheckItem),
          )}
          saving={saving}
          loadChecklistPhotos={onLoadChecklistPhotos}
          onSaveChecklistPhotos={onSaveChecklistPhotos}
          onClose={() => {
            if (!saving) setChecklistCheckItem(null);
          }}
          onSave={async (values) => {
            const saved = await onSaveChecklistCheck(values);
            if (saved) setChecklistCheckItem(null);
          }}
        />
      ) : null}

      {ganttOpen ? <ScheduleGanttModal items={visibleItems} onClose={() => setGanttOpen(false)} /> : null}

      {removeCandidate ? (
        <ScheduleRemoveConfirmModal
          item={removeCandidate}
          saving={saving}
          onClose={() => {
            if (!saving) setRemoveCandidate(null);
          }}
          onConfirm={confirmRemove}
        />
      ) : null}
    </>
  );
}

function ScheduleRemoveConfirmModal({ item, saving, onClose, onConfirm }) {
  const isStage = !item.parentId;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="photo-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-remove-title">
        <div className="modal-head">
          <div>
            <span>{isStage ? 'Remover etapa' : 'Remover subitem'}</span>
            <h2 id="schedule-remove-title">Confirmar remocao</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="confirm-modal-body">
          <AlertTriangle size={34} aria-hidden="true" />
          <div>
            <strong>{item.nome}</strong>
            <p>
              {isStage
                ? 'Esta etapa e seus subitens sairao da tela do cronograma desta obra.'
                : 'Este subitem saira da tela do cronograma desta obra.'}
            </p>
            <p>Os dados continuam salvos no banco e podem ser restaurados em Removidos.</p>
          </div>
        </div>
        <div className="form-actions">
          <ActionButton Icon={Minus} variant="danger" onClick={onConfirm} disabled={saving}>
            {saving ? 'Removendo...' : 'Confirmar remocao'}
          </ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </section>
    </div>
  );
}

function ScheduleChecklistModal({ item, checklist, saving, onClose, onSave, onDelete }) {
  const draft = checklist || defaultChecklistForScheduleItem(item);
  const hasSavedChecklist = Boolean(checklist?.id);
  const [itemsText, setItemsText] = useState(() => checklistItemsToText(draft.itens));

  useEffect(() => {
    setItemsText(checklistItemsToText(draft.itens));
  }, [draft.id, item.id]);

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const itens = checklistItemsFromText(itemsText);
    if (!itens.length) return;
    const titulo = form.elements.titulo.value.trim() || 'Checklist tecnico';
    onSave({
      id: draft.id || '',
      scheduleItemId: item.id,
      titulo,
      descricao: titulo,
      procedimento: form.elements.procedimento.value.trim(),
      itens,
      etapa: item.nome,
      norma: form.elements.norma.value.trim() || 'Checklist interno',
      foto: draft.foto || 'Obrigatoria',
      responsavel: draft.responsavel || '',
      data: form.elements.data.value.trim(),
      status: draft.status || 'Nao iniciado',
    });
  }

  function confirmDelete() {
    if (!hasSavedChecklist || saving || !onDelete) return;
    const confirmed = window.confirm(`Excluir o checklist de "${item.nome}"? Esta acao remove o checklist deste subitem.`);
    if (confirmed) onDelete(checklist);
  }

  const previewItems = checklistItemsFromText(itemsText);

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal checklist-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Cadastro de checklist</span>
            <h2>{item.nome}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <Field label="Titulo" name="titulo" value={draft.titulo || 'Checklist tecnico'} required />
          <Field label="Norma / referencia" name="norma" value={draft.norma || 'Checklist interno'} />
          <Field label="Data prevista" name="data" value={draft.data || ''} />
          <label className="field wide">
            <span>Descricao de como proceder</span>
            <textarea
              name="procedimento"
              defaultValue={draft.procedimento || ''}
              rows={4}
            />
          </label>
          <label className="field wide">
            <span>Itens do checklist</span>
            <textarea
              value={itemsText}
              rows={9}
              placeholder="Um item por linha"
              onChange={(event) => setItemsText(event.target.value)}
            />
            <small>Digite um item por linha. O checklist sera copiado junto quando outra obra copiar este cronograma.</small>
          </label>
        </div>
        {previewItems.length ? (
          <section className="checklist-preview">
            <strong>{draft.titulo || 'Checklist tecnico'}</strong>
            <div>
              {previewItems.map((checkItem) => (
                <label key={checkItem.id}>
                  <input type="checkbox" disabled />
                  <span>{checkItem.texto}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving || !previewItems.length}>
            {saving ? 'Salvando...' : 'Salvar checklist'}
          </ActionButton>
          {hasSavedChecklist ? (
            <ActionButton Icon={Trash2} variant="danger" onClick={confirmDelete} disabled={saving}>
              Excluir checklist
            </ActionButton>
          ) : null}
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function ScheduleChecklistCheckModal({
  item,
  checklist,
  checklistResults = [],
  saving,
  onClose,
  onSave,
  loadChecklistPhotos,
  onSaveChecklistPhotos,
}) {
  const savedCheckedIds = useMemo(() => checkedChecklistIds(checklistResults), [checklistResults]);
  const [checkedItemIds, setCheckedItemIds] = useState(() => new Set(savedCheckedIds));
  const [photosByItemId, setPhotosByItemId] = useState(() => new Map());
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [uploadingChecklistItemId, setUploadingChecklistItemId] = useState('');

  useEffect(() => {
    setCheckedItemIds(new Set(savedCheckedIds));
  }, [checklist?.id, savedCheckedIds]);

  useEffect(() => {
    let active = true;
    setPhotoError('');

    if (!checklist?.id || !item?.id || !loadChecklistPhotos) {
      setPhotosByItemId(new Map());
      return () => {
        active = false;
      };
    }

    setPhotosLoading(true);
    loadChecklistPhotos({ scheduleItemId: item.id, checklistId: checklist.id })
      .then((photos) => {
        if (!active) return;
        const next = new Map();
        (photos || []).forEach((photo) => {
          const current = next.get(photo.checklistItemId) || [];
          next.set(photo.checklistItemId, [...current, photo]);
        });
        setPhotosByItemId(next);
      })
      .catch((error) => {
        if (active) setPhotoError(error.message || 'Nao foi possivel carregar as fotos do checklist.');
      })
      .finally(() => {
        if (active) setPhotosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [checklist?.id, item?.id]);

  function toggleItem(checkItemId) {
    if (savedCheckedIds.has(checkItemId)) return;
    setCheckedItemIds((current) => {
      const next = new Set(current);
      if (next.has(checkItemId)) {
        next.delete(checkItemId);
      } else {
        next.add(checkItemId);
      }
      return next;
    });
  }

  async function addChecklistPhotos(checkItem, fileList) {
    if (!checklist?.id || !item?.id || !onSaveChecklistPhotos) return;
    const existingPhotos = photosByItemId.get(checkItem.id) || [];
    const remainingSlots = MAX_CHECKLIST_PHOTOS_PER_ITEM - existingPhotos.length;
    const selectedFiles = Array.from(fileList || []).slice(0, Math.max(0, remainingSlots));

    if (remainingSlots <= 0) {
      setPhotoError(`Limite de ${MAX_CHECKLIST_PHOTOS_PER_ITEM} fotos atingido para este item.`);
      return;
    }
    if (!selectedFiles.length) return;

    setPhotoError('');
    setUploadingChecklistItemId(checkItem.id);
    try {
      const savedPhotos = await onSaveChecklistPhotos({
        scheduleItemId: item.id,
        checklistId: checklist.id,
        checklistItemId: checkItem.id,
        files: selectedFiles,
      });
      if (!savedPhotos?.length) return;
      setPhotosByItemId((current) => {
        const next = new Map(current);
        next.set(checkItem.id, [...savedPhotos, ...(next.get(checkItem.id) || [])]);
        return next;
      });
    } catch (error) {
      setPhotoError(error.message || 'Nao foi possivel salvar as fotos do checklist.');
    } finally {
      setUploadingChecklistItemId('');
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!checklist?.id) return;
    const resultByItemId = new Map((checklistResults || []).map((result) => [result.checklistItemId, result]));
    onSave({
      scheduleItemId: item.id,
      checklistId: checklist.id,
      results: (checklist.itens || []).map((checkItem) => {
        const previous = resultByItemId.get(checkItem.id);
        const checked = checkedItemIds.has(checkItem.id);
        return {
          id: previous?.id || '',
          scheduleItemId: item.id,
          scheduleLogId: '',
          checklistId: checklist.id,
          checklistItemId: checkItem.id,
          checked,
          checkedBy: previous?.checkedBy || '',
          checkedAt: previous?.checkedAt || '',
        };
      }),
    });
  }

  const items = checklist?.itens || [];
  const totalChecked = items.filter((checkItem) => checkedItemIds.has(checkItem.id)).length;

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal checklist-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Conferir checklist</span>
            <h2>{item.nome}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        {checklist ? (
          <>
            <section className="checklist-check-summary">
              <strong>{checklist.titulo || 'Checklist tecnico'}</strong>
              {checklist.procedimento ? <p>{checklist.procedimento}</p> : null}
              <span>{totalChecked} de {items.length} itens conferidos</span>
            </section>
            <section className="checklist-run-list">
              {items.map((checkItem) => {
                const saved = savedCheckedIds.has(checkItem.id);
                const itemPhotos = photosByItemId.get(checkItem.id) || [];
                const photoLimitReached = itemPhotos.length >= MAX_CHECKLIST_PHOTOS_PER_ITEM;
                const uploading = uploadingChecklistItemId === checkItem.id;
                return (
                  <article className={`checklist-run-item ${saved ? 'locked' : ''}`} key={checkItem.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checkedItemIds.has(checkItem.id)}
                        disabled={saving || saved}
                        onChange={() => toggleItem(checkItem.id)}
                      />
                      <span>{checkItem.texto}</span>
                      {saved ? <small>Ja conferido</small> : null}
                    </label>
                    <div className="checklist-item-photos">
                      {itemPhotos.length ? (
                        <div className="checklist-photo-strip" aria-label={`Fotos do item ${checkItem.texto}`}>
                          {itemPhotos.map((photo) => {
                            const photoUrl = getBestPhotoUrl(photo);
                            return (
                              <span className="checklist-photo-thumb" key={photo.id}>
                                {photoUrl ? <img src={photoUrl} alt={`Foto do checklist ${checkItem.texto}`} /> : <Camera size={18} aria-hidden="true" />}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="checklist-photo-actions">
                        <label className={`checklist-photo-button ${photoLimitReached ? 'disabled' : ''}`}>
                          <Camera size={16} aria-hidden="true" />
                          <span>{uploading ? 'Enviando...' : 'Foto'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={saving || uploading || photoLimitReached}
                            onChange={(event) => {
                              addChecklistPhotos(checkItem, event.target.files);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <small>{itemPhotos.length}/{MAX_CHECKLIST_PHOTOS_PER_ITEM} fotos</small>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
            {photosLoading ? <p className="checklist-photo-message">Carregando fotos do checklist...</p> : null}
            {photoError ? <p className="auth-message error">{photoError}</p> : null}
            <p className="checklist-once-note">Itens ja conferidos ficam bloqueados para evitar marcacao duplicada.</p>
          </>
        ) : (
          <EmptyNotice Icon={ClipboardCheck} title="Checklist nao cadastrado" text="Adicione o checklist deste subitem antes de conferir." />
        )}
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving || !checklist || !items.length}>
            {saving ? 'Salvando...' : 'Salvar conferencia'}
          </ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function ScheduleGanttModal({ items, onClose }) {
  const [labelWidth, setLabelWidth] = useState(() => (window.innerWidth <= 760 ? 210 : 270));
  const [timelineWidth, setTimelineWidth] = useState(900);
  const resizeRef = useRef(null);
  const stages = items
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const rows = stages.flatMap((stage) => [
    { ...stage, depth: 0 },
    ...items
      .filter((item) => item.parentId === stage.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({ ...item, depth: 1 })),
  ]);
  const datedRows = rows.filter((item) => ganttStartDate(item) && ganttEndDate(item));
  const undatedRows = rows.filter((item) => !ganttStartDate(item) || !ganttEndDate(item));
  const timeline = buildGanttTimeline(datedRows);
  const stateCounts = rows.reduce((counts, item) => {
    const state = ganttStageState(item);
    counts[state] += 1;
    return counts;
  }, { completed: 0, progressing: 0, late: 0, planned: 0 });

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    function resizeColumn(event) {
      const resize = resizeRef.current;
      if (!resize) return;
      const width = resize.startWidth + event.clientX - resize.startX;
      if (resize.column === 'label') {
        setLabelWidth(Math.min(520, Math.max(180, width)));
      } else {
        setTimelineWidth(Math.min(2600, Math.max(540, width)));
      }
    }

    function stopResize() {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.classList.remove('gantt-resizing');
    }

    window.addEventListener('pointermove', resizeColumn);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    window.addEventListener('mousemove', resizeColumn);
    window.addEventListener('mouseup', stopResize);
    return () => {
      window.removeEventListener('pointermove', resizeColumn);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
      window.removeEventListener('mousemove', resizeColumn);
      window.removeEventListener('mouseup', stopResize);
      document.body.classList.remove('gantt-resizing');
    };
  }, []);

  function startResize(column, event) {
    event.preventDefault();
    resizeRef.current = {
      column,
      startX: event.clientX,
      startWidth: column === 'label' ? labelWidth : timelineWidth,
    };
    document.body.classList.add('gantt-resizing');
  }

  function resizeWithKeyboard(column, event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const step = event.shiftKey ? 60 : 20;
    if (column === 'label') {
      setLabelWidth((width) => Math.min(520, Math.max(180, width + direction * step)));
    } else {
      setTimelineWidth((width) => Math.min(2600, Math.max(540, width + direction * step)));
    }
  }

  return (
    <div
      className="modal-backdrop gantt-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="gantt-modal" role="dialog" aria-modal="true" aria-labelledby="gantt-title">
        <header className="gantt-head">
          <div>
            <span>Visao geral da obra</span>
            <h2 id="gantt-title">Cronograma Gantt</h2>
            <p>Planejado, executado, em andamento e atrasos das etapas principais.</p>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </header>

        <div className="gantt-legend" aria-label="Legenda do cronograma">
          <span><i className="completed" /> Concluido <strong>{stateCounts.completed}</strong></span>
          <span><i className="progressing" /> Em andamento <strong>{stateCounts.progressing}</strong></span>
          <span><i className="late" /> Atrasado <strong>{stateCounts.late}</strong></span>
          <span><i className="planned" /> Nao iniciado <strong>{stateCounts.planned}</strong></span>
          <span><i className="baseline" /> Periodo previsto</span>
        </div>

        {timeline ? (
          <div className="gantt-scroll">
            <div className="gantt-resize-help">
              <span>Arraste os divisores azuis para ajustar a coluna de etapas.</span>
              <label>
                Largura das datas
                <input
                  type="range"
                  min="540"
                  max="2600"
                  step="20"
                  value={timelineWidth}
                  aria-label="Ajustar largura das colunas de datas"
                  onChange={(event) => setTimelineWidth(Number(event.target.value))}
                />
              </label>
            </div>
            <div
              className="gantt-chart"
              style={{
                gridTemplateColumns: `${labelWidth}px minmax(${timelineWidth}px, 1fr)`,
                minWidth: `${labelWidth + timelineWidth}px`,
              }}
            >
              <div className="gantt-axis-label">
                Etapa
                <button
                  className="gantt-column-resizer gantt-label-resizer"
                  type="button"
                  role="separator"
                  aria-label="Redimensionar coluna de etapas"
                  aria-orientation="vertical"
                  aria-valuemin="180"
                  aria-valuemax="520"
                  aria-valuenow={Math.round(labelWidth)}
                  title="Arraste para ajustar a coluna de etapas"
                  onPointerDown={(event) => startResize('label', event)}
                  onMouseDown={(event) => startResize('label', event)}
                  onKeyDown={(event) => resizeWithKeyboard('label', event)}
                />
              </div>
              <div className="gantt-axis">
                {timeline.markers.map((marker) => (
                  <span key={marker.key} style={{ left: `${marker.left}%` }}>{marker.label}</span>
                ))}
                {timeline.todayLeft !== null ? (
                  <i className="gantt-today-line" style={{ left: `${timeline.todayLeft}%` }}>
                    <span>Hoje</span>
                  </i>
                ) : null}
                <button
                  className="gantt-column-resizer gantt-timeline-resizer"
                  type="button"
                  role="separator"
                  aria-label="Redimensionar colunas de datas"
                  aria-orientation="vertical"
                  aria-valuemin="540"
                  aria-valuemax="2600"
                  aria-valuenow={Math.round(timelineWidth)}
                  title="Arraste para aumentar ou diminuir as colunas de datas"
                  onPointerDown={(event) => startResize('timeline', event)}
                  onMouseDown={(event) => startResize('timeline', event)}
                  onKeyDown={(event) => resizeWithKeyboard('timeline', event)}
                />
              </div>

              {rows.map((item) => {
                const hasDates = Boolean(ganttStartDate(item) && ganttEndDate(item));
                const placement = hasDates ? ganttPlacement(item, timeline) : null;
                const state = ganttStageState(item);
                const progressValue = ganttProgressValue(item);
                return (
                  <React.Fragment key={item.id}>
                    <div className={`gantt-row-label ${item.depth ? 'child' : 'stage'}`}>
                      <strong>{item.nome}</strong>
                      <span>{item.depth ? 'Subitem' : 'Etapa'} - {ganttStateLabel(state)} - {progressValue}%</span>
                    </div>
                    <div className={`gantt-track ${item.depth ? 'child' : 'stage'} ${hasDates ? '' : 'undated'}`}>
                      {hasDates ? (
                        <>
                          <span
                            className="gantt-plan-bar"
                            style={{ left: `${placement.left}%`, width: `${placement.width}%` }}
                            title={`Previsto: ${scheduleDateLabel(item.inicioPrevisto)} a ${scheduleDateLabel(item.fimPrevisto)}`}
                          />
                          <span
                            className={`gantt-progress-bar ${state}`}
                            style={{ left: `${placement.left}%`, width: `${placement.progressWidth}%` }}
                            title={`${ganttStateLabel(state)}: ${progressValue}%`}
                          >
                            {placement.progressWidth >= 9 ? `${progressValue}%` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="gantt-missing-dates">Defina inicio e conclusao no cronograma</span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyNotice Icon={CalendarDays} title="Datas ainda nao informadas" text="Edite as etapas e preencha inicio e fim previstos para montar o grafico." />
        )}

        {undatedRows.length ? <p className="gantt-undated-note">{undatedRows.length} itens aparecem sem barra porque ainda nao possuem periodo previsto.</p> : null}
      </section>
    </div>
  );
}

function buildGanttTimeline(items) {
  const dates = items.flatMap((item) => [ganttStartDate(item), ganttEndDate(item)]).filter(Boolean);
  if (!dates.length) return null;

  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);
  const totalDays = Math.max(1, daysBetween(minDate, maxDate));
  const markers = [];
  const markerStep = totalDays <= 31 ? 3 : totalDays <= 90 ? 7 : totalDays <= 180 ? 14 : 30;
  const cursor = new Date(minDate);

  while (cursor <= maxDate) {
    markers.push({
      key: cursor.toISOString(),
      label: formatDayMonth(cursor),
      left: (daysBetween(minDate, cursor) / totalDays) * 100,
    });
    cursor.setDate(cursor.getDate() + markerStep);
  }
  if (markers.at(-1)?.left < 96) {
    markers.push({
      key: `end-${maxDate.toISOString()}`,
      label: formatDayMonth(maxDate),
      left: 100,
    });
  }

  const today = parseScheduleDate(new Date().toISOString().slice(0, 10));
  const todayLeft = today >= minDate && today <= maxDate
    ? (daysBetween(minDate, today) / totalDays) * 100
    : null;
  return { minDate, maxDate, totalDays, markers, todayLeft };
}

function formatDayMonth(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function ganttPlacement(item, timeline) {
  const start = ganttStartDate(item);
  const end = ganttEndDate(item);
  const left = (daysBetween(timeline.minDate, start) / timeline.totalDays) * 100;
  const width = Math.max(1.2, ((daysBetween(start, end) + 1) / timeline.totalDays) * 100);
  const progress = ganttProgressValue(item);
  return {
    left,
    width,
    progressWidth: Math.max(progress > 0 ? 0.8 : 0, width * (progress / 100)),
  };
}

function ganttProgressValue(item) {
  return item.status === 'Concluida'
    ? 100
    : Math.min(100, Math.max(0, Number(item.percentual) || 0));
}

function ganttStageState(item) {
  const percentual = Math.min(100, Math.max(0, Number(item.percentual) || 0));
  if (item.status === 'Concluida' || percentual >= 100) return 'completed';
  const plannedEnd = parseScheduleDate(item.fimPrevisto);
  const today = parseScheduleDate(new Date().toISOString().slice(0, 10));
  if (plannedEnd && plannedEnd < today) return 'late';
  if (percentual > 0 || item.status === 'Em andamento' || item.inicioReal) return 'progressing';
  return 'planned';
}

function ganttStateLabel(state) {
  return {
    completed: 'Concluido',
    progressing: 'Em andamento',
    late: 'Atrasado',
    planned: 'Nao iniciado',
  }[state];
}

function ganttStartDate(item) {
  return parseScheduleDate(item.inicioPrevisto || item.inicioReal);
}

function ganttEndDate(item) {
  return parseScheduleDate(item.fimPrevisto || item.fimReal || item.inicioPrevisto || item.inicioReal);
}

function parseScheduleDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function calculateScheduleDurationDays(items) {
  const dates = items
    .flatMap((item) => [parseScheduleDate(item.inicioPrevisto), parseScheduleDate(item.fimPrevisto)])
    .filter(Boolean);

  if (!dates.length) return 0;
  const start = new Date(Math.min(...dates.map((date) => date.getTime())));
  const end = new Date(Math.max(...dates.map((date) => date.getTime())));
  return Math.max(1, daysBetween(start, end) + 1);
}

function calculateScheduleRemainingDays(items) {
  const deadlines = items
    .map((item) => parseScheduleDate(item.fimPrevisto || item.inicioPrevisto))
    .filter(Boolean);

  if (!deadlines.length) return 0;
  const deadline = new Date(Math.max(...deadlines.map((date) => date.getTime())));
  const todayDate = parseScheduleDate(todayIso());
  if (!todayDate) return 0;
  return Math.max(0, daysBetween(todayDate, deadline) + 1);
}

function ScheduleQuickDates({ item, saving, onSave }) {
  const [inicioPrevisto, setInicioPrevisto] = useState(item.inicioPrevisto || '');
  const [fimPrevisto, setFimPrevisto] = useState(item.fimPrevisto || '');
  const [message, setMessage] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);
  const pendingPatchRef = useRef(null);
  const savingRef = useRef(false);

  useEffect(() => {
    setInicioPrevisto(item.inicioPrevisto || '');
    setFimPrevisto(item.fimPrevisto || '');
    setMessage('');
    pendingPatchRef.current = null;
  }, [item.id, item.inicioPrevisto, item.fimPrevisto]);

  useEffect(() => {
    if (!saving && pendingPatchRef.current) void flushPending();
  }, [saving]);

  function queueSave(nextInicioPrevisto, nextFimPrevisto) {
    if (nextInicioPrevisto && nextFimPrevisto && nextFimPrevisto < nextInicioPrevisto) {
      setMessage('A conclusao deve ser igual ou posterior ao inicio.');
      return;
    }
    pendingPatchRef.current = {
      inicioPrevisto: nextInicioPrevisto,
      fimPrevisto: nextFimPrevisto,
    };
    setMessage('');
    void flushPending();
  }

  async function flushPending() {
    if (saving || savingRef.current || !pendingPatchRef.current) return;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = null;
    savingRef.current = true;
    setAutoSaving(true);
    setMessage('Salvando...');
    const saved = await onSave(item.id, patch);
    savingRef.current = false;
    setAutoSaving(false);
    if (saved) {
      setMessage('Salvo automaticamente.');
    } else if (!pendingPatchRef.current) {
      setMessage('Nao foi possivel salvar.');
    }
    if (pendingPatchRef.current) void flushPending();
  }

  function changeInicioPrevisto(event) {
    const nextInicioPrevisto = event.target.value;
    setInicioPrevisto(nextInicioPrevisto);
    queueSave(nextInicioPrevisto, fimPrevisto);
  }

  function changeFimPrevisto(event) {
    const nextFimPrevisto = event.target.value;
    setFimPrevisto(nextFimPrevisto);
    queueSave(inicioPrevisto, nextFimPrevisto);
  }

  return (
    <div className="schedule-quick-dates">
      <label>
        <span>Inicio previsto</span>
        <input
          type="date"
          value={inicioPrevisto}
          max={fimPrevisto || undefined}
          onChange={changeInicioPrevisto}
        />
      </label>
      <label>
        <span>Conclusao prevista</span>
        <input
          type="date"
          value={fimPrevisto}
          min={inicioPrevisto || undefined}
          onChange={changeFimPrevisto}
        />
      </label>
      {message ? <small className={message === 'Salvo automaticamente.' || autoSaving ? 'success' : 'error'}>{message}</small> : null}
    </div>
  );
}

function ScheduleDates({ item }) {
  return (
    <div className="schedule-dates">
      <span>Inicio previsto: <strong>{scheduleDateLabel(item.inicioPrevisto)}</strong></span>
      <span>Termino previsto: <strong>{scheduleDateLabel(item.fimPrevisto)}</strong></span>
    </div>
  );
}

function ScheduleLogSummary({ log, saving, onEdit }) {
  return (
    <article className="schedule-log-summary">
      <strong>{scheduleDateLabel(log.visitDate)}</strong>
      <span>{log.observacoes || log.checklist || 'Registro diario da obra'}</span>
      <button type="button" onClick={onEdit} disabled={saving}>
        <Pencil size={15} aria-hidden="true" /> Editar
      </button>
      {log.pedidoMaterial ? <small>Material: {log.pedidoMaterial}</small> : null}
      {log.ferramentas ? <small>Ferramentas: {log.ferramentas}</small> : null}
      {log.maoObra ? <small>Mao de obra: {log.maoObra}</small> : null}
    </article>
  );
}

function ScheduleItemModal({ item, serviceCategories = [], saving, onClose, onSave }) {
  const isStage = !item.parentId;
  const categoryOptions = serviceCategories.filter((category) => category.ativo !== false || category.id === item.categoriaServicoId);

  function submit(event) {
    event.preventDefault();
    const values = {
      ...item,
      ...Object.fromEntries(new FormData(event.currentTarget).entries()),
    };
    onSave(values);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="issue-modal schedule-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>{item.parentId ? 'Subitem da etapa' : 'Etapa da obra'}</span>
            <h2>{item.id ? 'Editar cronograma' : 'Adicionar ao cronograma'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <input type="hidden" name="id" defaultValue={item.id || ''} />
        <input type="hidden" name="parentId" defaultValue={item.parentId || ''} />
        <input type="hidden" name="itemType" defaultValue={item.parentId ? 'task' : 'stage'} />
        <div className="form-grid modal-fields">
          <Field label="Nome" name="nome" value={item.nome || ''} wide required />
          {isStage ? (
            <p className="schedule-stage-derived-note">As datas, o percentual e o status desta etapa sao calculados automaticamente pelos subitens.</p>
          ) : (
            <>
              <Field label="Inicio previsto" name="inicioPrevisto" type="date" value={item.inicioPrevisto || ''} />
              <Field label="Fim previsto" name="fimPrevisto" type="date" value={item.fimPrevisto || ''} />
              <Field label="Inicio real" name="inicioReal" type="date" value={item.inicioReal || ''} />
              <Field label="Fim real" name="fimReal" type="date" value={item.fimReal || ''} />
              <label className="field">
                <span>Categoria do servico</span>
                <select name="categoriaServicoId" defaultValue={item.categoriaServicoId || ''}>
                  <option value="">Sem categoria</option>
                  {categoryOptions.map((category) => (
                    <option value={category.id} key={category.id}>{category.nome}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Valor mao de obra (R$)</span>
                <input
                  type="number"
                  name="valorMaoObra"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={item.valorMaoObra ?? 0}
                />
              </label>
            </>
          )}
        </div>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function ScheduleContractorModal({ item, contractors = [], assignment, saving, onClose, onSave }) {
  const contractorOptions = contractors.filter((contractor) => (
    contractor.ativo !== false || contractor.id === assignment?.contractorId
  ));

  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    onSave({
      ...assignment,
      ...values,
      id: assignment?.id || '',
      scheduleItemId: item.id,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="issue-modal schedule-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Empreiteiro do subitem</span>
            <h2>{item.nome}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        {!contractorOptions.length ? (
          <section className="warning-strip">
            <AlertTriangle size={20} aria-hidden="true" />
            <span>Cadastre um empreiteiro antes de vincular ao subitem.</span>
          </section>
        ) : null}
        <input type="hidden" name="scheduleItemId" value={item.id} readOnly />
        <div className="form-grid modal-fields">
          <label className="field wide">
            <span>Empreiteiro</span>
            <select name="contractorId" defaultValue={assignment?.contractorId || ''}>
              <option value="">Sem empreiteiro vinculado</option>
              {contractorOptions.map((contractor) => (
                <option value={contractor.id} key={contractor.id}>{contractor.nome}</option>
              ))}
            </select>
          </label>
          <Field label="Inicio do servico" name="dataInicio" type="date" value={assignment?.dataInicio || item.inicioPrevisto || ''} />
          <Field label="Fim do servico" name="dataFim" type="date" value={assignment?.dataFim || item.fimPrevisto || ''} />
          <label className="field">
            <span>Valor contratado (R$)</span>
            <input
              type="number"
              name="valorContratado"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={assignment?.valorContratado ?? item.valorMaoObra ?? 0}
            />
          </label>
          <Field label="Forma de pagamento" name="formaPagamento" value={assignment?.formaPagamento || ''} />
          <TextAreaField label="Observacoes" name="observacoes" value={assignment?.observacoes || ''} />
        </div>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar vinculo'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function ScheduleLogModal({ item, log, saving, onClose, onSave, onDelete }) {
  const editing = Boolean(log?.id);
  const formKey = log?.id || `new-${item.id}`;
  const [status, setStatus] = useState(item.status || 'Nao iniciado');
  const [percentual, setPercentual] = useState(String(item.percentual ?? 0));
  const [formError, setFormError] = useState('');

  function changeStatus(event) {
    const nextStatus = event.target.value;
    setStatus(nextStatus);
    if (nextStatus === 'Concluida') {
      setPercentual('100');
      setFormError('');
      return;
    }
    if (nextStatus === 'Em andamento' && Number(percentual || 0) <= 0) {
      setFormError('Informe um percentual maior que zero para status Em andamento.');
      return;
    }
    setFormError('');
  }

  function changePercentual(event) {
    const nextPercentual = event.target.value;
    setPercentual(nextPercentual);
    if (status === 'Em andamento' && Number(nextPercentual || 0) <= 0) {
      setFormError('Informe um percentual maior que zero para status Em andamento.');
      return;
    }
    setFormError('');
  }

  function submit(event) {
    event.preventDefault();
    const nextPercentual = status === 'Concluida' ? 100 : Number(percentual || 0);
    if (status === 'Em andamento' && nextPercentual <= 0) {
      setFormError('Informe um percentual maior que zero para status Em andamento.');
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const submitter = event.nativeEvent.submitter;
    onSave({
      ...values,
      id: log?.id || '',
      scheduleItemId: item.id,
      status,
      percentual: nextPercentual,
    }, submitter?.dataset?.action === 'photo');
  }

  function confirmDelete() {
    const confirmed = window.confirm('Excluir este registro do diario? Esta acao nao pode ser desfeita.');
    if (confirmed && onDelete) onDelete();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form key={formKey} className="issue-modal schedule-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Diario da obra</span>
            <h2>{editing ? 'Editar registro' : item.nome}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <Field label="Data da visita" name="visitDate" type="date" value={log?.visitDate || new Date().toISOString().slice(0, 10)} required />
          <label className="field">
            <span>Status do subitem</span>
            <select name="status" value={status} onChange={changeStatus}>
              {['Nao iniciado', 'Em andamento', 'Atencao', 'Concluida'].map((statusOption) => <option key={statusOption}>{statusOption}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Percentual executado</span>
            <input
              type="number"
              name="percentual"
              min="0"
              max="100"
              step="1"
              value={percentual}
              onChange={changePercentual}
              readOnly={status === 'Concluida'}
            />
          </label>
          <TextAreaField label="Observacoes" name="observacoes" value={log?.observacoes || ''} />
          <TextAreaField label="Pedido de material" name="pedidoMaterial" value={log?.pedidoMaterial || ''} />
          <TextAreaField label="Ferramentas necessarias ou usadas" name="ferramentas" value={log?.ferramentas || ''} />
          <TextAreaField label="Mao de obra presente" name="maoObra" value={log?.maoObra || ''} />
          <TextAreaField label="Observacao sobre fotos" name="fotosObservacao" value={log?.fotosObservacao || ''} />
        </div>
        {formError ? <p className="auth-message error">{formError}</p> : null}
        <div className="form-actions">
          <button className="action-button primary" type="submit" data-action="save" disabled={saving}><Save size={20} /><span>{editing ? 'Salvar alteracoes' : 'Salvar registro'}</span></button>
          <button className="action-button secondary" type="submit" data-action="photo" disabled={saving}><Camera size={20} /><span>{editing ? 'Salvar e adicionar fotos' : 'Salvar e adicionar fotos'}</span></button>
          {editing ? <ActionButton Icon={Trash2} variant="danger" onClick={confirmDelete} disabled={saving}>Excluir</ActionButton> : null}
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function scheduleDateLabel(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function Issues({ issues, addIssue, resolveIssue, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Pendencias" title="Pendencias da obra" subtitle="Responsaveis, prazos, fotos e normas." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={Plus} onClick={() => addIssue('Geral')}>Nova pendencia</ActionButton>
      </PageTitle>
      <section className="issue-list">
        {issues.map((item) => (
          <article className="issue-card" key={item.id}>
            <div className="issue-icon"><AlertTriangle size={24} aria-hidden="true" /></div>
            <div>
              <h2>{item.descricao}</h2>
              <p>{item.etapa} - {item.responsavel}</p>
              <span>Prazo: {item.prazo}</span>
              <small>{item.norma}</small>
            </div>
            <StatusPill status={item.status} />
          </article>
        ))}
      </section>
      <div className="form-actions">
        <ActionButton Icon={Camera} onClick={() => setScreen('photos')}>Adicionar foto de correcao</ActionButton>
        <ActionButton Icon={CheckCircle2} variant="secondary" onClick={resolveIssue}>Marcar como resolvida</ActionButton>
      </div>
    </>
  );
}

function IssueModal({ etapa, stages, activeWork, saving, error, onClose, onSave }) {
  const stageOptions = [...new Set(['Geral', ...(stages || []).map((stage) => stage.nome).filter(Boolean)])];

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    onSave({
      descricao: form.elements.descricao.value.trim(),
      etapa: form.elements.etapa.value,
      responsavel: form.elements.responsavel.value.trim(),
      prazo: form.elements.prazo.value,
      norma: form.elements.norma.value.trim(),
      status: form.elements.status.value,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal issue-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Pendencia</span>
            <h2>Cadastrar pendencia</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <label className="field wide">
            <span>Descricao</span>
            <textarea name="descricao" rows={4} required />
          </label>
          <label className="field">
            <span>Etapa</span>
            <select name="etapa" defaultValue={etapa || 'Geral'}>
              {stageOptions.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Responsavel</span>
            <input name="responsavel" defaultValue={activeWork?.responsavel || ''} required />
          </label>
          <label className="field">
            <span>Prazo</span>
            <input name="prazo" type="date" required />
          </label>
          <label className="field">
            <span>Norma</span>
            <input name="norma" defaultValue="Checklist interno" />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue="Aberta">
              {['Aberta', 'Em andamento', 'Resolvida'].map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="auth-message error">{error}</p> : null}
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar pendencia'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function Users({ users, currentUser, loading, error, message, saving, canManage, onRefresh, onSave, onToggle, setScreen }) {
  const [query, setQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const normalizedQuery = normalizeSearch(query);
  const filteredUsers = normalizedQuery
    ? users.filter((user) => normalizeSearch(`${user.nome} ${user.email} ${user.telefone} ${user.cpf} ${user.professionalRegistry} ${user.cidade} ${roleLabel(user.role)}`).includes(normalizedQuery))
    : users;

  function openNewUser() {
    if (!canManage) return;
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEditUser(user) {
    if (!canManage) return;
    setEditingUser(user);
    setModalOpen(true);
  }

  async function saveUser(values) {
    const saved = await onSave(values);
    if (saved) {
      setModalOpen(false);
      setEditingUser(null);
    }
  }

  return (
    <>
      <PageTitle eyebrow="Usuarios" title="Acessos do Obras" subtitle="Equipe vinculada a conta comercial." onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={UserPlus} onClick={openNewUser} disabled={!canManage || saving}>Novo usuario</ActionButton>
      </PageTitle>
      {!canManage ? (
        <section className="warning-strip">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>Seu perfil atual permite visualizar usuarios, mas nao gerenciar acessos.</span>
        </section>
      ) : null}
      {error ? (
        <section className="warning-strip">
          <AlertTriangle size={22} aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}
      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      <div className="toolbar">
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <input value={query} placeholder="Buscar usuario" aria-label="Buscar usuario" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" onClick={onRefresh} disabled={loading}>
          <Database size={18} aria-hidden="true" /> {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
      {filteredUsers.length ? (
        <section className="user-grid">
          {filteredUsers.map((user) => {
            const isCurrent = currentUser?.id === user.id || Boolean(user.authUserId && currentUser?.authUserId === user.authUserId);
            return (
              <article className="user-card" key={user.id}>
                <div className="user-card-head">
                  <div className="user-avatar">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt={`Foto de ${user.nome}`} /> : <UserRound size={24} aria-hidden="true" />}
                  </div>
                  <StatusPill status={user.active ? 'Ativo' : 'Inativo'} />
                </div>
                <strong>{user.nome}</strong>
                <span>{user.email}</span>
                <span>{user.telefone || 'Sem telefone'}</span>
                <div className="user-meta">
                  <small>{roleLabel(user.role)}</small>
                  {user.cpf ? <small>CPF {user.cpf}</small> : null}
                  {user.professionalRegistry ? <small>{user.role === 'arquiteto' ? 'CAU' : 'CREA'} {user.professionalRegistry}</small> : null}
                  <small>{user.cidade}</small>
                  <small>{user.authUserId ? 'Login vinculado' : 'Aguardando login'}</small>
                  <small>{user.loginEnabled ? 'Acesso Obras' : 'Sem login Obras'}</small>
                </div>
                <div className="button-row">
                  <button type="button" onClick={() => openEditUser(user)} disabled={!canManage || saving}>
                    <Pencil size={18} aria-hidden="true" /> Editar
                  </button>
                  <button type="button" onClick={() => onToggle(user)} disabled={!canManage || saving || isCurrent}>
                    {user.active ? <XCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                    {user.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyNotice Icon={UsersRound} title="Nenhum usuario encontrado" text="Ajuste a busca ou cadastre um novo acesso do Obras." />
      )}
      {modalOpen ? (
        <UserModal
          user={editingUser}
          currentUser={currentUser}
          saving={saving}
          onClose={() => {
            if (!saving) {
              setModalOpen(false);
              setEditingUser(null);
            }
          }}
          onSave={saveUser}
        />
      ) : null}
    </>
  );
}

function UserModal({ user, currentUser, saving, onClose, onSave }) {
  const defaultCityId = user?.cidadeId || currentUser?.cidadeId || cityCatalog[0].id;
  const [selectedRole, setSelectedRole] = useState(user?.role || 'operador');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '');
  const needsRegistry = ['engenheiro', 'arquiteto'].includes(selectedRole);
  const registryLabel = selectedRole === 'arquiteto' ? 'CAU' : 'CREA';

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function handleAvatarChange(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setAvatarPreview(user?.avatarUrl || '');
      return;
    }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const selectedCity = cityCatalog.find((city) => city.id === form.elements.cidadeId.value) || cityCatalog[0];
    const role = form.elements.role.value;
    onSave({
      id: user?.id,
      authUserId: user?.authUserId || '',
      accountId: user?.accountId || currentUser?.accountId || '',
      nome: form.elements.nome.value.trim(),
      email: form.elements.email.value.trim(),
      telefone: form.elements.telefone.value.trim(),
      cpf: form.elements.cpf.value.trim(),
      professionalRegistry: form.elements.professionalRegistry?.value.trim() || '',
      cidadeId: selectedCity.id,
      cidade: selectedCity.nome,
      role,
      active: form.elements.active.checked,
      loginEnabled: form.elements.loginEnabled.checked,
      password: form.elements.password?.value || '',
      avatarFile: form.elements.avatarFile?.files?.[0] || null,
      avatarStoragePath: user?.avatarStoragePath || '',
      avatarFileName: user?.avatarFileName || '',
      avatarMimeType: user?.avatarMimeType || '',
      avatarFileSize: user?.avatarFileSize || 0,
      avatarUrl: user?.avatarUrl || '',
      createdAt: user?.createdAt || '',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal user-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Usuario do Obras</span>
            <h2>{user ? 'Editar acesso' : 'Cadastrar acesso'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <label className="field user-avatar-field">
            <span>Foto do usuario</span>
            <div className="user-avatar-preview">
              {avatarPreview ? <img src={avatarPreview} alt="Previa da foto do usuario" /> : <UserRound size={34} aria-hidden="true" />}
            </div>
            <input type="file" name="avatarFile" accept="image/*" onChange={handleAvatarChange} />
            <small>Use uma foto de rosto. O app reduz o tamanho antes de salvar.</small>
          </label>
          <Field label="Nome" name="nome" value={user?.nome || ''} required />
          <Field label="E-mail" name="email" value={user?.email || ''} type="email" required />
          <Field label="Telefone" name="telefone" value={user?.telefone || ''} />
          <Field label="CPF" name="cpf" value={user?.cpf || ''} />
          <label className="field">
            <span>{user ? 'Nova senha' : 'Senha temporaria'}</span>
            <input type="password" name="password" autoComplete="new-password" placeholder={user ? 'Deixe em branco para manter' : 'Senha inicial do usuario'} />
            <small>{user ? 'Preencha somente se quiser alterar a senha.' : 'Usada para o primeiro acesso do usuario.'}</small>
          </label>
          <label className="field">
            <span>Cidade</span>
            <select name="cidadeId" defaultValue={defaultCityId}>
              {cityCatalog.map((city) => (
                <option value={city.id} key={city.id}>{city.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Perfil</span>
            <select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
              {obrasRoles.map((role) => (
                <option value={role.value} key={role.value}>{role.label}</option>
              ))}
            </select>
          </label>
          {needsRegistry ? <Field label={`Numero ${registryLabel}`} name="professionalRegistry" value={user?.professionalRegistry || ''} required /> : null}
          <label className="field check-field">
            <span>Status</span>
            <input type="checkbox" name="active" defaultChecked={user?.active !== false} />
            <small>Usuario ativo</small>
          </label>
          <label className="field check-field">
            <span>Acesso</span>
            <input type="checkbox" name="loginEnabled" defaultChecked={user?.loginEnabled !== false} />
            <small>Permitir login no Obras</small>
          </label>
        </div>
        <section className="detail-note user-note">
          <strong>Login</strong>
          <p>Apenas proprietarios e administradores podem cadastrar usuarios. A senha e enviada para o Supabase Auth, nao fica salva na tabela do Obras.</p>
        </section>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar usuario'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

const companyStatusOptions = ['Ativa', 'Suspensa', 'Cancelada'];

function Companies({
  accounts,
  plans,
  currentUser,
  platformAdmin,
  loading,
  saving,
  error,
  message,
  onRefresh,
  onSave,
  setScreen,
}) {
  const [query, setQuery] = useState('');
  const [editingCompany, setEditingCompany] = useState(null);
  const normalizedQuery = normalizeSearch(query);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const canManageOwnCompany = !supabaseConfigured || ['owner', 'admin'].includes(currentUser?.role);
  const filteredAccounts = normalizedQuery
    ? accounts.filter((account) => [
        account.nome,
        account.documento,
        account.responsavel,
        account.email,
        account.telefone,
        account.cidade,
      ].some((value) => normalizeSearch(value).includes(normalizedQuery)))
    : accounts;

  function canEditCompany(company) {
    return !supabaseConfigured
      || platformAdmin
      || (canManageOwnCompany && company.id === currentUser?.accountId);
  }

  async function saveCompany(values) {
    const saved = await onSave(values);
    if (saved) setEditingCompany(null);
  }

  return (
    <>
      <PageTitle eyebrow="Empresas" title="Empresas cadastradas" subtitle={platformAdmin ? 'Contas comerciais ativas no sistema Obras.' : 'Dados comerciais da sua conta Obras.'} onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={Database} onClick={onRefresh} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </ActionButton>
      </PageTitle>
      {!platformAdmin ? (
        <section className="warning-strip">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>Voce esta vendo apenas a empresa vinculada ao seu login. Somente proprietarios e administradores podem alterar esses dados.</span>
        </section>
      ) : null}
      {error ? (
        <section className="warning-strip">
          <AlertTriangle size={22} aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}
      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      <div className="toolbar">
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <input value={query} placeholder="Buscar empresa" aria-label="Buscar empresa" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" onClick={onRefresh} disabled={loading}>
          <Database size={18} aria-hidden="true" /> {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
      {filteredAccounts.length ? (
        <section className="company-grid">
          {filteredAccounts.map((company) => {
            const plan = planById.get(company.plano);
            const editable = canEditCompany(company);
            return (
              <article className="company-card" key={company.id}>
                <div className="company-card-head">
                  <div className="company-logo">
                    {company.logoUrl ? <img src={company.logoUrl} alt={`Logo de ${company.nome}`} /> : <Landmark size={26} aria-hidden="true" />}
                  </div>
                  <StatusPill status={company.status || 'Ativa'} />
                </div>
                <strong>{company.nome}</strong>
                <span>{company.cidade || 'Cidade nao informada'}</span>
                <div className="company-meta">
                  {company.documento ? <small>CPF/CNPJ {company.documento}</small> : null}
                  {company.responsavel ? <small>{company.responsavel}</small> : null}
                  {company.email ? <small>{company.email}</small> : null}
                  {company.telefone ? <small>{company.telefone}</small> : null}
                  <small>{plan?.nome || company.plano || 'Plano nao informado'}</small>
                  <small>Conta {company.id}</small>
                </div>
                {company.endereco ? <p>{company.endereco}</p> : null}
                <div className="button-row">
                  <button type="button" onClick={() => setEditingCompany(company)} disabled={!editable || saving}>
                    <Pencil size={18} aria-hidden="true" /> Editar empresa
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyNotice Icon={Landmark} title="Nenhuma empresa encontrada" text="Atualize a tela ou ajuste a busca para localizar a empresa cadastrada." />
      )}
      {editingCompany ? (
        <CompanyModal
          company={editingCompany}
          plans={plans}
          platformAdmin={platformAdmin}
          saving={saving}
          onClose={() => {
            if (!saving) setEditingCompany(null);
          }}
          onSave={saveCompany}
        />
      ) : null}
    </>
  );
}

function CompanyModal({ company, plans, platformAdmin, saving, onClose, onSave }) {
  const [logoPreview, setLogoPreview] = useState(company?.logoUrl || '');
  const defaultCityId = company?.cidadeId || cityCatalog[0].id;
  const defaultPlan = company?.plano || plans[0]?.id || 'basico';
  const planOptions = plans.some((plan) => plan.id === defaultPlan)
    ? plans
    : [{ id: defaultPlan, nome: defaultPlan, active: true }, ...plans];

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function handleLogoChange(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setLogoPreview(company?.logoUrl || '');
      return;
    }
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  }

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const selectedCity = cityCatalog.find((city) => city.id === form.elements.cidadeId.value) || cityCatalog[0];
    onSave({
      id: company.id,
      nome: form.elements.nome.value.trim(),
      documento: form.elements.documento.value.trim(),
      responsavel: form.elements.responsavel.value.trim(),
      email: form.elements.email.value.trim(),
      telefone: form.elements.telefone.value.trim(),
      endereco: form.elements.endereco.value.trim(),
      cidadeId: selectedCity.id,
      cidade: selectedCity.nome,
      plano: platformAdmin ? form.elements.plano.value : company.plano,
      status: platformAdmin ? form.elements.status.value : company.status,
      logoFile: form.elements.logoFile?.files?.[0] || null,
      logoStoragePath: company.logoStoragePath || '',
      logoFileName: company.logoFileName || '',
      logoMimeType: company.logoMimeType || '',
      logoFileSize: company.logoFileSize || 0,
      logoUrl: company.logoUrl || '',
      createdAt: company.createdAt || '',
      updatedAt: company.updatedAt || '',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal user-modal company-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Empresa do Obras</span>
            <h2>Editar empresa</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <label className="field company-logo-field">
            <span>Logo da empresa</span>
            <div className="company-logo-preview">
              {logoPreview ? <img src={logoPreview} alt="Previa do logo da empresa" /> : <Landmark size={36} aria-hidden="true" />}
            </div>
            <input type="file" name="logoFile" accept="image/*" onChange={handleLogoChange} />
            <small>O app reduz a imagem antes de salvar.</small>
          </label>
          <Field label="Razao social / nome" name="nome" value={company.nome || ''} required />
          <Field label="CPF/CNPJ" name="documento" value={company.documento || ''} />
          <Field label="Responsavel" name="responsavel" value={company.responsavel || ''} />
          <Field label="E-mail" name="email" value={company.email || ''} type="email" />
          <Field label="Telefone" name="telefone" value={company.telefone || ''} />
          <Field label="Endereco" name="endereco" value={company.endereco || ''} wide />
          <label className="field">
            <span>Cidade</span>
            <select name="cidadeId" defaultValue={defaultCityId}>
              {cityCatalog.map((city) => (
                <option value={city.id} key={city.id}>{city.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Plano</span>
            <select name="plano" defaultValue={defaultPlan} disabled={!platformAdmin}>
              {planOptions.map((plan) => (
                <option value={plan.id} key={plan.id}>{plan.nome}</option>
              ))}
            </select>
            {!platformAdmin ? <small>Alteracao de plano e restrita ao administrador da plataforma.</small> : null}
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={company.status || 'Ativa'} disabled={!platformAdmin}>
              {companyStatusOptions.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
            {!platformAdmin ? <small>Status comercial e restrito ao administrador da plataforma.</small> : null}
          </label>
        </div>
        <section className="detail-note user-note">
          <strong>Permissao</strong>
          <p>Proprietarios e administradores editam os dados da propria empresa. Administradores da plataforma podem alterar plano e status.</p>
        </section>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar empresa'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function CommercialSubscriptions({
  plans,
  requests,
  subscriptions,
  currentUser,
  isPlatformAdmin: platformAdmin,
  loading,
  saving,
  error,
  message,
  onRefresh,
  onUpdateRequest,
  setScreen,
}) {
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const ownSubscription = subscriptions.find((subscription) => subscription.accountId === currentUser?.accountId);
  const openRequests = requests.filter((request) => ['novo', 'em_analise'].includes(request.status)).length;

  return (
    <>
      <PageTitle eyebrow="Assinaturas" title="Comercial do Obras" subtitle="Planos, solicitacoes e assinatura vinculada a cada conta." onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={Landmark} variant="ghost" onClick={() => setScreen('companies')}>
          Empresas
        </ActionButton>
        <ActionButton Icon={Database} onClick={onRefresh} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </ActionButton>
      </PageTitle>
      {!platformAdmin ? (
        <section className="warning-strip">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>Voce esta vendo apenas a assinatura da sua conta. O painel comercial completo e restrito aos administradores da plataforma.</span>
        </section>
      ) : null}
      {error ? (
        <section className="warning-strip">
          <AlertTriangle size={22} aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}
      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}

      <section className="commercial-summary">
        <article>
          <strong>{plans.length}</strong>
          <span>Planos</span>
        </article>
        <article>
          <strong>{platformAdmin ? openRequests : '-'}</strong>
          <span>Solicitacoes abertas</span>
        </article>
        <article>
          <strong>{subscriptions.length}</strong>
          <span>{platformAdmin ? 'Assinaturas' : 'Sua assinatura'}</span>
        </article>
      </section>

      <section className="plan-grid">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div className="plan-head">
              <span>{plan.tipo}</span>
              <StatusPill status={plan.active ? 'Ativo' : 'Inativo'} />
            </div>
            <strong>{plan.nome}</strong>
            <p>{plan.descricao}</p>
            <b>{formatCurrency(plan.valorMensal)} / mes</b>
            <small>{plan.limiteObras ? `${plan.limiteObras} obras` : 'Obras ilimitadas'} - {plan.limiteUsuarios ? `${plan.limiteUsuarios} usuarios` : 'Usuarios ilimitados'}</small>
            <ul>
              {(plan.recursos || []).slice(0, 5).map((recurso) => <li key={recurso}>{recurso}</li>)}
            </ul>
          </article>
        ))}
      </section>

      <section className="commercial-section">
        <div className="section-title-row">
          <div>
            <span>Conta atual</span>
            <h2>Assinatura da conta</h2>
          </div>
        </div>
        {ownSubscription ? (
          <article className="subscription-card">
            <div>
              <strong>{planById.get(ownSubscription.planId)?.nome || ownSubscription.planId || 'Plano nao informado'}</strong>
              <span>{formatCurrency(ownSubscription.valorMensal)} / mes</span>
            </div>
            <StatusPill status={subscriptionStatusLabel(ownSubscription.status)} />
            <small>Inicio: {formatDateTime(ownSubscription.startedAt)}</small>
            <small>Trial ate: {formatDateTime(ownSubscription.trialEndsAt)}</small>
            <small>{ownSubscription.limiteObras ? `${ownSubscription.limiteObras} obras` : 'Obras ilimitadas'} - {ownSubscription.limiteUsuarios ? `${ownSubscription.limiteUsuarios} usuarios` : 'Usuarios ilimitados'}</small>
            {ownSubscription.notes ? <p>{ownSubscription.notes}</p> : null}
          </article>
        ) : (
          <EmptyNotice Icon={Landmark} title="Sem assinatura vinculada" text="A conta atual ainda nao possui assinatura cadastrada." />
        )}
      </section>

      {platformAdmin ? (
        <section className="commercial-section">
          <div className="section-title-row">
            <div>
              <span>Solicitacoes</span>
              <h2>Cadastros recebidos</h2>
            </div>
          </div>
          {requests.length ? (
            <div className="request-grid">
              {requests.map((request) => {
                const plan = planById.get(request.planId);
                return (
                  <article className="request-card" key={request.id}>
                    <div className="request-card-head">
                      <div>
                        <strong>{request.empresa || request.nomeResponsavel}</strong>
                        <span>{request.nomeResponsavel}</span>
                      </div>
                      <StatusPill status={requestStatusLabel(request.status)} />
                    </div>
                    <div className="request-meta">
                      <span>{request.accountType}</span>
                      <span>{plan?.nome || 'Plano nao informado'}</span>
                      <span>{request.cidade}/{request.estado}</span>
                      <span>{formatDateTime(request.createdAt)}</span>
                    </div>
                    <p>{request.email} - {request.telefone}</p>
                    {request.documento ? <p>Documento: {request.documento}</p> : null}
                    {request.observacoes ? <p>{request.observacoes}</p> : null}
                    <div className="button-row">
                      {[
                        ['em_analise', 'Em analise'],
                        ['aprovado', 'Aprovar'],
                        ['rejeitado', 'Rejeitar'],
                        ['convertido', 'Convertido'],
                      ].map(([status, label]) => (
                        <button
                          type="button"
                          key={status}
                          onClick={() => onUpdateRequest(request, status)}
                          disabled={saving || request.status === status}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyNotice Icon={FileText} title="Nenhuma solicitacao" text="Quando alguem preencher o cadastro publico, a solicitacao aparecera aqui." />
          )}
        </section>
      ) : null}

      {platformAdmin ? (
        <section className="commercial-section">
          <div className="section-title-row">
            <div>
              <span>Contas</span>
              <h2>Assinaturas cadastradas</h2>
            </div>
          </div>
          {subscriptions.length ? (
            <div className="subscription-grid">
              {subscriptions.map((subscription) => (
                <article className="subscription-card" key={subscription.id}>
                  <div>
                    <strong>{planById.get(subscription.planId)?.nome || subscription.planId || 'Plano nao informado'}</strong>
                    <span>{formatCurrency(subscription.valorMensal)} / mes</span>
                  </div>
                  <StatusPill status={subscriptionStatusLabel(subscription.status)} />
                  <small>Conta: {subscription.accountId}</small>
                  <small>Periodo ate: {formatDateTime(subscription.currentPeriodEndsAt || subscription.trialEndsAt)}</small>
                  {subscription.notes ? <p>{subscription.notes}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyNotice Icon={Landmark} title="Nenhuma assinatura" text="As assinaturas das contas cadastradas aparecerao aqui." />
          )}
        </section>
      ) : null}
    </>
  );
}

function TableList({ title, eyebrow, subtitle, items, onPrimary, setScreen, primaryLabel = 'Atualizar', PrimaryIcon = Pencil }) {
  return (
    <>
      <PageTitle eyebrow={eyebrow} title={title} subtitle={subtitle} onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={PrimaryIcon} onClick={onPrimary}>{primaryLabel}</ActionButton>
      </PageTitle>
      <section className="table-cards">
        {items.map((item) => (
          <article className="table-card" key={item.id}>
            <div>
              <strong>{item.nome || item.descricao}</strong>
              <span>{item.etapa} {item.unidade ? `- ${item.unidade}` : ''}</span>
            </div>
            <StatusPill status={item.status} />
            {item.prevista ? <span>Previsto: {item.prevista}</span> : null}
            {item.usada !== undefined ? <span>Usado: {item.usada}</span> : null}
            {item.obrigatorio ? <span>{item.obrigatorio}</span> : null}
            {item.norma ? <span>{item.norma}</span> : null}
            <p>{item.observacao || item.responsavel || item.foto}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function Documents({ documents = [], saving, deletingId, error, onSave, onDelete, setScreen }) {
  const groupedDocuments = documentTypeOptions.map((type) => ({
    type,
    documents: documents.filter((document) => document.tipo === type),
  }));

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const file = form.elements.documentFile.files?.[0];
    onSave({ ...values, file }, () => form.reset());
  }

  return (
    <>
      <PageTitle eyebrow="Documentos" title="Documentos da obra" subtitle="Projetos, documentos de clientes e contratos vinculados a esta obra." onBack={() => setScreen('workPanel')} />
      <form className="document-upload-panel" onSubmit={submit}>
        <label className="field">
          <span>Tipo de documento</span>
          <select name="tipo" defaultValue={documentTypeOptions[0]}>
            {documentTypeOptions.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
        <Field label="Titulo" name="titulo" required />
        <label className="field wide">
          <span>Arquivo</span>
          <input name="documentFile" type="file" required />
        </label>
        <label className="field wide">
          <span>Descricao</span>
          <textarea name="descricao" placeholder="Observacao opcional sobre este documento." />
        </label>
        {error ? <p className="auth-message error">{error}</p> : null}
        <div className="form-actions">
          <ActionButton Icon={Upload} type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Adicionar documento'}</ActionButton>
        </div>
      </form>
      <section className="document-type-groups">
        {groupedDocuments.map((group) => (
          <article className="document-type-group" key={group.type}>
            <header>
              <h2>{group.type}</h2>
              <span>{group.documents.length} documento{group.documents.length === 1 ? '' : 's'}</span>
            </header>
            {group.documents.length ? (
              <div className="document-grid">
                {group.documents.map((document) => (
                  <article className="document-card" key={document.id}>
                    <FileText size={28} aria-hidden="true" />
                    <div>
                      <strong>{document.titulo}</strong>
                      <span>{document.fileName || 'Arquivo sem nome'} - {formatFileSize(document.fileSize)}</span>
                      {document.descricao ? <p>{document.descricao}</p> : null}
                      <small>{document.createdAt ? `Adicionado em ${formatDateTime(document.createdAt)}` : 'Data nao informada'}</small>
                    </div>
                    <div className="button-row">
                      {document.documentUrl ? (
                        <a className="button-link" href={document.documentUrl} target="_blank" rel="noreferrer">
                          <Eye size={17} aria-hidden="true" /> Abrir
                        </a>
                      ) : null}
                      <button type="button" className="danger" disabled={saving || deletingId === document.id} onClick={() => onDelete(document)}>
                        <Trash2 size={17} aria-hidden="true" /> {deletingId === document.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="document-empty">Nenhum documento nesta categoria.</p>
            )}
          </article>
        ))}
      </section>
    </>
  );
}

function uniqueTextLines(values) {
  return [...new Set(
    (values || [])
      .flatMap((value) => String(value || '').split(/\r?\n/))
      .map((line) => line.trim())
      .filter(Boolean),
  )].join('\n');
}

function scheduleItemLabel(itemsById, itemId) {
  const item = itemsById.get(itemId);
  if (!item) return 'Cronograma';
  const parent = item.parentId ? itemsById.get(item.parentId) : null;
  return parent ? `${parent.nome} / ${item.nome}` : item.nome;
}

function resolveSchedulePhotoContext(photo, itemsByName, itemsById) {
  const item = itemsByName.get(normalizeSearch(photo.etapa));
  if (!item) {
    return {
      stageName: photo.etapa || 'Sem etapa',
      subitemName: '',
    };
  }
  return getScheduleActivityContext(item.id, itemsById);
}

function groupRdoPhotosBySchedule(photos, scheduleItems) {
  const itemsById = new Map((scheduleItems || []).map((item) => [item.id, item]));
  const itemsByName = new Map();
  (scheduleItems || []).forEach((item) => {
    itemsByName.set(normalizeSearch(item.nome), item);
  });
  const groups = new Map();
  photos.forEach((photo) => {
    const context = resolveSchedulePhotoContext(photo, itemsByName, itemsById);
    const key = `${context.stageName}__${context.subitemName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        stageName: context.stageName,
        subitemName: context.subitemName,
        photos: [],
      });
    }
    groups.get(key).photos.push({ ...photo, ...context });
  });

  return [...groups.values()].sort((a, b) => {
    const stageCompare = a.stageName.localeCompare(b.stageName);
    return stageCompare || a.subitemName.localeCompare(b.subitemName);
  });
}

function buildRdoDraft({ data, activeWork, startDate, endDate, savedReport }) {
  const range = normalizeDateRange(startDate, endDate);
  const itemsById = new Map((data.scheduleItems || []).map((item) => [item.id, item]));
  const checklistById = new Map((data.checklist || []).map((entry) => [entry.id, entry]));
  const checklistItemsById = new Map();
  (data.checklist || []).forEach((checklist) => {
    (checklist.itens || []).forEach((item) => checklistItemsById.set(item.id, item));
  });
  const logs = (data.scheduleLogs || []).filter((log) => isDateInRange(log.visitDate, range.startDate, range.endDate));
  const photos = (data.photos || []).filter((photo) => isDateInRange(photo.data || photo.createdAt || photo.updatedAt, range.startDate, range.endDate));
  const openIssues = (data.issues || []).filter((issue) => (
    normalizeSearch(issue.status) !== 'resolvida'
    || isDateInRange(issue.updatedAt || issue.createdAt || issue.prazo, range.startDate, range.endDate)
  ));
  const checklistResults = (data.checklistResults || []).filter((result) => (
    result.checked && isDateInRange(result.checkedAt || result.updatedAt || result.createdAt, range.startDate, range.endDate)
  ));
  const serviceLines = logs.map((log) => {
    const label = scheduleItemLabel(itemsById, log.scheduleItemId);
    const description = log.observacoes || log.checklist || 'Registro diario da obra';
    return `${formatDateBr(log.visitDate)} - ${label}: ${description}`;
  });
  const checklistLines = checklistResults.map((result) => {
    const checklist = checklistById.get(result.checklistId);
    const checklistItem = checklistItemsById.get(result.checklistItemId);
    return `${formatDateBr(normalizeDateKey(result.checkedAt))} - ${scheduleItemLabel(itemsById, result.scheduleItemId)}: ${checklistItem?.texto || checklist?.titulo || 'Checklist conferido'}`;
  });
  const occurrenceLines = [
    ...logs.map((log) => log.fotosObservacao ? `${scheduleItemLabel(itemsById, log.scheduleItemId)}: ${log.fotosObservacao}` : ''),
    ...openIssues.map((issue) => `${issue.etapa}: ${issue.descricao} (${issue.status})`),
    ...checklistLines,
  ];
  const groupedPhotos = groupRdoPhotosBySchedule(photos, data.scheduleItems || []);
  const generated = {
    reportDate: range.startDate,
    startDate: range.startDate,
    endDate: range.endDate,
    titulo: `RDO - ${activeWork?.nome || 'Obra'} - ${formatDateRangeBr(range.startDate, range.endDate)}`,
    clima: '',
    equipe: uniqueTextLines(logs.map((log) => log.maoObra)),
    resumo: logs.length
      ? `${logs.length} registro(s) de diario encontrados no periodo ${formatDateRangeBr(range.startDate, range.endDate)}.`
      : `Sem registros de diario no periodo ${formatDateRangeBr(range.startDate, range.endDate)}.`,
    servicosExecutados: uniqueTextLines(serviceLines),
    materiais: uniqueTextLines(logs.map((log) => log.pedidoMaterial)),
    ferramentas: uniqueTextLines(logs.map((log) => log.ferramentas)),
    ocorrencias: uniqueTextLines(occurrenceLines),
    fotosCount: photos.length,
    payload: {
      generatedAt: new Date().toISOString(),
      obra: activeWork || null,
      startDate: range.startDate,
      endDate: range.endDate,
      scheduleItems: data.scheduleItems || [],
      logs: logs.map((log) => ({
        ...log,
        itemLabel: scheduleItemLabel(itemsById, log.scheduleItemId),
      })),
      photos,
      groupedPhotos,
      openIssues,
      checklistResults,
    },
  };

  return savedReport ? { ...generated, ...savedReport, payload: generated.payload } : generated;
}

function Reports({ data, activeWork, account, works = [], saving, error, message, setScreen, onSelectWork, onSaveRdo, onDeleteRdo, onLoadRdoPhotos }) {
  const [workQuery, setWorkQuery] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [pdfLoading, setPdfLoading] = useState(false);
  const formRef = useRef(null);
  const range = normalizeDateRange(startDate, endDate);
  const filteredWorks = useMemo(() => {
    const normalizedQuery = normalizeSearch(workQuery);
    return works.filter((work) => {
      if (!normalizedQuery) return true;
      const searchable = Object.values(work || {})
        .filter((value) => ['string', 'number'].includes(typeof value))
        .map((value) => String(value))
        .join(' ');
      return normalizeSearch(searchable).includes(normalizedQuery);
    });
  }, [works, workQuery]);
  const savedReports = (data.rdoReports || [])
    .slice()
    .sort((a, b) => String(b.startDate || b.reportDate).localeCompare(String(a.startDate || a.reportDate)));
  const savedReport = savedReports.find((report) => {
    const reportStart = normalizeDateKey(report.startDate || report.reportDate);
    const reportEnd = normalizeDateKey(report.endDate || report.reportDate);
    return reportStart === range.startDate && reportEnd === range.endDate;
  });
  const draft = useMemo(
    () => buildRdoDraft({ data, activeWork, startDate: range.startDate, endDate: range.endDate, savedReport }),
    [data, activeWork, range.startDate, range.endDate, savedReport?.id],
  );

  function currentFormValues() {
    return Object.fromEntries(new FormData(formRef.current).entries());
  }

  function buildReportFromValues(values, extraPayload = {}) {
    return {
      id: savedReport?.id || '',
      reportDate: range.startDate,
      startDate: range.startDate,
      endDate: range.endDate,
      titulo: values.titulo,
      clima: values.clima,
      equipe: values.equipe,
      resumo: values.resumo,
      servicosExecutados: values.servicosExecutados,
      materiais: values.materiais,
      ferramentas: values.ferramentas,
      ocorrencias: values.ocorrencias,
      fotosCount: draft.fotosCount,
      payload: {
        ...draft.payload,
        campos: values,
        ...extraPayload,
      },
    };
  }

  function submit(event) {
    event.preventDefault();
    onSaveRdo(buildReportFromValues(currentFormValues()));
  }

  async function downloadPdf() {
    if (!formRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const signedPhotos = await onLoadRdoPhotos(range);
      const periodPhotos = signedPhotos.filter((photo) => isDateInRange(photo.data || photo.createdAt || photo.updatedAt, range.startDate, range.endDate));
      const groupedPhotos = groupRdoPhotosBySchedule(periodPhotos, data.scheduleItems || []);
      const report = buildReportFromValues(currentFormValues(), {
        photos: periodPhotos,
        groupedPhotos,
      });
      report.fotosCount = periodPhotos.length;
      const { generateRdoPdf } = await import('./rdoPdf.js');
      await generateRdoPdf({
        report,
        account,
        project: activeWork,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  function deleteSavedReport(event, report) {
    event.stopPropagation();
    const period = formatDateRangeBr(report.startDate || report.reportDate, report.endDate || report.reportDate);
    const confirmed = window.confirm(`Excluir o RDO de ${period}? Esta acao nao pode ser desfeita.`);
    if (!confirmed) return;
    onDeleteRdo(report.id);
  }

  return (
    <>
      <PageTitle eyebrow="RDO" title="Relatorio diario de obra" subtitle="Gere e grave o RDO por obra e periodo." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={FileText} variant="secondary" onClick={downloadPdf} disabled={pdfLoading}>
          {pdfLoading ? 'Gerando PDF...' : 'Gerar PDF'}
        </ActionButton>
      </PageTitle>
      <section className="rdo-work-picker">
        <label className="field rdo-work-search">
          <span>Busca obra</span>
          <span className="search-control">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={workQuery}
              placeholder="Buscar por lote, quadra, numero, cliente ou rua"
              onChange={(event) => setWorkQuery(event.target.value)}
            />
          </span>
        </label>
        <section className="work-list rdo-work-list">
          {filteredWorks.map((obra) => (
            <button
              className={`work-card work-card-${getWorkCardTone(obra)} ${obra.id === activeWork?.id ? 'active' : ''}`}
              type="button"
              key={obra.id}
              onClick={() => onSelectWork?.(obra)}
              aria-label={`Selecionar ${obra.nome} para o RDO`}
            >
              <strong>{getFirstName(obra.cliente || obra.nome)}</strong>
              <span>{obra.endereco || obra.nome}</span>
              <span>{[obra.quadra ? `Quadra ${obra.quadra}` : '', obra.lote ? `Lote ${obra.lote}` : '', obra.numero ? `Numero ${obra.numero}` : ''].filter(Boolean).join(' - ')}</span>
              <b>{obra.percentual}%</b>
              <ProgressBar value={obra.percentual} />
            </button>
          ))}
          {!filteredWorks.length ? <EmptyNotice title="Nenhuma obra encontrada" text="Ajuste a busca para selecionar a obra do relatorio." /> : null}
        </section>
      </section>
      <section className="report-summary rdo-summary">
        <strong>{activeWork?.nome || 'Obra selecionada'}</strong>
        <span>{account?.nome || 'Empresa'} - {activeWork?.cliente || 'Cliente'} - {activeWork?.endereco || 'Endereco nao informado'}</span>
        <span>Periodo: {formatDateRangeBr(range.startDate, range.endDate)}</span>
        <span>{savedReport ? `RDO salvo em ${formatDateTime(savedReport.updatedAt || savedReport.createdAt)}` : 'RDO ainda nao salvo para este periodo'}</span>
      </section>
      {error ? <p className="auth-message error">{error}</p> : null}
      {message ? <p className="auth-message success">{message}</p> : null}
      <section className="rdo-layout">
        <form ref={formRef} className="rdo-form" key={`${activeWork?.id || 'obra'}-${range.startDate}-${range.endDate}-${savedReport?.id || 'novo'}`} onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Data inicial</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </label>
            <label className="field">
              <span>Data final</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </label>
            <Field label="Titulo" name="titulo" value={draft.titulo} required />
            <Field label="Clima" name="clima" value={draft.clima} />
            <Field label="Fotos do periodo" name="fotosCountDisplay" value={`${draft.fotosCount} foto(s)`} disabled />
            <TextAreaField label="Equipe / mao de obra" name="equipe" value={draft.equipe} />
            <TextAreaField label="Resumo do periodo" name="resumo" value={draft.resumo} />
            <TextAreaField label="Servicos executados" name="servicosExecutados" value={draft.servicosExecutados} />
            <TextAreaField label="Materiais" name="materiais" value={draft.materiais} />
            <TextAreaField label="Ferramentas / equipamentos" name="ferramentas" value={draft.ferramentas} />
            <TextAreaField label="Ocorrencias / pendencias" name="ocorrencias" value={draft.ocorrencias} />
          </div>
          <div className="form-actions">
            <ActionButton Icon={Save} type="submit" disabled={saving}>
              {saving ? 'Salvando...' : savedReport ? 'Atualizar RDO' : 'Salvar RDO'}
            </ActionButton>
            <ActionButton Icon={FileText} variant="secondary" onClick={downloadPdf} disabled={pdfLoading}>
              {pdfLoading ? 'Gerando PDF...' : 'Baixar PDF'}
            </ActionButton>
          </div>
        </form>
        <aside className="rdo-history">
          <strong>RDOs salvos</strong>
          {savedReports.length ? savedReports.map((report) => (
            <div
              className={
                normalizeDateKey(report.startDate || report.reportDate) === range.startDate
                && normalizeDateKey(report.endDate || report.reportDate) === range.endDate
                  ? 'rdo-history-item active'
                  : 'rdo-history-item'
              }
              key={report.id}
            >
              <button
                type="button"
                className="rdo-history-select"
                onClick={() => {
                  setStartDate(normalizeDateKey(report.startDate || report.reportDate));
                  setEndDate(normalizeDateKey(report.endDate || report.reportDate));
                }}
              >
                <FileText size={18} aria-hidden="true" />
                <span>{formatDateRangeBr(report.startDate || report.reportDate, report.endDate || report.reportDate)}</span>
                <small>{report.titulo}</small>
              </button>
              <button
                type="button"
                className="rdo-history-delete"
                onClick={(event) => deleteSavedReport(event, report)}
                disabled={saving}
                aria-label={`Excluir RDO ${formatDateRangeBr(report.startDate || report.reportDate, report.endDate || report.reportDate)}`}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          )) : <p>Nenhum RDO salvo para esta obra.</p>}
        </aside>
      </section>
    </>
  );
}

const stageStatusOptions = ['Nao iniciado', 'Em andamento', 'Atencao', 'Concluida', 'Inativo'];

function StageLibrary({ stages, saving, error, setScreen, onSave, onDuplicate, onDeactivate }) {
  const [editingStage, setEditingStage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openNewStage() {
    setEditingStage(null);
    setModalOpen(true);
  }

  function openEditStage(stage) {
    setEditingStage(stage);
    setModalOpen(true);
  }

  async function saveStage(values) {
    const saved = await onSave(values);
    if (saved) {
      setModalOpen(false);
      setEditingStage(null);
    }
  }

  return (
    <>
      <PageTitle eyebrow="Cadastro de etapas" title="Etapas da obra" subtitle="Cadastre, edite e duplique etapas usadas em fotos, PLS e cronograma." onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={Plus} onClick={openNewStage} disabled={saving}>Nova etapa</ActionButton>
      </PageTitle>
      {error ? (
        <section className="warning-strip">
          <AlertTriangle size={22} aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}
      <section className="stage-list">
        {stages.map((stage, index) => (
          <article className="stage-card" key={stage.id}>
            <div className="stage-main">
              <div>
                <h2>{stage.nome}</h2>
                <span>Ordem {index + 1} - {stage.inicio || '-'} ate {stage.fim || '-'}</span>
              </div>
              <StatusPill status={stage.status} />
            </div>
            <div className="stage-meta">
              <span>{stage.percentual}% executado</span>
              <span>{stage.pendencias} pendencias</span>
              <span>{stage.fotosFaltando} fotos faltando</span>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => openEditStage(stage)} disabled={saving}><Pencil size={18} aria-hidden="true" /> Editar</button>
              <button type="button" onClick={() => onDuplicate(stage)} disabled={saving}><FolderKanban size={18} aria-hidden="true" /> Duplicar</button>
              <button type="button" onClick={() => onDeactivate(stage)} disabled={saving || stage.status === 'Inativo'}><XCircle size={18} aria-hidden="true" /> Desativar</button>
            </div>
          </article>
        ))}
        {!stages.length ? <EmptyNotice Icon={Layers3} title="Nenhuma etapa cadastrada" text="Cadastre a primeira etapa para liberar o uso nos registros de fotos." /> : null}
      </section>
      {modalOpen ? (
        <StageModal
          stage={editingStage}
          nextOrder={stages.length}
          saving={saving}
          onClose={() => {
            if (!saving) {
              setModalOpen(false);
              setEditingStage(null);
            }
          }}
          onSave={saveStage}
        />
      ) : null}
    </>
  );
}

function StageModal({ stage, nextOrder, saving, onClose, onSave }) {
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    onSave({
      id: stage?.id,
      nome: form.elements.nome.value.trim(),
      percentual: Math.min(100, Math.max(0, Number(form.elements.percentual.value) || 0)),
      status: form.elements.status.value,
      inicio: form.elements.inicio.value.trim(),
      fim: form.elements.fim.value.trim(),
      pendencias: Math.max(0, Number(form.elements.pendencias.value) || 0),
      fotosFaltando: Math.max(0, Number(form.elements.fotosFaltando.value) || 0),
      sortOrder: Math.max(0, Number(form.elements.sortOrder.value) || 0),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal user-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Cadastro de etapas</span>
            <h2>{stage ? 'Editar etapa' : 'Nova etapa'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <Field label="Nome da etapa" name="nome" value={stage?.nome || ''} required />
          <Field label="Ordem" name="sortOrder" value={String(stage?.sortOrder ?? nextOrder)} type="number" />
          <Field label="Inicio previsto" name="inicio" value={stage?.inicio || ''} />
          <Field label="Fim previsto" name="fim" value={stage?.fim || ''} />
          <Field label="Percentual" name="percentual" value={String(stage?.percentual ?? 0)} type="number" />
          <Field label="Pendencias" name="pendencias" value={String(stage?.pendencias ?? 0)} type="number" />
          <Field label="Fotos faltando" name="fotosFaltando" value={String(stage?.fotosFaltando ?? 0)} type="number" />
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={stage?.status || 'Nao iniciado'}>
              {stageStatusOptions.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
        <section className="detail-note user-note">
          <strong>Uso da etapa</strong>
          <p>Etapas ativas aparecem no cadastro de fotos, cronograma, PLS e demais controles da obra selecionada.</p>
        </section>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar etapa'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

function Profile({ currentUser, saving, error, message, onSave }) {
  const defaultCityId = currentUser?.cidadeId || cityCatalog[0].id;
  const [cityId, setCityId] = useState(defaultCityId);
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatarUrl || '');
  const role = currentUser?.role || 'operador';
  const needsRegistry = ['engenheiro', 'arquiteto'].includes(role);
  const registryLabel = role === 'arquiteto' ? 'CAU' : 'CREA';

  useEffect(() => {
    setCityId(currentUser?.cidadeId || cityCatalog[0].id);
    setAvatarPreview(currentUser?.avatarUrl || '');
  }, [currentUser?.id, currentUser?.avatarUrl, currentUser?.cidadeId]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!currentUser) {
    return <EmptyNotice Icon={UserRound} title="Usuario nao carregado" text="Entre novamente para alterar seu perfil." />;
  }

  function handleAvatarChange(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setAvatarPreview(currentUser.avatarUrl || '');
      return;
    }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const selectedCity = cityCatalog.find((city) => city.id === form.elements.cidadeId.value) || cityCatalog[0];
    onSave({
      nome: form.elements.nome.value.trim(),
      telefone: form.elements.telefone.value.trim(),
      cpf: form.elements.cpf.value.trim(),
      professionalRegistry: form.elements.professionalRegistry?.value.trim() || '',
      cidadeId: selectedCity.id,
      cidade: selectedCity.nome,
      password: form.elements.password.value,
      confirmPassword: form.elements.confirmPassword.value,
      avatarFile: form.elements.avatarFile.files?.[0] || null,
      avatarUrl: currentUser.avatarUrl || '',
      avatarStoragePath: currentUser.avatarStoragePath || '',
      avatarFileName: currentUser.avatarFileName || '',
      avatarMimeType: currentUser.avatarMimeType || '',
      avatarFileSize: currentUser.avatarFileSize || 0,
    });
  }

  return (
    <form onSubmit={submit}>
      <PageTitle eyebrow="Perfil" title="Meu cadastro" subtitle="Dados do usuario, foto de perfil e senha de acesso." />
      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      <section className="profile-summary-grid user-profile-summary">
        <article className="profile-card profile-user-card">
          <div className="user-avatar profile-avatar">
            {avatarPreview ? <img src={avatarPreview} alt={`Foto de ${currentUser.nome}`} /> : <UserRound size={34} aria-hidden="true" />}
          </div>
          <strong className="profile-user-name">{currentUser.nome || 'Usuario Obras'}</strong>
          <span>{roleLabel(currentUser.role)}</span>
          <p>{currentUser.email}</p>
        </article>
        <article className="profile-card profile-access-card">
          <ShieldCheck size={34} aria-hidden="true" />
          <span>Acesso Obras</span>
          <span>{currentUser.active ? 'Usuario ativo' : 'Usuario inativo'}</span>
          <p>{currentUser.loginEnabled ? 'Login habilitado' : 'Login bloqueado'}</p>
        </article>
      </section>
      <section className="form-grid profile-edit-form">
        <label className="field user-avatar-field">
          <span>Foto de perfil</span>
          <div className="user-avatar-upload">
            <div className="user-avatar-preview">
              {avatarPreview ? <img src={avatarPreview} alt="Previa da foto do usuario" /> : <UserRound size={34} aria-hidden="true" />}
            </div>
            <div>
              <input type="file" name="avatarFile" accept="image/*" onChange={handleAvatarChange} disabled={saving} />
              <small>Use uma foto de rosto. O app reduz o tamanho antes de salvar.</small>
            </div>
          </div>
        </label>
        <Field label="Nome" name="nome" value={currentUser.nome || ''} required disabled={saving} />
        <Field label="E-mail de login" name="email" value={currentUser.email || ''} type="email" disabled />
        <Field label="Telefone" name="telefone" value={currentUser.telefone || ''} disabled={saving} />
        <Field label="CPF" name="cpf" value={currentUser.cpf || ''} disabled={saving} />
        <label className="field">
          <span>Cidade</span>
          <select name="cidadeId" value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={saving}>
            {cityCatalog.map((city) => (
              <option value={city.id} key={city.id}>{city.nome}</option>
            ))}
          </select>
        </label>
        <Field label="Perfil" name="roleLabel" value={roleLabel(currentUser.role)} disabled />
        {needsRegistry ? <Field label={`Numero ${registryLabel}`} name="professionalRegistry" value={currentUser.professionalRegistry || ''} required disabled={saving} /> : null}
        <label className="field">
          <span>Nova senha</span>
          <input type="password" name="password" autoComplete="new-password" placeholder="Deixe em branco para manter" disabled={saving} />
          <small>Use para trocar a senha temporaria por uma definitiva.</small>
        </label>
        <label className="field">
          <span>Confirmar nova senha</span>
          <input type="password" name="confirmPassword" autoComplete="new-password" placeholder="Repita a nova senha" disabled={saving} />
        </label>
      </section>
      <div className="form-actions">
        <ActionButton Icon={Save} type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar meu cadastro'}
        </ActionButton>
      </div>
    </form>
  );
}

function resolveLocation(values, customNeighborhoods = []) {
  const city = cityCatalog.find((item) => item.id === values.cidadeId) || cityCatalog[0];
  const allNeighborhoods = getAllNeighborhoodOptions(customNeighborhoods);
  const neighborhood = allNeighborhoods.find((item) => item.id === values.bairroId) || getNeighborhoodOptions(city.id, customNeighborhoods)[0];
  return { city, neighborhood };
}

function WorkProfile({ activeWork, saving, error, message, canEdit, canDelete, neighborhoods: customNeighborhoods = [], onAddNeighborhood, onSave, onDelete, setScreen }) {
  const initialCityId = activeWork?.cidadeId || cityCatalog.find((city) => normalizeSearch(city.nome) === normalizeSearch(activeWork?.cidade))?.id || cityCatalog[0].id;
  const [cityId, setCityId] = useState(initialCityId);

  useEffect(() => {
    setCityId(activeWork?.cidadeId || cityCatalog.find((city) => normalizeSearch(city.nome) === normalizeSearch(activeWork?.cidade))?.id || cityCatalog[0].id);
  }, [activeWork?.id, activeWork?.cidadeId, activeWork?.cidade]);

  if (!activeWork) {
    return <EmptyNotice Icon={Building2} title="Obra nao selecionada" text="Selecione uma obra para editar os dados cadastrais." />;
  }

  const neighborhoods = getNeighborhoodOptions(cityId, customNeighborhoods);
  const currentNeighborhood = neighborhoods.find((neighborhood) => neighborhood.id === activeWork.bairroId)
    || neighborhoods.find((neighborhood) => normalizeSearch(neighborhood.nome) === normalizeSearch(activeWork.bairro));
  const neighborhoodId = currentNeighborhood?.id
    || neighborhoods[0]?.id
    || '';

  function submit(event) {
    event.preventDefault();
    if (!canEdit || saving) return;
    onSave(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  function confirmDelete() {
    const confirmed = window.confirm('Excluir esta obra? Esta acao remove a obra e seus registros vinculados.');
    if (confirmed) onDelete();
  }

  return (
    <form onSubmit={submit}>
      <PageTitle eyebrow="Dados da obra" title={activeWork.nome} subtitle="Cadastro, localizacao e informacoes tecnicas da obra." onBack={() => setScreen('workPanel')}>
        <StatusPill status={getEffectiveWorkStatus(activeWork)} />
      </PageTitle>
      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      {!canEdit ? (
        <section className="warning-strip">
          <AlertTriangle size={22} aria-hidden="true" />
          <span>Somente proprietarios, administradores e engenheiros podem alterar os dados da obra.</span>
        </section>
      ) : null}

      <section className="profile-summary-grid">
        <article className="profile-card">
          <Building2 size={34} aria-hidden="true" />
          <strong>{activeWork.nome}</strong>
          <span>{activeWork.cliente || 'Cliente nao informado'}</span>
          <p>{activeWork.endereco || 'Endereco nao informado'}</p>
        </article>
        <article className="profile-card">
          <MapPinned size={34} aria-hidden="true" />
          <strong>{activeWork.cidade || 'Cidade nao informada'}</strong>
          <span>{activeWork.bairro || 'Bairro nao informado'}</span>
          <p>{activeWork.quadra || activeWork.lote ? `Quadra ${activeWork.quadra || '-'} / Lote ${activeWork.lote || '-'}` : 'Quadra e lote nao informados'}</p>
        </article>
      </section>

      <section className="form-grid profile-edit-form">
        <Field label="Nome da obra" name="nome" value={activeWork.nome || ''} required disabled={!canEdit || saving} />
        <Field label="Cliente" name="cliente" value={activeWork.cliente || ''} required disabled={!canEdit || saving} />
        <label className="field">
          <span>Cidade</span>
          <select name="cidadeId" value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={!canEdit || saving}>
            {cityCatalog.map((city) => (
              <option value={city.id} key={city.id}>{city.nome}</option>
            ))}
          </select>
        </label>
        <NeighborhoodField
          cityId={cityId}
          value={neighborhoodId}
          neighborhoods={customNeighborhoods}
          disabled={!canEdit || saving}
          onAddNeighborhood={onAddNeighborhood}
        />
        <Field label="Endereco" name="endereco" value={activeWork.endereco || ''} wide required disabled={!canEdit || saving} />
        <Field label="Quadra" name="quadra" value={activeWork.quadra || ''} disabled={!canEdit || saving} />
        <Field label="Lote" name="lote" value={activeWork.lote || ''} disabled={!canEdit || saving} />
        <Field label="Area construida" name="areaConstruida" value={activeWork.areaConstruida || ''} disabled={!canEdit || saving} />
        <Field label="Area do terreno" name="areaTerreno" value={activeWork.areaTerreno || ''} disabled={!canEdit || saving} />
        <Field label="Numero de pavimentos" name="pavimentos" value={activeWork.pavimentos || ''} disabled={!canEdit || saving} />
        <Field label="Responsavel tecnico" name="responsavel" value={activeWork.responsavel || ''} disabled={!canEdit || saving} />
        <TextAreaField label="Observacoes" name="observacoes" value={activeWork.observacoes || ''} disabled={!canEdit || saving} />
      </section>

      <div className="form-actions">
        <ActionButton Icon={Save} type="submit" disabled={!canEdit || saving}>{saving ? 'Salvando...' : 'Salvar dados da obra'}</ActionButton>
        {canDelete ? <ActionButton Icon={Trash2} variant="danger" onClick={confirmDelete} disabled={saving}>Excluir obra</ActionButton> : null}
        <ActionButton Icon={XCircle} variant="ghost" onClick={() => setScreen('workPanel')} disabled={saving}>Voltar</ActionButton>
      </div>
    </form>
  );
}

function buildAiProjectDraft(result, selectedCity, customNeighborhoods = []) {
  const values = result.valores || {};
  const requestedCity = normalizeSearch(values.cidade);
  const city = cityCatalog.find((item) => {
    const catalogName = normalizeSearch(item.nome);
    return requestedCity && (requestedCity === catalogName || requestedCity.includes(catalogName));
  }) || selectedCity || cityCatalog[0];
  const neighborhoods = getNeighborhoodOptions(city.id, customNeighborhoods);
  const requestedNeighborhood = normalizeSearch(values.bairro);
  const neighborhood = neighborhoods.find((item) => {
    const catalogName = normalizeSearch(item.nome);
    return requestedNeighborhood
      && (requestedNeighborhood === catalogName
        || requestedNeighborhood.includes(catalogName)
        || catalogName.includes(requestedNeighborhood));
  }) || neighborhoods[0];
  const warnings = [...(result.avisos || [])];

  if (values.cidade && city.nome !== values.cidade) {
    warnings.push(`Cidade interpretada como "${values.cidade}". Confira a cidade selecionada.`);
  }
  if (values.bairro && neighborhood?.nome !== values.bairro) {
    warnings.push(`Bairro interpretado como "${values.bairro}". Confira o bairro selecionado.`);
  }

  return {
    ...values,
    cidadeId: city.id,
    bairroId: neighborhood?.id || '',
    arquivo: result.arquivo,
    modelo: result.modelo,
    avisos: [...new Set(warnings.filter(Boolean))],
  };
}

function formatGeminiProjectError(result) {
  if (result?.codigo === 'gemini_api_key_missing') {
    return 'A analise por IA ainda nao esta configurada. Reinicie o Obras depois de configurar a chave do Gemini.';
  }
  if (result?.httpStatus === 429 || result?.status === 'RESOURCE_EXHAUSTED') {
    return 'A cota gratuita do Gemini foi atingida. Aguarde a liberacao e tente novamente.';
  }
  if (result?.httpStatus === 400 || result?.status === 'INVALID_ARGUMENT') {
    return 'O Gemini recusou o arquivo. Confira o formato, o tamanho e tente novamente.';
  }
  return result?.motivo || 'Nao foi possivel analisar o projeto.';
}

function App() {
  const [screen, setScreenState] = useState('login');
  const screenRef = useRef('login');
  const screenHistoryRef = useRef([]);
  const screenForwardHistoryRef = useRef([]);
  const [data, setData] = useState(() => (supabaseConfigured ? remoteInitialData : loadData()));
  const [session, setSession] = useState(null);
  const [authInitializing, setAuthInitializing] = useState(supabaseConfigured);
  const [sessionHydrating, setSessionHydrating] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
  const [projectDataProjectId, setProjectDataProjectId] = useState(supabaseConfigured ? '' : initialData.works[0]?.id || '');
  const [loadedProjectCollections, setLoadedProjectCollections] = useState(supabaseConfigured ? [] : projectCollections);
  const [photoUrlsProjectId, setPhotoUrlsProjectId] = useState(supabaseConfigured ? '' : initialData.works[0]?.id || '');
  const [dataError, setDataError] = useState('');
  const [photoDraftStage, setPhotoDraftStage] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [documentSaving, setDocumentSaving] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [documentError, setDocumentError] = useState('');
  const [issueDraftStage, setIssueDraftStage] = useState(null);
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [rdoSaving, setRdoSaving] = useState(false);
  const [rdoError, setRdoError] = useState('');
  const [rdoMessage, setRdoMessage] = useState('');
  const [obrasAccounts, setObrasAccounts] = useState(() => (supabaseConfigured ? [] : localObrasAccounts));
  const [obrasNotifications, setObrasNotifications] = useState([]);
  const [pushSupport, setPushSupport] = useState(() => (
    typeof window === 'undefined' ? 'unsupported' : getPushSupportStatus()
  ));
  const [pushMessage, setPushMessage] = useState('');
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsSaving, setAccountsSaving] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [accountsMessage, setAccountsMessage] = useState('');
  const [obrasUsers, setObrasUsers] = useState(() => (supabaseConfigured ? [] : localObrasUsers));
  const [currentObrasUser, setCurrentObrasUser] = useState(() => (supabaseConfigured ? null : localObrasUsers[0]));
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSaving, setUsersSaving] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersMessage, setUsersMessage] = useState('');
  const [platformAdmin, setPlatformAdmin] = useState(!supabaseConfigured);
  const [commercialPlans, setCommercialPlans] = useState(localCommercialPlans);
  const [signupRequests, setSignupRequests] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [commercialLoading, setCommercialLoading] = useState(false);
  const [commercialSaving, setCommercialSaving] = useState(false);
  const [commercialError, setCommercialError] = useState('');
  const [commercialMessage, setCommercialMessage] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [workProfileSaving, setWorkProfileSaving] = useState(false);
  const [workProfileError, setWorkProfileError] = useState('');
  const [workProfileMessage, setWorkProfileMessage] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogMessage, setCatalogMessage] = useState('');
  const [aiProjectDraft, setAiProjectDraft] = useState(null);
  const [selectedCity, setSelectedCity] = useState(cityCatalog[0]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState(supabaseConfigured ? '' : initialData.works[0].id);
  const [selectedStageId, setSelectedStageId] = useState(supabaseConfigured ? '' : initialData.stages[0].id);

  const setScreen = useCallback((nextScreen) => {
    const currentScreen = screenRef.current;
    if (!nextScreen || nextScreen === currentScreen) return;

    if (nextScreen === 'login' || currentScreen === 'login') {
      screenHistoryRef.current = [];
      screenForwardHistoryRef.current = [];
    } else if (screenHistoryRef.current[screenHistoryRef.current.length - 1] === nextScreen) {
      screenHistoryRef.current.pop();
    } else {
      screenHistoryRef.current.push(currentScreen);
    }

    screenForwardHistoryRef.current = [];

    screenRef.current = nextScreen;
    setScreenState(nextScreen);
  }, []);

  const goBack = useCallback(() => {
    const previousScreen = screenHistoryRef.current.pop();
    if (!previousScreen) return;
    screenForwardHistoryRef.current.push(screenRef.current);
    screenRef.current = previousScreen;
    setScreenState(previousScreen);
  }, []);

  const goForward = useCallback(() => {
    const nextScreen = screenForwardHistoryRef.current.pop();
    if (!nextScreen) return;
    screenHistoryRef.current.push(screenRef.current);
    screenRef.current = nextScreen;
    setScreenState(nextScreen);
  }, []);

  const navigation = useMemo(() => ({
    canGoBack: screenHistoryRef.current.length > 0,
    canGoForward: screenForwardHistoryRef.current.length > 0,
    goBack,
    goForward,
  }), [goBack, goForward, screen]);

  useEffect(() => {
    if (!supabaseConfigured) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data]);

  useEffect(() => {
    if (screen === 'login') return undefined;

    let tracking = false;
    let startX = 0;
    let startY = 0;

    function resetGesture() {
      tracking = false;
      startX = 0;
      startY = 0;
    }

    function handleTouchStart(event) {
      if (
        event.touches.length !== 1
        || (!screenHistoryRef.current.length && !screenForwardHistoryRef.current.length)
      ) return;

      const touch = event.touches[0];
      const target = event.target;
      const isGanttSurface = target instanceof Element
        && target.closest('.gantt-backdrop, .gantt-scroll, .gantt-chart');
      const isContractWorkTable = target instanceof Element
        && target.closest('.contract-work-table, .contract-schedule-table');

      if (isGanttSurface || isContractWorkTable) return;

      tracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
    }

    function handleTouchMove(event) {
      if (!tracking || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absDeltaX = Math.abs(deltaX);

      if (absDeltaX < 12) return;

      const isBackSwipe = deltaX > 0;
      const canNavigateDirection = isBackSwipe
        ? screenHistoryRef.current.length > 0
        : screenForwardHistoryRef.current.length > 0;

      if (!canNavigateDirection || Math.abs(deltaY) > 90) {
        resetGesture();
        return;
      }

      if (absDeltaX > Math.abs(deltaY) * 1.2) {
        event.preventDefault();
      }
    }

    function handleTouchEnd(event) {
      if (!tracking || event.changedTouches.length !== 1) {
        resetGesture();
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const isHorizontalSwipe = Math.abs(deltaX) >= 80
        && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;
      const shouldGoBack = isHorizontalSwipe && deltaX > 0 && screenHistoryRef.current.length > 0;
      const shouldGoForward = isHorizontalSwipe && deltaX < 0 && screenForwardHistoryRef.current.length > 0;

      resetGesture();
      if (shouldGoBack) goBack();
      if (shouldGoForward) goForward();
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetGesture);
    };
  }, [goBack, goForward, screen]);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let mounted = true;

    const unsubscribe = onAuthStateChange((nextSession, event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setSessionHydrating(false);
        setSession(null);
        setCurrentObrasUser(null);
        setObrasUsers([]);
        setObrasAccounts([]);
        setObrasNotifications([]);
        setPushMessage('');
        setData(remoteInitialData);
        setSelectedWorkId('');
        setPlatformAdmin(!supabaseConfigured);
        setProjectDataProjectId('');
        setLoadedProjectCollections([]);
        setPhotoUrlsProjectId('');
        setScreen('login');
        return;
      }
      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthInitializing(false);
      return undefined;
    }

    let mounted = true;
    getSession()
      .then((existingSession) => {
        if (!mounted || !existingSession) return;
        setSessionHydrating(true);
        setSession(existingSession);
        screenRef.current = 'dashboard';
        setScreenState('dashboard');
      })
      .catch((error) => {
        if (mounted) setAuthError(error.message || 'Nao foi possivel restaurar a sessao.');
      })
      .finally(() => {
        if (mounted) setAuthInitializing(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !session) return;
    void hydrateRemoteSession();
  }, [session?.user?.id]);

  useEffect(() => {
    if (screen !== 'commercial') return;
    void loadCommercialData();
  }, [screen, session?.user?.id, platformAdmin]);

  useEffect(() => {
    if (screen !== 'companies') return;
    void loadObrasAccounts({ signLogos: true });
  }, [screen, session?.user?.id, platformAdmin]);

  useEffect(() => {
    if (screen !== 'users') return;
    void loadRemoteUsers({ signAvatars: true });
  }, [screen, session?.user?.id]);

  const cityWorks = useMemo(
    () => data.works.filter((work) => work.cidadeId === selectedCity.id),
    [data.works, selectedCity.id],
  );
  const activeWork = useMemo(
    () => cityWorks.find((work) => work.id === selectedWorkId) || cityWorks[0] || null,
    [cityWorks, selectedWorkId],
  );
  const cityData = useMemo(() => ({ ...data, works: cityWorks }), [data, cityWorks]);
  const cityUsers = useMemo(
    () => obrasUsers.filter((user) => !user.cidadeId || user.cidadeId === selectedCity.id),
    [obrasUsers, selectedCity.id],
  );
  const currentObrasAccount = useMemo(
    () => obrasAccounts.find((account) => account.id === currentObrasUser?.accountId) || obrasAccounts[0] || null,
    [obrasAccounts, currentObrasUser?.accountId],
  );
  const activeStage = data.stages.find((stage) => stage.id === selectedStageId) || data.stages[0];
  const canManageObrasUsers = !supabaseConfigured || ['owner', 'admin'].includes(currentObrasUser?.role);
  const canManageCompanyAccount = !supabaseConfigured || platformAdmin || ['owner', 'admin'].includes(currentObrasUser?.role);
  const canEditWorkProfile = !supabaseConfigured || ['owner', 'admin', 'engenheiro'].includes(currentObrasUser?.role);
  const canDeleteWorkProfile = !supabaseConfigured || ['owner', 'admin'].includes(currentObrasUser?.role);

  function selectWork(work, nextScreen = 'workPanel') {
    if (!work?.id) return;
    const city = cityCatalog.find((item) => item.id === work.cidadeId) || selectedCity;
    const neighborhood = (data.neighborhoods || []).find((item) => item.id === work.bairroId) || null;

    setSelectedCity(city);
    setSelectedNeighborhood(neighborhood);
    setSelectedWorkId(work.id);
    if (projectDataProjectId !== work.id) {
      setProjectDataProjectId('');
      setLoadedProjectCollections([]);
      setPhotoUrlsProjectId('');
    }
    setScreen(nextScreen);
  }

  function hasLoadedProjectRequirement(projectId, requirement) {
    if (!supabaseConfigured || !session || !requirement.collections.length) return true;
    if (!projectId || projectDataProjectId !== projectId) return false;
    const hasCollections = requirement.collections.every((collection) => loadedProjectCollections.includes(collection));
    if (!hasCollections) return false;
    return !(requirement.signPhotoUrls && requirement.collections.includes('photos') && photoUrlsProjectId !== projectId);
  }

  useEffect(() => {
    const requirement = getProjectScreenRequirement(screen);
    if (
      !supabaseConfigured
      || !session
      || !selectedWorkId
      || !requirement.collections.length
      || projectDetailsLoading
      || hasLoadedProjectRequirement(selectedWorkId, requirement)
    ) return;

    void loadProject(selectedWorkId, requirement);
  }, [
    screen,
    selectedWorkId,
    projectDataProjectId,
    loadedProjectCollections,
    photoUrlsProjectId,
    projectDetailsLoading,
    session?.user?.id,
  ]);

  function upsertNotification(notification, { showBrowser = false } = {}) {
    if (!notification?.id) return;

    setObrasNotifications((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== notification.id);
      return [notification, ...withoutDuplicate]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 100);
    });

    if (showBrowser && notification.actorUserId !== session?.user?.id) {
      void showObrasBrowserNotification(notification).catch(() => {});
    }
  }

  async function notifyCompany({ projectId = '', type, title, body, payload = {} }) {
    if (!supabaseConfigured || !session || !currentObrasUser?.accountId || !type || !title || !body) {
      return null;
    }

    try {
      const notification = await insertObrasNotification({
        projectId,
        type,
        title,
        body,
        payload: {
          ...payload,
          actorName: currentObrasUser?.nome || currentObrasUser?.email || 'Usuario Obras',
        },
      });
      upsertNotification(notification);
      void sendObrasPushNotification(notification.id).catch((error) => {
        console.warn('Nao foi possivel enviar push do Obras.', error);
      });
      return notification;
    } catch (error) {
      console.warn('Nao foi possivel registrar notificacao do Obras.', error);
      return null;
    }
  }

  async function enablePushForCurrentUser() {
    if (!supabaseConfigured || !session) {
      setPushMessage('Entre no Obras para ativar notificacoes push.');
      return;
    }

    setPushMessage('Solicitando permissao de notificacao...');
    try {
      const result = await enableObrasPushNotifications(upsertObrasPushSubscription);
      setPushSupport(getPushSupportStatus());
      setPushMessage(
        result.mode === 'push'
          ? 'Push ativo para este navegador.'
          : 'Notificacoes locais ativas. Falta configurar a chave push para envio em segundo plano.',
      );
    } catch (error) {
      setPushSupport(getPushSupportStatus());
      setPushMessage(error.message || 'Nao foi possivel ativar notificacoes push.');
    }
  }

  useEffect(() => {
    if (!supabaseConfigured || !session?.user?.id || !currentObrasUser?.accountId) {
      setObrasNotifications([]);
      return undefined;
    }

    let active = true;
    void fetchObrasNotifications({ limit: 80 })
      .then((notifications) => {
        if (active) setObrasNotifications(notifications);
      })
      .catch((error) => {
        console.warn('Nao foi possivel carregar notificacoes do Obras.', error);
      });

    const unsubscribe = subscribeObrasNotifications(currentObrasUser.accountId, (notification) => {
      if (active) upsertNotification(notification, { showBrowser: true });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [session?.user?.id, currentObrasUser?.accountId]);

  async function hydrateRemoteSession() {
    setSessionHydrating(true);
    try {
      const activeUser = await loadRemoteUsers();
      if (!activeUser) {
        await signOut();
        setSession(null);
        setCurrentObrasUser(null);
        setObrasUsers([]);
        setObrasAccounts([]);
        setAuthError('Este e-mail nao esta cadastrado no sistema Obras.');
        setScreen('login');
        return;
      }
      await Promise.all([
        loadObrasAccounts(),
        loadServiceCatalogs(),
        loadRemoteData(),
      ]);
    } catch {
      // The specific loading error is already displayed by the failing request.
    } finally {
      setSessionHydrating(false);
    }
  }

  async function loadRemoteUsers({ signAvatars = false } = {}) {
    if (!supabaseConfigured || !session) {
      setObrasUsers(localObrasUsers);
      setCurrentObrasUser(localObrasUsers[0]);
      return;
    }

    setUsersLoading(true);
    setUsersError('');
    try {
      const currentUser = await ensureCurrentObrasUser();
      const nextPlatformAdmin = await isObrasPlatformAdmin().catch(() => false);
      const users = await fetchObrasUsers({ signAvatars });
      setPlatformAdmin(nextPlatformAdmin);
      setCurrentObrasUser(currentUser || users.find((item) => item.authUserId === session.user.id) || null);
      setObrasUsers(users);
      return currentUser || users.find((item) => item.authUserId === session.user.id) || null;
    } catch (error) {
      setUsersError(error.message || 'Nao foi possivel carregar usuarios do Obras.');
      throw error;
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadObrasAccounts({ signLogos = false } = {}) {
    setAccountsLoading(true);
    setAccountsError('');
    setAccountsMessage('');

    if (!supabaseConfigured || !session) {
      setObrasAccounts(localObrasAccounts);
      setAccountsLoading(false);
      return;
    }

    try {
      const accounts = await fetchObrasAccounts({ signLogos });
      setObrasAccounts(accounts);
    } catch (error) {
      setAccountsError(error.message || 'Nao foi possivel carregar empresas do Obras.');
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadServiceCatalogs() {
    if (!supabaseConfigured || !session) {
      setData((current) => ({
        ...current,
        serviceCategories: initialData.serviceCategories,
        neighborhoods: initialData.neighborhoods,
        contractors: initialData.contractors,
      }));
      return;
    }

    try {
      const [serviceCategories, neighborhoods, contractors] = await Promise.all([
        fetchServiceCategories({ includeInactive: true }),
        fetchNeighborhoods({ includeInactive: true }),
        fetchContractors({ includeInactive: true }),
      ]);
      setData((current) => ({
        ...current,
        serviceCategories,
        neighborhoods,
        contractors,
      }));
    } catch (error) {
      setDataError(error.message || 'Nao foi possivel carregar catalogos do Obras.');
    }
  }

  async function loadRemoteData(preferredProjectId) {
    setDataLoading(true);
    setDataError('');
    try {
      let works = await fetchProjects();

      if (!works.length) {
        setData((current) => ({
          ...remoteInitialData,
          serviceCategories: current.serviceCategories,
          neighborhoods: current.neighborhoods,
          contractors: current.contractors,
        }));
        setSelectedWorkId('');
        setProjectDataProjectId('');
        setLoadedProjectCollections([]);
        setPhotoUrlsProjectId('');
        setDataLoading(false);
        return;
      }

      const cityProject = works.find((work) => work.cidadeId === selectedCity.id);
      const projectId = preferredProjectId && works.some((work) => work.id === preferredProjectId)
        ? preferredProjectId
        : cityProject?.id || works[0].id;
      const project = works.find((work) => work.id === projectId);
      const projectCity = cityCatalog.find((city) => city.id === project?.cidadeId);
      setData((current) => ({
        ...remoteInitialData,
        serviceCategories: current.serviceCategories,
        neighborhoods: current.neighborhoods,
        contractors: current.contractors,
        works,
      }));
      if (projectCity) setSelectedCity(projectCity);
      setSelectedNeighborhood(null);
      setSelectedWorkId(projectId);
      setProjectDataProjectId('');
      setLoadedProjectCollections([]);
      setPhotoUrlsProjectId('');
      setDataLoading(false);
    } catch (error) {
      setDataError(error.message || 'Nao foi possivel carregar o banco de dados.');
      setDataLoading(false);
    }
  }

  async function loadProject(projectId, requirement = { collections: projectCollections, signPhotoUrls: true }) {
    if (!supabaseConfigured || !session) return;
    const requestedCollections = [...new Set(requirement.collections || projectCollections)];
    const sameProject = projectDataProjectId === projectId;
    const missingCollections = sameProject
      ? requestedCollections.filter((collection) => (
          !loadedProjectCollections.includes(collection)
          || (collection === 'photos' && requirement.signPhotoUrls && photoUrlsProjectId !== projectId)
        ))
      : requestedCollections;

    if (!missingCollections.length) return;

    setProjectDetailsLoading(true);
    setDataError('');
    try {
      const currentProject = data.works.find((work) => work.id === projectId);
      const { projectSummary, ...children } = await loadProjectChildren(
        projectId,
        currentProject?.status,
        missingCollections,
        {
          signPhotoUrls: requirement.signPhotoUrls,
          normalizeSchedule: requirement.normalizeSchedule,
        },
      );
      setData((current) => ({
        ...current,
        ...children,
        works: current.works.map((work) => (
          work.id === projectId ? { ...work, ...projectSummary } : work
        )),
      }));
      setProjectDataProjectId(projectId);
      setLoadedProjectCollections((current) => (
        sameProject ? [...new Set([...current, ...missingCollections])] : missingCollections
      ));
      setPhotoUrlsProjectId((current) => (
        missingCollections.includes('photos')
          ? (requirement.signPhotoUrls ? projectId : sameProject ? current : '')
          : current
      ));
      setProjectDetailsLoading(false);
    } catch (error) {
      setDataError(error.message || 'Nao foi possivel carregar a obra.');
      setProjectDetailsLoading(false);
    }
  }

  async function createInitialProjectSchedule(projectId, sourceProjectId) {
    const selectedSource = String(sourceProjectId || DEFAULT_SCHEDULE_SOURCE);
    if (selectedSource === DEFAULT_SCHEDULE_SOURCE) {
      await ensureProjectSchedule(projectId, defaultScheduleBlueprint);
      return;
    }

    const sourceIsLoaded = selectedSource === selectedWorkId
      && projectDataProjectId === selectedSource
      && loadedProjectCollections.includes('scheduleItems')
      && loadedProjectCollections.includes('checklist')
      && data.scheduleItems.length;
    const sourceChildren = sourceIsLoaded
      ? { scheduleItems: data.scheduleItems, checklist: data.checklist }
      : await fetchProjectChildren(selectedSource, {
          collections: ['scheduleItems', 'checklist'],
          signPhotoUrls: false,
        });
    const sourceItems = sourceChildren.scheduleItems || [];
    const sourceChecklists = sourceChildren.checklist || [];
    const copyPlan = buildScheduleCopyPlan(sourceItems);

    if (!copyPlan.length) {
      await ensureProjectSchedule(projectId, defaultScheduleBlueprint);
      return;
    }

    const copiedItemsBySourceId = new Map();
    for (const group of copyPlan) {
      const stage = await insertChild('scheduleItems', projectId, group.stage);
      if (group.stage.sourceId) copiedItemsBySourceId.set(group.stage.sourceId, stage);
      for (const child of group.children) {
        const savedChild = await insertChild('scheduleItems', projectId, { ...child, parentId: stage.id });
        if (child.sourceId) copiedItemsBySourceId.set(child.sourceId, savedChild);
      }
    }

    const checklistCopies = sourceChecklists
      .filter((entry) => entry.scheduleItemId && copiedItemsBySourceId.has(entry.scheduleItemId))
      .map((entry) => {
        const copiedItem = copiedItemsBySourceId.get(entry.scheduleItemId);
        return {
          scheduleItemId: copiedItem.id,
          titulo: entry.titulo || entry.descricao || 'Checklist tecnico',
          descricao: entry.descricao || entry.titulo || 'Checklist tecnico',
          procedimento: entry.procedimento || '',
          itens: entry.itens || [],
          etapa: copiedItem.nome,
          norma: entry.norma || 'Checklist interno',
          foto: entry.foto || 'Obrigatoria',
          responsavel: '',
          data: '',
          status: 'Nao iniciado',
        };
      });

    for (const checklistCopy of checklistCopies) {
      await insertChild('checklist', projectId, checklistCopy);
    }
  }

  async function loadProjectChildren(projectId, currentStatus = 'Nao iniciada', collections = projectCollections, options = {}) {
    const requestedCollections = [...new Set(collections)];
    const shouldNormalizeSchedule = requestedCollections.includes('scheduleItems') && options.normalizeSchedule !== false;
    let children = await fetchProjectChildren(projectId, {
      collections: requestedCollections,
      signPhotoUrls: options.signPhotoUrls,
    });

    if (!shouldNormalizeSchedule) {
      return {
        ...children,
        projectSummary: {},
      };
    }

    if (!children.scheduleItems.length) {
      await ensureProjectSchedule(projectId, defaultScheduleBlueprint);
      children = await fetchProjectChildren(projectId, {
        collections: requestedCollections,
        signPhotoUrls: options.signPhotoUrls,
      });
    }
    const stagesWithoutChildren = children.scheduleItems.filter((item) => (
      !item.parentId
      && !children.scheduleItems.some((candidate) => candidate.parentId === item.id)
    ));

    if (stagesWithoutChildren.length) {
      await Promise.all(stagesWithoutChildren.map((stage) => insertChild('scheduleItems', projectId, {
        parentId: stage.id,
        nome: stage.nome,
        itemType: 'task',
        inicioPrevisto: stage.inicioPrevisto,
        fimPrevisto: stage.fimPrevisto,
        inicioReal: stage.inicioReal,
        fimReal: stage.fimReal,
        status: stage.status,
        percentual: stage.percentual,
        sortOrder: 0,
        visible: stage.visible,
      })));
      children = await fetchProjectChildren(projectId, {
        collections: requestedCollections,
        signPhotoUrls: options.signPhotoUrls,
      });
    }

    const initialChildren = children.scheduleItems.filter((item) => item.parentId);
    const initialStages = children.scheduleItems.filter((item) => !item.parentId);
    const childrenToSeed = initialStages.flatMap((stage) => {
      const stageChildren = initialChildren.filter((item) => item.parentId === stage.id);
      if (stageChildren.length !== 1) return [];
      const child = stageChildren[0];
      const childIsBlank = !child.inicioPrevisto
        && !child.fimPrevisto
        && !child.inicioReal
        && !child.fimReal
        && child.percentual === 0
        && child.status === 'Nao iniciado';
      const stageHasData = Boolean(
        stage.inicioPrevisto
        || stage.fimPrevisto
        || stage.inicioReal
        || stage.fimReal
        || stage.percentual > 0
        || stage.status !== 'Nao iniciado',
      );
      return childIsBlank && stageHasData && child.nome === stage.nome
        ? [{ child, stage }]
        : [];
    });

    if (childrenToSeed.length) {
      await Promise.all(childrenToSeed.map(({ child, stage }) => updateChild('scheduleItems', child.id, {
        inicioPrevisto: stage.inicioPrevisto,
        fimPrevisto: stage.fimPrevisto,
        inicioReal: stage.inicioReal,
        fimReal: stage.fimReal,
        status: stage.status,
        percentual: stage.status === 'Concluida' ? 100 : stage.percentual,
      })));
      children = await fetchProjectChildren(projectId, {
        collections: requestedCollections,
        signPhotoUrls: options.signPhotoUrls,
      });
    }

    const derivedItems = deriveScheduleStages(children.scheduleItems);
    const updates = getDerivedStageUpdates(children.scheduleItems, derivedItems);
    const percentual = calculateScheduleProgress(derivedItems);
    const status = getEffectiveWorkStatus({ status: currentStatus, percentual });
    if (updates.length) {
      await Promise.all(updates.map(({ id, patch }) => updateChild('scheduleItems', id, patch)));
    }
    await updateProject(projectId, { percentual, status });
    children.scheduleItems = derivedItems;
    return {
      ...children,
      projectSummary: { percentual, status },
    };
  }

  async function handleCityChange(cityId, destination = 'dashboard') {
    const nextCity = cityCatalog.find((city) => city.id === cityId);
    if (!nextCity) return;

    const changedCity = nextCity.id !== selectedCity.id;
    if (changedCity) setSelectedCity(nextCity);
    setSelectedNeighborhood(null);

    if (changedCity) {
      const nextWork = data.works.find((work) => work.cidadeId === nextCity.id);
      if (nextWork) {
        setSelectedWorkId(nextWork.id);
        setProjectDataProjectId('');
        setLoadedProjectCollections([]);
        setPhotoUrlsProjectId('');
      } else {
        setSelectedWorkId('');
        setData((current) => ({
          ...current,
          ...emptyProjectCollections,
        }));
        setProjectDataProjectId('');
        setLoadedProjectCollections([]);
        setPhotoUrlsProjectId('');
      }
    }

    setScreen(destination);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError('');

    if (!supabaseConfigured) {
      setScreen('dashboard');
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    setAuthLoading(true);
    try {
      const nextSession = await signIn(email, password);
      const obrasUser = await ensureCurrentObrasUser(nextSession);
      if (!obrasUser) {
        await signOut();
        setSessionHydrating(false);
        setSession(null);
        setCurrentObrasUser(null);
        setObrasUsers([]);
        setAuthError('Este e-mail nao esta cadastrado no sistema Obras.');
        return;
      }
      setCurrentObrasUser(obrasUser);
      setSessionHydrating(true);
      setSession(nextSession);
      setScreen('dashboard');
    } catch (error) {
      setAuthError(error.message || 'Nao foi possivel entrar.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setAuthError('');
    setUsersError('');

    try {
      if (supabaseConfigured) {
        setSessionHydrating(false);
        await signOut();
      }
    } catch (error) {
      setAuthError(error.message || 'Nao foi possivel sair do Obras.');
    } finally {
      setSession(null);
      setCurrentObrasUser(supabaseConfigured ? null : localObrasUsers[0]);
      setObrasUsers(supabaseConfigured ? [] : localObrasUsers);
      setObrasAccounts(supabaseConfigured ? [] : localObrasAccounts);
      setObrasNotifications([]);
      setPushMessage('');
      setPlatformAdmin(!supabaseConfigured);
      setProjectDataProjectId('');
      setLoadedProjectCollections([]);
      setPhotoUrlsProjectId('');
      screenHistoryRef.current = [];
      screenRef.current = 'login';
      setScreenState('login');
    }
  }

  async function ensureCurrentObrasUser(activeSession = session) {
    const claimedUser = await claimObrasUser();
    if (claimedUser) return claimedUser;

    const email = activeSession?.user?.email || '';
    const metadataName = activeSession?.user?.user_metadata?.name
      || activeSession?.user?.user_metadata?.full_name;
    const defaultName = metadataName || email.split('@')[0] || 'Proprietario Obras';

    try {
      return await bootstrapObrasOwner({
        nome: defaultName,
        cidadeId: selectedCity.id,
        cidade: selectedCity.nome,
      });
    } catch (error) {
      if (String(error?.message || '').includes('conta inicial do Obras ja foi criada')) {
        return null;
      }
      throw error;
    }
  }

  async function createWork(values) {
    setDataError('');
    const { city, neighborhood } = resolveLocation(values, data.neighborhoods || []);
    const scheduleSourceProjectId = String(values.scheduleSourceProjectId || DEFAULT_SCHEDULE_SOURCE);
    let nextWork = {
      id: makeId('obra'),
      nome: values.nome || 'Nova obra',
      cliente: values.cliente || 'Cliente sem nome',
      endereco: values.endereco || 'Endereco nao informado',
      cidadeId: city.id,
      bairroId: neighborhood.id,
      cidade: city.nome,
      bairro: neighborhood.nome,
      percentual: 0,
      status: 'Nao iniciada',
      proximaEtapa: 'Servicos preliminares',
      pls: 'Pendente',
      pendencias: 0,
      atraso: 0,
      areaConstruida: values.areaConstruida || '',
      areaTerreno: values.areaTerreno || '',
      quadra: values.quadra || '',
      lote: values.lote || '',
      pavimentos: values.pavimentos || '',
      responsavel: values.responsavel || '',
      observacoes: values.observacoes || '',
    };

    if (supabaseConfigured && session) {
      try {
        nextWork = await insertProject(nextWork);
        await createInitialProjectSchedule(nextWork.id, scheduleSourceProjectId);
        const { projectSummary, ...children } = await loadProjectChildren(
          nextWork.id,
          nextWork.status,
          ['scheduleItems'],
          { signPhotoUrls: false, normalizeSchedule: true },
        );
        nextWork = { ...nextWork, ...projectSummary };
        setData((current) => ({ ...current, ...children, works: [nextWork, ...current.works] }));
        setProjectDataProjectId(nextWork.id);
        setLoadedProjectCollections(Object.keys(children));
        setPhotoUrlsProjectId('');
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel salvar a obra no banco.');
        return;
      }
    } else {
      setData((current) => ({ ...current, works: [nextWork, ...current.works] }));
    }

    setSelectedWorkId(nextWork.id);
    setSelectedCity(city);
    setSelectedNeighborhood(neighborhood);
    void notifyCompany({
      projectId: nextWork.id,
      type: 'new_work',
      title: 'Nova obra cadastrada',
      body: `${currentObrasUser?.nome || 'Usuario Obras'} cadastrou a obra ${nextWork.nome} em ${city.nome}.`,
      payload: {
        workName: nextWork.nome,
        city: city.nome,
        neighborhood: neighborhood.nome,
      },
    });
    setScreen('workPanel');
  }

  async function saveWorkProfile(values) {
    if (!activeWork || !canEditWorkProfile) return;

    setWorkProfileSaving(true);
    setWorkProfileError('');
    setWorkProfileMessage('');

    const { city, neighborhood } = resolveLocation(values, data.neighborhoods || []);
    const patch = {
      nome: values.nome || activeWork.nome,
      cliente: values.cliente || activeWork.cliente,
      endereco: values.endereco || activeWork.endereco,
      cidadeId: city.id,
      bairroId: neighborhood.id,
      cidade: city.nome,
      bairro: neighborhood.nome,
      quadra: values.quadra || '',
      lote: values.lote || '',
      areaConstruida: values.areaConstruida || '',
      areaTerreno: values.areaTerreno || '',
      pavimentos: values.pavimentos || '',
      responsavel: values.responsavel || '',
      observacoes: values.observacoes || '',
    };

    try {
      if (supabaseConfigured && session) {
        await updateProject(activeWork.id, patch);
      }
      setData((current) => ({
        ...current,
        works: current.works.map((work) => (
          work.id === activeWork.id ? { ...work, ...patch } : work
        )),
      }));
      setSelectedCity(city);
      setSelectedNeighborhood(neighborhood);
      setWorkProfileMessage('Cadastro da obra atualizado.');
    } catch (error) {
      setWorkProfileError(error.message || 'Nao foi possivel atualizar o cadastro da obra.');
    } finally {
      setWorkProfileSaving(false);
    }
  }

  async function deleteActiveWork() {
    if (!activeWork || !canDeleteWorkProfile) return;

    setWorkProfileSaving(true);
    setWorkProfileError('');
    setWorkProfileMessage('');

    try {
      if (supabaseConfigured && session) {
        const photosToDelete = projectDataProjectId === activeWork.id && loadedProjectCollections.includes('photos')
          ? data.photos
          : (await fetchProjectChildren(activeWork.id, {
              collections: ['photos'],
              signPhotoUrls: false,
            })).photos;
        for (const photo of photosToDelete) {
          await deletePhotoRecord(photo);
        }
        await deleteProject(activeWork.id);
        await loadRemoteData();
      } else {
        const remainingWorks = data.works.filter((work) => work.id !== activeWork.id);
        const nextWork = remainingWorks.find((work) => work.cidadeId === selectedCity.id) || remainingWorks[0] || null;
        setData((current) => ({
          ...current,
          works: remainingWorks,
          ...(!nextWork ? emptyProjectCollections : {}),
        }));
        setSelectedWorkId(nextWork?.id || '');
      }
      setProjectDataProjectId('');
      setLoadedProjectCollections([]);
      setPhotoUrlsProjectId('');
      setScreen('dashboard');
    } catch (error) {
      setWorkProfileError(error.message || 'Nao foi possivel excluir a obra.');
    } finally {
      setWorkProfileSaving(false);
    }
  }

  async function updateStage(id, patch) {
    if (!id) return;
    const percentual = Math.max(activeWork.percentual, patch.percentual || 0);
    const status = getEffectiveWorkStatus({ ...activeWork, percentual });
    setData((current) => ({
      ...current,
      stages: current.stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
      works: current.works.map((work) => (
        work.id === activeWork.id ? { ...work, percentual, status } : work
      )),
    }));

    if (supabaseConfigured && session) {
      try {
        await updateChild('stages', id, patch);
        if (patch.percentual !== undefined) {
          await updateProject(activeWork.id, { percentual, status });
        }
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel atualizar a etapa.');
      }
    }
  }

  async function saveStage(values) {
    if (!activeWork?.id) {
      setStageError('Selecione uma obra antes de cadastrar etapas.');
      return null;
    }

    const stageValues = {
      ...values,
      nome: values.nome || 'Nova etapa',
      percentual: Math.min(100, Math.max(0, Number(values.percentual) || 0)),
      pendencias: Math.max(0, Number(values.pendencias) || 0),
      fotosFaltando: Math.max(0, Number(values.fotosFaltando) || 0),
      sortOrder: Math.max(0, Number(values.sortOrder) || 0),
    };

    setStageSaving(true);
    setStageError('');
    try {
      if (stageValues.id) {
        let saved = stageValues;
        if (supabaseConfigured && session) {
          await updateChild('stages', stageValues.id, stageValues);
        }
        setData((current) => ({
          ...current,
          stages: current.stages
            .map((stage) => (stage.id === stageValues.id ? { ...stage, ...stageValues } : stage))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        }));
        return saved;
      }

      let saved = {
        ...stageValues,
        id: makeId('etapa'),
      };

      if (supabaseConfigured && session) {
        saved = await insertChild('stages', activeWork.id, stageValues);
      }

      setData((current) => ({
        ...current,
        stages: [...current.stages, saved].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }));
      return saved;
    } catch (error) {
      setStageError(error.message || 'Nao foi possivel salvar a etapa.');
      return null;
    } finally {
      setStageSaving(false);
    }
  }

  async function duplicateStage(stage) {
    await saveStage({
      ...stage,
      id: undefined,
      nome: `${stage.nome} copia`,
      sortOrder: data.stages.length,
      status: 'Nao iniciado',
      percentual: 0,
    });
  }

  async function deactivateStage(stage) {
    await saveStage({ ...stage, status: 'Inativo' });
  }

  function commitScheduleItems(nextItems, percentual, status) {
    setData((current) => ({
      ...current,
      scheduleItems: nextItems,
      works: current.works.map((work) => (
        work.id === activeWork.id ? { ...work, percentual, status } : work
      )),
    }));
  }

  async function persistScheduleDerivations(previousItems, nextItems) {
    const percentual = calculateScheduleProgress(nextItems);
    const status = getEffectiveWorkStatus({ ...activeWork, percentual });
    if (supabaseConfigured && session) {
      const stageUpdates = getDerivedStageUpdates(previousItems, nextItems);
      await Promise.all(stageUpdates.map(({ id, patch }) => updateChild('scheduleItems', id, patch)));
      await updateProject(activeWork.id, { percentual, status });
    }
    commitScheduleItems(nextItems, percentual, status);
  }

  async function saveScheduleItem(values) {
    if (!activeWork?.id) {
      setScheduleError('Selecione uma obra antes de alterar o cronograma.');
      return null;
    }

    const previousItems = data.scheduleItems;
    const parentId = values.parentId || '';
    const nextStatus = values.status || 'Nao iniciado';
    const nextPercentual = nextStatus === 'Concluida'
      ? 100
      : Math.min(100, Math.max(0, Number(values.percentual) || 0));
    if (parentId && nextStatus === 'Em andamento' && nextPercentual <= 0) {
      setScheduleError('Informe um percentual maior que zero para status Em andamento.');
      return null;
    }
    const normalized = {
      nome: String(values.nome || '').trim() || (parentId ? 'Novo subitem' : 'Nova etapa'),
      parentId,
      itemType: parentId ? 'task' : 'stage',
      visible: values.visible !== false,
      ...(parentId ? {
        inicioPrevisto: values.inicioPrevisto || '',
        fimPrevisto: values.fimPrevisto || '',
        inicioReal: values.inicioReal || '',
        fimReal: values.fimReal || '',
        status: nextStatus,
        percentual: nextPercentual,
        valorMaoObra: normalizeMoneyValue(values.valorMaoObra),
        categoriaServicoId: values.categoriaServicoId || '',
      } : {}),
    };

    setScheduleSaving(true);
    setScheduleError('');
    try {
      let saved;
      let rawItems;
      if (values.id) {
        saved = { ...previousItems.find((item) => item.id === values.id), ...normalized, updatedAt: new Date().toISOString() };
        if (supabaseConfigured && session) {
          await updateChild('scheduleItems', values.id, normalized);
        }
        rawItems = previousItems.map((item) => (item.id === values.id ? saved : item));
      } else {
        const siblings = previousItems.filter((item) => item.parentId === parentId);
        const item = {
          ...normalized,
          id: makeId(parentId ? 'subitem' : 'etapa-cronograma'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sortOrder: siblings.length
            ? Math.max(...siblings.map((sibling) => Number(sibling.sortOrder) || 0)) + 1
            : 0,
        };
        saved = supabaseConfigured && session
          ? await insertChild('scheduleItems', activeWork.id, item)
          : item;
        rawItems = [...previousItems, saved];

        if (!parentId) {
          const initialChild = {
            id: makeId('subitem'),
            parentId: saved.id,
            nome: saved.nome,
            itemType: 'task',
            inicioPrevisto: '',
            fimPrevisto: '',
            inicioReal: '',
            fimReal: '',
            status: 'Nao iniciado',
            percentual: 0,
            valorMaoObra: 0,
            categoriaServicoId: '',
            sortOrder: 0,
            visible: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const savedChild = supabaseConfigured && session
            ? await insertChild('scheduleItems', activeWork.id, initialChild)
            : initialChild;
          rawItems.push(savedChild);
        }
      }

      const nextItems = deriveScheduleStages(rawItems);
      await persistScheduleDerivations(previousItems, nextItems);
      if (values.id && saved?.parentId) {
        const itemsById = new Map(nextItems.map((item) => [item.id, item]));
        const context = getScheduleActivityContext(saved.id, itemsById);
        void notifyCompany({
          projectId: activeWork.id,
          type: 'subitem_updated',
          title: 'Subitem editado',
          body: `${currentObrasUser?.nome || 'Usuario Obras'} editou ${context.subitemName || saved.nome} em ${activeWork.nome}.`,
          payload: {
            workName: activeWork.nome,
            scheduleItemId: saved.id,
            ...context,
          },
        });
      }
      return saved;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar o item do cronograma.');
      return null;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function updateScheduleItem(id, patch) {
    if (!id || scheduleSaving) return false;
    const previousItems = data.scheduleItems;
    const rawItems = previousItems.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    const nextItems = deriveScheduleStages(rawItems);

    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (supabaseConfigured && session) {
        await updateChild('scheduleItems', id, patch);
      }
      await persistScheduleDerivations(previousItems, nextItems);
      const updatedItem = nextItems.find((item) => item.id === id);
      if (updatedItem?.parentId) {
        const itemsById = new Map(nextItems.map((item) => [item.id, item]));
        const context = getScheduleActivityContext(id, itemsById);
        void notifyCompany({
          projectId: activeWork.id,
          type: 'subitem_updated',
          title: 'Subitem editado',
          body: `${currentObrasUser?.nome || 'Usuario Obras'} atualizou ${context.subitemName || updatedItem.nome} em ${activeWork.nome}.`,
          payload: {
            workName: activeWork.nome,
            scheduleItemId: id,
            ...context,
          },
        });
      }
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel atualizar o cronograma.');
      return false;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function reorderScheduleItem(sourceId, targetId, placement = 'before') {
    if (!sourceId || !targetId || sourceId === targetId || scheduleSaving) return false;

    const previousItems = data.scheduleItems;
    const source = previousItems.find((item) => item.id === sourceId);
    const target = previousItems.find((item) => item.id === targetId);
    if (!source || !target || (source.parentId || '') !== (target.parentId || '')) return false;

    const parentId = source.parentId || '';
    const siblings = previousItems
      .filter((item) => (item.parentId || '') === parentId && item.visible !== false)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    const withoutSource = siblings.filter((item) => item.id !== sourceId);
    const targetIndex = withoutSource.findIndex((item) => item.id === targetId);
    if (targetIndex < 0) return false;

    const insertAt = placement === 'after' ? targetIndex + 1 : targetIndex;
    const reordered = [
      ...withoutSource.slice(0, insertAt),
      source,
      ...withoutSource.slice(insertAt),
    ];
    const orderById = new Map(reordered.map((item, index) => [item.id, index]));
    const rawItems = previousItems.map((item) => (
      orderById.has(item.id) ? { ...item, sortOrder: orderById.get(item.id) } : item
    ));
    const nextItems = deriveScheduleStages(rawItems);

    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (supabaseConfigured && session) {
        await Promise.all(reordered.map((item) => (
          updateChild('scheduleItems', item.id, { sortOrder: orderById.get(item.id) })
        )));
      }
      await persistScheduleDerivations(previousItems, nextItems);
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel reordenar o cronograma.');
      return false;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function setScheduleItemVisibility(id, visible) {
    if (!id || scheduleSaving) return false;
    const previousItems = data.scheduleItems;
    const target = previousItems.find((item) => item.id === id);
    if (!target) return false;

    const affectedIds = new Set([id]);
    if (!target.parentId) {
      previousItems
        .filter((item) => item.parentId === id)
        .forEach((item) => affectedIds.add(item.id));
    }
    const rawItems = previousItems.map((item) => (
      affectedIds.has(item.id) ? { ...item, visible } : item
    ));
    const nextItems = deriveScheduleStages(rawItems);

    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (supabaseConfigured && session) {
        await Promise.all([...affectedIds].map((itemId) => (
          updateChild('scheduleItems', itemId, { visible })
        )));
      }
      await persistScheduleDerivations(previousItems, nextItems);
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel alterar a exibicao deste item.');
      return false;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveScheduleLog(values) {
    if (!activeWork?.id || !values.scheduleItemId) {
      setScheduleError('Selecione um item do cronograma antes de registrar a visita.');
      return null;
    }

    const hasChecklistResults = Array.isArray(values.checklistResults);
    const checklistResultDrafts = hasChecklistResults ? values.checklistResults : [];
    const {
      checklistResults: _checklistResults,
      status: scheduleStatus,
      percentual: schedulePercentual,
      ...logValues
    } = values;
    const previousItems = data.scheduleItems || [];
    const targetScheduleItem = previousItems.find((item) => item.id === values.scheduleItemId);
    const progressStatus = scheduleStatus || targetScheduleItem?.status || 'Nao iniciado';
    const progressPercentual = progressStatus === 'Concluida'
      ? 100
      : Math.min(100, Math.max(0, Number(schedulePercentual) || 0));

    if (targetScheduleItem?.parentId && progressStatus === 'Em andamento' && progressPercentual <= 0) {
      setScheduleError('Informe um percentual maior que zero para status Em andamento.');
      return null;
    }

    const progressPatch = targetScheduleItem?.parentId
      ? { status: progressStatus, percentual: progressPercentual }
      : null;
    const rawItems = progressPatch
      ? previousItems.map((item) => (
          item.id === targetScheduleItem.id
            ? { ...item, ...progressPatch, updatedAt: new Date().toISOString() }
            : item
        ))
      : previousItems;
    const nextItems = progressPatch ? deriveScheduleStages(rawItems) : previousItems;
    const nextProjectPercentual = progressPatch ? calculateScheduleProgress(nextItems) : activeWork.percentual;
    const nextProjectStatus = progressPatch
      ? getEffectiveWorkStatus({ ...activeWork, percentual: nextProjectPercentual })
      : activeWork.status;
    const nextLog = {
      ...logValues,
      visitDate: logValues.visitDate || new Date().toISOString().slice(0, 10),
    };
    setScheduleSaving(true);
    setScheduleError('');
    try {
      let saved;
      if (nextLog.id) {
        saved = {
          ...(data.scheduleLogs.find((log) => log.id === nextLog.id) || {}),
          ...nextLog,
          updatedAt: new Date().toISOString(),
        };
        if (supabaseConfigured && session) {
          await updateChild('scheduleLogs', nextLog.id, nextLog);
        }
      } else {
        saved = supabaseConfigured && session
          ? await insertChild('scheduleLogs', activeWork.id, nextLog)
          : { ...nextLog, id: makeId('diario'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      }
      let savedChecklistResults = null;
      if (hasChecklistResults) {
        const nowIso = new Date().toISOString();
        const checkedBy = session?.user?.id || currentObrasUser?.authUserId || currentObrasUser?.id || '';
        const nextChecklistResults = checklistResultDrafts.map((result) => ({
          ...result,
          scheduleLogId: saved.id,
          scheduleItemId: nextLog.scheduleItemId,
          checkedBy,
          checkedAt: result.checked ? nowIso : '',
        }));
        savedChecklistResults = supabaseConfigured && session
          ? await replaceScheduleChecklistResults(activeWork.id, saved.id, nextChecklistResults)
          : nextChecklistResults.map((result, index) => ({
              id: result.id || makeId(`check-result-${index}`),
              ...result,
              createdAt: nowIso,
              updatedAt: nowIso,
            }));
      }
      if (progressPatch && supabaseConfigured && session) {
        const stageUpdates = getDerivedStageUpdates(previousItems, nextItems);
        await updateChild('scheduleItems', targetScheduleItem.id, progressPatch);
        await Promise.all(stageUpdates.map(({ id, patch }) => updateChild('scheduleItems', id, patch)));
        await updateProject(activeWork.id, {
          percentual: nextProjectPercentual,
          status: nextProjectStatus,
        });
      }
      setData((current) => ({
        ...current,
        scheduleItems: progressPatch ? nextItems : current.scheduleItems,
        works: progressPatch
          ? current.works.map((work) => (
              work.id === activeWork.id
                ? { ...work, percentual: nextProjectPercentual, status: nextProjectStatus }
                : work
            ))
          : current.works,
        scheduleLogs: nextLog.id
          ? current.scheduleLogs.map((log) => (log.id === saved.id ? saved : log))
          : [saved, ...current.scheduleLogs],
        checklistResults: savedChecklistResults
          ? [
              ...savedChecklistResults,
              ...(current.checklistResults || []).filter((result) => result.scheduleLogId !== saved.id),
            ]
          : current.checklistResults,
      }));
      const itemsById = new Map((data.scheduleItems || []).map((item) => [item.id, item]));
      const context = getScheduleActivityContext(nextLog.scheduleItemId, itemsById);
      void notifyCompany({
        projectId: activeWork.id,
        type: 'daily_log',
        title: nextLog.id ? 'Diario da obra atualizado' : 'Diario da obra registrado',
        body: `${currentObrasUser?.nome || 'Usuario Obras'} ${nextLog.id ? 'atualizou' : 'registrou'} diario em ${context.subitemName || context.stageName} - ${activeWork.nome}.`,
        payload: {
          workName: activeWork.nome,
          scheduleLogId: saved.id,
          ...context,
        },
      });
      return saved;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar o diario da obra.');
      return null;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function deleteScheduleLog(logId) {
    if (!logId || scheduleSaving) return false;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (supabaseConfigured && session) {
        await deleteChild('scheduleLogs', logId);
      }
      setData((current) => ({
        ...current,
        scheduleLogs: current.scheduleLogs.filter((log) => log.id !== logId),
        checklistResults: (current.checklistResults || []).filter((result) => result.scheduleLogId !== logId),
      }));
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel excluir o registro do diario.');
      return false;
    } finally {
      setScheduleSaving(false);
    }
  }

  function addPhoto(etapa) {
    setPhotoError('');
    const visibleItems = data.scheduleItems.filter((item) => item.visible !== false);
    const exactSubitem = visibleItems.find((item) => item.parentId && item.nome === etapa);
    const selectedStage = visibleItems.find((item) => !item.parentId && item.nome === etapa);
    const firstStageChild = selectedStage
      ? visibleItems
          .filter((item) => item.parentId === selectedStage.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)[0]
      : null;
    const firstSubitem = visibleItems
      .filter((item) => item.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    setPhotoDraftStage(
      etapa === 'PLS Caixa'
        ? etapa
        : exactSubitem?.nome || firstStageChild?.nome || firstSubitem?.nome || etapa || 'Subitem da obra',
    );
  }

  async function savePhoto({ etapa, tipo, observacao, files }) {
    const selectedFiles = files || [];
    if (!selectedFiles.length) return;

    const basePhoto = {
      etapa,
      tipo,
      data: today(),
      usuario: activeWork.responsavel || 'Eng. Ana Prado',
      observacao: observacao || `Registro incluido em ${etapa}`,
      cor: tipo === 'PLS Caixa' ? 'purple' : tipo === 'Problema' ? 'red' : 'blue',
    };
    const targetStage = data.stages.find((stage) => stage.nome === etapa);
    let nextMissingPhotos = null;
    let nextPhotos = [];

    setPhotoSaving(true);
    setPhotoError('');

    if (supabaseConfigured && session) {
      try {
        const uploadResults = await Promise.allSettled(selectedFiles.map(async (file) => {
          const prepared = await preparePhotoUpload(file);
          const upload = await uploadPhotoFile({
            userId: session.user.id,
            projectId: activeWork.id,
            file: prepared.photoFile,
            thumbnailFile: prepared.thumbnailFile,
          });
          const { thumbnail, ...photoUpload } = upload;
          const savedPhoto = await insertChild('photos', activeWork.id, { ...basePhoto, ...photoUpload });
          if (!thumbnail) return savedPhoto;

          const savedThumbnail = await insertPhotoThumbnail(activeWork.id, savedPhoto.id, {
            ...thumbnail,
            width: prepared.thumbnailWidth,
            height: prepared.thumbnailHeight,
          });
          return {
            ...savedPhoto,
            ...savedThumbnail,
          };
        }));
        nextPhotos = uploadResults
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        if (!nextPhotos.length) {
          const failed = uploadResults.find((result) => result.status === 'rejected');
          throw failed?.reason || new Error('Nenhuma foto foi enviada.');
        }
        nextMissingPhotos = targetStage ? Math.max(0, targetStage.fotosFaltando - nextPhotos.length) : null;
        if (targetStage && nextMissingPhotos !== null) {
          await updateChild('stages', targetStage.id, { fotosFaltando: nextMissingPhotos });
        }
        const failedCount = uploadResults.length - nextPhotos.length;
        if (failedCount) {
          setPhotoError(`${failedCount} foto${failedCount > 1 ? 's' : ''} nao foi${failedCount > 1 ? 'ram' : ''} enviada${failedCount > 1 ? 's' : ''}.`);
        }
      } catch (error) {
        setPhotoError(error.message || 'Nao foi possivel enviar as fotos.');
        setPhotoSaving(false);
        return;
      }
    } else {
      try {
        const uploadResults = await Promise.allSettled(selectedFiles.map(async (file) => {
          const prepared = await preparePhotoUpload(file);
          return {
            id: makeId('foto'),
            ...basePhoto,
            fileName: prepared.photoFile.name,
            mimeType: prepared.photoFile.type || 'image/jpeg',
            fileSize: prepared.compressedSize,
            photoUrl: URL.createObjectURL(prepared.photoFile),
            thumbnailFileName: prepared.thumbnailFile.name,
            thumbnailMimeType: prepared.thumbnailFile.type || 'image/jpeg',
            thumbnailFileSize: prepared.thumbnailSize,
            thumbnailWidth: prepared.thumbnailWidth,
            thumbnailHeight: prepared.thumbnailHeight,
            thumbnailUrl: URL.createObjectURL(prepared.thumbnailFile),
          };
        }));
        nextPhotos = uploadResults
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        if (!nextPhotos.length) {
          const failed = uploadResults.find((result) => result.status === 'rejected');
          throw failed?.reason || new Error('Nenhuma foto foi preparada.');
        }
      } catch (error) {
        setPhotoError(error.message || 'Nao foi possivel reduzir as fotos.');
        setPhotoSaving(false);
        return;
      }
      nextMissingPhotos = targetStage ? Math.max(0, targetStage.fotosFaltando - nextPhotos.length) : null;
    }

    setData((current) => ({
      ...current,
      photos: [...nextPhotos, ...current.photos],
      stages: current.stages.map((stage) => (
        stage.nome === etapa && nextMissingPhotos !== null
          ? { ...stage, fotosFaltando: nextMissingPhotos }
          : stage
      )),
    }));
    void notifyCompany({
      projectId: activeWork.id,
      type: 'photo_added',
      title: nextPhotos.length > 1 ? 'Fotos adicionadas' : 'Foto adicionada',
      body: `${currentObrasUser?.nome || 'Usuario Obras'} adicionou ${nextPhotos.length} foto${nextPhotos.length > 1 ? 's' : ''} em ${etapa} - ${activeWork.nome}.`,
      payload: {
        workName: activeWork.nome,
        stageName: etapa,
        photoCount: nextPhotos.length,
        photoIds: nextPhotos.map((photo) => photo.id),
      },
    });
    setPhotoSaving(false);
    setPhotoDraftStage(null);
    setScreen('photos');
  }

  async function deletePhoto(photo) {
    const confirmed = window.confirm('Tem certeza que deseja excluir esta foto? Esta acao nao pode ser desfeita.');
    if (!confirmed) return;

    setDeletingPhotoId(photo.id);
    setPhotoError('');
    try {
      let storageWarning = '';
      if (supabaseConfigured && session) {
        storageWarning = await deletePhotoRecord(photo);
      } else if (photo.photoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(photo.photoUrl);
        if (photo.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.thumbnailUrl);
      }

      setData((current) => ({
        ...current,
        photos: current.photos.filter((item) => item.id !== photo.id),
      }));
      if (storageWarning) {
        setPhotoError('A foto foi excluida, mas o arquivo antigo nao pode ser removido do armazenamento.');
      }
    } catch (error) {
      setPhotoError(error.message || 'Nao foi possivel excluir a foto.');
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function saveDocument(values, onDone) {
    if (!activeWork?.id) {
      setDocumentError('Selecione uma obra antes de adicionar documentos.');
      return;
    }

    const file = values.file;
    if (!file) {
      setDocumentError('Selecione um arquivo para salvar.');
      return;
    }

    const baseDocument = {
      tipo: values.tipo || documentTypeOptions[0],
      titulo: String(values.titulo || file.name || 'Documento').trim(),
      descricao: String(values.descricao || '').trim(),
    };

    setDocumentSaving(true);
    setDocumentError('');

    try {
      let savedDocument;
      if (supabaseConfigured && session) {
        const upload = await uploadObrasDocumentFile({
          userId: session.user.id,
          projectId: activeWork.id,
          file,
        });
        savedDocument = await insertChild('documents', activeWork.id, { ...baseDocument, ...upload });
      } else {
        savedDocument = {
          id: makeId('documento'),
          ...baseDocument,
          fileName: file.name || 'documento',
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size || 0,
          documentUrl: URL.createObjectURL(file),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      setData((current) => ({
        ...current,
        documents: [savedDocument, ...(current.documents || [])],
      }));
      onDone?.();
    } catch (error) {
      setDocumentError(error.message || 'Nao foi possivel salvar o documento.');
    } finally {
      setDocumentSaving(false);
    }
  }

  async function deleteDocument(document) {
    const confirmed = window.confirm('Excluir este documento? Esta acao nao pode ser desfeita.');
    if (!confirmed) return;

    setDeletingDocumentId(document.id);
    setDocumentError('');

    try {
      let storageWarning = '';
      if (supabaseConfigured && session) {
        storageWarning = await deleteDocumentRecord(document);
      } else if (document.documentUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(document.documentUrl);
      }

      setData((current) => ({
        ...current,
        documents: (current.documents || []).filter((item) => item.id !== document.id),
      }));

      if (storageWarning) {
        setDocumentError('O documento foi excluido, mas o arquivo antigo nao pode ser removido do armazenamento.');
      }
    } catch (error) {
      setDocumentError(error.message || 'Nao foi possivel excluir o documento.');
    } finally {
      setDeletingDocumentId(null);
    }
  }

  function addIssue(etapa = 'Geral') {
    setIssueError('');
    setIssueDraftStage(etapa || 'Geral');
    setScreen('issues');
  }

  async function saveIssue(values) {
    const etapa = values.etapa || issueDraftStage || 'Geral';
    let next = {
      id: makeId('pend'),
      descricao: values.descricao || `Pendencia registrada em ${etapa}`,
      etapa,
      responsavel: values.responsavel || activeWork.responsavel || 'Eng. Ana',
      prazo: formatIssuePrazo(values.prazo),
      status: values.status || 'Aberta',
      norma: values.norma || 'Checklist interno',
    };
    const pendenciaDelta = next.status === 'Resolvida' ? 0 : 1;

    setIssueSaving(true);
    setIssueError('');
    if (supabaseConfigured && session) {
      try {
        next = await insertChild('issues', activeWork.id, next);
        if (pendenciaDelta) {
          await updateProject(activeWork.id, { pendencias: activeWork.pendencias + pendenciaDelta });
        }
      } catch (error) {
        setIssueError(error.message || 'Nao foi possivel salvar a pendencia.');
        setIssueSaving(false);
        return;
      }
    }

    setData((current) => ({
      ...current,
      issues: [next, ...current.issues],
      works: current.works.map((work) => (work.id === activeWork.id ? { ...work, pendencias: work.pendencias + pendenciaDelta } : work)),
    }));
    void notifyCompany({
      projectId: activeWork.id,
      type: 'issue_added',
      title: 'Pendencia adicionada',
      body: `${currentObrasUser?.nome || 'Usuario Obras'} adicionou uma pendencia em ${etapa} - ${activeWork.nome}.`,
      payload: {
        workName: activeWork.nome,
        stageName: etapa,
        issueId: next.id,
        status: next.status,
      },
    });
    setIssueSaving(false);
    setIssueDraftStage(null);
    setScreen('issues');
  }

  async function resolveIssue() {
    const targetIssue = data.issues[0];
    if (!targetIssue) return;
    if (targetIssue.status === 'Resolvida') return;

    setData((current) => ({
      ...current,
      issues: current.issues.map((issue, index) => (index === 0 ? { ...issue, status: 'Resolvida' } : issue)),
      works: current.works.map((work) => (work.id === activeWork.id ? { ...work, pendencias: Math.max(0, work.pendencias - 1) } : work)),
    }));

    if (supabaseConfigured && session) {
      try {
        await updateChild('issues', targetIssue.id, { status: 'Resolvida' });
        await updateProject(activeWork.id, { pendencias: Math.max(0, activeWork.pendencias - 1) });
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel resolver a pendencia.');
      }
    }
  }

  async function updatePls(status) {
    const targetPls = data.plsItems[0];
    if (!targetPls) return;

    setData((current) => ({
      ...current,
      plsItems: current.plsItems.map((item, index) => (index === 0 ? { ...item, status } : item)),
      works: current.works.map((work) => (work.id === activeWork.id ? { ...work, pls: status } : work)),
    }));

    if (supabaseConfigured && session) {
      try {
        await updateChild('plsItems', targetPls.id, { status });
        await updateProject(activeWork.id, { pls: status });
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel atualizar a PLS.');
      }
    }
  }

  async function saveScheduleChecklist(values) {
    if (!activeWork?.id) {
      setScheduleError('Selecione uma obra antes de cadastrar checklist.');
      return null;
    }

    const normalized = {
      ...values,
      titulo: values.titulo || 'Checklist tecnico',
      descricao: values.descricao || values.titulo || 'Checklist tecnico',
      procedimento: values.procedimento || '',
      itens: (values.itens || []).filter((item) => item.texto),
      etapa: values.etapa || 'Cronograma',
      norma: values.norma || 'Checklist interno',
      foto: values.foto || 'Obrigatoria',
      responsavel: values.responsavel || '',
      data: values.data || '',
      status: values.status || 'Nao iniciado',
    };

    if (!normalized.itens.length) {
      setScheduleError('Informe pelo menos um item no checklist.');
      return null;
    }

    setScheduleSaving(true);
    setScheduleError('');
    try {
      let saved = normalized;
      if (normalized.id) {
        if (supabaseConfigured && session) {
          await updateChild('checklist', normalized.id, normalized);
        }
      } else {
        saved = { ...normalized, id: makeId('checklist') };
        if (supabaseConfigured && session) {
          saved = await insertChild('checklist', activeWork.id, normalized);
        }
      }

      setData((current) => {
        const exists = current.checklist.some((entry) => entry.id === saved.id);
        return {
          ...current,
          checklist: exists
            ? current.checklist.map((entry) => (entry.id === saved.id ? { ...entry, ...saved } : entry))
            : [saved, ...current.checklist],
        };
      });
      return saved;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar o checklist.');
      return null;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function loadChecklistPhotosForItem({ scheduleItemId, checklistId, checklistItemId = '' }) {
    if (!activeWork?.id || !scheduleItemId || !checklistId) return [];

    if (supabaseConfigured && session) {
      const photos = await fetchChecklistPhotos(activeWork.id, { scheduleItemId, checklistId, checklistItemId });
      setData((current) => {
        const existingById = new Map((current.checklistPhotos || []).map((photo) => [photo.id, photo]));
        photos.forEach((photo) => existingById.set(photo.id, photo));
        return {
          ...current,
          checklistPhotos: Array.from(existingById.values()),
        };
      });
      return photos;
    }

    return (data.checklistPhotos || []).filter((photo) => (
      photo.scheduleItemId === scheduleItemId
      && photo.checklistId === checklistId
      && (!checklistItemId || photo.checklistItemId === checklistItemId)
    ));
  }

  async function saveChecklistPhotos({ scheduleItemId, checklistId, checklistItemId, files }) {
    if (!activeWork?.id || !scheduleItemId || !checklistId || !checklistItemId) {
      throw new Error('Selecione um item de checklist antes de adicionar fotos.');
    }

    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return [];

    const existingCount = (data.checklistPhotos || []).filter((photo) => (
      photo.scheduleItemId === scheduleItemId
      && photo.checklistId === checklistId
      && photo.checklistItemId === checklistItemId
    )).length;
    const remainingSlots = MAX_CHECKLIST_PHOTOS_PER_ITEM - existingCount;
    if (remainingSlots <= 0) {
      throw new Error(`Limite de ${MAX_CHECKLIST_PHOTOS_PER_ITEM} fotos atingido para este item.`);
    }

    const filesToSave = selectedFiles.slice(0, remainingSlots);
    setScheduleSaving(true);
    setScheduleError('');

    try {
      let savedPhotos = [];
      if (supabaseConfigured && session) {
        const uploadResults = await Promise.allSettled(filesToSave.map(async (file) => {
          const prepared = await preparePhotoUpload(file);
          const upload = await uploadPhotoFile({
            userId: session.user.id,
            projectId: activeWork.id,
            file: prepared.photoFile,
            thumbnailFile: prepared.thumbnailFile,
          });
          const { thumbnail, ...photoUpload } = upload;
          return insertChecklistPhoto(activeWork.id, {
            scheduleItemId,
            checklistId,
            checklistItemId,
            ...photoUpload,
            width: prepared.width,
            height: prepared.height,
            thumbnailStoragePath: thumbnail?.storagePath || '',
            thumbnailFileName: thumbnail?.fileName || '',
            thumbnailMimeType: thumbnail?.mimeType || 'image/jpeg',
            thumbnailFileSize: thumbnail?.fileSize || 0,
            thumbnailWidth: prepared.thumbnailWidth,
            thumbnailHeight: prepared.thumbnailHeight,
          });
        }));
        savedPhotos = uploadResults
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        if (!savedPhotos.length) {
          const failed = uploadResults.find((result) => result.status === 'rejected');
          throw failed?.reason || new Error('Nenhuma foto foi salva.');
        }
        const failedCount = uploadResults.length - savedPhotos.length;
        if (failedCount) {
          setScheduleError(`${failedCount} foto${failedCount > 1 ? 's' : ''} nao foi${failedCount > 1 ? 'ram' : ''} salva${failedCount > 1 ? 's' : ''}.`);
        }
      } else {
        const uploadResults = await Promise.allSettled(filesToSave.map(async (file) => {
          const prepared = await preparePhotoUpload(file);
          return {
            id: makeId('checklist-foto'),
            projectId: activeWork.id,
            scheduleItemId,
            checklistId,
            checklistItemId,
            fileName: prepared.photoFile.name,
            mimeType: prepared.photoFile.type || 'image/jpeg',
            fileSize: prepared.compressedSize,
            width: prepared.width,
            height: prepared.height,
            photoUrl: URL.createObjectURL(prepared.photoFile),
            thumbnailFileName: prepared.thumbnailFile.name,
            thumbnailMimeType: prepared.thumbnailFile.type || 'image/jpeg',
            thumbnailFileSize: prepared.thumbnailSize,
            thumbnailWidth: prepared.thumbnailWidth,
            thumbnailHeight: prepared.thumbnailHeight,
            thumbnailUrl: URL.createObjectURL(prepared.thumbnailFile),
            createdBy: currentObrasUser?.id || '',
            createdAt: new Date().toISOString(),
          };
        }));
        savedPhotos = uploadResults
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        if (!savedPhotos.length) {
          const failed = uploadResults.find((result) => result.status === 'rejected');
          throw failed?.reason || new Error('Nenhuma foto foi preparada.');
        }
      }

      setData((current) => ({
        ...current,
        checklistPhotos: [...savedPhotos, ...(current.checklistPhotos || [])],
      }));
      return savedPhotos;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar as fotos do checklist.');
      throw error;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveRdoReport(values) {
    if (!activeWork?.id || !values?.startDate || !values?.endDate) {
      setRdoError('Selecione uma obra, data inicial e data final para salvar o RDO.');
      return null;
    }

    const range = normalizeDateRange(values.startDate, values.endDate);
    const normalized = {
      ...values,
      reportDate: range.startDate,
      startDate: range.startDate,
      endDate: range.endDate,
      titulo: values.titulo || `RDO - ${activeWork.nome} - ${formatDateRangeBr(range.startDate, range.endDate)}`,
      fotosCount: Number(values.fotosCount || 0),
      payload: values.payload || {},
    };

    setRdoSaving(true);
    setRdoError('');
    setRdoMessage('');
    try {
      let saved;
      if (normalized.id) {
        saved = {
          ...(data.rdoReports || []).find((report) => report.id === normalized.id),
          ...normalized,
          updatedAt: new Date().toISOString(),
        };
        if (supabaseConfigured && session) {
          await updateChild('rdoReports', normalized.id, normalized);
        }
      } else {
        saved = supabaseConfigured && session
          ? await insertChild('rdoReports', activeWork.id, normalized)
          : { ...normalized, id: makeId('rdo'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      }

      setData((current) => {
        const exists = (current.rdoReports || []).some((report) => report.id === saved.id);
        return {
          ...current,
          rdoReports: exists
            ? current.rdoReports.map((report) => (report.id === saved.id ? saved : report))
            : [saved, ...(current.rdoReports || [])],
        };
      });
      setRdoMessage('RDO salvo.');
      return saved;
    } catch (error) {
      setRdoError(error.message || 'Nao foi possivel salvar o RDO.');
      return null;
    } finally {
      setRdoSaving(false);
    }
  }

  async function deleteRdoReport(reportId) {
    if (!reportId) return false;
    setRdoSaving(true);
    setRdoError('');
    setRdoMessage('');
    try {
      if (supabaseConfigured && session) {
        await deleteChild('rdoReports', reportId);
      }
      setData((current) => ({
        ...current,
        rdoReports: (current.rdoReports || []).filter((report) => report.id !== reportId),
      }));
      setRdoMessage('RDO excluido.');
      return true;
    } catch (error) {
      setRdoError(error.message || 'Nao foi possivel excluir o RDO.');
      return false;
    } finally {
      setRdoSaving(false);
    }
  }

  async function loadRdoPhotosWithUrls() {
    if (!activeWork?.id) return [];
    const hasSignedUrls = photoUrlsProjectId === activeWork.id && (data.photos || []).some((photo) => getBestPhotoUrl(photo));
    if (!supabaseConfigured || !session || hasSignedUrls) return data.photos || [];

    try {
      const children = await fetchProjectChildren(activeWork.id, {
        collections: ['photos'],
        signPhotoUrls: true,
      });
      const photosWithUrls = children.photos || [];
      const photosById = new Map(photosWithUrls.map((photo) => [photo.id, photo]));
      setData((current) => ({
        ...current,
        photos: (current.photos || []).map((photo) => photosById.get(photo.id) || photo),
      }));
      setPhotoUrlsProjectId(activeWork.id);
      return photosWithUrls;
    } catch (error) {
      setRdoError(error.message || 'Nao foi possivel carregar as fotos para o PDF.');
      return data.photos || [];
    }
  }

  async function saveScheduleChecklistCheck(values) {
    if (!activeWork?.id || !values?.scheduleItemId || !values?.checklistId) {
      setScheduleError('Selecione um subitem com checklist antes de conferir.');
      return false;
    }

    const alreadyCheckedIds = checkedChecklistIds(
      subitemChecklistResults(data.checklistResults, { id: values.scheduleItemId }, { id: values.checklistId }),
    );
    const nowIso = new Date().toISOString();
    const checkedBy = session?.user?.id || currentObrasUser?.authUserId || currentObrasUser?.id || '';
    const newCheckedResults = (values.results || [])
      .filter((result) => result.checked && !alreadyCheckedIds.has(result.checklistItemId))
      .map((result) => ({
        ...result,
        scheduleLogId: '',
        checked: true,
        checkedBy,
        checkedAt: nowIso,
      }));

    if (!newCheckedResults.length) return true;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      const savedResults = supabaseConfigured && session
        ? await insertScheduleItemChecklistResults(activeWork.id, newCheckedResults)
        : newCheckedResults.map((result, index) => ({
            id: result.id || makeId(`check-result-${index}`),
            ...result,
            createdAt: nowIso,
            updatedAt: nowIso,
          }));

      setData((current) => ({
        ...current,
        checklistResults: [
          ...savedResults,
          ...(current.checklistResults || []),
        ],
      }));
      const itemsById = new Map((data.scheduleItems || []).map((item) => [item.id, item]));
      const context = getScheduleActivityContext(values.scheduleItemId, itemsById);
      const checklist = (data.checklist || []).find((entry) => entry.id === values.checklistId);
      void notifyCompany({
        projectId: activeWork.id,
        type: 'checklist_checked',
        title: 'Checklist conferido',
        body: `${currentObrasUser?.nome || 'Usuario Obras'} conferiu ${savedResults.length} item${savedResults.length === 1 ? '' : 's'} do checklist em ${context.subitemName || context.stageName} - ${activeWork.nome}.`,
        payload: {
          workName: activeWork.nome,
          checklistId: values.checklistId,
          checklistTitle: checklist?.titulo || 'Checklist',
          checkedCount: savedResults.length,
          scheduleItemId: values.scheduleItemId,
          ...context,
        },
      });
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar a conferencia do checklist.');
      return false;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function deleteScheduleChecklist(checklistItem) {
    if (!checklistItem?.id || scheduleSaving) return false;

    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (supabaseConfigured && session) {
        await deleteChild('checklist', checklistItem.id);
      }
      setData((current) => ({
        ...current,
        checklist: current.checklist.filter((entry) => entry.id !== checklistItem.id),
        checklistResults: (current.checklistResults || []).filter((entry) => entry.checklistId !== checklistItem.id),
        checklistPhotos: (current.checklistPhotos || []).filter((entry) => entry.checklistId !== checklistItem.id),
      }));
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel excluir o checklist.');
      return false;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveObrasAccount(values) {
    setAccountsError('');
    setAccountsMessage('');

    if (!canManageCompanyAccount) {
      setAccountsError('Apenas proprietarios e administradores podem alterar os dados da empresa.');
      return false;
    }
    if (!platformAdmin && supabaseConfigured && values.id !== currentObrasUser?.accountId) {
      setAccountsError('Seu perfil so pode alterar a empresa vinculada ao seu login.');
      return false;
    }
    if (!values.nome) {
      setAccountsError('Informe o nome da empresa.');
      return false;
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setAccountsError('Informe um e-mail valido.');
      return false;
    }

    setAccountsSaving(true);
    try {
      let savedCompany;
      if (supabaseConfigured && session) {
        savedCompany = await updateObrasAccount(values.id, values);
        if (values.logoFile) {
          const logoFile = await prepareLogoUpload(values.logoFile);
          const logoUpload = await uploadObrasAccountLogo({
            accountId: savedCompany.id,
            file: logoFile,
            previousPath: savedCompany.logoStoragePath,
          });
          savedCompany = await updateObrasAccount(savedCompany.id, {
            ...savedCompany,
            logoStoragePath: logoUpload.logoStoragePath,
            logoFileName: logoUpload.logoFileName,
            logoMimeType: logoUpload.logoMimeType,
            logoFileSize: logoUpload.logoFileSize,
          });
          savedCompany = { ...savedCompany, logoUrl: logoUpload.logoUrl };
        }
      } else {
        let logoUrl = values.logoUrl || '';
        if (values.logoFile) {
          if (logoUrl?.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
          logoUrl = URL.createObjectURL(values.logoFile);
        }
        savedCompany = {
          ...values,
          logoUrl,
          status: values.status || 'Ativa',
        };
      }

      setObrasAccounts((current) => (
        current.some((company) => company.id === savedCompany.id)
          ? current.map((company) => (company.id === savedCompany.id ? savedCompany : company))
          : [savedCompany, ...current]
      ));
      setAccountsMessage('Empresa atualizada.');
      setAccountsSaving(false);
      return true;
    } catch (error) {
      setAccountsError(error.message || 'Nao foi possivel salvar a empresa.');
      setAccountsSaving(false);
      return false;
    }
  }

  async function saveObrasUser(values) {
    setUsersError('');
    setUsersMessage('');

    if (!canManageObrasUsers) {
      setUsersError('Apenas proprietarios e administradores podem cadastrar ou alterar usuarios.');
      return false;
    }
    if (!values.nome) {
      setUsersError('Informe o nome do usuario.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setUsersError('Informe um e-mail valido.');
      return false;
    }
    if (!values.id && values.loginEnabled !== false && !values.password) {
      setUsersError('Informe uma senha temporaria para o novo usuario.');
      return false;
    }
    if (values.id && values.loginEnabled !== false && !values.authUserId && !values.password) {
      setUsersError('Este usuario ainda nao tem login vinculado. Informe uma senha temporaria e salve novamente.');
      return false;
    }
    if (values.password && values.password.length < 6) {
      setUsersError('A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    if (['engenheiro', 'arquiteto'].includes(values.role) && !values.professionalRegistry) {
      setUsersError(values.role === 'arquiteto' ? 'Informe o numero do CAU.' : 'Informe o numero do CREA.');
      return false;
    }
    if (currentObrasUser?.id === values.id && !['owner', 'admin'].includes(values.role)) {
      setUsersError('Voce nao pode remover seu proprio perfil de administrador.');
      return false;
    }

    setUsersSaving(true);
    try {
      let savedUser;
      if (supabaseConfigured && session) {
        const accountId = values.accountId || currentObrasUser?.accountId;
        if (!accountId) throw new Error('Sua conta Obras ainda nao foi vinculada.');
        savedUser = values.id
          ? await updateObrasUser(values.id, values)
          : await insertObrasUser(accountId, values);
        if (values.avatarFile) {
          const avatarFile = await prepareAvatarUpload(values.avatarFile);
          const avatarUpload = await uploadObrasUserAvatar({
            accountId,
            userId: savedUser.id,
            file: avatarFile,
            previousPath: savedUser.avatarStoragePath,
          });
          savedUser = await updateObrasUser(savedUser.id, {
            ...savedUser,
            avatarStoragePath: avatarUpload.avatarStoragePath,
            avatarFileName: avatarUpload.avatarFileName,
            avatarMimeType: avatarUpload.avatarMimeType,
            avatarFileSize: avatarUpload.avatarFileSize,
          });
          savedUser = { ...savedUser, avatarUrl: avatarUpload.avatarUrl };
        }
      } else {
        let avatarUrl = values.avatarUrl || '';
        if (values.avatarFile) {
          avatarUrl = URL.createObjectURL(values.avatarFile);
        }
        savedUser = {
          ...values,
          id: values.id || makeId('usuario'),
          accountId: values.accountId || 'local-account',
          active: values.active !== false,
          avatarUrl,
        };
      }

      setObrasUsers((current) => (
        values.id
          ? current.map((user) => (user.id === savedUser.id ? savedUser : user))
          : [savedUser, ...current]
      ));
      if (currentObrasUser?.id === savedUser.id) setCurrentObrasUser(savedUser);
      setUsersMessage(values.id ? 'Usuario atualizado.' : 'Usuario cadastrado no Obras.');
      setUsersSaving(false);
      return true;
    } catch (error) {
      setUsersError(error.message || 'Nao foi possivel salvar o usuario.');
      setUsersSaving(false);
      return false;
    }
  }

  async function saveCurrentUserProfile(values) {
    setProfileError('');
    setProfileMessage('');

    if (!currentObrasUser?.id) {
      setProfileError('Usuario do Obras nao carregado.');
      return false;
    }
    if (!values.nome) {
      setProfileError('Informe seu nome.');
      return false;
    }
    if (['engenheiro', 'arquiteto'].includes(currentObrasUser.role) && !values.professionalRegistry) {
      setProfileError(currentObrasUser.role === 'arquiteto' ? 'Informe o numero do CAU.' : 'Informe o numero do CREA.');
      return false;
    }
    if (values.password || values.confirmPassword) {
      if (values.password !== values.confirmPassword) {
        setProfileError('A confirmacao da senha nao confere.');
        return false;
      }
      if (values.password.length < 6) {
        setProfileError('A nova senha deve ter pelo menos 6 caracteres.');
        return false;
      }
    }

    setProfileSaving(true);
    try {
      let nextUser = {
        ...currentObrasUser,
        nome: values.nome,
        telefone: values.telefone,
        cpf: values.cpf,
        professionalRegistry: values.professionalRegistry,
        cidadeId: values.cidadeId,
        cidade: values.cidade,
      };

      if (supabaseConfigured && session) {
        if (!nextUser.accountId) throw new Error('Sua conta Obras ainda nao foi vinculada.');
        if (values.avatarFile) {
          const avatarFile = await prepareAvatarUpload(values.avatarFile);
          const avatarUpload = await uploadObrasUserAvatar({
            accountId: nextUser.accountId,
            userId: nextUser.id,
            file: avatarFile,
            previousPath: nextUser.avatarStoragePath,
          });
          nextUser = {
            ...nextUser,
            avatarStoragePath: avatarUpload.avatarStoragePath,
            avatarFileName: avatarUpload.avatarFileName,
            avatarMimeType: avatarUpload.avatarMimeType,
            avatarFileSize: avatarUpload.avatarFileSize,
            avatarUrl: avatarUpload.avatarUrl,
          };
        }
        nextUser = await updateCurrentObrasUserProfile(nextUser);
        if (values.password) await updateCurrentUserPassword(values.password);
      } else if (values.avatarFile) {
        nextUser = {
          ...nextUser,
          avatarUrl: URL.createObjectURL(values.avatarFile),
        };
      }

      setCurrentObrasUser(nextUser);
      setObrasUsers((current) => (
        current.some((user) => user.id === nextUser.id)
          ? current.map((user) => (user.id === nextUser.id ? nextUser : user))
          : [nextUser, ...current]
      ));
      setProfileMessage(values.password ? 'Perfil e senha atualizados.' : 'Perfil atualizado.');
      return true;
    } catch (error) {
      setProfileError(error.message || 'Nao foi possivel atualizar seu perfil.');
      return false;
    } finally {
      setProfileSaving(false);
    }
  }

  async function toggleObrasUser(user) {
    if (currentObrasUser?.id === user.id || (user.authUserId && user.authUserId === session?.user?.id)) {
      setUsersError('Voce nao pode desativar seu proprio acesso.');
      return;
    }
    await saveObrasUser({ ...user, active: !user.active });
  }

  async function loadCommercialData() {
    setCommercialLoading(true);
    setCommercialError('');
    setCommercialMessage('');

    if (!supabaseConfigured || !session) {
      setCommercialPlans(localCommercialPlans);
      setSignupRequests([]);
      setSubscriptions([
        {
          id: 'local-subscription',
          accountId: currentObrasUser?.accountId || 'local-account',
          planId: 'empresa-campo',
          status: 'trial',
          startedAt: new Date().toISOString(),
          trialEndsAt: '',
          currentPeriodEndsAt: '',
          cancelledAt: '',
          limiteObras: 30,
          limiteUsuarios: 12,
          valorMensal: 149.90,
          notes: 'Assinatura local para demonstracao.',
        },
      ]);
      setCommercialLoading(false);
      return;
    }

    try {
      const [plans, accountSubscriptions] = await Promise.all([
        fetchCommercialPlans({ includeInactive: platformAdmin }),
        fetchObrasSubscriptions(),
      ]);
      const requests = platformAdmin ? await fetchSignupRequests() : [];
      setCommercialPlans(plans.length ? plans : localCommercialPlans);
      setSubscriptions(accountSubscriptions);
      setSignupRequests(requests);
    } catch (error) {
      setCommercialError(error.message || 'Nao foi possivel carregar assinaturas.');
    } finally {
      setCommercialLoading(false);
    }
  }

  async function updateSignupRequestStatus(request, status) {
    if (!request?.id || !platformAdmin) return;
    setCommercialSaving(true);
    setCommercialError('');
    setCommercialMessage('');

    try {
      const saved = await updateSignupRequest(request.id, { status });
      setSignupRequests((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setCommercialMessage(`Solicitacao marcada como ${requestStatusLabel(status)}.`);
    } catch (error) {
      setCommercialError(error.message || 'Nao foi possivel atualizar a solicitacao.');
    } finally {
      setCommercialSaving(false);
    }
  }

  async function updateFirst(collection, updater) {
    const target = data[collection]?.[0];
    if (!target) return;
    const next = updater(target);

    setData((current) => ({
      ...current,
      [collection]: current[collection].map((item, index) => (index === 0 ? next : item)),
    }));

    if (supabaseConfigured && session) {
      try {
        await updateChild(collection, target.id, next);
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel atualizar o registro.');
      }
    }
  }

  async function saveServiceCategory(values) {
    const nome = String(values.nome || '').trim();
    if (!nome) {
      setCatalogError('Informe o nome da categoria.');
      return null;
    }

    setCatalogSaving(true);
    setCatalogError('');
    setCatalogMessage('');

    try {
      let saved = {
        ...values,
        nome,
        descricao: String(values.descricao || '').trim(),
        ativo: values.ativo !== false,
      };

      if (supabaseConfigured && session) {
        saved = values.id
          ? await updateServiceCategory(values.id, saved)
          : await insertServiceCategory(saved);
      } else {
        saved = { ...saved, id: values.id || makeId('categoria') };
      }

      setData((current) => ({
        ...current,
        serviceCategories: current.serviceCategories.some((item) => item.id === saved.id)
          ? current.serviceCategories.map((item) => (item.id === saved.id ? saved : item))
          : [...current.serviceCategories, saved].sort((a, b) => a.nome.localeCompare(b.nome)),
      }));
      setCatalogMessage('Categoria salva.');
      return saved;
    } catch (error) {
      setCatalogError(error.message || 'Nao foi possivel salvar a categoria.');
      return null;
    } finally {
      setCatalogSaving(false);
    }
  }

  async function saveNeighborhood(values) {
    const nome = String(values.nome || '').trim();
    const cidadeId = String(values.cidadeId || '').trim();
    if (!nome) throw new Error('Informe o nome do bairro.');
    if (!cidadeId) throw new Error('Selecione a cidade antes de cadastrar o bairro.');

    const slug = buildNeighborhoodSlug(nome);
    const existing = getNeighborhoodOptions(cidadeId, data.neighborhoods || [])
      .find((neighborhood) => buildNeighborhoodSlug(neighborhood.nome) === slug);
    if (existing) return existing;

    let saved = {
      id: makeId('bairro'),
      cidadeId,
      nome,
      slug,
      ativo: true,
    };

    if (supabaseConfigured && session) {
      saved = await insertNeighborhood(saved);
    }

    setData((current) => ({
      ...current,
      neighborhoods: [...(current.neighborhoods || []), saved].sort((a, b) => a.nome.localeCompare(b.nome)),
    }));
    return saved;
  }

  async function toggleServiceCategory(category) {
    if (!category?.id) return null;
    return saveServiceCategory({ ...category, ativo: category.ativo === false });
  }

  async function saveContractor(values) {
    const nome = String(values.nome || '').trim();
    if (!nome) {
      setCatalogError('Informe o nome do empreiteiro.');
      return null;
    }

    setCatalogSaving(true);
    setCatalogError('');
    setCatalogMessage('');

    try {
      let saved = {
        ...values,
        nome,
        telefone: String(values.telefone || '').trim(),
        documento: String(values.documento || '').trim(),
        email: String(values.email || '').trim().toLowerCase(),
        observacoes: String(values.observacoes || '').trim(),
        ativo: values.ativo !== false,
      };

      if (supabaseConfigured && session) {
        saved = values.id
          ? await updateContractor(values.id, saved)
          : await insertContractor(saved);
      } else {
        saved = { ...saved, id: values.id || makeId('empreiteiro') };
      }

      setData((current) => ({
        ...current,
        contractors: current.contractors.some((item) => item.id === saved.id)
          ? current.contractors.map((item) => (item.id === saved.id ? saved : item))
          : [...current.contractors, saved].sort((a, b) => a.nome.localeCompare(b.nome)),
      }));
      setCatalogMessage('Empreiteiro salvo.');
      return saved;
    } catch (error) {
      setCatalogError(error.message || 'Nao foi possivel salvar o empreiteiro.');
      return null;
    } finally {
      setCatalogSaving(false);
    }
  }

  async function toggleContractor(contractor) {
    if (!contractor?.id) return null;
    return saveContractor({ ...contractor, ativo: contractor.ativo === false });
  }

  async function saveContractorAssignment(values) {
    if (!activeWork?.id) {
      setScheduleError('Selecione uma obra antes de vincular empreiteiro.');
      return null;
    }
    if (!values.scheduleItemId) {
      setScheduleError('Selecione um subitem para vincular empreiteiro.');
      return null;
    }

    const activeAssignment = data.contractorAssignments.find((item) => (
      item.scheduleItemId === values.scheduleItemId && item.ativo !== false
    ));
    const isFirstContractorAssignment = !activeAssignment;

    setScheduleSaving(true);
    setScheduleError('');

    try {
      if (!values.contractorId) {
        if (!activeAssignment) return { scheduleItemId: values.scheduleItemId, contractorId: '' };
        const patch = { ativo: false };
        if (supabaseConfigured && session) {
          await updateChild('contractorAssignments', activeAssignment.id, patch);
        }
        const inactiveAssignment = { ...activeAssignment, ...patch };
        setData((current) => ({
          ...current,
          contractorAssignments: current.contractorAssignments.map((item) => (
            item.id === activeAssignment.id ? inactiveAssignment : item
          )),
        }));
        return inactiveAssignment;
      }

      const normalized = {
        id: values.id || activeAssignment?.id || '',
        scheduleItemId: values.scheduleItemId,
        contractorId: values.contractorId,
        dataInicio: values.dataInicio || '',
        dataFim: values.dataFim || '',
        valorContratado: normalizeMoneyValue(values.valorContratado),
        formaPagamento: String(values.formaPagamento || '').trim(),
        observacoes: String(values.observacoes || '').trim(),
        ativo: true,
      };

      let saved;
      if (normalized.id) {
        if (supabaseConfigured && session) {
          await updateChild('contractorAssignments', normalized.id, normalized);
        }
        saved = { ...activeAssignment, ...normalized, updatedAt: new Date().toISOString() };
      } else {
        const localAssignment = {
          ...normalized,
          id: makeId('empreiteiro-subitem'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saved = supabaseConfigured && session
          ? await insertChild('contractorAssignments', activeWork.id, localAssignment)
          : localAssignment;
      }

      setData((current) => ({
        ...current,
        contractorAssignments: current.contractorAssignments.some((item) => item.id === saved.id)
          ? current.contractorAssignments.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current.contractorAssignments],
      }));

      const contractor = data.contractors.find((item) => item.id === saved.contractorId);
      const subitem = data.scheduleItems.find((item) => item.id === saved.scheduleItemId);
      if (!isFirstContractorAssignment && contractor && subitem) {
        void notifyCompany({
          projectId: activeWork.id,
          type: 'subitem_updated',
          title: 'Empreiteiro vinculado',
          body: `${currentObrasUser?.nome || 'Usuario Obras'} vinculou ${contractor.nome} ao subitem ${subitem.nome}.`,
          payload: {
            workName: activeWork.nome,
            scheduleItemId: subitem.id,
            subitemName: subitem.nome,
            contractorName: contractor.nome,
          },
        });
      }
      return saved;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel vincular o empreiteiro.');
      return null;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveContractorAssignmentsBulk({ contractorId, assignments = [] }) {
    if (!activeWork?.id) {
      setScheduleError('Selecione uma obra antes de vincular empreiteiro.');
      return null;
    }
    if (!contractorId) {
      setScheduleError('Selecione um empreiteiro.');
      return null;
    }
    if (!assignments.length) {
      setScheduleError('Selecione pelo menos um subitem.');
      return null;
    }

    setScheduleSaving(true);
    setScheduleError('');

    try {
      const now = new Date().toISOString();
      const activeAssignmentsBySubitem = new Map();
      data.contractorAssignments
        .filter((item) => item.ativo !== false)
        .forEach((item) => {
          activeAssignmentsBySubitem.set(item.scheduleItemId, item);
        });

      const savedAssignments = [];
      for (const assignment of assignments) {
        const activeAssignment = activeAssignmentsBySubitem.get(assignment.scheduleItemId);
        const normalized = {
          id: assignment.id || activeAssignment?.id || '',
          scheduleItemId: assignment.scheduleItemId,
          contractorId,
          dataInicio: assignment.dataInicio || '',
          dataFim: assignment.dataFim || '',
          valorContratado: normalizeMoneyValue(assignment.valorContratado),
          formaPagamento: String(assignment.formaPagamento || '').trim(),
          observacoes: String(assignment.observacoes || '').trim(),
          ativo: true,
        };

        let saved;
        if (normalized.id) {
          if (supabaseConfigured && session) {
            await updateChild('contractorAssignments', normalized.id, normalized);
          }
          saved = { ...activeAssignment, ...normalized, updatedAt: now };
        } else {
          const localAssignment = {
            ...normalized,
            id: makeId('empreita-subitem'),
            projectId: activeWork.id,
            createdAt: now,
            updatedAt: now,
          };
          saved = supabaseConfigured && session
            ? await insertChild('contractorAssignments', activeWork.id, localAssignment)
            : localAssignment;
        }

        const scheduleItem = data.scheduleItems.find((item) => item.id === saved.scheduleItemId);
        if (scheduleItem && normalizeMoneyValue(scheduleItem.valorMaoObra) !== saved.valorContratado) {
          if (supabaseConfigured && session) {
            await updateChild('scheduleItems', saved.scheduleItemId, { valorMaoObra: saved.valorContratado });
          }
        }

        savedAssignments.push({ ...saved, updatedAt: saved.updatedAt || now });
      }

      const savedById = new Map(savedAssignments.map((item) => [item.id, item]));
      const savedBySubitem = new Map(savedAssignments.map((item) => [item.scheduleItemId, item]));

      setData((current) => ({
        ...current,
        contractorAssignments: [
          ...current.contractorAssignments.filter((item) => (
            !savedById.has(item.id) && !savedBySubitem.has(item.scheduleItemId)
          )),
          ...savedAssignments,
        ],
        scheduleItems: current.scheduleItems.map((item) => {
          const saved = savedBySubitem.get(item.id);
          return saved ? { ...item, valorMaoObra: saved.valorContratado, updatedAt: now } : item;
        }),
      }));

      return savedAssignments;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar a empreita.');
      return null;
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveContractSchedulePlan({ contractorId = '', stages = [], removedItemIds = [] }) {
    if (!activeWork?.id) {
      setScheduleError('Selecione uma obra antes de salvar o cronograma.');
      return null;
    }
    if (!stages.length && !removedItemIds.length) {
      setScheduleError('Adicione pelo menos um item ao cronograma.');
      return null;
    }

    const previousItems = data.scheduleItems;
    setScheduleSaving(true);
    setScheduleError('');

    try {
      const now = new Date().toISOString();
      const rawItems = previousItems.map((item) => ({ ...item }));
      const savedAssignments = [];
      const activeAssignmentsBySubitem = new Map();
      data.contractorAssignments
        .filter((item) => item.ativo !== false)
        .forEach((item) => {
          activeAssignmentsBySubitem.set(item.scheduleItemId, item);
        });

      function upsertRawItem(item) {
        const index = rawItems.findIndex((current) => current.id === item.id);
        if (index >= 0) {
          rawItems[index] = item;
        } else {
          rawItems.push(item);
        }
      }

      const removedIds = new Set(removedItemIds.filter(Boolean));
      previousItems
        .filter((item) => removedIds.has(item.parentId))
        .forEach((item) => removedIds.add(item.id));
      if (removedIds.size) {
        if (supabaseConfigured && session) {
          await Promise.all([...removedIds].map((itemId) => (
            updateChild('scheduleItems', itemId, { visible: false })
          )));
        }
        rawItems.forEach((item, index) => {
          if (removedIds.has(item.id)) {
            rawItems[index] = { ...item, visible: false, updatedAt: now };
          }
        });
      }

      for (const [stageIndex, stage] of stages.entries()) {
        const existingStage = previousItems.find((item) => item.id === (stage.sourceId || stage.id));
        const stagePatch = {
          parentId: '',
          nome: String(stage.nome || '').trim() || 'Novo item',
          itemType: 'stage',
          visible: true,
          sortOrder: stageIndex,
        };

        let savedStage;
        if (existingStage) {
          if (supabaseConfigured && session) {
            await updateChild('scheduleItems', existingStage.id, stagePatch);
          }
          savedStage = { ...existingStage, ...stagePatch, updatedAt: now };
        } else {
          const stageItem = {
            ...stagePatch,
            id: makeId('etapa-cronograma'),
            createdAt: now,
            updatedAt: now,
          };
          savedStage = supabaseConfigured && session
            ? await insertChild('scheduleItems', activeWork.id, stageItem)
            : stageItem;
        }
        upsertRawItem(savedStage);

        for (const [subitemIndex, subitem] of (stage.subitems || []).entries()) {
          const value = normalizeMoneyValue(subitem.valorMaoObra);
          const existingSubitem = previousItems.find((item) => item.id === (subitem.sourceId || subitem.id));
          const subitemPatch = {
            parentId: savedStage.id,
            nome: String(subitem.nome || '').trim() || 'Novo subitem',
            itemType: 'task',
            inicioPrevisto: subitem.inicioPrevisto || '',
            fimPrevisto: subitem.fimPrevisto || '',
            valorMaoObra: value,
            sortOrder: subitemIndex,
            visible: true,
          };

          let savedSubitem;
          if (existingSubitem) {
            if (supabaseConfigured && session) {
              await updateChild('scheduleItems', existingSubitem.id, subitemPatch);
            }
            savedSubitem = { ...existingSubitem, ...subitemPatch, updatedAt: now };
          } else {
            const subitemItem = {
              ...subitemPatch,
              id: makeId('subitem'),
              inicioReal: '',
              fimReal: '',
              status: 'Nao iniciado',
              percentual: 0,
              categoriaServicoId: '',
              createdAt: now,
              updatedAt: now,
            };
            savedSubitem = supabaseConfigured && session
              ? await insertChild('scheduleItems', activeWork.id, subitemItem)
              : subitemItem;
          }
          upsertRawItem(savedSubitem);

          if (contractorId && value > 0) {
            const activeAssignment = activeAssignmentsBySubitem.get(savedSubitem.id);
            const assignment = {
              id: activeAssignment?.id || '',
              projectId: activeWork.id,
              scheduleItemId: savedSubitem.id,
              contractorId,
              dataInicio: savedSubitem.inicioPrevisto,
              dataFim: savedSubitem.fimPrevisto,
              valorContratado: value,
              formaPagamento: '',
              observacoes: '',
              ativo: true,
              createdAt: now,
              updatedAt: now,
            };
            let savedAssignment;
            if (activeAssignment?.id) {
              if (supabaseConfigured && session) {
                await updateChild('contractorAssignments', activeAssignment.id, assignment);
              }
              savedAssignment = { ...activeAssignment, ...assignment, updatedAt: now };
            } else {
              const localAssignment = {
                ...assignment,
                id: makeId('empreita-subitem'),
              };
              savedAssignment = supabaseConfigured && session
                ? await insertChild('contractorAssignments', activeWork.id, localAssignment)
                : localAssignment;
            }
            savedAssignments.push(savedAssignment);
          }
        }
      }

      const nextItems = deriveScheduleStages(rawItems);
      await persistScheduleDerivations(previousItems, nextItems);

      if (savedAssignments.length) {
        const savedById = new Map(savedAssignments.map((item) => [item.id, item]));
        const savedBySubitem = new Map(savedAssignments.map((item) => [item.scheduleItemId, item]));
        setData((current) => ({
          ...current,
          contractorAssignments: [
            ...current.contractorAssignments.filter((item) => (
              !savedById.has(item.id) && !savedBySubitem.has(item.scheduleItemId)
            )),
            ...savedAssignments,
          ],
        }));
      }

      return { items: nextItems, assignments: savedAssignments };
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel salvar o cronograma.');
      return null;
    } finally {
      setScheduleSaving(false);
    }
  }

  function renderScreen() {
    const publicScreens = ['login', 'signup'];

    if (authInitializing && screen !== 'signup') {
      return <EmptyNotice Icon={Database} title="Carregando Obras" text="Restaurando sessao e preparando os dados do banco." />;
    }

    if (!publicScreens.includes(screen) && sessionHydrating) {
      return <EmptyNotice Icon={Database} title="Carregando Obras" text="Sincronizando usuario, empresa e obras antes de abrir o painel." />;
    }

    if (!publicScreens.includes(screen) && dataLoading) {
      return <EmptyNotice Icon={Database} title="Carregando banco de dados" text="Sincronizando obras, etapas e pendencias." />;
    }

    if (!publicScreens.includes(screen) && dataError) {
      return (
        <>
          <section className="warning-strip">
            <AlertTriangle size={22} aria-hidden="true" />
            <span>{dataError}</span>
          </section>
          <Dashboard data={cityData} setScreen={setScreen} />
        </>
      );
    }

    const projectScreens = ['workPanel', 'stages', 'stageDetail', 'photos', 'pls', 'schedule', 'contractWork', 'contractScheduleBuilder', 'issues', 'supplies', 'tools', 'checklist', 'notifications', 'documents', 'standards', 'stageLibrary', 'reports', 'workProfile'];
    if (!activeWork && projectScreens.includes(screen)) {
      return (
        <>
          <PageTitle eyebrow={selectedCity.nome} title="Nenhuma obra cadastrada" subtitle="Cadastre uma obra para acessar os modulos desta cidade." />
          <EmptyNotice Icon={Building2} title="Cidade sem obras" text="Os dados de outra cidade nao serao exibidos neste contexto." />
          <div className="form-actions">
            <ActionButton Icon={Plus} onClick={() => setScreen('newWork')}>Nova obra</ActionButton>
          </div>
        </>
      );
    }

    const screenRequirement = getProjectScreenRequirement(screen);
    if (activeWork && !hasLoadedProjectRequirement(selectedWorkId, screenRequirement)) {
      return (
        <>
          <PageTitle
            eyebrow={activeWork.nome}
            title="Carregando dados da obra"
            subtitle="Buscando somente as informacoes necessarias para esta tela."
            onBack={() => setScreen('workPanel')}
          />
          <EmptyNotice
            Icon={Database}
            title={projectDetailsLoading ? 'Sincronizando modulo' : 'Preparando modulo'}
            text="O painel principal abre sem esperar fotos, cronograma e demais tabelas."
          />
        </>
      );
    }

    switch (screen) {
      case 'login':
        return (
          <LoginScreen
            onLogin={handleLogin}
            authError={authError}
            authLoading={authLoading}
            dbAvailable={supabaseConfigured}
            onOpenSignup={() => setScreen('signup')}
          />
        );
      case 'signup':
        return <SignupRequestScreen dbAvailable={supabaseConfigured} onBack={() => setScreen('login')} />;
      case 'dashboard':
        return <Dashboard data={cityData} setScreen={setScreen} />;
      case 'cities':
        return <Cities works={data.works} neighborhoods={data.neighborhoods || []} openCity={(city) => void handleCityChange(city.id, 'neighborhoods')} />;
      case 'neighborhoods':
        return <Neighborhoods works={cityWorks} neighborhoods={data.neighborhoods || []} selectedCity={selectedCity} openNeighborhood={(bairro) => { setSelectedNeighborhood(bairro); setScreen('works'); }} setScreen={setScreen} />;
      case 'works':
        return <Works selectedCity={selectedCity} selectedNeighborhood={selectedNeighborhood} works={cityWorks} openWork={selectWork} setScreen={setScreen} />;
      case 'newWork':
        return <NewWork createWork={createWork} setScreen={setScreen} selectedCity={selectedCity} works={data.works} neighborhoods={data.neighborhoods || []} onAddNeighborhood={saveNeighborhood} onProjectAnalyzed={setAiProjectDraft} />;
      case 'extractedData':
        return <ExtractedData createWork={createWork} setScreen={setScreen} draft={aiProjectDraft} works={data.works} neighborhoods={data.neighborhoods || []} onAddNeighborhood={saveNeighborhood} />;
      case 'workPanel':
        return <WorkPanel obra={activeWork} data={cityData} setScreen={setScreen} />;
      case 'stages':
        return (
          <Stages
            scheduleItems={data.scheduleItems}
            logs={data.scheduleLogs}
            photos={data.photos}
            issues={data.issues}
            addPhoto={addPhoto}
            addIssue={addIssue}
            setScreen={setScreen}
          />
        );
      case 'contractWork':
        return (
          <ContractWork
            items={data.scheduleItems}
            contractors={data.contractors || []}
            contractorAssignments={data.contractorAssignments || []}
            saving={scheduleSaving}
            error={scheduleError}
            onSaveAssignments={saveContractorAssignmentsBulk}
            setScreen={setScreen}
          />
        );
      case 'contractScheduleBuilder':
        return (
          <ContractScheduleBuilder
            items={data.scheduleItems || []}
            contractors={data.contractors || []}
            contractorAssignments={data.contractorAssignments || []}
            saving={scheduleSaving}
            error={scheduleError}
            onSavePlan={saveContractSchedulePlan}
            setScreen={setScreen}
          />
        );
      case 'stageDetail':
        return <StageDetail stage={activeStage} updateStage={updateStage} addPhoto={addPhoto} addIssue={addIssue} setScreen={setScreen} />;
      case 'photos':
        return (
          <Photos
            photos={data.photos}
            scheduleItems={data.scheduleItems}
            addPhoto={addPhoto}
            deletePhoto={deletePhoto}
            deletingPhotoId={deletingPhotoId}
            error={photoError}
            setScreen={setScreen}
          />
        );
      case 'pls':
        return <Pls plsItems={data.plsItems} updatePls={updatePls} addPhoto={addPhoto} setScreen={setScreen} />;
      case 'schedule':
        return (
          <Schedule
            items={data.scheduleItems}
            logs={data.scheduleLogs}
            checklist={data.checklist}
            checklistResults={data.checklistResults || []}
            serviceCategories={data.serviceCategories || []}
            contractors={data.contractors || []}
            contractorAssignments={data.contractorAssignments || []}
            saving={scheduleSaving}
            error={scheduleError}
            onSaveItem={saveScheduleItem}
            onUpdateItem={updateScheduleItem}
            onSetVisibility={setScheduleItemVisibility}
            onSaveLog={saveScheduleLog}
            onDeleteLog={deleteScheduleLog}
            onSaveChecklist={saveScheduleChecklist}
            onDeleteChecklist={deleteScheduleChecklist}
            onSaveChecklistCheck={saveScheduleChecklistCheck}
            onLoadChecklistPhotos={loadChecklistPhotosForItem}
            onSaveChecklistPhotos={saveChecklistPhotos}
            onSaveContractorAssignment={saveContractorAssignment}
            onReorderItem={reorderScheduleItem}
            addPhoto={addPhoto}
            setScreen={setScreen}
          />
        );
      case 'issues':
        return <Issues issues={data.issues} addIssue={addIssue} resolveIssue={resolveIssue} setScreen={setScreen} />;
      case 'companies':
        return (
          <Companies
            accounts={obrasAccounts}
            plans={commercialPlans}
            currentUser={currentObrasUser}
            platformAdmin={platformAdmin}
            loading={accountsLoading}
            saving={accountsSaving}
            error={accountsError}
            message={accountsMessage}
            onRefresh={() => loadObrasAccounts({ signLogos: true })}
            onSave={saveObrasAccount}
            setScreen={setScreen}
          />
        );
      case 'users':
        return (
          <Users
            users={cityUsers}
            currentUser={currentObrasUser}
            loading={usersLoading}
            error={usersError}
            message={usersMessage}
            saving={usersSaving}
            canManage={canManageObrasUsers}
            onRefresh={() => loadRemoteUsers({ signAvatars: true })}
            onSave={saveObrasUser}
            onToggle={toggleObrasUser}
            setScreen={setScreen}
          />
        );
      case 'serviceCategories':
        return (
          <ServiceCategories
            categories={data.serviceCategories || []}
            saving={catalogSaving}
            error={catalogError}
            message={catalogMessage}
            onSave={saveServiceCategory}
            onToggle={toggleServiceCategory}
            setScreen={setScreen}
          />
        );
      case 'contractors':
        return (
          <Contractors
            contractors={data.contractors || []}
            saving={catalogSaving}
            error={catalogError}
            message={catalogMessage}
            onSave={saveContractor}
            onToggle={toggleContractor}
            setScreen={setScreen}
          />
        );
      case 'commercial':
        return (
          <CommercialSubscriptions
            plans={commercialPlans}
            requests={signupRequests}
            subscriptions={subscriptions}
            currentUser={currentObrasUser}
            isPlatformAdmin={platformAdmin}
            loading={commercialLoading}
            saving={commercialSaving}
            error={commercialError}
            message={commercialMessage}
            onRefresh={loadCommercialData}
            onUpdateRequest={updateSignupRequestStatus}
            setScreen={setScreen}
          />
        );
      case 'supplies':
        return <TableList eyebrow="Insumos" title="Materiais por etapa" subtitle="Previsto, usado, status e observacoes." items={data.supplies} setScreen={setScreen} onPrimary={() => updateFirst('supplies', (item) => ({ ...item, usada: item.usada + 1, status: 'Comprado' }))} primaryLabel="Atualizar insumo" PrimaryIcon={PackageCheck} />;
      case 'tools':
        return <TableList eyebrow="Ferramentas" title="Ferramentas e equipamentos" subtitle="Controle por etapa, tipo e disponibilidade." items={data.tools} setScreen={setScreen} onPrimary={() => updateFirst('tools', (item) => ({ ...item, status: item.status === 'Disponivel' ? 'Em falta' : 'Disponivel' }))} primaryLabel="Alternar status" PrimaryIcon={Wrench} />;
      case 'checklist':
        return (
          <ChecklistOverview
            scheduleItems={data.scheduleItems}
            checklist={data.checklist}
            checklistResults={data.checklistResults || []}
            scheduleLogs={data.scheduleLogs}
            setScreen={setScreen}
          />
        );
      case 'notifications':
        return (
          <Notifications
            data={data}
            activeWork={activeWork}
            users={obrasUsers}
            currentUser={currentObrasUser}
            selectedCity={selectedCity}
            notifications={obrasNotifications}
            pushSupport={pushSupport}
            pushMessage={pushMessage}
            onEnablePush={enablePushForCurrentUser}
            setScreen={setScreen}
          />
        );
      case 'documents':
      case 'standards':
        return (
          <Documents
            documents={data.documents}
            saving={documentSaving}
            deletingId={deletingDocumentId}
            error={documentError}
            onSave={saveDocument}
            onDelete={deleteDocument}
            setScreen={setScreen}
          />
        );
      case 'reports':
        return (
          <Reports
            data={data}
            activeWork={activeWork}
            account={currentObrasAccount}
            works={data.works}
            saving={rdoSaving}
            error={rdoError}
            message={rdoMessage}
            setScreen={setScreen}
            onSelectWork={(work) => selectWork(work, 'reports')}
            onSaveRdo={saveRdoReport}
            onDeleteRdo={deleteRdoReport}
            onLoadRdoPhotos={loadRdoPhotosWithUrls}
          />
        );
      case 'workProfile':
        return (
          <WorkProfile
            activeWork={activeWork}
            saving={workProfileSaving}
            error={workProfileError}
            message={workProfileMessage}
            canEdit={canEditWorkProfile}
            canDelete={canDeleteWorkProfile}
            neighborhoods={data.neighborhoods || []}
            onAddNeighborhood={saveNeighborhood}
            onSave={saveWorkProfile}
            onDelete={deleteActiveWork}
            setScreen={setScreen}
          />
        );
      case 'stageLibrary':
        return (
          <StageLibrary
            stages={data.stages}
            saving={stageSaving}
            error={stageError}
            setScreen={setScreen}
            onSave={saveStage}
            onDuplicate={duplicateStage}
            onDeactivate={deactivateStage}
          />
        );
      case 'profile':
        return (
          <Profile
            currentUser={currentObrasUser}
            saving={profileSaving}
            error={profileError}
            message={profileMessage}
            onSave={saveCurrentUserProfile}
          />
        );
      default:
        return <EmptyNotice title="Tela nao encontrada" text="Volte para o painel geral." />;
    }
  }

  return (
    <NavigationContext.Provider value={navigation}>
      <Shell
        screen={screen}
        setScreen={setScreen}
        activeWork={activeWork}
        selectedCity={selectedCity}
        cities={cityCatalog}
        onCityChange={(cityId) => void handleCityChange(cityId)}
        currentUser={currentObrasUser}
        onLogout={() => void handleLogout()}
      >
        {renderScreen()}
        {photoDraftStage ? (
          <PhotoUploadModal
            etapa={photoDraftStage}
            scheduleItems={data.scheduleItems}
            saving={photoSaving}
            error={photoError}
            onClose={() => {
              if (!photoSaving) {
                setPhotoDraftStage(null);
                setPhotoError('');
              }
            }}
            onSave={savePhoto}
          />
        ) : null}
        {issueDraftStage ? (
          <IssueModal
            etapa={issueDraftStage}
            stages={data.stages}
            activeWork={activeWork}
            saving={issueSaving}
            error={issueError}
            onClose={() => {
              if (!issueSaving) {
                setIssueDraftStage(null);
                setIssueError('');
              }
            }}
            onSave={saveIssue}
          />
        ) : null}
      </Shell>
    </NavigationContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
