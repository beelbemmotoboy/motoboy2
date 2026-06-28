import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, Download, ExternalLink, FilePlus2, FileText, HardHat, Save, Sparkles, Trash2 } from 'lucide-react';
import './contract-work.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const currencyMaskFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
  return number > 0 ? currencyMaskFormatter.format(number) : '';
}

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return 'Tamanho não informado';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function maskMoneyInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return currencyMaskFormatter.format(Number(digits) / 100);
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
  documents = [],
  saving,
  error,
  documentSaving,
  deletingDocumentId,
  documentError,
  onSaveAssignments,
  onSaveDocument,
  onDeleteDocument,
  setScreen,
}) {
  const contractFileRef = useRef(null);
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
  const contractorsById = useMemo(
    () => new Map(contractors.map((contractor) => [contractor.id, contractor])),
    [contractors],
  );
  const contractDocuments = useMemo(
    () => documents
      .filter((document) => (
        document.contractorId
        || document.tipo === 'Contratos Mao de Obra'
        || document.storagePath?.includes('/Contratos/')
      ))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [documents],
  );
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
    setValues((current) => ({ ...current, [itemId]: maskMoneyInput(value) }));
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

  async function addContract(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !contractorId || !onSaveDocument) return;
    const contractor = contractorsById.get(contractorId);
    setMessage('');
    setFormError('');
    const savedDocument = await onSaveDocument({
      tipo: 'Contratos Mao de Obra',
      titulo: `Contrato - ${contractor?.nome || 'Empreiteiro'}`,
      descricao: file.name || '',
      contractorId,
      folder: 'Contratos',
      file,
    });
    if (savedDocument) {
      setMessage('Contrato adicionado e exibido abaixo.');
    }
  }

  async function downloadContract(document) {
    if (!document.documentUrl) return;
    try {
      const response = await fetch(document.documentUrl);
      if (!response.ok) throw new Error('Arquivo indisponível.');
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.fileName || 'contrato';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setFormError('Não foi possível baixar o contrato.');
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
            <input
              ref={contractFileRef}
              className="contract-file-input"
              type="file"
              accept=".pdf,.doc,.docx,.odt,image/*"
              onChange={addContract}
            />
            <button
              className="action-button secondary"
              type="button"
              disabled={documentSaving || !contractorId}
              onClick={() => contractFileRef.current?.click()}
            >
              <FilePlus2 size={20} aria-hidden="true" />
              <span>{documentSaving ? 'Enviando...' : 'Adicionar contrato'}</span>
            </button>
          </section>

          {error ? <p className="auth-message error">{error}</p> : null}
          {formError ? <p className="auth-message error">{formError}</p> : null}
          {message ? <p className="auth-message success">{message}</p> : null}
          {documentError ? <p className="auth-message error">{documentError}</p> : null}

          <section className="contract-documents" aria-labelledby="contract-documents-title">
            <header>
              <div>
                <span>Documentos da obra</span>
                <h2 id="contract-documents-title">Contratos dos empreiteiros</h2>
              </div>
              <small>{contractDocuments.length} contrato{contractDocuments.length === 1 ? '' : 's'}</small>
            </header>
            {contractDocuments.length ? (
              <div className="contract-document-list">
                {contractDocuments.map((document) => {
                  const contractor = contractorsById.get(document.contractorId);
                  return (
                    <article className="contract-document-row" key={document.id}>
                      <FileText size={24} aria-hidden="true" />
                      <div>
                        {document.documentUrl ? (
                          <a href={document.documentUrl} target="_blank" rel="noreferrer">
                            {document.titulo}
                          </a>
                        ) : (
                          <span>{document.titulo}</span>
                        )}
                        <small>
                          {contractor?.nome || 'Empreiteiro não informado'}
                          {' · '}
                          {document.fileName || 'Arquivo sem nome'}
                          {' · '}
                          {formatFileSize(document.fileSize)}
                        </small>
                      </div>
                      <div className="contract-document-actions">
                        {document.documentUrl ? (
                          <>
                            <a href={document.documentUrl} target="_blank" rel="noreferrer" title="Visualizar contrato">
                              <ExternalLink size={18} aria-hidden="true" />
                              <span>Visualizar</span>
                            </a>
                            <button type="button" onClick={() => downloadContract(document)} title="Baixar contrato">
                              <Download size={18} aria-hidden="true" />
                              <span>Baixar</span>
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="danger"
                          disabled={documentSaving || deletingDocumentId === document.id}
                          onClick={() => onDeleteDocument?.(document)}
                          title="Excluir contrato"
                        >
                          <Trash2 size={18} aria-hidden="true" />
                          <span>{deletingDocumentId === document.id ? 'Excluindo...' : 'Excluir'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyContractNotice
                Icon={FileText}
                title="Nenhum contrato adicionado"
                text="Selecione o empreiteiro e use o botão Adicionar contrato."
              />
            )}
          </section>

          {subitemRows.length ? (
            <section className="contract-work-table" aria-label="Cronograma da empreita">
              <table>
                <thead>
                  <tr>
                    <th>Selecionar</th>
                    <th>Subitem</th>
                    <th>Valor da empreita</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsByStage.map(({ stage, children }) => (
                    <React.Fragment key={stage.id}>
                      <tr className="contract-work-stage-row">
                        <td colSpan="3">{stage.nome}</td>
                      </tr>
                      {children.map((item) => {
                        const assignment = assignmentsBySubitem.get(item.id);
                        const lockedByOtherContractor = Boolean(
                          assignment?.contractorId && assignment.contractorId !== contractorId,
                        );
                        const checked = selectedItems.has(item.id) || lockedByOtherContractor;
                        const assignedContractor = lockedByOtherContractor
                          ? contractorsById.get(assignment.contractorId)
                          : null;
                        return (
                          <tr className={`${checked ? 'selected' : ''} ${lockedByOtherContractor ? 'locked' : ''}`} key={item.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={lockedByOtherContractor}
                                onChange={() => toggleSubitem(item.id)}
                                aria-label={`Selecionar ${item.nome}`}
                              />
                            </td>
                            <td>
                              <span>{item.nome}</span>
                              {assignedContractor ? <small>Vinculado a {assignedContractor.nome}</small> : null}
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={lockedByOtherContractor}
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
