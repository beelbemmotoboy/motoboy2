import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Breadcrumbs from './Breadcrumbs.jsx';
import './contract-schedule-builder.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const currencyMaskFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DEFAULT_COLUMN_WIDTHS = [240, 150, 155, 150, 180, 180, 70];
const MIN_COLUMN_WIDTHS = [160, 120, 130, 130, 150, 150, 64];

function makeDraftId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function maskMoneyInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return currencyMaskFormatter.format(Number(digits) / 100);
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatMoneyInput(value) {
  const number = normalizeMoneyValue(value);
  return number > 0 ? currencyMaskFormatter.format(number) : '';
}

function parseIsoDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addBusinessDays(startDate, days) {
  const date = parseIsoDate(startDate);
  const workDays = Math.floor(Number(days) || 0);
  if (!date || workDays <= 0) return '';

  while (isWeekend(date)) {
    date.setDate(date.getDate() + 1);
  }

  let remaining = workDays - 1;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) remaining -= 1;
  }

  return toIsoDate(date);
}

function businessDaysBetween(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || end < start) return '';

  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!isWeekend(cursor)) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return String(days);
}

function compareSubitemsByStartDate(left, right) {
  const leftDate = left.inicioPrevisto || '9999-12-31';
  const rightDate = right.inicioPrevisto || '9999-12-31';
  const dateOrder = leftDate.localeCompare(rightDate);
  if (dateOrder) return dateOrder;
  return (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0);
}

function sortSubitemsByStartDate(subitems) {
  return [...subitems].sort(compareSubitemsByStartDate);
}

function createSubitem(overrides = {}) {
  return {
    id: makeDraftId('subitem'),
    sourceId: '',
    isNew: true,
    nome: '',
    inicioPrevisto: '',
    diasTrabalhados: '',
    fimPrevisto: '',
    contractorId: '',
    valorEmpreita: '',
    sortOrder: 0,
    ...overrides,
  };
}

function createStage(overrides = {}) {
  return {
    id: makeDraftId('item'),
    sourceId: '',
    isNew: true,
    nome: '',
    subitems: [createSubitem()],
    ...overrides,
  };
}

