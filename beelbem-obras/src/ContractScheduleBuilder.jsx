import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, HardHat, Plus, Save, Sparkles, Trash2 } from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const currencyMaskFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function createSubitem() {
  return {
    id: makeDraftId('subitem'),
    nome: '',
    inicioPrevisto: '',
    diasTrabalhados: '',
    fimPrevisto: '',
    valorEmpreita: '',
  };
}

function createStage() {
  return {
    id: makeDraftId('item'),
    nome: '',
    subitems: [createSubitem()],
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

export default function ContractScheduleBuilder({
  contractors = [],
  saving,
  error,
  onSavePlan,
  setScreen,
}) {
  const activeContractors = useMemo(
    () => contractors
      .filter((contractor) => contractor.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [contractors],
  );
  const [contractorId, setContractorId] = useState(activeContractors[0]?.id || '');
  const [stages, setStages] = useState([createStage()]);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!contractorId && activeContractors[0]?.id) {
      setContractorId(activeContractors[0].id);
    }
  }, [activeContractors, contractorId]);

  const totalValue = stages.reduce((stageTotal, stage) => (
    stageTotal + stage.subitems.reduce((subTotal, subitem) => (
      subTotal + normalizeMoneyValue(subitem.valorEmpreita)
    ), 0)
  ), 0);

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
    setStages((current) => [...current, createStage()]);
  }

  function removeStage(stageId) {
    setStages((current) => {
      const next = current.filter((stage) => stage.id !== stageId);
      return next.length ? next : [createStage()];
    });
  }

  function addSubitem(stageId) {
    setStages((current) => current.map((stage) => (
      stage.id === stageId
        ? { ...stage, subitems: [...stage.subitems, createSubitem()] }
        : stage
    )));
  }

  function removeSubitem(stageId, subitemId) {
    setStages((current) => current.map((stage) => {
      if (stage.id !== stageId) return stage;
      const subitems = stage.subitems.filter((subitem) => subitem.id !== subitemId);
      return { ...stage, subitems: subitems.length ? subitems : [createSubitem()] };
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    setMessage('');

    const cleanedStages = stages.map((stage) => ({
      ...stage,
      nome: stage.nome.trim(),
      subitems: stage.subitems.map((subitem) => ({
        ...subitem,
        nome: subitem.nome.trim(),
        diasTrabalhados: Math.floor(Number(subitem.diasTrabalhados) || 0),
        valorMaoObra: normalizeMoneyValue(subitem.valorEmpreita),
      })),
    }));

    const missingStage = cleanedStages.find((stage) => !stage.nome);
    if (missingStage) {
      setFormError('Informe o nome de todos os itens.');
      return;
    }

    const missingSubitem = cleanedStages
      .flatMap((stage) => stage.subitems.map((subitem) => ({ stage, subitem })))
      .find(({ subitem }) => !subitem.nome || !subitem.inicioPrevisto || subitem.diasTrabalhados <= 0);
    if (missingSubitem) {
      setFormError('Informe nome, inicio e dias trabalhados de todos os subitens.');
      return;
    }

    if (totalValue > 0 && !contractorId) {
      setFormError('Selecione um empreiteiro para salvar os valores de empreita.');
      return;
    }

    const saved = await onSavePlan({
      contractorId,
      stages: cleanedStages,
    });

    if (saved) {
      setStages([createStage()]);
      setFormError('');
      setMessage('Cronograma criado.');
    }
  }

  return (
    <>
      <header className="page-title">
        <div>
          <div className="title-row">
            <button className="icon-button" type="button" aria-label="Voltar" title="Voltar" onClick={() => setScreen('contractWork')}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <span>Empreita</span>
          </div>
          <h1>Criar cronograma</h1>
          <p>Cadastre itens, subitens, dias trabalhados e valor de empreita em uma unica tela.</p>
        </div>
        <div className="title-actions">
          <button className="action-button secondary" type="button" onClick={() => setScreen('contractors')}>
            <HardHat size={20} aria-hidden="true" />
            <span>Empreiteiros</span>
          </button>
        </div>
      </header>

      <form className="contract-work" onSubmit={submit}>
        <section className="contract-work-toolbar">
          <label className="field">
            <span>Empreiteiro</span>
            <select value={contractorId} onChange={(event) => setContractorId(event.target.value)}>
              <option value="">Sem empreiteiro</option>
              {activeContractors.map((contractor) => (
                <option value={contractor.id} key={contractor.id}>{contractor.nome}</option>
              ))}
            </select>
          </label>
          <div className="contract-work-total">
            <span>Total da empreita</span>
            <strong>{formatCurrency(totalValue)}</strong>
          </div>
          <button className="action-button primary" type="submit" disabled={saving}>
            <Save size={20} aria-hidden="true" />
            <span>{saving ? 'Salvando...' : 'Salvar cronograma'}</span>
          </button>
        </section>

        {error ? <p className="auth-message error">{error}</p> : null}
        {formError ? <p className="auth-message error">{formError}</p> : null}
        {message ? <p className="auth-message success">{message}</p> : null}

        <section className="contract-schedule-actions">
          <button className="action-button secondary" type="button" onClick={addStage}>
            <Plus size={20} aria-hidden="true" />
            <span>Adicionar item</span>
          </button>
        </section>

        {stages.length ? (
          <section className="contract-work-table contract-schedule-table" aria-label="Criacao do cronograma">
            <table>
              <thead>
                <tr>
                  <th>Subitem</th>
                  <th>Inicio</th>
                  <th>Dias trabalhados</th>
                  <th>Fim calculado</th>
                  <th>Valor da empreita</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <React.Fragment key={stage.id}>
                    <tr className="contract-work-stage-row contract-schedule-stage-row">
                      <td colSpan="6">
                        <div>
                          <input
                            type="text"
                            value={stage.nome}
                            onChange={(event) => updateStage(stage.id, { nome: event.target.value })}
                            placeholder="Nome do item"
                          />
                          <button type="button" onClick={() => addSubitem(stage.id)}>
                            <Plus size={17} aria-hidden="true" />
                            Subitem
                          </button>
                          <button className="danger" type="button" onClick={() => removeStage(stage.id)}>
                            <Trash2 size={17} aria-hidden="true" />
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                    {stage.subitems.map((subitem) => (
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
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={subitem.diasTrabalhados}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { diasTrabalhados: event.target.value })}
                          />
                        </td>
                        <td>
                          <input type="date" value={subitem.fimPrevisto} readOnly />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={subitem.valorEmpreita}
                            onChange={(event) => updateSubitem(stage.id, subitem.id, { valorEmpreita: maskMoneyInput(event.target.value) })}
                            placeholder="0,00"
                          />
                        </td>
                        <td>
                          <button className="danger compact-button" type="button" onClick={() => removeSubitem(stage.id, subitem.id)}>
                            <Trash2 size={17} aria-hidden="true" />
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
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
