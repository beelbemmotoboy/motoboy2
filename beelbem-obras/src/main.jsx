import React, { useEffect, useMemo, useState } from 'react';
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
  MapPinned,
  Menu,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  fetchProjectChildren,
  fetchProjects,
  getSession,
  insertChild,
  insertProject,
  onAuthStateChange,
  seedProjectChildren,
  signIn,
  supabaseConfigured,
  updateChild,
  updateProject,
  uploadPhotoFile,
} from './db.js';
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
  'Pronto para enviar': 'info',
  Enviado: 'info',
  IA: 'ai',
  'Analise IA': 'ai',
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
  { id: 'pls', label: 'PLS Caixa', Icon: FileCheck2 },
  { id: 'reports', label: 'Relatorios', Icon: BarChart3 },
  { id: 'stageLibrary', label: 'Biblioteca', Icon: Library },
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
  return (
    <article className={`metric-card tone-${tone}`}>
      {onIconClick ? (
        <button className="metric-action-icon" type="button" aria-label={iconLabel || label} title={iconLabel || label} onClick={onIconClick}>
          <Icon size={22} aria-hidden="true" />
        </button>
      ) : (
        <span className="metric-action-icon metric-action-icon-static">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <strong>{value}</strong>
      <span>{label}</span>
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

function PageTitle({ eyebrow, title, subtitle, children, onBack }) {
  return (
    <header className="page-title">
      <div>
        <div className="title-row">
          {onBack ? <IconButton label="Voltar" Icon={ChevronLeft} onClick={onBack} /> : null}
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

function Field({ label, name, value, type = 'text', wide = false, required = false }) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <input type={type} name={name} defaultValue={value || ''} required={required} />
    </label>
  );
}

function SelectField({ label, name, value, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, name, value }) {
  return (
    <label className="field wide">
      <span>{label}</span>
      <textarea name={name} defaultValue={value || ''} rows={4} />
    </label>
  );
}

function Shell({ screen, setScreen, children, activeWork }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (screen === 'login') return children;

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
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} aria-hidden="true" />
          </button>
          <div>
            <strong>{activeWork?.nome || 'Painel de obras'}</strong>
            <span>{activeWork ? `${activeWork.bairro}, ${activeWork.cidade}` : 'Dados locais'}</span>
          </div>
          <button className="topbar-ai" type="button" onClick={() => setScreen('newWork')}>
            <Bot size={19} aria-hidden="true" />
            <span>IA</span>
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

function LoginScreen({ onLogin, authError, authLoading, dbAvailable }) {
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
        </form>
      </section>
    </main>
  );
}

function Dashboard({ data, setScreen }) {
  const cityCount = new Set(data.works.map((work) => work.cidadeId)).size;
  const openIssues = data.issues.filter((issue) => issue.status !== 'Resolvida').length;
  const metrics = [
    { label: 'Cidades', value: cityCount, Icon: MapPinned, tone: 'info', onIconClick: () => setScreen('cities'), iconLabel: 'Abrir cadastro e visualizacao de cidades' },
    { label: 'Andamento', value: data.works.filter((work) => work.status === 'Em andamento').length, Icon: Clock3, tone: 'warning', onIconClick: () => setScreen('works'), iconLabel: 'Abrir obras em andamento' },
    { label: 'Atrasadas', value: data.works.filter((work) => work.status === 'Atrasada').length, Icon: AlertTriangle, tone: 'danger', onIconClick: () => setScreen('works'), iconLabel: 'Abrir obras atrasadas' },
    { label: 'PLS', value: data.plsItems.filter((item) => !['Aprovado', 'Enviado'].includes(item.status)).length, Icon: FileCheck2, tone: 'danger', onIconClick: () => setScreen('pls'), iconLabel: 'Abrir PLS Caixa' },
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
      atrasadas: local.filter((work) => work.status === 'Atrasada').length,
    };
  });
}

function getNeighborhoodSummary(works, city) {
  return (neighborhoodCatalog[city?.id] || neighborhoodCatalog['rio-verde']).map((bairro) => {
    const local = works.filter((work) => work.bairroId === bairro.id);
    return {
      ...bairro,
      obras: local.length,
      andamento: local.filter((work) => work.status === 'Em andamento').length,
      atrasadas: local.filter((work) => work.status === 'Atrasada').length,
    };
  });
}

