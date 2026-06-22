import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  FolderKanban,
  HardHat,
  Pencil,
  Plus,
  Save,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';

const statusClasses = {
  Ativo: 'completed',
  Inativo: 'neutral',
};

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function StatusPill({ status }) {
  return <span className={`status ${statusClasses[status] || 'neutral'}`}>{status}</span>;
}

function IconButton({ label, Icon, onClick }) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>
      <Icon size={22} aria-hidden="true" />
    </button>
  );
}

function ActionButton({ children, Icon, variant = 'primary', onClick, type = 'button', disabled = false }) {
  return (
    <button className={`action-button ${variant}`} type={type} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={20} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function Field({ label, name, value, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} name={name} defaultValue={value || ''} required={required} />
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

export function ServiceCategories({ categories = [], saving, error, message, onSave, onToggle, setScreen }) {
  const [query, setQuery] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const normalizedQuery = normalizeSearch(query);
  const filteredCategories = normalizedQuery
    ? categories.filter((category) => normalizeSearch(`${category.nome} ${category.descricao}`).includes(normalizedQuery))
    : categories;

  return (
    <>
      <PageTitle eyebrow="Categorias" title="Categorias de servico" subtitle="Classificacao tecnica usada nos subitens do cronograma." onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={Plus} onClick={() => setEditingCategory({ ativo: true })}>Nova categoria</ActionButton>
      </PageTitle>
      {error ? <p className="auth-message error">{error}</p> : null}
      {message ? <p className="auth-message success">{message}</p> : null}
      <section className="data-toolbar">
        <label className="field wide">
          <span>Buscar categoria</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fundacao, alvenaria, acabamento..." />
        </label>
      </section>
      <section className="catalog-grid">
        {filteredCategories.map((category) => (
          <article className="catalog-card" key={category.id}>
            <div>
              <span className="catalog-kicker">Categoria</span>
              <h2>{category.nome}</h2>
              {category.descricao ? <p>{category.descricao}</p> : <p>Sem descricao.</p>}
            </div>
            <StatusPill status={category.ativo === false ? 'Inativo' : 'Ativo'} />
            <div className="button-row">
              <button type="button" onClick={() => setEditingCategory(category)} disabled={saving}><Pencil size={17} /> Editar</button>
              <button type="button" onClick={() => onToggle(category)} disabled={saving}>
                {category.ativo === false ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                {category.ativo === false ? 'Ativar' : 'Inativar'}
              </button>
            </div>
          </article>
        ))}
      </section>
      {!filteredCategories.length ? <EmptyNotice Icon={FolderKanban} title="Nenhuma categoria" text="Cadastre categorias para classificar os subitens." /> : null}
      {editingCategory ? (
        <ServiceCategoryModal
          category={editingCategory}
          saving={saving}
          onClose={() => {
            if (!saving) setEditingCategory(null);
          }}
          onSave={async (values) => {
            const saved = await onSave(values);
            if (saved) setEditingCategory(null);
          }}
        />
      ) : null}
    </>
  );
}

function ServiceCategoryModal({ category, saving, onClose, onSave }) {
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    onSave({
      ...category,
      ...values,
      ativo: values.ativo === 'on',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal issue-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Categoria de servico</span>
            <h2>{category.id ? 'Editar categoria' : 'Nova categoria'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <Field label="Nome" name="nome" value={category.nome || ''} required />
          <TextAreaField label="Descricao" name="descricao" value={category.descricao || ''} />
          <label className="field check-field">
            <span>Situacao</span>
            <input type="checkbox" name="ativo" defaultChecked={category.ativo !== false} />
            <small>Categoria ativa para novos subitens</small>
          </label>
        </div>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar categoria'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

export function Contractors({ contractors = [], saving, error, message, onSave, onToggle, setScreen }) {
  const [query, setQuery] = useState('');
  const [editingContractor, setEditingContractor] = useState(null);
  const normalizedQuery = normalizeSearch(query);
  const filteredContractors = normalizedQuery
    ? contractors.filter((contractor) => normalizeSearch(`${contractor.nome} ${contractor.telefone} ${contractor.documento} ${contractor.email}`).includes(normalizedQuery))
    : contractors;

  return (
    <>
      <PageTitle eyebrow="Empreiteiros" title="Cadastro de empreiteiros" subtitle="Prestadores vinculados aos subitens de cada obra." onBack={() => setScreen('dashboard')}>
        <ActionButton Icon={Plus} onClick={() => setEditingContractor({ ativo: true })}>Novo empreiteiro</ActionButton>
      </PageTitle>
      {error ? <p className="auth-message error">{error}</p> : null}
      {message ? <p className="auth-message success">{message}</p> : null}
      <section className="data-toolbar">
        <label className="field wide">
          <span>Buscar empreiteiro</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, CPF/CNPJ, telefone ou e-mail" />
        </label>
      </section>
      <section className="catalog-grid">
        {filteredContractors.map((contractor) => (
          <article className="catalog-card" key={contractor.id}>
            <div>
              <span className="catalog-kicker">Empreiteiro</span>
              <h2>{contractor.nome}</h2>
              <p>{contractor.telefone || 'Sem telefone'}{contractor.email ? ` - ${contractor.email}` : ''}</p>
              {contractor.documento ? <small>Documento: {contractor.documento}</small> : null}
              {contractor.observacoes ? <small>{contractor.observacoes}</small> : null}
            </div>
            <StatusPill status={contractor.ativo === false ? 'Inativo' : 'Ativo'} />
            <div className="button-row">
              <button type="button" onClick={() => setEditingContractor(contractor)} disabled={saving}><Pencil size={17} /> Editar</button>
              <button type="button" onClick={() => onToggle(contractor)} disabled={saving}>
                {contractor.ativo === false ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                {contractor.ativo === false ? 'Ativar' : 'Inativar'}
              </button>
            </div>
          </article>
        ))}
      </section>
      {!filteredContractors.length ? <EmptyNotice Icon={HardHat} title="Nenhum empreiteiro" text="Cadastre empreiteiros para vincular aos subitens da obra." /> : null}
      {editingContractor ? (
        <ContractorModal
          contractor={editingContractor}
          saving={saving}
          onClose={() => {
            if (!saving) setEditingContractor(null);
          }}
          onSave={async (values) => {
            const saved = await onSave(values);
            if (saved) setEditingContractor(null);
          }}
        />
      ) : null}
    </>
  );
}

function ContractorModal({ contractor, saving, onClose, onSave }) {
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    onSave({
      ...contractor,
      ...values,
      ativo: values.ativo === 'on',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal issue-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span>Empreiteiro</span>
            <h2>{contractor.id ? 'Editar empreiteiro' : 'Novo empreiteiro'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} />
        </div>
        <div className="form-grid modal-fields">
          <Field label="Nome" name="nome" value={contractor.nome || ''} required />
          <Field label="Telefone" name="telefone" value={contractor.telefone || ''} />
          <Field label="CPF / CNPJ" name="documento" value={contractor.documento || ''} />
          <Field label="E-mail" name="email" type="email" value={contractor.email || ''} />
          <TextAreaField label="Observacoes" name="observacoes" value={contractor.observacoes || ''} />
          <label className="field check-field">
            <span>Situacao</span>
            <input type="checkbox" name="ativo" defaultChecked={contractor.ativo !== false} />
            <small>Empreiteiro ativo para novos vinculos</small>
          </label>
        </div>
        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar empreiteiro'}</ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}
