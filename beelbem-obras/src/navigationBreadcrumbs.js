const projectScreenLabels = {
  stages: 'Etapas',
  stageDetail: 'Detalhe da etapa',
  photos: 'Fotos',
  pls: 'PLS Caixa',
  schedule: 'Cronograma',
  contractWork: 'Empreita',
  contractScheduleBuilder: 'Criar cronograma',
  issues: 'Pendencias',
  supplies: 'Insumos',
  tools: 'Ferramentas',
  checklist: 'Checklist tecnico',
  notifications: 'Atividades',
  documents: 'Documentos',
  standards: 'Documentos',
  stageLibrary: 'Cadastro de etapas',
  reports: 'RDO',
  workProfile: 'Dados da obra',
};

const mainScreenLabels = {
  cities: 'Cidades',
  companies: 'Empresas',
  users: 'Usuarios',
  serviceCategories: 'Categorias',
  contractors: 'Empreiteiros',
  commercial: 'Assinaturas',
  profile: 'Perfil',
};

function link(label, screen, setScreen) {
  return { label, onClick: () => setScreen(screen) };
}

export function buildNavigationBreadcrumbs({
  screen,
  activeWork,
  selectedCity,
  selectedNeighborhood,
  setScreen,
}) {
  if (screen === 'dashboard') return [{ label: 'Inicio' }];

  if (screen === 'neighborhoods') {
    return [
      link('Inicio', 'dashboard', setScreen),
      link('Cidades', 'cities', setScreen),
      { label: selectedCity?.nome || 'Bairros' },
      { label: 'Bairros' },
    ];
  }

  if (screen === 'works') {
    return [
      link('Inicio', 'dashboard', setScreen),
      link('Cidades', 'cities', setScreen),
      selectedCity?.nome ? link(selectedCity.nome, 'neighborhoods', setScreen) : null,
      selectedNeighborhood?.nome ? link('Bairros', 'neighborhoods', setScreen) : null,
      selectedNeighborhood?.nome ? { label: selectedNeighborhood.nome } : null,
      { label: 'Obras' },
    ].filter(Boolean);
  }

  if (screen === 'allWorks') {
    return [
      link('Inicio', 'dashboard', setScreen),
      link('Obras', 'allWorks', setScreen),
      { label: 'Todas as obras' },
    ];
  }

  if (screen === 'newWork' || screen === 'extractedData') {
    return [
      link('Inicio', 'dashboard', setScreen),
      link('Obras', 'allWorks', setScreen),
      screen === 'extractedData' ? link('Nova obra', 'newWork', setScreen) : { label: 'Nova obra' },
      screen === 'extractedData' ? { label: 'Dados extraidos' } : null,
    ].filter(Boolean);
  }

  if (screen === 'workPanel') {
    return [
      link('Inicio', 'dashboard', setScreen),
      link('Obras', 'allWorks', setScreen),
      { label: activeWork?.nome || 'Painel da obra' },
    ];
  }

  if (projectScreenLabels[screen]) {
    return [
      link('Inicio', 'dashboard', setScreen),
      link('Obras', 'allWorks', setScreen),
      activeWork?.nome ? link(activeWork.nome, 'workPanel', setScreen) : null,
      { label: projectScreenLabels[screen] },
    ].filter(Boolean);
  }

  if (mainScreenLabels[screen]) {
    return [
      link('Inicio', 'dashboard', setScreen),
      { label: mainScreenLabels[screen] },
    ];
  }

  return [
    link('Inicio', 'dashboard', setScreen),
    { label: 'Obras' },
  ];
}
