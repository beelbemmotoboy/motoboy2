import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  Database,
  Trash2,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
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
  deleteProject,
  deletePhotoRecord,
  fetchProjectChildren,
  fetchProjects,
  fetchCommercialPlans,
  fetchObrasAccounts,
  fetchObrasSubscriptions,
  fetchObrasUsers,
  fetchSignupRequests,
  getSession,
  ensureProjectSchedule,
  insertChild,
  insertPhotoThumbnail,
  insertObrasUser,
  insertProject,
  insertSignupRequest,
  isObrasPlatformAdmin,
  onAuthStateChange,
  seedProjectChildren,
  signIn,
  signOut,
  supabaseConfigured,
  updateChild,
  updateObrasAccount,
  updateObrasUser,
  updateProject,
  updateSignupRequest,
  uploadObrasAccountLogo,
  uploadObrasUserAvatar,
  uploadPhotoFile,
} from './db.js';
import { analisarProjetoComGemini, geminiProjectConfig } from './analisa_projeto_gemini.js';
import { getBestPhotoUrl, prepareAvatarUpload, prepareLogoUpload, preparePhotoUpload } from './photoFunctions.js';
import {
  DEFAULT_SCHEDULE_SOURCE,
  buildScheduleCopyPlan,
  buildScheduleSourceOptions,
} from './scheduleFunctions.js';
import { buildLocalScheduleItems, defaultScheduleBlueprint } from './scheduleBlueprint.js';
import './styles.css';

const STORAGE_KEY = 'beelbem-obras-local-v1';

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

const projectCollections = ['stages', 'scheduleItems', 'scheduleLogs', 'photos', 'plsItems', 'issues', 'supplies', 'tools', 'checklist'];
const emptyProjectCollections = Object.fromEntries(projectCollections.map((collection) => [collection, []]));
const projectScreenRequirements = {
  stages: { collections: ['scheduleItems', 'scheduleLogs', 'photos', 'issues'], signPhotoUrls: false, normalizeSchedule: false },
  stageDetail: { collections: ['stages'], signPhotoUrls: false },
  photos: { collections: ['scheduleItems', 'photos'], signPhotoUrls: true, normalizeSchedule: false },
  pls: { collections: ['plsItems'], signPhotoUrls: false },
  schedule: { collections: ['scheduleItems', 'scheduleLogs', 'checklist'], signPhotoUrls: false, normalizeSchedule: true },
  issues: { collections: ['issues'], signPhotoUrls: false },
  supplies: { collections: ['supplies'], signPhotoUrls: false },
  tools: { collections: ['tools'], signPhotoUrls: false },
  checklist: { collections: ['checklist'], signPhotoUrls: false },
  reports: { collections: ['photos', 'issues'], signPhotoUrls: false },
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
};

const standards = [
  ['NR-01', 'Gerenciamento de riscos ocupacionais', 'NR', 'Geral', 'Planejamento do canteiro'],
  ['NR-18', 'Condicoes de seguranca na construcao', 'NR', 'Canteiro', 'Protecao coletiva e organizacao'],
  ['NR-10', 'Seguranca em instalacoes eletricas', 'NR', 'Eletrica', 'Riscos e documentacao'],
  ['ABNT NBR 6122', 'Projeto e execucao de fundacoes', 'ABNT', 'Fundacao', 'Execucao conforme projeto'],
  ['ABNT NBR 6118', 'Estruturas de concreto', 'ABNT', 'Fundacao', 'Armadura, cobrimento e concretagem'],
  ['ABNT NBR 8545', 'Execucao de alvenaria', 'ABNT', 'Alvenaria', 'Prumo, amarracao e juntas'],
  ['ABNT NBR 5410', 'Instalacoes eletricas de baixa tensao', 'ABNT', 'Eletrica', 'Quadros, circuitos e aterramento'],
  ['ABNT NBR 9575', 'Impermeabilizacao', 'ABNT', 'Baldrame', 'Criterios do sistema'],
].map(([codigo, nome, tipo, etapa, descricao], index) => ({
  id: `${codigo}-${index}`,
  codigo,
  nome,
  tipo,
  etapa,
  descricao,
  checklist: index % 3 === 0 ? 'Pendente' : 'Conferido',
  status: index % 4 === 0 ? 'Atencao' : 'Conferido',
}));