function Cities({ works, openCity }) {
  return (
    <>
      <PageTitle eyebrow="Cidades" title="Obras por cidade" subtitle="Mapa operacional por municipio." />
      <section className="item-grid">
        {getCitySummary(works).map((city) => (
          <button className="city-card" type="button" key={city.id} onClick={() => openCity(city)}>
            <MapPinned size={34} aria-hidden="true" />
            <strong>{city.nome}</strong>
            <span>{city.bairros} bairros</span>
            <span>{city.obras} obras</span>
            {city.atrasadas ? <StatusPill status="Atrasada" /> : <StatusPill status="Conferido" />}
          </button>
        ))}
      </section>
    </>
  );
}

function Neighborhoods({ works, selectedCity, openNeighborhood, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Bairros" title={selectedCity?.nome || 'Rio Verde'} subtitle="Obras agrupadas por bairro." onBack={() => setScreen('cities')} />
      <section className="item-grid">
        {getNeighborhoodSummary(works, selectedCity).map((bairro) => (
          <button className="item-card as-button" type="button" key={bairro.id} onClick={() => openNeighborhood(bairro)}>
            <Landmark size={32} aria-hidden="true" />
            <strong>{bairro.nome}</strong>
            <span>{bairro.obras} obras</span>
            <span>{bairro.andamento} em andamento</span>
            {bairro.atrasadas ? <StatusPill status="Atrasada" /> : <StatusPill status="Conferido" />}
          </button>
        ))}
      </section>
    </>
  );
}

function Works({ selectedCity, selectedNeighborhood, works, openWork, setScreen }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const filtered = works.filter((obra) => {
    if (selectedNeighborhood && obra.bairroId !== selectedNeighborhood.id) return false;
    if (!selectedNeighborhood && selectedCity && obra.cidadeId !== selectedCity.id) return false;
    if (status !== 'Todos' && obra.status !== status) return false;
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
          <article className="work-card" key={obra.id}>
            <div className="work-head">
              <div>
                <h2>{obra.nome}</h2>
                <p>{obra.cliente} - {obra.endereco}</p>
              </div>
              <StatusPill status={obra.status} />
            </div>
            <ProgressBar value={obra.percentual} />
            <div className="work-meta">
              <span>{obra.percentual}% executado</span>
              <span>Proxima: {obra.proximaEtapa}</span>
              <span>PLS: {obra.pls}</span>
              <span>{obra.pendencias} pendencias</span>
            </div>
            <ActionButton Icon={Eye} onClick={() => openWork(obra)}>Abrir painel</ActionButton>
          </article>
        ))}
        {!filtered.length ? <EmptyNotice title="Nenhuma obra encontrada" text="Ajuste a busca ou os filtros." /> : null}
      </section>
    </>
  );
}

