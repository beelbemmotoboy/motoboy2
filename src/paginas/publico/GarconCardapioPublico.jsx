import React from 'react';
import { Minus, Plus, ShoppingCart, Store, Trash2, Utensils } from 'lucide-react';
import { supabase } from '../../supabaseClient';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function totalCarrinho(carrinho) {
  return carrinho.reduce((total, item) => total + Number(item.preco || 0) * Number(item.quantidade || 0), 0);
}

export function GarconCardapioPublico({ empresaId, mesaId }) {
  const [carregando, setCarregando] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const [cardapio, setCardapio] = React.useState(null);
  const [carrinho, setCarrinho] = React.useState([]);
  const [observacaoGeral, setObservacaoGeral] = React.useState('');
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

  function adicionarProduto(produto) {
    if (produto.disponivel === false) return;
    setMensagem('');
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.produto_id === produto.id);
      if (existente) {
        return atual.map((item) => (
          item.produto_id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        ));
      }
      return [
        ...atual,
        {
          produto_id: produto.id,
          nome: produto.nome,
          preco: Number(produto.preco || 0),
          quantidade: 1,
          observacao: '',
        },
      ];
    });
  }

  function atualizarQuantidade(produtoId, quantidade) {
    setCarrinho((atual) => atual
      .map((item) => (item.produto_id === produtoId ? { ...item, quantidade: Math.max(1, quantidade) } : item))
      .filter((item) => item.quantidade > 0));
  }

  function removerItem(produtoId) {
    setCarrinho((atual) => atual.filter((item) => item.produto_id !== produtoId));
  }

  function atualizarObservacao(produtoId, observacao) {
    setCarrinho((atual) => atual.map((item) => (
      item.produto_id === produtoId ? { ...item, observacao } : item
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
                  <button type="button" onClick={() => adicionarProduto(produto)} disabled={produto.disponivel === false}>
                    <Plus size={18} />
                    {produto.disponivel === false ? 'Indisponivel' : 'Adicionar'}
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
          <article className="garcon-cart-item" key={item.produto_id}>
            <div>
              <strong>{item.nome}</strong>
              <span>{formatarMoeda(item.preco * item.quantidade)}</span>
            </div>
            <div className="garcon-cart-qty">
              <button type="button" aria-label="Diminuir quantidade" onClick={() => item.quantidade === 1 ? removerItem(item.produto_id) : atualizarQuantidade(item.produto_id, item.quantidade - 1)}><Minus size={16} /></button>
              <b>{item.quantidade}</b>
              <button type="button" aria-label="Aumentar quantidade" onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + 1)}><Plus size={16} /></button>
              <button type="button" aria-label="Remover item" onClick={() => removerItem(item.produto_id)}><Trash2 size={16} /></button>
            </div>
            <textarea value={item.observacao} onChange={(event) => atualizarObservacao(item.produto_id, event.target.value)} placeholder="Observacao do item" />
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
    </main>
  );
}
