export const DEFAULT_SCHEDULE_SOURCE = 'default-schedule';

export function buildScheduleSourceOptions(works) {
  return (Array.isArray(works) ? works : [])
    .filter((work) => work?.id)
    .map((work) => {
      const location = [work.bairro, work.cidade].filter(Boolean).join(' - ');
      const details = [work.cliente, location].filter(Boolean).join(' | ');
      return {
        value: work.id,
        label: details ? `${work.nome} - ${details}` : work.nome,
      };
    });
}

export function buildScheduleCopyPlan(scheduleItems) {
  const items = Array.isArray(scheduleItems) ? scheduleItems : [];
  const stages = items
    .filter((item) => !item.parentId)
    .sort(sortScheduleItems);

  return stages
    .map((stage, stageIndex) => ({
      stage: resetScheduleItem(stage, 'stage', stageIndex),
      children: items
        .filter((item) => item.parentId === stage.id)
        .sort(sortScheduleItems)
        .map((child, childIndex) => resetScheduleItem(child, 'task', childIndex)),
    }))
    .filter((group) => group.stage.nome);
}

function resetScheduleItem(item, fallbackType, sortOrder) {
  return {
    libraryItemId: item.libraryItemId || '',
    nome: item.nome || '',
    itemType: item.itemType || fallbackType,
    inicioPrevisto: '',
    fimPrevisto: '',
    inicioReal: '',
    fimReal: '',
    status: 'Nao iniciado',
    percentual: 0,
    sortOrder,
    visible: item.visible !== false,
  };
}

function sortScheduleItems(a, b) {
  const first = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0;
  const second = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;
  if (first !== second) return first - second;
  return String(a.nome || '').localeCompare(String(b.nome || ''));
}