function EmptyBuilderNotice({ Icon = Sparkles, title, text }) {
  return (
    <section className="empty-notice">
      <Icon size={30} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function buildDraftFromItems(items = [], contractorAssignments = []) {
  const visibleItems = items.filter((item) => item.visible !== false);
  const activeAssignmentsBySubitem = new Map();
  contractorAssignments
    .filter((assignment) => assignment.ativo !== false)
    .forEach((assignment) => {
      activeAssignmentsBySubitem.set(assignment.scheduleItemId, assignment);
    });

  const stages = visibleItems
    .filter((item) => !item.parentId)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((stage) => {
      const children = visibleItems
        .filter((item) => item.parentId === stage.id)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
        .map((item) => {
          const assignment = activeAssignmentsBySubitem.get(item.id);
          const value = normalizeMoneyValue(item.valorMaoObra) || normalizeMoneyValue(assignment?.valorContratado);
          return createSubitem({
            id: item.id,
            sourceId: item.id,
            isNew: false,
            nome: item.nome || '',
            inicioPrevisto: item.inicioPrevisto || '',
            diasTrabalhados: businessDaysBetween(item.inicioPrevisto, item.fimPrevisto),
            fimPrevisto: item.fimPrevisto || '',
            contractorId: assignment?.contractorId || '',
            valorEmpreita: formatMoneyInput(value),
            sortOrder: Number(item.sortOrder) || 0,
          });
        })
        .sort(compareSubitemsByStartDate);

      return createStage({
        id: stage.id,
        sourceId: stage.id,
        isNew: false,
        nome: stage.nome || '',
        subitems: children,
      });
    });

  return stages.length ? stages : [createStage()];
}

export default function ContractScheduleBuilder({
  items = [],
  contractors = [],
  contractorAssignments = [],
  saving,
  error,
  onSavePlan,
  setScreen,
  breadcrumbs = [],
}) {
  const draftFromSchedule = useMemo(
    () => buildDraftFromItems(items, contractorAssignments),
    [items, contractorAssignments],
  );
  const [stages, setStages] = useState(draftFromSchedule);
  const [removedItemIds, setRemovedItemIds] = useState([]);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [collapsedStageIds, setCollapsedStageIds] = useState(
    () => new Set(draftFromSchedule.map((stage) => stage.id)),
  );
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const assignedContractorIds = useMemo(
    () => new Set(
      contractorAssignments
        .filter((assignment) => assignment.ativo !== false)
        .map((assignment) => assignment.contractorId),
    ),
    [contractorAssignments],
  );
  const contractorOptions = useMemo(
    () => contractors
      .filter((contractor) => contractor.ativo !== false || assignedContractorIds.has(contractor.id))
      .sort((left, right) => left.nome.localeCompare(right.nome)),
    [contractors, assignedContractorIds],
  );

  useEffect(() => {
    setStages(draftFromSchedule);
    setRemovedItemIds([]);
    setCollapsedStageIds(new Set(draftFromSchedule.map((stage) => stage.id)));
    setFormError('');
    setMessage('');
  }, [draftFromSchedule]);

  const totalValue = stages.reduce((stageTotal, stage) => (
    stageTotal + stage.subitems.reduce((subTotal, subitem) => (
      subTotal + normalizeMoneyValue(subitem.valorEmpreita)
    ), 0)
  ), 0);
  const subitemCount = stages.reduce((total, stage) => total + stage.subitems.length, 0);

  function updateStage(stageId, patch) {
    setStages((current) => current.map((stage) => (
      stage.id === stageId ? { ...stage, ...patch } : stage
    )));
    setFormError('');
    setMessage('');
  }

  function updateSubitem(stageId, subitemId, patch) {
    setStages((current) => current.map((stage) => {
      if (stage.id !== stageId) return stage;
      return {
        ...stage,
        subitems: stage.subitems.map((subitem) => {
          if (subitem.id !== subitemId) return subitem;
          const next = { ...subitem, ...patch };
          if (patch.inicioPrevisto !== undefined || patch.diasTrabalhados !== undefined) {
            next.fimPrevisto = addBusinessDays(next.inicioPrevisto, next.diasTrabalhados);
          }
          return next;
        }),
      };
    }));
    setFormError('');
    setMessage('');
  }

  function addStage() {
    const stage = createStage();
    setStages((current) => [...current, stage]);
    setCollapsedStageIds((current) => {
      const next = new Set(current);
      next.delete(stage.id);
      return next;
    });
  }

  function removeStage(stageId) {
    const removedStage = stages.find((stage) => stage.id === stageId);
    if (!removedStage) return;
    const confirmed = window.confirm(`Remover o item "${removedStage.nome || 'sem nome'}" e todos os seus subitens?`);
    if (!confirmed) return;
    if (removedStage) {
      const removedIds = [
        removedStage.sourceId,
        ...removedStage.subitems.map((subitem) => subitem.sourceId),
      ].filter(Boolean);
      if (removedIds.length) {
        setRemovedItemIds((ids) => [...new Set([...ids, ...removedIds])]);
      }
    }
    setStages((current) => current.filter((stage) => stage.id !== stageId));
    setFormError('');
    setMessage('');
  }

  function addSubitem(stageId) {
    setStages((current) => current.map((stage) => (
      stage.id === stageId
        ? {
            ...stage,
            subitems: [
              ...stage.subitems,
              createSubitem({ sortOrder: stage.subitems.length }),
            ],
          }
        : stage
    )));
    setCollapsedStageIds((current) => {
      const next = new Set(current);
      next.delete(stageId);
      return next;
    });
  }

  function toggleStage(stageId) {
    setCollapsedStageIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }

  function removeSubitem(stageId, subitemId) {
    const removedSubitem = stages
      .find((stage) => stage.id === stageId)
      ?.subitems.find((subitem) => subitem.id === subitemId);
    if (!removedSubitem) return;
    const confirmed = window.confirm(`Remover o subitem "${removedSubitem.nome || 'sem nome'}"?`);
    if (!confirmed) return;
    if (removedSubitem?.sourceId) {
      setRemovedItemIds((ids) => [...new Set([...ids, removedSubitem.sourceId])]);
    }
    setStages((current) => current.map((stage) => {
      if (stage.id !== stageId) return stage;
      const subitems = stage.subitems.filter((subitem) => subitem.id !== subitemId);
      return { ...stage, subitems };
    }));
    setFormError('');
    setMessage('');
  }

  function resizeColumn(columnIndex, width) {
    setColumnWidths((current) => current.map((currentWidth, index) => (
      index === columnIndex
        ? Math.max(MIN_COLUMN_WIDTHS[index], Math.round(width))
        : currentWidth
    )));
  }

  function startColumnResize(columnIndex, event) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = columnWidths[columnIndex];

    function move(moveEvent) {
      resizeColumn(columnIndex, startWidth + moveEvent.clientX - startX);
    }

    function stop() {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    }

    handle.setPointerCapture(event.pointerId);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function columnHeader(label, columnIndex) {
    return (
      <th>
        <span>{label}</span>
        <span
          className="table-column-resizer"
          role="separator"
          aria-label={`Redimensionar coluna ${label}`}
          tabIndex="0"
          onPointerDown={(event) => startColumnResize(columnIndex, event)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            resizeColumn(columnIndex, columnWidths[columnIndex] + (event.key === 'ArrowRight' ? 12 : -12));
          }}
        />
      </th>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    setMessage('');

    const cleanedStages = stages.map((stage) => ({
      ...stage,
      nome: stage.nome.trim(),
      subitems: sortSubitemsByStartDate(stage.subitems).map((subitem) => {
        const diasTrabalhados = Math.floor(Number(subitem.diasTrabalhados) || 0);
        return {
          ...subitem,
          nome: subitem.nome.trim(),
          diasTrabalhados,
          fimPrevisto: subitem.inicioPrevisto && diasTrabalhados > 0
            ? addBusinessDays(subitem.inicioPrevisto, diasTrabalhados)
            : subitem.fimPrevisto || '',
          valorMaoObra: normalizeMoneyValue(subitem.valorEmpreita),
          contractorId: subitem.contractorId || '',
        };
      }),
    }));

    const missingStage = cleanedStages.find((stage) => !stage.nome);
    if (missingStage) {
      setFormError('Informe o nome de todos os itens.');
      return;
    }

    const missingSubitem = cleanedStages
      .flatMap((stage) => stage.subitems.map((subitem) => ({ stage, subitem })))
      .find(({ subitem }) => !subitem.nome);
    if (missingSubitem) {
      setFormError('Informe o nome de todos os subitens.');
      return;
    }

    const invalidDates = cleanedStages
      .flatMap((stage) => stage.subitems.map((subitem) => ({ stage, subitem })))
      .find(({ subitem }) => (
        (subitem.inicioPrevisto && subitem.diasTrabalhados <= 0)
        || (!subitem.inicioPrevisto && subitem.diasTrabalhados > 0)
      ));
    if (invalidDates) {
      setFormError('Informe inicio e dias trabalhados juntos para calcular o fim do subitem.');
      return;
    }

    const invalidContractorValue = cleanedStages
      .flatMap((stage) => stage.subitems)
      .find((subitem) => subitem.contractorId && subitem.valorMaoObra <= 0);
    if (invalidContractorValue) {
      setFormError(`Informe o valor da empreita para ${invalidContractorValue.nome}.`);
      return;
    }

    const saved = await onSavePlan({
      stages: cleanedStages,
      removedItemIds,
    });

    if (saved) {
      setFormError('');
      setMessage('Cronograma salvo.');
    }
  }

  return (
    <>
      <header className="page-title">
        <div>
          <Breadcrumbs items={breadcrumbs} onBack={() => setScreen('schedule')} fallbackLabel="Cronograma" />
          <h1>Criar cronograma</h1>
          <p>Edite os mesmos itens do cronograma em uma tela rapida, com dias uteis e valor de empreita.</p>
        </div>
        <div className="title-actions">
          <button className="action-button secondary icon-only-action" type="button" aria-label="Adicionar item" title="Adicionar item" onClick={addStage}>
            <Plus size={20} aria-hidden="true" />
          </button>
          <button className="action-button primary" type="submit" form="contract-schedule-builder-form" disabled={saving}>
            <Save size={20} aria-hidden="true" />
            <span>{saving ? 'Salvando...' : 'Salvar cronograma'}</span>
          </button>
        </div>
      </header>

      <form id="contract-schedule-builder-form" className="contract-work contract-schedule-builder" onSubmit={submit}>
        {error ? <p className="auth-message error">{error}</p> : null}
        {formError ? <p className="auth-message error">{formError}</p> : null}
        {message ? <p className="auth-message success">{message}</p> : null}

        <section className="contract-schedule-summary" aria-label="Resumo do cronograma">
          <span>{stages.length} itens</span>
          <span>{subitemCount} subitens</span>
          <span>Total mao de obra <strong>{formatCurrency(totalValue)}</strong></span>
        </section>

        {stages.length ? (
          <section className="contract-work-table contract-schedule-table" aria-label="Criacao do cronograma">
            <table style={{ minWidth: `${columnWidths.reduce((total, width) => total + width, 0)}px` }}>
              <colgroup>
                {columnWidths.map((width, index) => <col style={{ width: `${width}px` }} key={`column-${index}`} />)}
              </colgroup>
              <thead>
                <tr>
                  {columnHeader('Subitem', 0)}
                  {columnHeader('Inicio', 1)}
                  {columnHeader('Dias', 2)}
                  {columnHeader('Fim calculado', 3)}
                  {columnHeader('Empreiteiro', 4)}
                  {columnHeader('Valor da empreita', 5)}
                  {columnHeader('Acoes', 6)}
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => {
                  const collapsed = collapsedStageIds.has(stage.id);
                  return (
                    <React.Fragment key={stage.id}>
                      <tr className="contract-work-stage-row contract-schedule-stage-row">
                        <td colSpan="7">
                          <div>
                            <button
                              className="contract-schedule-toggle"
                              type="button"
                              aria-label={`${collapsed ? 'Expandir' : 'Recolher'} item ${stage.nome || 'sem nome'}`}
                              title={collapsed ? 'Expandir item' : 'Recolher item'}
                              onClick={() => toggleStage(stage.id)}
                            >
                              {collapsed
                                ? <ChevronRight size={17} aria-hidden="true" />
                                : <ChevronDown size={17} aria-hidden="true" />}
                            </button>
                            <input
                              type="text"
                              value={stage.nome}
                              onChange={(event) => updateStage(stage.id, { nome: event.target.value })}
                              placeholder="Nome do item"
                            />
                            <button
                              type="button"
                              aria-label="Abrir checklist"
                              title="Abrir checklist"
                              onClick={() => setScreen('checklist')}
                            >
                              <ClipboardCheck size={17} aria-hidden="true" />
                            </button>
                            <button type="button" aria-label="Adicionar subitem" title="Adicionar subitem" onClick={() => addSubitem(stage.id)}>
                              <Plus size={17} aria-hidden="true" />
                            </button>
                            <button
                              className="danger"
                              type="button"
                              aria-label="Remover item"
                              title="Remover item"
                              onClick={() => removeStage(stage.id)}
                            >
                              <Trash2 size={17} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {!collapsed && sortSubitemsByStartDate(stage.subitems).map((subitem) => (
                      <tr key={subitem.id}>
                        <td>
                          <input
                            type="text"
                            value={subitem.nome}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { nome: event.target.value })}
                            placeholder="Nome do subitem"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={subitem.inicioPrevisto}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { inicioPrevisto: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="contract-schedule-days"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={subitem.diasTrabalhados}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { diasTrabalhados: event.target.value })}
                          />
                        </td>
                        <td>
                          <input className="contract-schedule-end" type="date" value={subitem.fimPrevisto} readOnly />
                        </td>
                        <td>
                          <select
                            value={subitem.contractorId}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { contractorId: event.target.value })}
                            aria-label={`Empreiteiro de ${subitem.nome || 'subitem'}`}
                          >
                            <option value="">Sem empreiteiro</option>
                            {contractorOptions.map((contractor) => (
                              <option value={contractor.id} key={contractor.id}>{contractor.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="contract-schedule-value"
                            type="text"
                            inputMode="decimal"
                            value={subitem.valorEmpreita}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { valorEmpreita: maskMoneyInput(event.target.value) })}
                            placeholder="0,00"
                          />
                        </td>
                        <td>
                          <button
                            className="danger compact-button"
                            type="button"
                            aria-label="Remover subitem"
                            title="Remover subitem"
                            onClick={() => removeSubitem(stage.id, subitem.id)}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : (
          <EmptyBuilderNotice Icon={CalendarDays} title="Nenhum item" text="Adicione o primeiro item para iniciar o cronograma." />
        )}
      </form>
    </>
  );
}
