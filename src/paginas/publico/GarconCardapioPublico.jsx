import React from 'react';
import { Check, Minus, Plus, ShoppingCart, Store, Trash2, Utensils, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function totalCarrinho(carrinho) {
  return carrinho.reduce((total, item) => total + Number(item.preco_total || item.preco || 0) * Number(item.quantidade || 0), 0);
}

function totalProduto(produto, opcoesSelecionadas) {
  const adicional = Object.values(opcoesSelecionadas || {})
    .flat()
    .reduce((soma, opcao) => soma + Number(opcao.preco_adicional || 0), 0);
  return Number(produto?.preco || 0) + adicional;
}

function gruposDoProduto(produto) {
  return [...(produto?.grupos_de_opcoes || produto?.grupos_opcoes || [])]
    .filter((grupo) => grupo.status !== 'inativo')
    .sort((a, b) => Number(b.obrigatorio) - Number(a.obrigatorio) || Number(a.ordem || 0) - Number(b.ordem || 0));
}

export function GarconCardapioPublico({ empresaId, mesaId }) {
  const [carregando, setCarregando] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const [cardapio, setCardapio] = React.useState(null);
  const [carrinho, setCarrinho] = React.useState([]);
  const [observacaoGeral, setObservacaoGeral] = React.useState('');
  const [produtoAberto, setProdutoAberto] = React.useState(null);
  const [opcoesSelecionadas, setOpcoesSelecionadas] = React.useState({});
  const [observacaoProduto, setObservacaoProduto] = React.useState('');
  const [mensagem, setMensagem] = React.useState('');

  React.useEffect(() => {
    carregarCardapio();
  }, [empresaId, mesaId]);

  async function carregarCardapio() {
    setMensagem('');
    setCarregando(true);
    if (!supabase || !empresaId || !mesaId) {
      setMensagem('Cardapio indisponivel neste momento.');
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase.rpc('buscar_cardapio_garcon_publico', {
      target_empresa_id: empresaId,
      target_mesa_id: mesaId,
    });
    setCarregando(false);

    if (error) {
      setMensagem(`Nao foi possivel abrir o cardapio: ${error.message}`);
      return;
    }
    if (!data) {
      setMensagem('Mesa ou cardapio indisponivel.');
      return;
    }
    setCardapio(data);
  }

  function abrirProduto(produto) {
    if (produto.disponivel === false) return;
    setMensagem('');
    setProdutoAberto(produto);
    setOpcoesSelecionadas({});
    setObservacaoProduto('');
  }

  function fecharProduto() {
    setProdutoAberto(null);
    setOpcoesSelecionadas({});
    setObservacaoProduto('');
  }

  function alternarOpcao(grupo, opcao) {
    if (opcao.disponivel === false || opcao.status === 'inativo') return;
    setMensagem('');
    setOpcoesSelecionadas((atual) => {
      const selecionadas = atual[grupo.id] || [];
      const jaExiste = selecionadas.some((item) => item.id === opcao.id);
      if (!grupo.multipla_escolha) {
        return { ...atual, [grupo.id]: jaExiste ? [] : [opcao] };
      }
      if (jaExiste) {
        return { ...atual, [grupo.id]: selecionadas.filter((item) => item.id !== opcao.id) };
      }
      if (Number(grupo.maximo_escolhas || 0) > 0 && selecionadas.length >= Number(grupo.maximo_escolhas)) {
        setMensagem(`Limite de ${grupo.maximo_escolhas} escolha(s) em ${grupo.nome}.`);
        return atual;
      }
      return { ...atual, [grupo.id]: [...selecionadas, opcao] };
    });
  }

  function validarProdutoAberto() {
    for (const grupo of gruposDoProduto(produtoAberto)) {
      const quantidade = (opcoesSelecionadas[grupo.id] || []).length;
      if (grupo.obrigatorio && quantidade < Number(grupo.minimo_escolhas || 1)) {
        return `Escolha ${grupo.minimo_escolhas || 1} opcao em ${grupo.nome}.`;
      }
      if (Number(grupo.maximo_escolhas || 0) > 0 && quantidade > Number(grupo.maximo_escolhas)) {
        return `Revise o limite de escolhas em ${grupo.nome}.`;
      }
    }
    return '';
  }

  function adicionarProdutoAoCarrinho() {
    if (!produtoAberto) return;
    const erro = validarProdutoAberto();
    if (erro) {
      setMensagem(erro);
      return;
    }
    const opcoes = Object.entries(opcoesSelecionadas).flatMap(([grupoId, opcoes]) => {
      const grupo = gruposDoProduto(produtoAberto).find((item) => item.id === grupoId);
      return opcoes.map((opcao) => ({
        id: opcao.id,
        grupo_id: grupoId,
        grupo_nome: grupo?.nome || 'Opcao',
        nome: opcao.nome,
        preco_adicional: Number(opcao.preco_adicional || 0),
      }));
    });
    const precoUnitario = totalProduto(produtoAberto, opcoesSelecionadas);
    const chave = `${produtoAberto.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCarrinho((atual) => {
      return [
        ...atual,
        {
          chave,
          produto_id: produtoAberto.id,
          nome: produtoAberto.nome,
          preco: Number(produtoAberto.preco || 0),
          preco_total: precoUnitario,
          quantidade: 1,
          observacao: observacaoProduto.trim(),
          opcoes,
        },
      ];
    });
    fecharProduto();
  }

  function atualizarQuantidade(chave, quantidade) {
    setCarrinho((atual) => atual
      .map((item) => (item.chave === chave ? { ...item, quantidade: Math.max(1, quantidade) } : item))
      .filter((item) => item.quantidade > 0));
  }

  function removerItem(chave) {
    setCarrinho((atual) => atual.filter((item) => item.chave !== chave));
  }

  function atualizarObservacao(chave, observacao) {
    setCarrinho((atual) => atual.map((item) => (
      item.chave === chave ? { ...item, observacao } : item
    )));
  }

  async function enviarPedido() {
    setMensagem('');
    if (!carrinho.length) {
      setMensagem('Adicione ao menos um produto ao pedido.');
      return;
    }

    setEnviando(true);
    const { data, error } = await supabase.rpc('criar_pedido_garcon_publico', {
      target_empresa_id: empresaId,
      target_mesa_id: mesaId,
      observacao_pedido: observacaoGeral.trim(),
      itens_pedido: carrinho.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        observacao: item.observacao.trim(),
        opcoes: item.opcoes || [],
      })),
    });
    setEnviando(false);

    if (error) {
      setMensagem(`Nao foi possivel enviar o pedido: ${error.message}`);
      return;
    }

    setCarrinho([]);
    setObservacaoGeral('');
    setMensagem('Pedido enviado com sucesso. Acompanhe o atendimento pela mesa.');
    if (data?.numero_pedido) {
      setMensagem(`Pedido enviado com sucesso. Acompanhe o atendimento pela mesa. Numero ${data.numero_pedido}.`);
    }
  }

  const empresa = cardapio?.empresa || {};
  const mesa = cardapio?.mesa || {};
  const categorias = cardapio?.categorias || [];
  const total = totalCarrinho(carrinho);

  if (carregando) {
    return (
      <main className="garcon-public-page">
        <section className="garcon-public-loading">
          <Utensils size={38} />
          <p>Carregando cardapio...</p>
        </section>
      </main>
    );
  }

  if (!cardapio) {
    return (
      <main className="garcon-public-page">
        <section className="garcon-public-loading">
          <Store size={38} />
          <p>{mensagem || 'Cardapio indisponivel.'}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="garcon-public-page">
      <header className="garcon-public-header">
        <div className="garcon-public-logo">
          {empresa.logo_url ? <img src={empresa.logo_url} alt="" /> : <Store size={26} />}
        </div>
        <div>
          <span>Beelbem Garçon</span>
          <h1>{empresa.nome || 'Cardapio digital'}</h1>
          <p>{mesa.nome || 'Mesa'} {mesa.numero ? `nº ${mesa.numero}` : ''}</p>
        </div>
      </header>

      {mensagem && <p className={mensagem.includes('sucesso') ? 'garcon-public-success' : 'garcon-public-error'}>{mensagem}</p>}

      <section className="garcon-public-menu" aria-label="Cardapio da mesa">
        {categorias.map((categoria) => (
          <section className="garcon-public-category" key={categoria.id}>
            <h2>{categoria.nome}</h2>
            {categoria.descricao && <p>{categoria.descricao}</p>}
            <div className="garcon-public-products">
              {(categoria.produtos || []).map((produto) => (
                <article className={`garcon-public-product ${produto.disponivel === false ? 'unavailable' : ''}`} key={produto.id}>
                  {produto.imagem_url ? <img src={produto.imagem_url} alt="" /> : <span><Utensils size={24} /></span>}
                  <div>
                    <strong>{produto.nome}</strong>
                    <small>{produto.descricao || 'Sem descricao'}</small>
                    <b>{formatarMoeda(produto.preco)}</b>
                  </div>
                  <button type="button" onClick={() => abrirProduto(produto)} disabled={produto.disponivel === false}>
                    <Plus size={18} />
                    {produto.disponivel === false ? 'Indisponivel' : 'Escolher'}
                  </button>
                </article>
              ))}
              {(categoria.produtos || []).length === 0 && <p className="empty-state">Nenhum produto disponivel nesta categoria.</p>}
            </div>
          </section>
        ))}
      </section>

      <aside className="garcon-public-cart" aria-label="Carrinho">
        <header>
          <span><ShoppingCart size={20} />Carrinho</span>
          <strong>{formatarMoeda(total)}</strong>
        </header>

        {carrinho.map((item) => (
          <article className="garcon-cart-item" key={item.chave}>
            <div>
              <strong>{item.nome}</strong>
              <span>{formatarMoeda(item.preco_total * item.quantidade)}</span>
            </div>
            {(item.opcoes || []).length > 0 && (
              <ul className="garcon-cart-options">
                {item.opcoes.map((opcao) => (
                  <li key={`${item.chave}-${opcao.id}`}>{opcao.grupo_nome}: {opcao.nome}{opcao.preco_adicional > 0 ? ` + ${formatarMoeda(opcao.preco_adicional)}` : ''}</li>
                ))}
              </ul>
            )}
            <div className="garcon-cart-qty">
              <button type="button" aria-label="Diminuir quantidade" onClick={() => item.quantidade === 1 ? removerItem(item.chave) : atualizarQuantidade(item.chave, item.quantidade - 1)}><Minus size={16} /></button>
              <b>{item.quantidade}</b>
              <button type="button" aria-label="Aumentar quantidade" onClick={() => atualizarQuantidade(item.chave, item.quantidade + 1)}><Plus size={16} /></button>
              <button type="button" aria-label="Remover item" onClick={() => removerItem(item.chave)}><Trash2 size={16} /></button>
            </div>
            <textarea value={item.observacao} onChange={(event) => atualizarObservacao(item.chave, event.target.value)} placeholder="Observacao do item" />
          </article>
        ))}
        {carrinho.length === 0 && <p className="garcon-cart-empty">Adicione produtos para montar o pedido.</p>}

        <label className="garcon-public-note">
          Observacao geral
          <textarea value={observacaoGeral} onChange={(event) => setObservacaoGeral(event.target.value)} placeholder="Ex.: sem cebola, ponto da carne, talheres" />
        </label>

        <button className="garcon-public-submit" type="button" onClick={enviarPedido} disabled={enviando || carrinho.length === 0}>
          {enviando ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </aside>

      {produtoAberto && (
        <section className="garcon-product-modal" role="dialog" aria-modal="true" aria-label="Detalhes do produto">
          <div className="garcon-product-modal-card">
            <header>
              {produtoAberto.imagem_url ? <img src={produtoAberto.imagem_url} alt="" /> : <span><Utensils size={24} /></span>}
              <div>
                <small>Beelbem Garcon</small>
                <h2>{produtoAberto.nome}</h2>
                <p>{produtoAberto.descricao || 'Personalize seu pedido.'}</p>
                <strong>{formatarMoeda(produtoAberto.preco)}</strong>
              </div>
              <button type="button" aria-label="Fechar" onClick={fecharProduto}><X size={20} /></button>
            </header>

            <div className="garcon-product-modal-body">
              {gruposDoProduto(produtoAberto).map((grupo) => {
                const selecionadas = opcoesSelecionadas[grupo.id] || [];
                return (
                  <section className="garcon-option-group" key={grupo.id}>
                    <div>
                      <h3>{grupo.nome}</h3>
                      <span>{grupo.obrigatorio ? `Escolha ${grupo.minimo_escolhas || 1} opcao` : 'Opcional'}{grupo.multipla_escolha ? ` - ate ${grupo.maximo_escolhas}` : ''}</span>
                    </div>
                    {grupo.descricao && <p>{grupo.descricao}</p>}
                    <div className="garcon-option-list">
                      {(grupo.opcoes || []).map((opcao) => {
                        const marcado = selecionadas.some((item) => item.id === opcao.id);
                        return (
                          <button type="button" className={marcado ? 'selected' : ''} key={opcao.id} onClick={() => alternarOpcao(grupo, opcao)} disabled={opcao.disponivel === false || opcao.status === 'inativo'}>
                            <span>{marcado && <Check size={16} />}{opcao.nome}</span>
                            <b>{Number(opcao.preco_adicional || 0) > 0 ? `+ ${formatarMoeda(opcao.preco_adicional)}` : 'sem custo'}</b>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {gruposDoProduto(produtoAberto).length === 0 && <p className="garcon-cart-empty">Este produto nao possui adicionais cadastrados.</p>}
              <label className="garcon-public-note">
                Observacao para a cozinha
                <textarea value={observacaoProduto} onChange={(event) => setObservacaoProduto(event.target.value)} placeholder="Ex.: sem sal, cortar ao meio, caprichar no molho" />
              </label>
            </div>

            <footer>
              <strong>Total {formatarMoeda(totalProduto(produtoAberto, opcoesSelecionadas))}</strong>
              <button type="button" onClick={adicionarProdutoAoCarrinho}>Adicionar ao pedido</button>
            </footer>
          </div>
        </section>
      )}
    </main>
  );
}
