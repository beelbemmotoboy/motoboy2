import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, HardHat, Save, Sparkles } from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function normalizeMoneyValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const rawValue = String(value || '').trim();
  const normalized = rawValue.includes(',')
    ? rawValue.replace(/\./g, '').replace(',', '.')
    : rawValue;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatMoneyInput(value) {
  const number = normalizeMoneyValue(value);
  return number > 0 ? String(number) : '';
}

function scheduleDateLabel(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function EmptyContractNotice({ Icon = Sparkles, title, text }) {
  return (
    <section className="empty-notice">
      <Icon size={30} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

export default function ContractWork({
  items = [],
  contractors = [],
  contractorAssignments = [],
  saving,
  error,
  onSaveAssignments,
  setScreen,
}) {
  const activeContractors = useMemo(
    () => contractors
      .filter((contractor) => contractor.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [contractors],
  );
  const [contractorId, setContractorId] = useState(activeContractors[0]?.id || '');
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [values, setValues] = useState({});
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  const visibleItems = useMemo(
    () => items.filter((item) => item.visible !== false),
    [items],
  );
  const stages = useMemo(
    () => visibleItems
      .filter((item) => !item.parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [visibleItems],
  );
  const assignmentsBySubitem = useMemo(() => {
    const next = new Map();
    contractorAssignments
      .filter((assignment) => assignment.ativo !== false)
      .forEach((assignment) => {
        next.set(assignment.scheduleItemId, assignment);
      });
    return next;
  }, [contractorAssignments]);
  const rowsByStage = useMemo(() => stages.map((stage) => ({
    stage,
    children: visibleItems
      .filter((item) => item.parentId === stage.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  })), [stages, visibleItems]);
  const subitemRows = useMemo(
    () => rowsByStage.flatMap((group) => group.children.map((item) => ({ stage: group.stage, item }))),
    [rowsByStage],
  );

  useEffect(() => {
    if (!contractorId && activeContractors[0]?.id) {
      setContractorId(activeContractors[0].id);
    }
  }, [activeContractors, contractorId]);

  useEffect(() => {
    const nextSelected = new Set();
    const nextValues = {};
    subitemRows.forEach(({ item }) => {
      const assignment = assignmentsBySubitem.get(item.id);
      if (assignment?.contractorId === contractorId) {
        nextSelected.add(item.id);
      }
      nextValues[item.id] = formatMoneyInput(assignment?.valorContratado ?? item.valorMaoObra);
    });
    setSelectedItems(nextSelected);
    setValues(nextValues);
    setFormError('');
    setMessage('');
  }, [assignmentsBySubitem, contractorId, subitemRows]);

  function toggleSubitem(itemId) {
    setSelectedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    setFormError('');
  }

  function updateValue(itemId, value) {
    setValues((current) => ({ ...current, [itemId]: value }));
    setSelectedItems((current) => new Set(current).add(itemId));
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    if (!contractorId) {
      setFormError('Selecione um empreiteiro.');
      return;
    }

    const selectedRows = subitemRows.filter(({ item }) => selectedItems.has(item.id));
    if (!selectedRows.length) {
      setFormError('Selecione pelo menos um subitem para esta empreita.');
      return;
    }

    const invalidRow = selectedRows.find(({ item }) => normalizeMoneyValue(values[item.id]) <= 0);
    if (invalidRow) {
      setFormError(`Informe o valor da empreita para ${invalidRow.item.nome}.`);
      return;
    }

    const saved = await onSaveAssignments({
      contractorId,
      assignments: selectedRows.map(({ item }) => {
        const previous = assignmentsBySubitem.get(item.id);
        return {
          ...previous,
          scheduleItemId: item.id,
          contractorId,
          dataInicio: previous?.dataInicio || item.inicioPrevisto || '',
          dataFim: previous?.dataFim || item.fimPrevisto || '',
          valorContratado: normalizeMoneyValue(values[item.id]),
          formaPagamento: previous?.formaPagamento || '',
          observacoes: previous?.observacoes || '',
          ativo: true,
        };
      }),
    });

    if (saved) {
      setFormError('');
      setMessage('Empreita salva.');
    }
  }

  const selectedTotal = subitemRows
    .filter(({ item }) => selectedItems.has(item.id))
    .reduce((total, { item }) => total + normalizeMoneyValue(values[item.id]), 0);

  return (
    <>
      <header className="page-title">
        <div>
          <div className="title-row">
            <button className="icon-button" type="button" aria-label="Voltar" title="Voltar" onClick={() => setScreen('workPanel')}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <span>Empreita</span>
          </div>
          <h1>Empreita da obra</h1>
          <p>Selecione o empreiteiro, os subitens do cronograma e o valor contratado.</p>
        </div>
        <div className="title-actions">
          <button className="action-button primary" type="button" onClick={() => setScreen('contractors')}>
            <HardHat size={20} aria-hidden="true" />
            <span>Empreiteiros</span>
          </button>
        </div>
      </header>

      {!activeContractors.length ? (
        <EmptyContractNotice Icon={HardHat} title="Nenhum empreiteiro cadastrado" text="Cadastre os empreiteiros antes de montar a empreita da obra." />
      ) : (
        <form className="contract-work" onSubmit={submit}>
          <section className="contract-work-toolbar">
            <label className="field">
              <span>Empreiteiro</span>
              <select value={contractorId} onChange={(event) => setContractorId(event.target.value)}>
                {activeContractors.map((contractor) => (
                  <option value={contractor.id} key={contractor.id}>{contractor.nome}</option>
                ))}
              </select>
            </label>
            <div className="contract-work-total">
              <span>Total selecionado</span>
              <strong>{formatCurrency(selectedTotal)}</strong>
            </div>
            <button className="action-button primary" type="submit" disabled={saving || !subitemRows.length}>
              <Save size={20} aria-hidden="true" />
              <span>{saving ? 'Salvando...' : 'Salvar empreita'}</span>
            </button>
          </section>

          {error ? <p className="auth-message error">{error}</p> : null}
          {formError ? <p className="auth-message error">{formError}</p> : null}
          {message ? <p className="auth-message success">{message}</p> : null}

          {subitemRows.length ? (
            <section className="contract-work-table" aria-label="Cronograma da empreita">
              <table>
                <thead>
                  <tr>
                    <th>Selecionar</th>
                    <th>Etapa</th>
                    <th>Subitem</th>
                    <th>Inicio</th>
                    <th>Fim</th>
                    <th>Status</th>
                    <th>Valor da empreita</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsByStage.map(({ stage, children }) => (
                    <React.Fragment key={stage.id}>
                      <tr className="contract-work-stage-row">
                        <td colSpan="7">{stage.nome}</td>
                      </tr>
                      {children.map((item) => {
                        const checked = selectedItems.has(item.id);
                        return (
                          <tr className={checked ? 'selected' : ''} key={item.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSubitem(item.id)}
                                aria-label={`Selecionar ${item.nome}`}
                              />
                            </td>
                            <td>{stage.nome}</td>
                            <td>{item.nome}</td>
                            <td>{scheduleDateLabel(item.inicioPrevisto)}</td>
                            <td>{scheduleDateLabel(item.fimPrevisto)}</td>
                            <td>{item.status || 'Nao iniciado'}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={values[item.id] || ''}
                                onChange={(event) => updateValue(item.id, event.target.value)}
                                placeholder="0,00"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <EmptyContractNotice Icon={CalendarDays} title="Cronograma sem subitens" text="Cadastre subitens no cronograma para montar a empreita." />
          )}
        </form>
      )}
    </>
  );
}