function NewWork({ createWork, setScreen }) {
  function submit(event) {
    event.preventDefault();
    createWork(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  return (
    <form onSubmit={submit}>
      <PageTitle eyebrow="Nova obra" title="Cadastro de obra" subtitle="Dados principais para abrir o painel da obra." onBack={() => setScreen('works')} />
      <section className="ai-panel">
        <div>
          <StatusPill status="Analise IA" />
          <h2>Cadastro inteligente por IA</h2>
          <p>Fluxo preparado para anexos de projeto e conferencia antes da criacao.</p>
        </div>
        <div className="upload-grid">
          <button type="button" onClick={() => setScreen('extractedData')}><Upload size={30} aria-hidden="true" /> Enviar PDF do projeto</button>
          <button type="button" onClick={() => setScreen('extractedData')}><ImagePlus size={30} aria-hidden="true" /> Enviar imagem da planta</button>
          <button type="button" onClick={() => setScreen('extractedData')}><Camera size={30} aria-hidden="true" /> Tirar foto do projeto</button>
          <button type="button"><Pencil size={30} aria-hidden="true" /> Cadastrar manualmente</button>
        </div>
      </section>
      <section className="form-grid">
        <Field label="Nome da obra" name="nome" value="Casa Joao Silva" required />
        <Field label="Cliente" name="cliente" value="Joao Silva" required />
        <SelectField label="Cidade" name="cidadeId" value="rio-verde" options={cityCatalog.map((city) => ({ value: city.id, label: city.nome }))} />
        <SelectField label="Bairro" name="bairroId" value="centro" options={Object.values(neighborhoodCatalog).flat().map((bairro) => ({ value: bairro.id, label: bairro.nome }))} />
        <Field label="Endereco" name="endereco" value="Rua 12, Qd. 8, Lt. 4" wide required />
        <Field label="Quadra" name="quadra" value="8" />
        <Field label="Lote" name="lote" value="4" />
        <Field label="Area construida" name="areaConstruida" value="148 m2" />
        <Field label="Area do terreno" name="areaTerreno" value="300 m2" />
        <Field label="Numero de pavimentos" name="pavimentos" value="1" />
        <Field label="Responsavel tecnico" name="responsavel" value="Eng. Ana Prado" />
        <TextAreaField label="Observacoes" name="observacoes" value="Projeto residencial com acompanhamento PLS Caixa." />
      </section>
      <div className="form-actions">
        <ActionButton Icon={Save} type="submit">Salvar obra</ActionButton>
        <ActionButton Icon={Bot} variant="secondary" onClick={() => setScreen('extractedData')}>Analisar com IA</ActionButton>
        <ActionButton Icon={XCircle} variant="ghost" onClick={() => setScreen('works')}>Cancelar</ActionButton>
      </div>
    </form>
  );
}

function ExtractedData({ createWork, setScreen }) {
  const extracted = {
    nome: 'Casa Joao Silva',
    cliente: 'Joao Silva',
    endereco: 'Rua 12, Qd. 8, Lt. 4',
    cidadeId: 'rio-verde',
    bairroId: 'centro',
    areaConstruida: '148 m2',
    areaTerreno: '300 m2',
    pavimentos: '1',
    responsavel: 'Eng. Ana Prado',
    observacoes: 'Fundacao em sapatas isoladas e cobertura com telha termoacustica.',
  };
  return (
    <>
      <PageTitle eyebrow="IA" title="Conferir dados extraidos" subtitle="Revise antes de criar a obra." onBack={() => setScreen('newWork')} />
      <section className="warning-strip">
        <AlertTriangle size={22} aria-hidden="true" />
        <span>A IA pode cometer erros. Confira os dados antes de criar a obra.</span>
      </section>
      <section className="form-grid">
        <Field label="Nome da obra" value={extracted.nome} />
        <Field label="Cliente" value={extracted.cliente} />
        <Field label="Endereco" value={extracted.endereco} wide />
        <Field label="Cidade" value="Rio Verde" />
        <Field label="Bairro" value="Centro" />
        <Field label="Area construida" value={extracted.areaConstruida} />
        <Field label="Area do terreno" value={extracted.areaTerreno} />
        <Field label="Responsavel tecnico" value={extracted.responsavel} />
        <TextAreaField label="Observacoes tecnicas" value={extracted.observacoes} />
      </section>
      <div className="form-actions">
        <ActionButton Icon={CheckCircle2} onClick={() => createWork(extracted)}>Confirmar e criar obra</ActionButton>
        <ActionButton Icon={Pencil} variant="secondary" onClick={() => setScreen('newWork')}>Corrigir manualmente</ActionButton>
        <ActionButton Icon={XCircle} variant="ghost" onClick={() => setScreen('dashboard')}>Cancelar</ActionButton>
      </div>
    </>
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
  const summary = [
    ['Concluidas', data.stages.filter((stage) => stage.status === 'Concluida').length, CheckCircle2, 'success'],
    ['Andamento', data.stages.filter((stage) => ['Em andamento', 'Atencao'].includes(stage.status)).length, Clock3, 'warning'],
    ['Pendencias', data.issues.filter((issue) => issue.status !== 'Resolvida').length, AlertTriangle, 'danger'],
    ['Fotos', data.photos.length, Camera, 'info'],
    ['PLS', data.plsItems.filter((item) => !['Aprovado', 'Enviado'].includes(item.status)).length, FileCheck2, 'danger'],
    ['Atraso', obra.atraso, CalendarDays, obra.atraso ? 'danger' : 'success'],
  ];

  return (
    <>
      <PageTitle eyebrow="Painel da obra" title={obra.nome} subtitle={`${obra.cliente} - ${obra.bairro}, ${obra.cidade}`}>
        <StatusPill status={obra.status} />
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
      <section className="metric-grid compact">
        {summary.map(([label, value, Icon, tone]) => (
          <MetricCard key={label} label={label} value={value} Icon={Icon} tone={tone} />
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

function Stages({ stages, openStage, addPhoto, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Etapas da obra" title="Etapas padrao" subtitle="Percentuais, datas e fotos obrigatorias." onBack={() => setScreen('workPanel')} />
      <section className="stage-list">
        {stages.map((stage) => (
          <article className="stage-card" key={stage.id}>
            <div className="stage-main">
              <div>
                <h2>{stage.nome}</h2>
                <span>{stage.inicio} ate {stage.fim}</span>
              </div>
              <StatusPill status={stage.status} />
            </div>
            <ProgressBar value={stage.percentual} />
            <div className="stage-meta">
              <span>{stage.percentual}% executado</span>
              <span>{stage.pendencias} pendencias</span>
              <span>{stage.fotosFaltando} fotos faltando</span>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => openStage(stage)}><Eye size={18} aria-hidden="true" /> Abrir etapa</button>
              <button type="button" onClick={() => addPhoto(stage.nome)}><Camera size={18} aria-hidden="true" /> Adicionar foto</button>
              <button type="button" onClick={() => setScreen('checklist')}><ClipboardCheck size={18} aria-hidden="true" /> Conferir checklist</button>
              <button type="button" onClick={() => setScreen('supplies')}><PackageCheck size={18} aria-hidden="true" /> Ver insumos</button>
            </div>
          </article>
        ))}
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

function Photos({ photos, addPhoto, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Fotos da obra" title="Registros por etapa" subtitle="Etapa, tipo, data, usuario e PLS Caixa." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={Camera} onClick={() => addPhoto('Fundacao')}>Adicionar foto</ActionButton>
      </PageTitle>
      <div className="toolbar">
        {['Etapa', 'Tipo da foto', 'Data', 'Usuario', 'PLS Caixa'].map((item) => (
          <button type="button" key={item}><Filter size={18} aria-hidden="true" /> {item}</button>
        ))}
      </div>
      <section className="photo-grid">
        {photos.map((photo) => (
          <article className="photo-card" key={photo.id}>
            <div className={`photo-thumb ${photo.cor}`}>
              {photo.photoUrl ? <img src={photo.photoUrl} alt={`Foto ${photo.etapa}`} /> : <Camera size={34} aria-hidden="true" />}
            </div>
            <div>
              <strong>{photo.etapa}</strong>
              <span>{photo.tipo} - {photo.data}</span>
              <p>{photo.observacao}</p>
              <small>{photo.usuario}</small>
              {photo.fileName ? <small>{photo.fileName}</small> : null}
            </div>
          </article>
        ))}
      </section>
      <div className="form-actions">
        <ActionButton Icon={Camera} onClick={() => addPhoto('Fundacao')}>Tirar foto</ActionButton>
        <ActionButton Icon={Upload} variant="secondary" onClick={() => addPhoto('PLS Caixa')}>Enviar da galeria</ActionButton>
      </div>
    </>
  );
}

function PhotoUploadModal({ etapa, stages, saving, error, onClose, onSave }) {
  const [files, setFiles] = useState([]);
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
                {[...new Set([etapa, ...stages.map((stage) => stage.nome), 'PLS Caixa'].filter(Boolean))].map((item) => (
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

function Schedule({ stages, updateStage, setScreen }) {
  const firstOpen = stages.find((stage) => stage.status !== 'Concluida')?.id;
  return (
    <>
      <PageTitle eyebrow="Cronograma" title="Datas por etapa" subtitle="Previsto, real, atraso e percentual." onBack={() => setScreen('workPanel')}>
        <ActionButton Icon={Pencil} onClick={() => updateStage(firstOpen, { status: 'Em andamento' })}>Editar cronograma</ActionButton>
      </PageTitle>
      <section className="schedule-table">
        <div className="table-head">
          <span>Etapa</span>
          <span>Inicio previsto</span>
          <span>Fim previsto</span>
          <span>Inicio real</span>
          <span>Fim real</span>
          <span>Status</span>
          <span>Atraso</span>
          <span>%</span>
        </div>
        {stages.map((stage, index) => (
          <article className="table-row" key={stage.id}>
            <strong>{stage.nome}</strong>
            <span>{stage.inicio}</span>
            <span>{stage.fim}</span>
            <span>{index < 4 ? stage.inicio : '-'}</span>
            <span>{stage.status === 'Concluida' ? stage.fim : '-'}</span>
            <StatusPill status={stage.status} />
            <span>{stage.status === 'Atencao' ? '2 dias' : '0 dia'}</span>
            <span>{stage.percentual}%</span>
          </article>
        ))}
      </section>
    </>
  );
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

function StageLibrary({ stages, setScreen }) {
  return (
    <>
      <PageTitle eyebrow="Biblioteca de etapas" title="Modelos reaproveitaveis" subtitle="Modelos copiados para cada nova obra." onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={Plus}>Nova etapa modelo</ActionButton>
      </PageTitle>
      <section className="stage-list">
        {stages.slice(0, 8).map((stage, index) => (
          <article className="stage-card" key={stage.id}>
            <div className="stage-main">
              <div>
                <h2>{stage.nome}</h2>
                <span>{index + 2} servicos - {index + 4} insumos - {index + 1} normas</span>
              </div>
              <StatusPill status="Conferido" />
            </div>
            <div className="stage-meta">
              <span>{index + 1} ferramentas</span>
              <span>{index + 2} fotos obrigatorias</span>
              <span>Checklist tecnico</span>
            </div>
            <div className="button-row">
              <button type="button"><Pencil size={18} aria-hidden="true" /> Editar modelo</button>
              <button type="button"><FolderKanban size={18} aria-hidden="true" /> Duplicar modelo</button>
              <button type="button"><XCircle size={18} aria-hidden="true" /> Desativar modelo</button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function Profile({ activeWork }) {
  return (
    <>
      <PageTitle eyebrow="Perfil" title="Engenharia de campo" subtitle="Responsavel tecnico e dados da obra." />
      <section className="profile-grid">
        <article className="profile-card">
          <UserRound size={34} aria-hidden="true" />
          <strong>{activeWork.responsavel || 'Eng. Ana Prado'}</strong>
          <span>Responsavel tecnica</span>
          <p>Rio Verde, Jatai, Mineiros e Santa Helena</p>
        </article>
        <article className="profile-card">
          <Building2 size={34} aria-hidden="true" />
          <strong>{activeWork.nome}</strong>
          <span>{activeWork.status}</span>
          <p>{activeWork.percentual}% executado - {activeWork.pendencias} pendencias</p>
          <p>{activeWork.areaConstruida} - {activeWork.areaTerreno}</p>
        </article>
      </section>
    </>
  );
}

function resolveLocation(values) {
  const city = cityCatalog.find((item) => item.id === values.cidadeId) || cityCatalog[0];
  const allNeighborhoods = Object.values(neighborhoodCatalog).flat();
  const neighborhood = allNeighborhoods.find((item) => item.id === values.bairroId) || neighborhoodCatalog[city.id][0];
  return { city, neighborhood };
}

function App() {
  const [screen, setScreen] = useState('login');
  const [data, setData] = useState(loadData);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [photoDraftStage, setPhotoDraftStage] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [selectedCity, setSelectedCity] = useState(cityCatalog[0]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState(initialData.works[0].id);
  const [selectedStageId, setSelectedStageId] = useState(initialData.stages[0].id);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let mounted = true;

    getSession().then((currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      if (currentSession) setScreen('dashboard');
    });

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession) setScreen('dashboard');
      else setScreen('login');
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !session) return;
    void loadRemoteData();
  }, [session?.user?.id]);

  const activeWork = useMemo(() => data.works.find((work) => work.id === selectedWorkId) || data.works[0], [data.works, selectedWorkId]);
  const activeStage = data.stages.find((stage) => stage.id === selectedStageId) || data.stages[0];

  async function loadRemoteData(preferredProjectId) {
    setDataLoading(true);
    setDataError('');
    try {
      let works = await fetchProjects();

      if (!works.length) {
        const created = await insertProject(initialData.works[0]);
        await seedProjectChildren(created.id, initialData);
        works = [created];
      }

      const projectId = preferredProjectId && works.some((work) => work.id === preferredProjectId)
        ? preferredProjectId
        : works[0].id;
      const children = await fetchProjectChildren(projectId);
      setData({ ...initialData, ...children, works });
      setSelectedWorkId(projectId);
      setDataLoading(false);
    } catch (error) {
      setDataError(error.message || 'Nao foi possivel carregar o banco de dados.');
      setDataLoading(false);
    }
  }

  async function loadProject(projectId) {
    if (!supabaseConfigured || !session) return;
    setDataLoading(true);
    setDataError('');
    try {
      const children = await fetchProjectChildren(projectId);
      setData((current) => ({ ...current, ...children }));
      setDataLoading(false);
    } catch (error) {
      setDataError(error.message || 'Nao foi possivel carregar a obra.');
      setDataLoading(false);
    }
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
      setSession(nextSession);
      setScreen('dashboard');
    } catch (error) {
      setAuthError(error.message || 'Nao foi possivel entrar.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function createWork(values) {
    const { city, neighborhood } = resolveLocation(values);
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
      pavimentos: values.pavimentos || '',
      responsavel: values.responsavel || '',
      observacoes: values.observacoes || '',
    };

    if (supabaseConfigured && session) {
      try {
        nextWork = await insertProject(nextWork);
        await seedProjectChildren(nextWork.id, {
          ...initialData,
          photos: [],
          plsItems: [],
          issues: [],
        });
        const children = await fetchProjectChildren(nextWork.id);
        setData((current) => ({ ...current, ...children, works: [nextWork, ...current.works] }));
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

  async function updateStage(id, patch) {
    if (!id) return;
    setData((current) => ({
      ...current,
      stages: current.stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
      works: current.works.map((work) => (work.id === activeWork.id ? { ...work, percentual: Math.max(work.percentual, patch.percentual || 0) } : work)),
    }));

    if (supabaseConfigured && session) {
      try {
        await updateChild('stages', id, patch);
        if (patch.percentual !== undefined) {
          await updateProject(activeWork.id, { percentual: Math.max(activeWork.percentual, patch.percentual) });
        }
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel atualizar a etapa.');
      }
    }
  }

  function addPhoto(etapa) {
    setPhotoError('');
    setPhotoDraftStage(etapa || activeStage?.nome || 'Fundacao');
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
          const upload = await uploadPhotoFile({
            userId: session.user.id,
            projectId: activeWork.id,
            file,
          });
          return insertChild('photos', activeWork.id, { ...basePhoto, ...upload });
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
      nextPhotos = selectedFiles.map((file) => ({
        id: makeId('foto'),
        ...basePhoto,
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size || 0,
        photoUrl: URL.createObjectURL(file),
      }));
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

  async function addIssue(etapa) {
    let next = {
      id: makeId('pend'),
      descricao: `Pendencia registrada em ${etapa}`,
      etapa,
      responsavel: activeWork.responsavel || 'Eng. Ana',
      prazo: '10/06',
      status: 'Aberta',
      norma: 'Checklist interno',
    };

    if (supabaseConfigured && session) {
      try {
        next = await insertChild('issues', activeWork.id, next);
        await updateProject(activeWork.id, { pendencias: activeWork.pendencias + 1 });
      } catch (error) {
        setDataError(error.message || 'Nao foi possivel salvar a pendencia.');
        return;
      }
    }

    setData((current) => ({
      ...current,
      issues: [next, ...current.issues],
      works: current.works.map((work) => (work.id === activeWork.id ? { ...work, pendencias: work.pendencias + 1 } : work)),
    }));
    setScreen('issues');
  }

  async function resolveIssue() {
    const targetIssue = data.issues[0];
    if (!targetIssue) return;

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
    if (screen !== 'login' && dataLoading) {
      return <EmptyNotice Icon={Database} title="Carregando banco de dados" text="Sincronizando obras, etapas e pendencias." />;
    }

    if (screen !== 'login' && dataError) {
      return (
        <>
          <section className="warning-strip">
            <AlertTriangle size={22} aria-hidden="true" />
            <span>{dataError}</span>
          </section>
          <Dashboard data={data} setScreen={setScreen} />
        </>
      );
    }

    switch (screen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} authError={authError} authLoading={authLoading} dbAvailable={supabaseConfigured} />;
      case 'dashboard':
        return <Dashboard data={data} setScreen={setScreen} />;
      case 'cities':
        return <Cities works={data.works} openCity={(city) => { setSelectedCity(city); setSelectedNeighborhood(null); setScreen('neighborhoods'); }} />;
      case 'neighborhoods':
        return <Neighborhoods works={data.works} selectedCity={selectedCity} openNeighborhood={(bairro) => { setSelectedNeighborhood(bairro); setScreen('works'); }} setScreen={setScreen} />;
      case 'works':
        return <Works selectedCity={selectedCity} selectedNeighborhood={selectedNeighborhood} works={data.works} openWork={(work) => { setSelectedWorkId(work.id); void loadProject(work.id); setScreen('workPanel'); }} setScreen={setScreen} />;
      case 'newWork':
        return <NewWork createWork={createWork} setScreen={setScreen} />;
      case 'extractedData':
        return <ExtractedData createWork={createWork} setScreen={setScreen} />;
      case 'workPanel':
        return <WorkPanel obra={activeWork} data={data} setScreen={setScreen} />;
      case 'stages':
        return <Stages stages={data.stages} openStage={(stage) => { setSelectedStageId(stage.id); setScreen('stageDetail'); }} addPhoto={addPhoto} setScreen={setScreen} />;
      case 'stageDetail':
        return <StageDetail stage={activeStage} updateStage={updateStage} addPhoto={addPhoto} addIssue={addIssue} setScreen={setScreen} />;
      case 'photos':
        return <Photos photos={data.photos} addPhoto={addPhoto} setScreen={setScreen} />;
      case 'pls':
        return <Pls plsItems={data.plsItems} updatePls={updatePls} addPhoto={addPhoto} setScreen={setScreen} />;
      case 'schedule':
        return <Schedule stages={data.stages} updateStage={updateStage} setScreen={setScreen} />;
      case 'issues':
        return <Issues issues={data.issues} addIssue={addIssue} resolveIssue={resolveIssue} setScreen={setScreen} />;
      case 'supplies':
        return <TableList eyebrow="Insumos" title="Materiais por etapa" subtitle="Previsto, usado, status e observacoes." items={data.supplies} setScreen={setScreen} onPrimary={() => updateFirst('supplies', (item) => ({ ...item, usada: item.usada + 1, status: 'Comprado' }))} primaryLabel="Atualizar insumo" PrimaryIcon={PackageCheck} />;
      case 'tools':
        return <TableList eyebrow="Ferramentas" title="Ferramentas e equipamentos" subtitle="Controle por etapa, tipo e disponibilidade." items={data.tools} setScreen={setScreen} onPrimary={() => updateFirst('tools', (item) => ({ ...item, status: item.status === 'Disponivel' ? 'Em falta' : 'Disponivel' }))} primaryLabel="Alternar status" PrimaryIcon={Wrench} />;
      case 'checklist':
        return <TableList eyebrow="Checklist tecnico" title="Conferencias por etapa" subtitle="Itens, normas, fotos e responsaveis." items={data.checklist} setScreen={setScreen} onPrimary={() => updateFirst('checklist', (item) => ({ ...item, status: item.status === 'Conferido' ? 'Atencao' : 'Conferido' }))} primaryLabel="Conferir item" PrimaryIcon={ClipboardCheck} />;
      case 'standards':
        return <Standards setScreen={setScreen} />;
      case 'reports':
        return <Reports data={data} setScreen={setScreen} />;
      case 'stageLibrary':
        return <StageLibrary stages={data.stages} setScreen={setScreen} />;
      case 'profile':
        return <Profile activeWork={activeWork} />;
      default:
        return <EmptyNotice title="Tela nao encontrada" text="Volte para o painel geral." />;
    }
  }

  return (
    <Shell screen={screen} setScreen={setScreen} activeWork={activeWork}>
      {renderScreen()}
      {photoDraftStage ? (
        <PhotoUploadModal
          etapa={photoDraftStage}
          stages={data.stages}
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
    </Shell>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
