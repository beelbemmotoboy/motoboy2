import React from 'react';
import { Bot, Edit3, FileSearch, Layers3, Plus, Trash2, Utensils } from 'lucide-react';
import {
  aplicarSugestoesCardapioIa,
  parseMoedaBrasileira,
  precoParaEntrada,
  registrarImportacaoCardapioIa,
  removerIngredienteDoProduto,
  salvarCategoriaCardapio,
  salvarIngredienteCardapio,
  salvarIngredienteDoProduto,
  salvarProdutoCardapio,
} from './garconDb';
import { analisarCardapioComIa, garconMenuAiStatus } from './garconMenuAi';

const STATUS_CADASTRO = ['ativa', 'inativa'];
const STATUS_PRODUTO = ['ativo', 'inativo'];
const STATUS_INGREDIENTE = ['ativo', 'inativo'];

const FORM_CATEGORIA_INICIAL = {
  nome: '',
  descricao: '',
  ordem: '1',
  status: 'ativa',
};

const FORM_PRODUTO_INICIAL = {
  nome: '',
  descricao: '',
  preco: '',
  categoria_id: '',
  imagem_url: '',
  status: 'ativo',
  disponivel: 'sim',
  permite_adicionais: 'nao',
  tempo_medio_preparo: '',
};

const FORM_INGREDIENTE_INICIAL = {
  nome: '',
  descricao: '',
  unidade_medida: 'un',
  custo_unitario: '',
  estoque_minimo: '',
  status: 'ativo',
};

