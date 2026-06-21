export const defaultScheduleBlueprint = [
  stage('limpeza-terreno', 'Limpeza do terreno', [
    'Limpeza do terreno',
  ]),
  stage('muro-arrimo', 'Muro de contencao / muro de arrimo', [
    'Gabarito do muro',
    'Marcacao das estacas / fundacao',
    'Perfuracao das estacas',
    'Armacao e concretagem de estacas / fundacao',
    'Caixaria dos baldrames',
    'Armacao das ferragens dos baldrames e arranques dos pilares',
    'Concretagem e impermeabilizacao dos baldrames',
    'Alvenaria',
    'Caixaria dos pilares e vigas',
    'Armacao dos pilares e vigas',
    'Concretagem dos pilares e vigas',
  ]),
  stage('correcao-solo', 'Correcao do solo', [
    'Conferencia do nivel',
    'Aterro ou corte do terreno / compactacao',
  ]),
  stage('locacao-gabarito', 'Locacao da obra e gabarito', [
    'Montagem do gabarito',
    'Marcacao da obra, paredes e estacas',
  ]),
  stage('fundacao', 'Fundacao / estacas / blocos / sapatas', [
    'Perfuracao das estacas / fundacao',
    'Concretagem e armacao da fundacao',
  ]),
  stage('baldrame', 'Baldrame e impermeabilizacao', [
    'Caixaria dos baldrames',
    'Armacao das vigas baldrames e arranques dos pilares',
    'Concretagem',
    'Desforma e impermeabilizacao',
  ]),
  stage('alvenaria', 'Alvenaria externa e interna', [
    'Assentamento de meia alvenaria, marcacao e esquadro',
    'Caixaria dos pilares e contra-vergas da meia alvenaria',
    'Armacao e concretagem dos pilares e contra-vergas',
    'Desforma dos pilares e contra-vergas',
    'Alvenaria de respaldo',
    'Armacao e concretagem dos pilares e vergas',
    'Desforma dos pilares e vergas de respaldo',
  ]),
  stage('laje', 'Laje', [
    'Marcacao dos pontos de espera eletricos, hidraulicos e pilares',
    'Armacao das vigas da laje e esperas dos pilares',
    'Caixaria das vigas da laje',
    'Tubulacao eletrica da laje',
    'Concretagem da laje',
    'Desforma das caixarias e escoras',
  ]),
  stage('alvenaria-respaldo', 'Alvenaria de respaldo', [
    'Assentamento dos blocos',
    'Armacao dos pilares e caixaria',
    'Concretagem, desforma e respaldo da platibanda',
  ]),
  stage('cobertura', 'Cobertura / estrutura do telhado', [
    'Montagem da estrutura do telhado',
    'Instalacao da calha',
    'Tubulacao pluvial',
    'Base da caixa de agua',
    'Instalacao das telhas',
    'Rufos e pingadeira',
  ]),
  stage('hidraulica', 'Instalacao hidraulica', [
    'Marcacao da tubulacao hidraulica',
    'Instalacao da caixa de agua e ramificacoes',
    'Montagem da tubulacao hidraulica',
  ]),
  stage('sanitaria', 'Instalacao sanitaria / tubulacao e servicos', [
    'Marcacao da instalacao sanitaria e servicos',
    'Montagem da tubulacao sanitaria',
    'Caixas de inspecao',
    'Perfuracao das fossas',
    'Alvenaria das fossas',
    'Encanamento das fossas e tampas',
  ]),
  stage('eletrica-bruta', 'Instalacao eletrica bruta', [
    'Marcacao das paredes para tubulacao e caixas 4x2',
    'Tubulacao das paredes e chumbamento das caixas 4x2',
  ]),
  stage('reboco', 'Chapisco, emboco e reboco', [
    'Chapisco em pilares, vigas e vergas',
    'Reboco',
    'Requadros das janelas',
    'Instalacao de portais e esquadrias',
    'Peitoris',
  ]),
  stage('contrapiso', 'Contrapiso final e regularizacoes', [
    'Regularizacao do contrapiso',
    'Concretagem do contrapiso',
  ]),
  stage('forro', 'Forro / gesso / sancas', [
    'Instalacao ou execucao do forro',
  ]),
  stage('revestimentos', 'Revestimentos ceramicos', [
    'Assentamento dos revestimentos das paredes',
    'Assentamento do revestimento do piso',
    'Rejuntes',
    'Instalacao das bancadas',
    'Montagem dos metais',
  ]),
  stage('pintura', 'Massa corrida / preparacao da pintura', [
    'Lixamento das paredes e fundo preparador',
    'Lixamento das portas e portais',
    'Primeira demao de massa',
    'Segunda demao de massa',
    'Lixamento, demao e calafete',
    'Pintura das portas e portais',
    'Pintura das paredes e teto',
    'Pintura externa da fachada',
    'Pintura dos metais e portao',
    'Pintura das calcadas',
  ]),
  stage('eletrica-final', 'Instalacao final eletrica', [
    'Montagem da fiacao eletrica e luminarias',
    'Tomadas, interruptores e espelhos',
    'Fechamento do quadro e testes',
  ]),
  stage('entrega', 'Limpeza fina e checklist de entrega', [
    'Limpeza pos-obra',
    'Checklist',
    'Correcoes',
    'Limpeza fina',
    'Visita com o cliente',
    'Correcoes finais',
    'Limpeza simples',
    'Entrega das chaves',
  ]),
];

export function buildLocalScheduleItems() {
  return defaultScheduleBlueprint.flatMap((item, stageIndex) => {
    const parentId = `schedule-${item.code}`;
    return [
      scheduleItem(parentId, null, item.nome, 'stage', stageIndex),
      ...item.children.map((nome, childIndex) => (
        scheduleItem(`${parentId}-${childIndex + 1}`, parentId, nome, 'task', childIndex)
      )),
    ];
  });
}

function stage(code, nome, children = []) {
  return { code, nome, children };
}

function scheduleItem(id, parentId, nome, itemType, sortOrder) {
  return {
    id,
    parentId,
    nome,
    itemType,
    inicioPrevisto: '',
    fimPrevisto: '',
    inicioReal: '',
    fimReal: '',
    status: 'Nao iniciado',
    percentual: 0,
    valorMaoObra: 0,
    sortOrder,
    visible: true,
  };
}