const reports = [
  'Relatorio completo da obra',
  'Relatorio de fotos por etapa',
  'Relatorio PLS Caixa',
  'Relatorio de pendencias',
  'Relatorio de checklist tecnico',
  'Relatorio de insumos',
];

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
  { id: 'commercial', label: 'Assinaturas', Icon: Landmark },
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
  { id: 'stages', label: 'Etapas', Icon: Layers3 },
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
          {sidebarRoutes.map(({ id, label, Icon }) => (
            <button className={screen === id ? 'active' : ''} type="button" key={id} onClick={() => setScreen(id)}>
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
          <button className="menu-button" type="button" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} aria-hidden="true" />
          </button>
          <div className="topbar-title">
            <strong>Beelbem Obras</strong>
            <label className="topbar-city">
              <MapPinned size={15} aria-hidden="true" />
              <select value={selectedCity?.id || ''} aria-label="Selecionar cidade" onChange={(event) => onCityChange(event.target.value)}>
                {cities.map((city) => (
                  <option value={city.id} key={city.id}>{city.nome}</option>
                ))}
              </select>
            </label>
            {activeWork?.nome ? <span className="topbar-work">{activeWork.nome}</span> : null}
          </div>
          <button className="topbar-logout" type="button" onClick={onLogout} title="Sair do Obras" aria-label="Sair do Obras">
            <LogOut size={19} aria-hidden="true" />
            <span>Sair</span>
          </button>
        </header>

        {mobileMenuOpen ? (
          <div className="mobile-drawer" role="dialog" aria-label="Menu">
            <div className="drawer-head">
              <strong>Beelbem Obras</strong>
              <IconButton label="Fechar menu" Icon={X} onClick={() => setMobileMenuOpen(false)} />
            </div>
            {sidebarRoutes.map(({ id, label, Icon }) => (
              <button
                className={screen === id ? 'active' : ''}
                type="button"
                key={id}
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
    <main className="login-page">
      <section className="login-visual" aria-label="Beelbem Obras">
        <div className="login-grid" />
        <div className="login-badge">
          <HardHat size={58} aria-hidden="true" />
          <strong>Beelbem Obras</strong>
          <span>Controle inteligente de obras</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="brand-lockup login-brand">
          <div className="brand-mark"><HardHat size={32} aria-hidden="true" /></div>
          <div>
            <strong>Beelbem Obras</strong>
            <span>Controle inteligente de obras</span>
          </div>
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
    { label: 'Andamento', value: data.works.filter((work) => getEffectiveWorkStatus(work) === 'Em andamento').length, Icon: Clock3, tone: 'warning', onIconClick: () => setScreen('works'), iconLabel: 'Abrir obras em andamento' },
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

function getCitySummary(works) {
  return cityCatalog.map((city) => {
    const local = works.filter((work) => work.cidadeId === city.id);
    return {
      ...city,
      obras: local.length,
      bairros: new Set(local.map((work) => work.bairroId)).size || (neighborhoodCatalog[city.id] || []).length,
      atrasadas: local.filter((work) => getEffectiveWorkStatus(work) === 'Atrasada').length,
    };
  });
}

function getNeighborhoodSummary(works, city) {
  return (neighborhoodCatalog[city?.id] || neighborhoodCatalog['rio-verde']).map((bairro) => {
    const local = works.filter((work) => work.bairroId === bairro.id);
    return {
      ...bairro,
      obras: local.length,
      andamento: local.filter((work) => getEffectiveWorkStatus(work) === 'Em andamento').length,
      atrasadas: local.filter((work) => getEffectiveWorkStatus(work) === 'Atrasada').length,
    };
  });
}

function Cities({ works, openCity }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const cities = getCitySummary(works);
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

function Neighborhoods({ works, selectedCity, openNeighborhood, setScreen }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const neighborhoods = getNeighborhoodSummary(works, selectedCity);
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

function NewWork({ createWork, setScreen, selectedCity, onProjectAnalyzed, works = [] }) {
  const [cityId, setCityId] = useState(selectedCity?.id || cityCatalog[0].id);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const manualFormRef = useRef(null);
  const neighborhoods = neighborhoodCatalog[cityId] || [];

  function submit(event) {
    event.preventDefault();
    createWork(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  async function analyzeFile(file) {
    if (!file) return;
    setAiLoading(true);
    setAiError('');
    setSelectedFileName(file.name || 'Arquivo selecionado');

    const result = await analisarProjetoComGemini({ arquivo: file });
    setAiLoading(false);

    if (!result.ok) {
      setAiError(formatGeminiProjectError(result));
      return;
    }

    const formCity = cityCatalog.find((city) => city.id === cityId) || selectedCity;
    onProjectAnalyzed(buildAiProjectDraft(result, formCity));
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
          {!aiLoading && !aiError && !geminiProjectConfig.configured ? <span>Gemini ainda nao configurado neste ambiente.</span> : null}
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
        <label className="field">
          <span>Bairro</span>
          <select name="bairroId" key={cityId} defaultValue={neighborhoods[0]?.id || ''}>
            {neighborhoods.map((bairro) => (
              <option value={bairro.id} key={bairro.id}>{bairro.nome}</option>
            ))}
          </select>
        </label>
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

function ExtractedData({ createWork, setScreen, draft, works = [] }) {
  const initialCityId = draft?.cidadeId || cityCatalog[0].id;
  const [cityId, setCityId] = useState(initialCityId);
  const neighborhoods = neighborhoodCatalog[cityId] || [];

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
        <label className="field">
          <span>Bairro</span>
          <select name="bairroId" key={cityId} defaultValue={cityId === draft.cidadeId ? draft.bairroId : neighborhoods[0]?.id || ''}>
            {neighborhoods.map((neighborhood) => <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.nome}</option>)}
          </select>
        </label>
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

function WorkPanel({ obra, data, setScreen }) {
  const cards = [
    ['Fotos', Camera, 'photos'],
    ['PLS Caixa', FileCheck2, 'pls'],
    ['Cronograma', CalendarDays, 'schedule'],
    ['Etapas', Layers3, 'stages'],
    ['Insumos', PackageCheck, 'supplies'],
    ['Ferramentas', Wrench, 'tools'],
    ['Checklist tecnico', ClipboardCheck, 'checklist'],
    ['Normas aplicaveis', ShieldCheck, 'standards'],
    ['Pendencias', AlertTriangle, 'issues'],
    ['Relatorios', BarChart3, 'reports'],
    ['Dados da obra', FileText, 'profile'],
  ];
  return (
    <>
      <PageTitle eyebrow="Painel da obra" title={obra.nome} subtitle={`${obra.cliente} - ${obra.bairro}, ${obra.cidade}`}>
        <StatusPill status={getEffectiveWorkStatus(obra)} />
      </PageTitle>
      <section className="work-hero">
        <div>
          <span>Proxima etapa</span>
          <strong>{obra.proximaEtapa}</strong>
        </div>
        <div>
          <span>Executado</span>
          <strong>{obra.percentual}%</strong>
          <ProgressBar value={obra.percentual} />
        </div>
      </section>
      <section className="module-grid">
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
    ['Normas aplicaveis', ShieldCheck, '4 normas', 'standards'],
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
    procedimento: 'Confira cada item antes de liberar o avancamento deste subitem.',
    itens: defaultScheduleChecklistItems.map(makeChecklistItem),
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

function Schedule({
  items,
  logs,
  checklist = [],
  saving,
  error,
  onSaveItem,
  onUpdateItem,
  onSetVisibility,
  onSaveLog,
  onDeleteLog,
  onSaveChecklist,
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
  const visibleItems = items.filter((item) => item.visible !== false);
  const removedItems = items.filter((item) => item.visible === false);
  const removedEntries = removedItems.filter((item) => (
    !item.parentId || items.find((parent) => parent.id === item.parentId)?.visible !== false
  ));
  const stages = visibleItems
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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

  return (
    <>
      <PageTitle eyebrow="Cronograma" title="Cronograma inteligente" subtitle="Etapas, subitens e diario de campo especificos desta obra." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={Plus} onClick={() => setItemModal({ itemType: 'stage' })}>Adicionar etapa</ActionButton>
      </PageTitle>
      <section className="schedule-toolbar">
        <span><strong>{stages.length}</strong> etapas ativas</span>
        <span><strong>{visibleItems.length - stages.length}</strong> subitens</span>
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
          return (
            <details className="schedule-stage-group" key={stage.id}>
              <summary>
                <div>
                  <strong>{stage.nome}</strong>
                  <span>{children.length} subitem{children.length === 1 ? '' : 's'}</span>
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
                    return (
                      <article className="schedule-subitem" key={item.id}>
                        <div className="schedule-subitem-main">
                          <button
                            className={`schedule-check ${item.status === 'Concluida' ? 'checked' : ''}`}
                            type="button"
                            aria-label={item.status === 'Concluida' ? 'Reabrir subitem' : 'Concluir subitem'}
                            onClick={() => onUpdateItem(item.id, {
                              status: item.status === 'Concluida' ? 'Nao iniciado' : 'Concluida',
                              percentual: item.status === 'Concluida' ? 0 : 100,
                              fimReal: item.status === 'Concluida' ? '' : new Date().toISOString().slice(0, 10),
                            })}
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <div>
                            <strong>{item.nome}</strong>
                            <span>{itemLogs.length} registros - {scheduleDateLabel(item.inicioPrevisto)} ate {scheduleDateLabel(item.fimPrevisto)}</span>
                          </div>
                          <StatusPill status={item.status} />
                        </div>
                        <ScheduleQuickDates item={item} saving={saving} onSave={onUpdateItem} />
                        <div className="schedule-actions compact">
                          <button type="button" onClick={() => setItemModal(item)}><Pencil size={16} /> Editar</button>
                          <button type="button" onClick={() => setLogItem(item)}><ClipboardCheck size={16} /> Diario</button>
                          <button type="button" onClick={() => addPhoto(item.nome)}><Camera size={16} /> Foto</button>
                          <button type="button" onClick={() => setChecklistItem(item)}>
                            <ClipboardCheck size={16} /> {itemChecklist ? 'Checklist' : '+ Checklist'}
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
                      </article>
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
          saving={saving}
          onClose={() => setItemModal(null)}
          onSave={async (values) => {
            const saved = await onSaveItem(values);
            if (saved) setItemModal(null);
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

function ScheduleChecklistModal({ item, checklist, saving, onClose, onSave }) {
  const draft = checklist || defaultChecklistForScheduleItem(item);
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
      foto: form.elements.foto.value.trim() || 'Obrigatoria',
      responsavel: form.elements.responsavel.value.trim(),
      data: form.elements.data.value.trim(),
      status: form.elements.status.value,
    });
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
          <Field label="Foto" name="foto" value={draft.foto || 'Obrigatoria'} />
          <Field label="Responsavel" name="responsavel" value={draft.responsavel || ''} />
          <Field label="Data prevista" name="data" value={draft.data || ''} />
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={draft.status || 'Nao iniciado'}>
              {['Nao iniciado', 'Em andamento', 'Conferido', 'Atencao'].map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field wide">
            <span>Descricao de como proceder</span>
            <textarea
              name="procedimento"
              defaultValue={draft.procedimento || 'Confira cada item antes de liberar o avancamento deste subitem.'}
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
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving || !previewItems.length}>
            {saving ? 'Salvando...' : 'Salvar checklist'}
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

function ScheduleItemModal({ item, saving, onClose, onSave }) {
  const isStage = !item.parentId;

  function submit(event) {
    event.preventDefault();
    const values = {
      ...item,
      ...Object.fromEntries(new FormData(event.currentTarget).entries()),
    };
    if (!isStage) {
      values.percentual = Number(event.currentTarget.elements.percentual.value || 0);
    }
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
                <span>Status</span>
                <select name="status" defaultValue={item.status || 'Nao iniciado'}>
                  {['Nao iniciado', 'Em andamento', 'Atencao', 'Concluida'].map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <Field label="Percentual" name="percentual" type="number" value={item.percentual ?? 0} />
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

function ScheduleLogModal({ item, log, saving, onClose, onSave, onDelete }) {
  const editing = Boolean(log?.id);

  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const submitter = event.nativeEvent.submitter;
    onSave({ ...values, id: log?.id || '', scheduleItemId: item.id }, submitter?.dataset?.action === 'photo');
  }

  function confirmDelete() {
    const confirmed = window.confirm('Excluir este registro do diario? Esta acao nao pode ser desfeita.');
    if (confirmed && onDelete) onDelete();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="issue-modal schedule-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Diario da obra</span>
            <h2>{editing ? 'Editar registro' : item.nome}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <Field label="Data da visita" name="visitDate" type="date" value={log?.visitDate || new Date().toISOString().slice(0, 10)} required />
          <TextAreaField label="Checklist executado" name="checklist" value={log?.checklist || ''} />
          <TextAreaField label="Observacoes" name="observacoes" value={log?.observacoes || ''} />
          <TextAreaField label="Pedido de material" name="pedidoMaterial" value={log?.pedidoMaterial || ''} />
          <TextAreaField label="Ferramentas necessarias ou usadas" name="ferramentas" value={log?.ferramentas || ''} />
          <TextAreaField label="Mao de obra presente" name="maoObra" value={log?.maoObra || ''} />
          <TextAreaField label="Observacao sobre fotos" name="fotosObservacao" value={log?.fotosObservacao || ''} />
        </div>
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

function Standards({ setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Normas aplicaveis" title="Normas tecnicas" subtitle="NR, ABNT e legislacao relacionada as etapas." onBack={() => setScreen('workPanel')} />
      <section className="standards-grid">
        {standards.map((norma) => (
          <article className="standard-card" key={norma.id}>
            <div>
              <strong>{norma.codigo}</strong>
              <StatusPill status={norma.status} />
            </div>
            <h2>{norma.nome}</h2>
            <p>{norma.descricao}</p>
            <span>{norma.tipo} - {norma.etapa}</span>
            <small>Checklist: {norma.checklist}</small>
          </article>
        ))}
      </section>
    </>
  );
}

function Reports({ data, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Relatorios" title="Documentos da obra" subtitle="PDF, visualizacao e compartilhamento." onBack={() => setScreen('workPanel')} />
      <section className="report-summary">
        <strong>Resumo atual</strong>
        <span>{data.works.length} obras - {data.photos.length} fotos - {data.issues.filter((item) => item.status !== 'Resolvida').length} pendencias abertas</span>
      </section>
      <section className="report-grid">
        {reports.map((report) => (
          <article className="report-card" key={report}>
            <FileText size={32} aria-hidden="true" />
            <strong>{report}</strong>
            <div className="button-row">
              <button type="button" onClick={() => window.print()}><FileText size={18} aria-hidden="true" /> Gerar PDF</button>
              <button type="button" onClick={() => setScreen('workPanel')}><Eye size={18} aria-hidden="true" /> Visualizar</button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2 size={18} aria-hidden="true" /> Compartilhar</button>
            </div>
          </article>
        ))}
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

function Profile({
  activeWork,
  currentUser,
  saving,
  error,
  message,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}) {
  const [cityId, setCityId] = useState(activeWork?.cidadeId || cityCatalog[0].id);
  const neighborhoods = neighborhoodCatalog[cityId] || [];
  const role = roleLabel(currentUser?.role);

  useEffect(() => {
    setCityId(activeWork?.cidadeId || cityCatalog[0].id);
  }, [activeWork?.id, activeWork?.cidadeId]);

  if (!activeWork) {
    return <EmptyNotice Icon={Building2} title="Nenhuma obra selecionada" text="Selecione uma obra para ver o perfil." />;
  }

  function submit(event) {
    event.preventDefault();
    if (!canEdit || saving) return;
    onSave(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  function confirmDelete() {
    if (!canDelete || saving) return;
    const confirmed = window.confirm(`Excluir a obra "${activeWork.nome}"? Esta acao remove o cadastro e todos os dados vinculados a ela.`);
    if (confirmed) onDelete();
  }

  return (
    <form onSubmit={submit}>
      <PageTitle eyebrow="Perfil" title="Engenharia de campo" subtitle="Responsavel tecnico e dados da obra." />
      {!canEdit ? (
        <section className="warning-strip profile-permission-note">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>{role} pode visualizar. Somente proprietarios, administradores e engenheiros podem alterar o cadastro.</span>
        </section>
      ) : null}
      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      <section className="profile-summary-grid">
        <article className="profile-card">
          <Building2 size={34} aria-hidden="true" />
          <strong>{activeWork.nome}</strong>
          <span>{getEffectiveWorkStatus(activeWork)}</span>
          <p>{activeWork.percentual}% executado - {activeWork.pendencias} pendencias</p>
          <p>{activeWork.pls || 'PLS pendente'}</p>
        </article>
        <article className="profile-card">
          <UserRound size={34} aria-hidden="true" />
          <strong>{activeWork.responsavel || 'Responsavel nao informado'}</strong>
          <span>Responsavel tecnico</span>
          <p>{activeWork.bairro}, {activeWork.cidade}</p>
        </article>
      </section>
      <section className="form-grid profile-edit-form">
        <Field label="Nome da obra" name="nome" value={activeWork.nome} required disabled={!canEdit || saving} />
        <Field label="Cliente" name="cliente" value={activeWork.cliente} required disabled={!canEdit || saving} />
        <label className="field">
          <span>Cidade</span>
          <select name="cidadeId" value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={!canEdit || saving}>
            {cityCatalog.map((city) => (
              <option value={city.id} key={city.id}>{city.nome}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Bairro</span>
          <select name="bairroId" key={cityId} defaultValue={cityId === activeWork.cidadeId ? activeWork.bairroId : neighborhoods[0]?.id || ''} disabled={!canEdit || saving}>
            {neighborhoods.map((bairro) => (
              <option value={bairro.id} key={bairro.id}>{bairro.nome}</option>
            ))}
          </select>
        </label>
        <Field label="Endereco" name="endereco" value={activeWork.endereco} wide required disabled={!canEdit || saving} />
        <Field label="Quadra" name="quadra" value={activeWork.quadra} disabled={!canEdit || saving} />
        <Field label="Lote" name="lote" value={activeWork.lote} disabled={!canEdit || saving} />
        <Field label="Area construida" name="areaConstruida" value={activeWork.areaConstruida} disabled={!canEdit || saving} />
        <Field label="Area do terreno" name="areaTerreno" value={activeWork.areaTerreno} disabled={!canEdit || saving} />
        <Field label="Numero de pavimentos" name="pavimentos" value={activeWork.pavimentos} disabled={!canEdit || saving} />
        <Field label="Responsavel tecnico" name="responsavel" value={activeWork.responsavel} disabled={!canEdit || saving} />
        <TextAreaField label="Observacoes" name="observacoes" value={activeWork.observacoes} disabled={!canEdit || saving} />
      </section>
      <div className="form-actions">
        <ActionButton Icon={Save} type="submit" disabled={!canEdit || saving}>
          {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </ActionButton>
      </div>
      <section className="profile-danger-zone">
        <div>
          <strong>Excluir obra</strong>
          <p>Remove esta obra e os dados vinculados. Esta acao e permitida apenas para proprietarios e administradores.</p>
        </div>
        <ActionButton Icon={Trash2} variant="danger" onClick={confirmDelete} disabled={!canDelete || saving}>
          Excluir obra
        </ActionButton>
      </section>
    </form>
  );
}

function resolveLocation(values) {
  const city = cityCatalog.find((item) => item.id === values.cidadeId) || cityCatalog[0];
  const allNeighborhoods = Object.values(neighborhoodCatalog).flat();
  const neighborhood = allNeighborhoods.find((item) => item.id === values.bairroId) || neighborhoodCatalog[city.id][0];
  return { city, neighborhood };
}

function buildAiProjectDraft(result, selectedCity) {
  const values = result.valores || {};
  const requestedCity = normalizeSearch(values.cidade);
  const city = cityCatalog.find((item) => {
    const catalogName = normalizeSearch(item.nome);
    return requestedCity && (requestedCity === catalogName || requestedCity.includes(catalogName));
  }) || selectedCity || cityCatalog[0];
  const neighborhoods = neighborhoodCatalog[city.id] || [];
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
  const [data, setData] = useState(() => (supabaseConfigured ? initialData : loadData()));
  const [session, setSession] = useState(null);
  const [authInitializing, setAuthInitializing] = useState(supabaseConfigured);
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
  const [issueDraftStage, setIssueDraftStage] = useState(null);
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [obrasAccounts, setObrasAccounts] = useState(localObrasAccounts);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsSaving, setAccountsSaving] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [accountsMessage, setAccountsMessage] = useState('');
  const [obrasUsers, setObrasUsers] = useState(localObrasUsers);
  const [currentObrasUser, setCurrentObrasUser] = useState(localObrasUsers[0]);
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
  const [aiProjectDraft, setAiProjectDraft] = useState(null);
  const [selectedCity, setSelectedCity] = useState(cityCatalog[0]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState(initialData.works[0].id);
  const [selectedStageId, setSelectedStageId] = useState(initialData.stages[0].id);

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

      if (isGanttSurface) return;

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
        setSession(null);
        setCurrentObrasUser(null);
        setObrasUsers([]);
        setObrasAccounts([]);
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
    void loadObrasAccounts();
  }, [screen, session?.user?.id, platformAdmin]);

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
  const activeStage = data.stages.find((stage) => stage.id === selectedStageId) || data.stages[0];
  const canManageObrasUsers = !supabaseConfigured || ['owner', 'admin'].includes(currentObrasUser?.role);
  const canManageCompanyAccount = !supabaseConfigured || platformAdmin || ['owner', 'admin'].includes(currentObrasUser?.role);
  const canEditWorkProfile = !supabaseConfigured || ['owner', 'admin', 'engenheiro'].includes(currentObrasUser?.role);
  const canDeleteWorkProfile = !supabaseConfigured || ['owner', 'admin'].includes(currentObrasUser?.role);

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

  async function hydrateRemoteSession() {
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
      await loadObrasAccounts();
      await loadRemoteData();
    } catch {
      // The specific loading error is already displayed by the failing request.
    }
  }

  async function loadRemoteUsers() {
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
      const users = await fetchObrasUsers();
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

  async function loadObrasAccounts() {
    setAccountsLoading(true);
    setAccountsError('');
    setAccountsMessage('');

    if (!supabaseConfigured || !session) {
      setObrasAccounts(localObrasAccounts);
      setAccountsLoading(false);
      return;
    }

    try {
      const accounts = await fetchObrasAccounts();
      setObrasAccounts(accounts);
    } catch (error) {
      setAccountsError(error.message || 'Nao foi possivel carregar empresas do Obras.');
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadRemoteData(preferredProjectId) {
    setDataLoading(true);
    setDataError('');
    try {
      let works = await fetchProjects();

      if (!works.length) {
        setData({
          ...initialData,
          works: [],
          ...emptyProjectCollections,
        });
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
      setData({ ...initialData, ...emptyProjectCollections, works });
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
        setSession(null);
        setCurrentObrasUser(null);
        setObrasUsers([]);
        setAuthError('Este e-mail nao esta cadastrado no sistema Obras.');
        return;
      }
      setCurrentObrasUser(obrasUser);
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
        await signOut();
      }
    } catch (error) {
      setAuthError(error.message || 'Nao foi possivel sair do Obras.');
    } finally {
      setSession(null);
      setCurrentObrasUser(supabaseConfigured ? null : localObrasUsers[0]);
      setObrasUsers(supabaseConfigured ? [] : localObrasUsers);
      setObrasAccounts(supabaseConfigured ? [] : localObrasAccounts);
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
    const { city, neighborhood } = resolveLocation(values);
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
        await seedProjectChildren(nextWork.id, {
          ...initialData,
          scheduleItems: [],
          scheduleLogs: [],
          photos: [],
          plsItems: [],
          issues: [],
        });
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
    setScreen('workPanel');
  }

  async function saveWorkProfile(values) {
    if (!activeWork || !canEditWorkProfile) return;

    setProfileSaving(true);
    setProfileError('');
    setProfileMessage('');

    const { city, neighborhood } = resolveLocation(values);
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
      setProfileMessage('Cadastro da obra atualizado.');
    } catch (error) {
      setProfileError(error.message || 'Nao foi possivel atualizar o cadastro da obra.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function deleteActiveWork() {
    if (!activeWork || !canDeleteWorkProfile) return;

    setProfileSaving(true);
    setProfileError('');
    setProfileMessage('');

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
      setProfileError(error.message || 'Nao foi possivel excluir a obra.');
    } finally {
      setProfileSaving(false);
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
        status: values.status || 'Nao iniciado',
        percentual: Math.min(100, Math.max(0, Number(values.percentual) || 0)),
      } : {}),
    };

    setScheduleSaving(true);
    setScheduleError('');
    try {
      let saved;
      let rawItems;
      if (values.id) {
        saved = { ...previousItems.find((item) => item.id === values.id), ...normalized };
        if (supabaseConfigured && session) {
          await updateChild('scheduleItems', values.id, normalized);
        }
        rawItems = previousItems.map((item) => (item.id === values.id ? saved : item));
      } else {
        const siblings = previousItems.filter((item) => item.parentId === parentId);
        const item = {
          ...normalized,
          id: makeId(parentId ? 'subitem' : 'etapa-cronograma'),
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
            sortOrder: 0,
            visible: true,
          };
          const savedChild = supabaseConfigured && session
            ? await insertChild('scheduleItems', activeWork.id, initialChild)
            : initialChild;
          rawItems.push(savedChild);
        }
      }

      const nextItems = deriveScheduleStages(rawItems);
      await persistScheduleDerivations(previousItems, nextItems);
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
    const rawItems = previousItems.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const nextItems = deriveScheduleStages(rawItems);

    setScheduleSaving(true);
    setScheduleError('');
    try {
      if (supabaseConfigured && session) {
        await updateChild('scheduleItems', id, patch);
      }
      await persistScheduleDerivations(previousItems, nextItems);
      return true;
    } catch (error) {
      setScheduleError(error.message || 'Nao foi possivel atualizar o cronograma.');
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

    const nextLog = {
      ...values,
      visitDate: values.visitDate || new Date().toISOString().slice(0, 10),
    };
    setScheduleSaving(true);
    setScheduleError('');
    try {
      let saved;
      if (nextLog.id) {
        saved = {
          ...(data.scheduleLogs.find((log) => log.id === nextLog.id) || {}),
          ...nextLog,
        };
        if (supabaseConfigured && session) {
          await updateChild('scheduleLogs', nextLog.id, nextLog);
        }
      } else {
        saved = supabaseConfigured && session
          ? await insertChild('scheduleLogs', activeWork.id, nextLog)
          : { ...nextLog, id: makeId('diario'), createdAt: new Date().toISOString() };
      }
      setData((current) => ({
        ...current,
        scheduleLogs: nextLog.id
          ? current.scheduleLogs.map((log) => (log.id === saved.id ? saved : log))
          : [saved, ...current.scheduleLogs],
      }));
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

  function renderScreen() {
    const publicScreens = ['login', 'signup'];

    if (authInitializing && screen !== 'signup') {
      return (
        <LoginScreen
          onLogin={(event) => event.preventDefault()}
          authError=""
          authLoading
          dbAvailable={supabaseConfigured}
          onOpenSignup={() => setScreen('signup')}
        />
      );
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

    const projectScreens = ['workPanel', 'stages', 'stageDetail', 'photos', 'pls', 'schedule', 'issues', 'supplies', 'tools', 'checklist', 'standards', 'stageLibrary', 'profile'];
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
        return <Cities works={data.works} openCity={(city) => void handleCityChange(city.id, 'neighborhoods')} />;
      case 'neighborhoods':
        return <Neighborhoods works={cityWorks} selectedCity={selectedCity} openNeighborhood={(bairro) => { setSelectedNeighborhood(bairro); setScreen('works'); }} setScreen={setScreen} />;
      case 'works':
        return <Works selectedCity={selectedCity} selectedNeighborhood={selectedNeighborhood} works={cityWorks} openWork={(work) => {
          setSelectedWorkId(work.id);
          if (projectDataProjectId !== work.id) {
            setProjectDataProjectId('');
            setLoadedProjectCollections([]);
            setPhotoUrlsProjectId('');
          }
          setScreen('workPanel');
        }} setScreen={setScreen} />;
      case 'newWork':
        return <NewWork createWork={createWork} setScreen={setScreen} selectedCity={selectedCity} works={data.works} onProjectAnalyzed={setAiProjectDraft} />;
      case 'extractedData':
        return <ExtractedData createWork={createWork} setScreen={setScreen} draft={aiProjectDraft} works={data.works} />;
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
            saving={scheduleSaving}
            error={scheduleError}
            onSaveItem={saveScheduleItem}
            onUpdateItem={updateScheduleItem}
            onSetVisibility={setScheduleItemVisibility}
            onSaveLog={saveScheduleLog}
            onDeleteLog={deleteScheduleLog}
            onSaveChecklist={saveScheduleChecklist}
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
            onRefresh={loadObrasAccounts}
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
            onRefresh={loadRemoteUsers}
            onSave={saveObrasUser}
            onToggle={toggleObrasUser}
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
        return <TableList eyebrow="Checklist tecnico" title="Conferencias por etapa" subtitle="Itens, normas, fotos e responsaveis." items={data.checklist} setScreen={setScreen} onPrimary={() => updateFirst('checklist', (item) => ({ ...item, status: item.status === 'Conferido' ? 'Atencao' : 'Conferido' }))} primaryLabel="Conferir item" PrimaryIcon={ClipboardCheck} />;
      case 'standards':
        return <Standards setScreen={setScreen} />;
      case 'reports':
        return <Reports data={cityData} setScreen={setScreen} />;
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
            activeWork={activeWork}
            currentUser={currentObrasUser}
            saving={profileSaving}
            error={profileError}
            message={profileMessage}
            canEdit={canEditWorkProfile}
            canDelete={canDeleteWorkProfile}
            onSave={saveWorkProfile}
            onDelete={deleteActiveWork}
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
