import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import Breadcrumbs from './Breadcrumbs.jsx';
import { formatCnpj, lookupCnpj } from './developmentFunctions.js';
import './developments.css';

const emptyDevelopment = {
  nome: '',
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  telefone: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  ativo: true,
};

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function IconButton({ label, Icon, onClick, disabled = false }) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
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

function Field({ label, name, value, onChange, type = 'text', wide = false, required = false, disabled = false }) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}

function DevelopmentModal({ development, saving, onClose, onSave }) {
  const [values, setValues] = useState({ ...emptyDevelopment, ...development });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setValues((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function consultCnpj() {
    setLookupLoading(true);
    setLookupError('');
    try {
      const company = await lookupCnpj(values.cnpj);
      setValues((current) => ({
        ...current,
        ...company,
        nome: current.nome || company.nomeFantasia || company.razaoSocial,
      }));
    } catch (error) {
      setLookupError(error.message || 'Nao foi possivel consultar o CNPJ.');
    } finally {
      setLookupLoading(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    onSave(values);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="photo-modal development-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="development-modal-title">
        <div className="modal-head">
          <div>
            <span>Empreendimento</span>
            <h2 id="development-modal-title">{development?.id ? 'Editar cadastro' : 'Novo empreendimento'}</h2>
          </div>
          <IconButton label="Fechar" Icon={X} onClick={onClose} disabled={saving || lookupLoading} />
        </div>

        <section className="development-cnpj-panel">
          <label className="field">
            <span>CNPJ</span>
            <input
              name="cnpj"
              value={values.cnpj}
              onChange={(event) => setValues((current) => ({ ...current, cnpj: formatCnpj(event.target.value) }))}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              required
              disabled={saving || lookupLoading}
            />
          </label>
          <ActionButton Icon={Search} variant="secondary" onClick={consultCnpj} disabled={saving || lookupLoading}>
            {lookupLoading ? 'Consultando...' : 'Consultar CNPJ'}
          </ActionButton>
        </section>
        {lookupError ? <p className="auth-message error">{lookupError}</p> : null}

        <section className="form-grid modal-fields">
          <Field label="Nome do empreendimento" name="nome" value={values.nome} onChange={updateField} required disabled={saving} />
          <Field label="Razao social" name="razaoSocial" value={values.razaoSocial} onChange={updateField} required disabled={saving} />
          <Field label="Nome fantasia" name="nomeFantasia" value={values.nomeFantasia} onChange={updateField} disabled={saving} />
          <Field label="Telefone" name="telefone" value={values.telefone} onChange={updateField} disabled={saving} />
          <Field label="E-mail" name="email" value={values.email} onChange={updateField} type="email" disabled={saving} />
          <Field label="CEP" name="cep" value={values.cep} onChange={updateField} disabled={saving} />
          <Field label="Logradouro" name="logradouro" value={values.logradouro} onChange={updateField} wide disabled={saving} />
          <Field label="Numero" name="numero" value={values.numero} onChange={updateField} disabled={saving} />
          <Field label="Complemento" name="complemento" value={values.complemento} onChange={updateField} disabled={saving} />
          <Field label="Bairro" name="bairro" value={values.bairro} onChange={updateField} disabled={saving} />
          <Field label="Cidade" name="municipio" value={values.municipio} onChange={updateField} disabled={saving} />
          <Field label="UF" name="uf" value={values.uf} onChange={updateField} disabled={saving} />
          <label className="field development-status-field">
            <span>Status</span>
            <span className="checkbox-line">
              <input type="checkbox" name="ativo" checked={values.ativo !== false} onChange={updateField} disabled={saving} />
              Empreendimento ativo
            </span>
          </label>
        </section>

        <div className="form-actions">
          <ActionButton Icon={Save} type="submit" disabled={saving || lookupLoading}>
            {saving ? 'Salvando...' : 'Salvar empreendimento'}
          </ActionButton>
          <ActionButton Icon={XCircle} variant="ghost" onClick={onClose} disabled={saving || lookupLoading}>Cancelar</ActionButton>
        </div>
      </form>
    </div>
  );
}

export default function Developments({
  developments = [],
  works = [],
  saving,
  error,
  message,
  onSave,
  setScreen,
  breadcrumbs = [],
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return developments;
    return developments.filter((development) => normalizeSearch([
      development.nome,
      development.cnpj,
      development.razaoSocial,
      development.nomeFantasia,
      development.municipio,
      development.uf,
    ].join(' ')).includes(normalized));
  }, [developments, query]);

  async function save(values) {
    const saved = await onSave({ ...editing, ...values });
    if (saved) setEditing(null);
  }

  return (
    <>
      <header className="page-title">
        <div>
          <Breadcrumbs items={breadcrumbs} onBack={() => setScreen('dashboard')} fallbackLabel="Empreendimentos" />
          <h1>Empreendimentos</h1>
          <p>Cadastros vinculados as obras da empresa.</p>
        </div>
        <div className="title-actions">
          <ActionButton Icon={Plus} onClick={() => setEditing(emptyDevelopment)}>Novo empreendimento</ActionButton>
        </div>
      </header>

      {message ? (
        <section className="success-strip">
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>{message}</span>
        </section>
      ) : null}
      {error ? <p className="auth-message error">{error}</p> : null}

      <section className="data-toolbar">
        <label className="search-control">
          <Search size={18} aria-hidden="true" />
          <input value={query} placeholder="Buscar empreendimento ou CNPJ" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>

      <section className="development-grid">
        {filtered.map((development) => {
          const workCount = works.filter((work) => work.developmentId === development.id).length;
          const address = [development.logradouro, development.numero, development.bairro, development.municipio, development.uf]
            .filter(Boolean)
            .join(', ');
          return (
            <article className="development-card" key={development.id}>
              <div className="development-card-head">
                <Building2 size={30} aria-hidden="true" />
                <span className={`status ${development.ativo === false ? 'neutral' : 'success'}`}>
                  {development.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
              </div>
              <h2>{development.nome}</h2>
              <p>{development.razaoSocial || 'Razao social nao informada'}</p>
              <span>{development.cnpj ? formatCnpj(development.cnpj) : 'CNPJ pendente'}</span>
              <small>{address || 'Endereco nao informado'}</small>
              <footer>
                <span>{workCount} obra{workCount === 1 ? '' : 's'}</span>
                <button type="button" onClick={() => setEditing(development)}>
                  <Pencil size={17} aria-hidden="true" />
                  Editar
                </button>
              </footer>
            </article>
          );
        })}
      </section>

      {!filtered.length ? (
        <section className="empty-notice">
          <Building2 size={30} aria-hidden="true" />
          <h2>Nenhum empreendimento encontrado</h2>
          <p>Cadastre o primeiro empreendimento para vincular as obras.</p>
        </section>
      ) : null}

      {editing ? (
        <DevelopmentModal
          development={editing}
          saving={saving}
          onClose={() => {
            if (!saving) setEditing(null);
          }}
          onSave={save}
        />
      ) : null}
    </>
  );
}