const FORM_VINCULO_INICIAL = {
  produto_id: '',
  ingrediente_id: '',
  tipo: 'base',
  quantidade: '',
  preco_adicional: '',
  obrigatorio: 'sim',
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function GarconCardapioCadastroView({
  store,
  categorias,
  produtos,
  ingredientes,
  produtoIngredientes,
  onReload,
  onMessage,
}) {
  const [categoriaEditandoId, setCategoriaEditandoId] = React.useState('');
  const [produtoEditandoId, setProdutoEditandoId] = React.useState('');
  const [ingredienteEditandoId, setIngredienteEditandoId] = React.useState('');
  const [formCategoria, setFormCategoria] = React.useState(FORM_CATEGORIA_INICIAL);
  const [formProduto, setFormProduto] = React.useState(FORM_PRODUTO_INICIAL);
  const [formIngrediente, setFormIngrediente] = React.useState(FORM_INGREDIENTE_INICIAL);
  const [formVinculo, setFormVinculo] = React.useState(FORM_VINCULO_INICIAL);
  const [arquivoIa, setArquivoIa] = React.useState(null);
  const [pesquisaIa, setPesquisaIa] = React.useState('');
  const [resultadoIa, setResultadoIa] = React.useState(null);
  const [analisandoIa, setAnalisandoIa] = React.useState(false);
  const [gravandoIa, setGravandoIa] = React.useState(false);

  React.useEffect(() => {
    setFormProduto((atual) => ({
      ...atual,
      categoria_id: atual.categoria_id || categorias[0]?.id || '',
    }));
    setFormVinculo((atual) => ({
      ...atual,
      produto_id: atual.produto_id || produtos[0]?.id || '',
      ingrediente_id: atual.ingrediente_id || ingredientes[0]?.id || '',
    }));
  }, [categorias, ingredientes, produtos]);

  function limparCategoria() {
    setCategoriaEditandoId('');
    setFormCategoria(FORM_CATEGORIA_INICIAL);
  }

  function limparProduto() {
    setProdutoEditandoId('');
    setFormProduto({ ...FORM_PRODUTO_INICIAL, categoria_id: categorias[0]?.id || '' });
  }

  function limparIngrediente() {
    setIngredienteEditandoId('');
    setFormIngrediente(FORM_INGREDIENTE_INICIAL);
  }

  async function salvarCategoria(event) {
    event.preventDefault();
    onMessage('');
    if (!store?.id || !formCategoria.nome.trim()) {
      onMessage('Nome da categoria e obrigatorio.');
      return;
    }

    const result = await salvarCategoriaCardapio({ empresaId: store.id, categoriaId: categoriaEditandoId, form: formCategoria });
    if (result.error) {
      onMessage(`Nao foi possivel salvar a categoria: ${result.error.message}`);
      return;
    }
    limparCategoria();
    onMessage('Categoria salva.');
    onReload();
  }

  async function salvarProduto(event) {
    event.preventDefault();
    onMessage('');
    const preco = parseMoedaBrasileira(formProduto.preco);
    if (!store?.id || !formProduto.nome.trim() || !formProduto.categoria_id || preco <= 0) {
      onMessage('Produto, categoria e preco valido sao obrigatorios.');
      return;
    }

    const result = await salvarProdutoCardapio({ empresaId: store.id, produtoId: produtoEditandoId, form: formProduto });
    if (result.error) {
      onMessage(`Nao foi possivel salvar o produto: ${result.error.message}`);
      return;
    }
    limparProduto();
    onMessage('Produto salvo.');
    onReload();
  }

  async function salvarIngrediente(event) {
    event.preventDefault();
    onMessage('');
    if (!store?.id || !formIngrediente.nome.trim()) {
      onMessage('Nome do ingrediente e obrigatorio.');
      return;
    }

    const result = await salvarIngredienteCardapio({ empresaId: store.id, ingredienteId: ingredienteEditandoId, form: formIngrediente });
    if (result.error) {
      onMessage(`Nao foi possivel salvar o ingrediente: ${result.error.message}`);
      return;
    }
    limparIngrediente();
    onMessage('Ingrediente salvo.');
    onReload();
  }

  async function salvarVinculo(event) {
    event.preventDefault();
    onMessage('');
    if (!store?.id || !formVinculo.produto_id || !formVinculo.ingrediente_id) {
      onMessage('Selecione produto e ingrediente para vincular.');
      return;
    }

    const result = await salvarIngredienteDoProduto({ empresaId: store.id, form: formVinculo });
    if (result.error) {
      onMessage(`Nao foi possivel vincular o ingrediente: ${result.error.message}`);
      return;
    }
    setFormVinculo({ ...FORM_VINCULO_INICIAL, produto_id: formVinculo.produto_id, ingrediente_id: ingredientes[0]?.id || '' });
    onMessage('Ingrediente vinculado ao produto.');
    onReload();
  }

  async function removerVinculo(vinculo) {
    const result = await removerIngredienteDoProduto({ empresaId: store.id, vinculoId: vinculo.id });
    if (result.error) {
      onMessage(`Nao foi possivel remover o vinculo: ${result.error.message}`);
      return;
    }
    onMessage('Ingrediente removido do produto.');
    onReload();
  }

  async function analisarArquivoCardapio() {
    onMessage('');
    setResultadoIa(null);
    setAnalisandoIa(true);
    try {
      const resultado = await analisarCardapioComIa({ arquivo: arquivoIa, pesquisa: pesquisaIa });
      if (!resultado.ok) {
        onMessage(resultado.motivo);
      } else {
        setResultadoIa(resultado);
        onMessage('Analise concluida. Confira os itens antes de gravar.');
      }
    } catch (error) {
      onMessage(`Nao foi possivel analisar o cardapio: ${error.message}`);
    } finally {
      setAnalisandoIa(false);
    }
  }

  async function gravarResultadoIa() {
    if (!resultadoIa?.dados || !store?.id) return;
    setGravandoIa(true);
    onMessage('');
    try {
      await aplicarSugestoesCardapioIa({ empresaId: store.id, sugestoes: resultadoIa.dados });
      await registrarImportacaoCardapioIa({ empresaId: store.id, arquivo: arquivoIa, resultado: resultadoIa });
      setResultadoIa(null);
      setArquivoIa(null);
      setPesquisaIa('');
      onMessage('Cardapio importado com ingredientes, produtos e categorias.');
      onReload();
    } catch (error) {
      onMessage(`Nao foi possivel gravar a importacao: ${error.message}`);
    } finally {
      setGravandoIa(false);
    }
  }

  function editarCategoria(categoria) {
    setCategoriaEditandoId(categoria.id);
    setFormCategoria({
      nome: categoria.nome || '',
      descricao: categoria.descricao || '',
      ordem: String(categoria.ordem ?? 1),
      status: categoria.status || 'ativa',
    });
  }

  function editarProduto(produto) {
    setProdutoEditandoId(produto.id);
    setFormProduto({
      nome: produto.nome || '',
      descricao: produto.descricao || '',
      preco: precoParaEntrada(produto.preco),
      categoria_id: produto.categoria_id || categorias[0]?.id || '',
      imagem_url: produto.imagem_url || '',
      status: produto.status || 'ativo',
      disponivel: produto.disponivel ? 'sim' : 'nao',
      permite_adicionais: produto.permite_adicionais ? 'sim' : 'nao',
      tempo_medio_preparo: produto.tempo_medio_preparo ? String(produto.tempo_medio_preparo) : '',
    });
  }

  function editarIngrediente(ingrediente) {
    setIngredienteEditandoId(ingrediente.id);
    setFormIngrediente({
      nome: ingrediente.nome || '',
      descricao: ingrediente.descricao || '',
      unidade_medida: ingrediente.unidade_medida || 'un',
      custo_unitario: precoParaEntrada(ingrediente.custo_unitario),
      estoque_minimo: ingrediente.estoque_minimo ? String(ingrediente.estoque_minimo) : '',
      status: ingrediente.status || 'ativo',
    });
  }

  function categoriaNome(id) {
    return categorias.find((categoria) => categoria.id === id)?.nome || 'Sem categoria';
  }

  function vinculosDoProduto(produtoId) {
    return produtoIngredientes.filter((item) => item.produto_id === produtoId);
  }

  return (
    <section className="garcon-cardapio-cadastro">
      <section className="garcon-ai-import garcon-panel">
        <header>
          <span><Bot size={22} />Cadastro de cardapio com IA</span>
          <button type="button" onClick={analisarArquivoCardapio} disabled={analisandoIa || !arquivoIa}>
            <FileSearch size={17} />{analisandoIa ? 'Analisando...' : 'Analisar'}
          </button>
        </header>
        <div className="garcon-form-grid">
          <label className="wide">Pesquisa para orientar a IA
            <input value={pesquisaIa} onChange={(event) => setPesquisaIa(event.target.value)} placeholder="Ex.: separar hamburgueres, bebidas, adicionais e combos" />
          </label>
          <label className="wide">Foto ou PDF do cardapio
            <input type="file" accept="image/*,application/pdf" onChange={(event) => setArquivoIa(event.target.files?.[0] || null)} />
          </label>
        </div>
        <p className="garcon-ai-note">
          Modelo: {garconMenuAiStatus.model}. A importacao fica pendente ate voce gravar o resultado analisado.
        </p>
        {resultadoIa?.dados && (
          <div className="garcon-ai-preview">
            <article><strong>{resultadoIa.dados.categorias.length}</strong><span>categorias</span></article>
            <article><strong>{resultadoIa.dados.produtos.length}</strong><span>produtos</span></article>
            <article><strong>{resultadoIa.dados.ingredientes.length}</strong><span>ingredientes</span></article>
            <button type="button" onClick={gravarResultadoIa} disabled={gravandoIa}>
              <Plus size={17} />{gravandoIa ? 'Gravando...' : 'Gravar no cardapio'}
            </button>
          </div>
        )}
      </section>

      <section className="garcon-menu-grid">
        <form className="garcon-panel" onSubmit={salvarCategoria}>
          <header>
            <span><Layers3 size={22} />Categorias</span>
            {categoriaEditandoId && <button type="button" onClick={limparCategoria}>Nova categoria</button>}
          </header>
          <div className="garcon-form-grid">
            <label>Nome da categoria<input value={formCategoria.nome} onChange={(event) => setFormCategoria((atual) => ({ ...atual, nome: event.target.value }))} placeholder="Bebidas" /></label>
            <label>Ordem<input inputMode="numeric" value={formCategoria.ordem} onChange={(event) => setFormCategoria((atual) => ({ ...atual, ordem: event.target.value }))} /></label>
            <label>Status
              <select value={formCategoria.status} onChange={(event) => setFormCategoria((atual) => ({ ...atual, status: event.target.value }))}>
                {STATUS_CADASTRO.map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
            </label>
            <label className="wide">Descricao opcional<input value={formCategoria.descricao} onChange={(event) => setFormCategoria((atual) => ({ ...atual, descricao: event.target.value }))} /></label>
          </div>
          <button className="primary-action" type="submit">{categoriaEditandoId ? 'Salvar categoria' : 'Criar categoria'}</button>
          <div className="garcon-compact-list">
            {categorias.map((categoria) => (
              <button type="button" key={categoria.id} onClick={() => editarCategoria(categoria)}>
                <strong>{categoria.nome}</strong>
                <span>{categoria.status} - ordem {categoria.ordem}</span>
              </button>
            ))}
          </div>
        </form>

        <form className="garcon-panel" onSubmit={salvarProduto}>
          <header>
            <span><Utensils size={22} />Produtos</span>
            {produtoEditandoId && <button type="button" onClick={limparProduto}>Novo produto</button>}
          </header>
          <div className="garcon-form-grid">
            <label>Nome do produto<input value={formProduto.nome} onChange={(event) => setFormProduto((atual) => ({ ...atual, nome: event.target.value }))} placeholder="X-Burger" /></label>
            <label>Preco<input inputMode="decimal" value={formProduto.preco} onChange={(event) => setFormProduto((atual) => ({ ...atual, preco: event.target.value }))} placeholder="29,90" /></label>
            <label>Categoria
              <select value={formProduto.categoria_id} onChange={(event) => setFormProduto((atual) => ({ ...atual, categoria_id: event.target.value }))}>
                <option value="">Selecione</option>
                {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
              </select>
            </label>
            <label>Status
              <select value={formProduto.status} onChange={(event) => setFormProduto((atual) => ({ ...atual, status: event.target.value }))}>
                {STATUS_PRODUTO.map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
            </label>
            <label>Disponivel
              <select value={formProduto.disponivel} onChange={(event) => setFormProduto((atual) => ({ ...atual, disponivel: event.target.value }))}>
                <option value="sim">sim</option>
                <option value="nao">nao</option>
              </select>
            </label>
            <label>Aceita adicionais
              <select value={formProduto.permite_adicionais} onChange={(event) => setFormProduto((atual) => ({ ...atual, permite_adicionais: event.target.value }))}>
                <option value="sim">sim</option>
                <option value="nao">nao</option>
              </select>
            </label>
            <label>Tempo medio (min)<input inputMode="numeric" value={formProduto.tempo_medio_preparo} onChange={(event) => setFormProduto((atual) => ({ ...atual, tempo_medio_preparo: event.target.value }))} /></label>
            <label className="wide">Imagem opcional<input value={formProduto.imagem_url} onChange={(event) => setFormProduto((atual) => ({ ...atual, imagem_url: event.target.value }))} placeholder="https://..." /></label>
            <label className="wide">Descricao<textarea value={formProduto.descricao} onChange={(event) => setFormProduto((atual) => ({ ...atual, descricao: event.target.value }))} /></label>
          </div>
          <button className="primary-action" type="submit">{produtoEditandoId ? 'Salvar produto' : 'Criar produto'}</button>
        </form>

        <form className="garcon-panel" onSubmit={salvarIngrediente}>
          <header>
            <span><Utensils size={22} />Ingredientes</span>
            {ingredienteEditandoId && <button type="button" onClick={limparIngrediente}>Novo ingrediente</button>}
          </header>
          <div className="garcon-form-grid">
            <label>Nome<input value={formIngrediente.nome} onChange={(event) => setFormIngrediente((atual) => ({ ...atual, nome: event.target.value }))} placeholder="Bacon" /></label>
            <label>Unidade<input value={formIngrediente.unidade_medida} onChange={(event) => setFormIngrediente((atual) => ({ ...atual, unidade_medida: event.target.value }))} placeholder="un, kg, g" /></label>
            <label>Custo unitario<input inputMode="decimal" value={formIngrediente.custo_unitario} onChange={(event) => setFormIngrediente((atual) => ({ ...atual, custo_unitario: event.target.value }))} placeholder="0,00" /></label>
            <label>Estoque minimo<input inputMode="decimal" value={formIngrediente.estoque_minimo} onChange={(event) => setFormIngrediente((atual) => ({ ...atual, estoque_minimo: event.target.value }))} /></label>
            <label>Status
              <select value={formIngrediente.status} onChange={(event) => setFormIngrediente((atual) => ({ ...atual, status: event.target.value }))}>
                {STATUS_INGREDIENTE.map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
            </label>
            <label className="wide">Descricao<textarea value={formIngrediente.descricao} onChange={(event) => setFormIngrediente((atual) => ({ ...atual, descricao: event.target.value }))} /></label>
          </div>
          <button className="primary-action" type="submit">{ingredienteEditandoId ? 'Salvar ingrediente' : 'Criar ingrediente'}</button>
        </form>

        <form className="garcon-panel" onSubmit={salvarVinculo}>
          <header><span><Plus size={22} />Ingredientes do produto</span></header>
          <div className="garcon-form-grid">
            <label>Produto
              <select value={formVinculo.produto_id} onChange={(event) => setFormVinculo((atual) => ({ ...atual, produto_id: event.target.value }))}>
                <option value="">Selecione</option>
                {produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
              </select>
            </label>
            <label>Ingrediente
              <select value={formVinculo.ingrediente_id} onChange={(event) => setFormVinculo((atual) => ({ ...atual, ingrediente_id: event.target.value }))}>
                <option value="">Selecione</option>
                {ingredientes.map((ingrediente) => <option key={ingrediente.id} value={ingrediente.id}>{ingrediente.nome}</option>)}
              </select>
            </label>
            <label>Tipo
              <select value={formVinculo.tipo} onChange={(event) => setFormVinculo((atual) => ({ ...atual, tipo: event.target.value }))}>
                <option value="base">base</option>
                <option value="adicional">adicional</option>
              </select>
            </label>
            <label>Quantidade<input inputMode="decimal" value={formVinculo.quantidade} onChange={(event) => setFormVinculo((atual) => ({ ...atual, quantidade: event.target.value }))} /></label>
            <label>Preco adicional<input inputMode="decimal" value={formVinculo.preco_adicional} onChange={(event) => setFormVinculo((atual) => ({ ...atual, preco_adicional: event.target.value }))} placeholder="0,00" /></label>
            <label>Obrigatorio
              <select value={formVinculo.obrigatorio} onChange={(event) => setFormVinculo((atual) => ({ ...atual, obrigatorio: event.target.value }))}>
                <option value="sim">sim</option>
                <option value="nao">nao</option>
              </select>
            </label>
          </div>
          <button className="primary-action" type="submit">Vincular ingrediente</button>
        </form>
      </section>

      <div className="garcon-products-list">
        {produtos.map((produto) => (
          <article className="garcon-product-card" key={produto.id}>
            {produto.imagem_url ? <img src={produto.imagem_url} alt="" /> : <span><Utensils size={28} /></span>}
            <div>
              <strong>{produto.nome}</strong>
              <small>{categoriaNome(produto.categoria_id)}</small>
              <p>{produto.descricao || 'Sem descricao'}</p>
              <b>{formatarMoeda(produto.preco)}</b>
              <div className="garcon-product-ingredients">
                {vinculosDoProduto(produto.id).map((vinculo) => (
                  <button type="button" key={vinculo.id} onClick={() => removerVinculo(vinculo)}>
                    {vinculo.ingrediente?.nome || 'Ingrediente'} - {vinculo.tipo}
                    {Number(vinculo.preco_adicional || 0) > 0 ? ` + ${formatarMoeda(vinculo.preco_adicional)}` : ''}
                    <Trash2 size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div className="garcon-product-flags">
              <mark className={`garcon-status ${produto.status}`}>{produto.status}</mark>
              <mark className={`garcon-status ${produto.disponivel ? 'livre' : 'inativa'}`}>{produto.disponivel ? 'disponivel' : 'indisponivel'}</mark>
              <mark className={`garcon-status ${produto.permite_adicionais ? 'livre' : 'inativa'}`}>{produto.permite_adicionais ? 'adicionais' : 'sem adicionais'}</mark>
              <button type="button" onClick={() => editarProduto(produto)}><Edit3 size={17} />Editar</button>
            </div>
          </article>
        ))}
        {produtos.length === 0 && <p className="empty-state">Nenhum produto cadastrado.</p>}
      </div>

      <div className="garcon-ingredients-list">
        {ingredientes.map((ingrediente) => (
          <button type="button" key={ingrediente.id} onClick={() => editarIngrediente(ingrediente)}>
            <strong>{ingrediente.nome}</strong>
            <span>{ingrediente.unidade_medida} - custo {formatarMoeda(ingrediente.custo_unitario)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
