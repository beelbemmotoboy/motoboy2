import React from 'react';
import {
  ArrowRight,
  BarChart3,
  ChefHat,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileText,
  Layers3,
  Plus,
  QrCode,
  RefreshCw,
  ShoppingCart,
  Store,
  Table2,
  Utensils,
  XCircle,
} from 'lucide-react';
import { LayoutLojista } from '../../../layouts/LayoutLojista';
import { supabase } from '../../../supabaseClient';
import { GarconCardapioCadastroView } from './GarconCardapioCadastroView';
import { carregarDadosGarcon } from './garconDb';

const STATUS_MESA = ['ativa', 'livre', 'ocupada', 'inativa'];
const STATUS_CADASTRO = ['ativa', 'inativa'];
const STATUS_PRODUTO = ['ativo', 'inativo'];

const STATUS_PEDIDO_LABEL = {
  novo: 'novo',
  confirmado: 'confirmado',
  em_preparo: 'em preparo',
  pronto: 'pronto',
  entregue: 'entregue',
  cancelado: 'cancelado',
};

const STATUS_PEDIDO_ACOES = {
  novo: [
    ['confirmado', 'Confirmar pedido'],
    ['cancelado', 'Cancelar'],
  ],
  confirmado: [
    ['em_preparo', 'Colocar em preparo'],
    ['cancelado', 'Cancelar'],
  ],
  em_preparo: [['pronto', 'Pedido pronto']],
  pronto: [['entregue', 'Marcar entregue']],
  entregue: [],
  cancelado: [],
};

const FORM_MESA_INICIAL = {
  nome: '',
  numero: '',
  descricao: '',
  status: 'livre',
};

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
  tempo_medio_preparo: '',
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarHora(valor) {
  if (!valor) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor));
}

function precoParaEntrada(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoedaBrasileira(valor) {
  const limpo = String(valor || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const numero = Number(limpo || 0);
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0;
}

function inicioDoDiaIso() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data.toISOString();
}

function fimDoDiaIso() {
  const data = new Date();
  data.setHours(23, 59, 59, 999);
  return data.toISOString();
}

function tempoDesde(valor) {
  if (!valor) return '--';
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(valor).getTime()) / 60000));
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

function statusClasse(status) {
  return String(status || '').replace(/_/g, '-');
}

function itensDoPedido(pedido) {
  return pedido?.itens_pedido_garcon || pedido?.itens || [];
}

export function BeelbemGarconView({ city, store, profile, storeOpen = true, onToggleStoreStatus, onBack }) {
  const [aba, setAba] = React.useState('inicio');
  const [carregando, setCarregando] = React.useState(false);
  const [mensagem, setMensagem] = React.useState('');
  const [mesas, setMesas] = React.useState([]);
  const [categorias, setCategorias] = React.useState([]);
  const [produtos, setProdutos] = React.useState([]);
  const [ingredientes, setIngredientes] = React.useState([]);
  const [produtoIngredientes, setProdutoIngredientes] = React.useState([]);
  const [gruposOpcoes, setGruposOpcoes] = React.useState([]);
  const [opcoesProduto, setOpcoesProduto] = React.useState([]);
  const [pedidos, setPedidos] = React.useState([]);
  const [mesaEditandoId, setMesaEditandoId] = React.useState('');
  const [categoriaEditandoId, setCategoriaEditandoId] = React.useState('');
  const [produtoEditandoId, setProdutoEditandoId] = React.useState('');
  const [formMesa, setFormMesa] = React.useState(FORM_MESA_INICIAL);
  const [formCategoria, setFormCategoria] = React.useState(FORM_CATEGORIA_INICIAL);
  const [formProduto, setFormProduto] = React.useState(FORM_PRODUTO_INICIAL);

  const storeName = store?.fantasyName || store?.name || profile?.name || 'Minha loja';

  React.useEffect(() => {
    carregarDados();
  }, [store?.id]);

  React.useEffect(() => {
    if (!supabase || !store?.id) return undefined;

    const intervalId = window.setInterval(carregarPedidos, 15000);
    const channel = supabase
      .channel(`garcon-pedidos-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_garcon', filter: `empresa_id=eq.${store.id}` }, carregarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido_garcon' }, carregarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opcoes_item_pedido_garcon' }, carregarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredientes_cardapio', filter: `empresa_id=eq.${store.id}` }, carregarDados)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos_ingredientes_cardapio', filter: `empresa_id=eq.${store.id}` }, carregarDados)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grupos_de_opcoes', filter: `empresa_id=eq.${store.id}` }, carregarDados)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opcoes_de_produto', filter: `empresa_id=eq.${store.id}` }, carregarDados)
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [store?.id]);

  async function carregarDados() {
    setMensagem('');
    if (!supabase || !store?.id) {
      setMensagem('Supabase nao disponivel nesta sessao.');
      return;
    }

    setCarregando(true);
    let dados;
    try {
      dados = await carregarDadosGarcon({ empresaId: store.id, buscarPedidosDoDia });
    } catch (error) {
      setCarregando(false);
      setMensagem(`Nao foi possivel carregar o Garcon: ${error.message}`);
      return;
    }
    setCarregando(false);

    setMesas(dados.mesas);
    setCategorias(dados.categorias);
    setProdutos(dados.produtos);
    setIngredientes(dados.ingredientes);
    setProdutoIngredientes(dados.produtoIngredientes);
    setGruposOpcoes(dados.gruposOpcoes);
    setOpcoesProduto(dados.opcoesProduto);
    setPedidos(dados.pedidos);
    setFormProduto((atual) => ({
      ...atual,
      categoria_id: atual.categoria_id || dados.categorias?.[0]?.id || '',
    }));
  }

  async function buscarPedidosDoDia() {
    return supabase
      .from('pedidos_garcon')
      .select(`
        id,
        empresa_id,
        mesa_id,
        numero_pedido,
        status,
        observacao_geral,
        subtotal,
        total,
        origem,
        criado_em,
        atualizado_em,
        mesas(nome, numero),
        itens_pedido_garcon(
          id,
          produto_id,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          observacao,
          criado_em,
          opcoes_item_pedido_garcon(id, grupo_nome, opcao_nome, preco_adicional)
        )
      `)
      .eq('empresa_id', store.id)
      .gte('criado_em', inicioDoDiaIso())
      .lte('criado_em', fimDoDiaIso())
      .order('criado_em', { ascending: false });
  }

  async function carregarPedidos() {
    if (!supabase || !store?.id) return;
    const result = await buscarPedidosDoDia();
    if (result.error) {
      setMensagem(`Nao foi possivel atualizar pedidos: ${result.error.message}`);
      return;
    }
    setPedidos(result.data ?? []);
  }

  const resumo = React.useMemo(() => {
    const pedidosValidos = pedidos.filter((pedido) => pedido.status !== 'cancelado');
    return {
      mesas: mesas.length,
      abertos: pedidos.filter((pedido) => ['novo', 'confirmado'].includes(pedido.status)).length,
      preparo: pedidos.filter((pedido) => pedido.status === 'em_preparo').length,
      prontos: pedidos.filter((pedido) => pedido.status === 'pronto').length,
      vendas: pedidosValidos.reduce((total, pedido) => total + Number(pedido.total || 0), 0),
      cancelados: pedidos.filter((pedido) => pedido.status === 'cancelado').length,
    };
  }, [mesas, pedidos]);

  const relatorio = React.useMemo(() => {
    const pedidosValidos = pedidos.filter((pedido) => pedido.status !== 'cancelado');
    const total = pedidosValidos.reduce((soma, pedido) => soma + Number(pedido.total || 0), 0);
    const produtosMap = new Map();
    const mesasMap = new Map();

    for (const pedido of pedidosValidos) {
      const mesa = [pedido.mesas?.nome, pedido.mesas?.numero ? `nº ${pedido.mesas.numero}` : ''].filter(Boolean).join(' ') || 'Mesa nao informada';
      const mesaAtual = mesasMap.get(mesa) || { mesa, pedidos: 0, total: 0 };
      mesaAtual.pedidos += 1;
      mesaAtual.total += Number(pedido.total || 0);
      mesasMap.set(mesa, mesaAtual);

      for (const item of itensDoPedido(pedido)) {
        const atual = produtosMap.get(item.nome_produto) || { nome: item.nome_produto, quantidade: 0, total: 0 };
        atual.quantidade += Number(item.quantidade || 0);
        atual.total += Number(item.subtotal || 0);
        produtosMap.set(item.nome_produto, atual);
      }
    }

    return {
      total,
      quantidadePedidos: pedidosValidos.length,
      ticketMedio: pedidosValidos.length ? total / pedidosValidos.length : 0,
      produtosMaisVendidos: [...produtosMap.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5),
      vendasPorMesa: [...mesasMap.values()].sort((a, b) => b.total - a.total),
    };
  }, [pedidos]);

  function linkPublicoMesa(mesaId) {
    return `${window.location.origin}/garcon/cardapio/${store?.id}/${mesaId}`;
  }

  function qrCodeUrl(link) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=14&data=${encodeURIComponent(link)}`;
  }

  function limparMesa() {
    setMesaEditandoId('');
    setFormMesa(FORM_MESA_INICIAL);
  }

  function limparCategoria() {
    setCategoriaEditandoId('');
    setFormCategoria(FORM_CATEGORIA_INICIAL);
  }

  function limparProduto() {
    setProdutoEditandoId('');
    setFormProduto({ ...FORM_PRODUTO_INICIAL, categoria_id: categorias[0]?.id || '' });
  }

  async function salvarMesa(event) {
    event.preventDefault();
    setMensagem('');
    if (!store?.id || !formMesa.nome.trim() || !formMesa.numero.trim()) {
      setMensagem('Nome e numero da mesa sao obrigatorios.');
      return;
    }

    const payload = {
      empresa_id: store.id,
      nome: formMesa.nome.trim(),
      numero: formMesa.numero.trim(),
      descricao: formMesa.descricao.trim() || null,
      status: formMesa.status,
    };

    if (mesaEditandoId) {
      const { error } = await supabase
        .from('mesas')
        .update({ ...payload, qr_code_url: linkPublicoMesa(mesaEditandoId) })
        .eq('id', mesaEditandoId)
        .eq('empresa_id', store.id);
      if (error) {
        setMensagem(`Nao foi possivel salvar a mesa: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('mesas')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        setMensagem(`Nao foi possivel criar a mesa: ${error.message}`);
        return;
      }
      await supabase
        .from('mesas')
        .update({ qr_code_url: linkPublicoMesa(data.id) })
        .eq('id', data.id)
        .eq('empresa_id', store.id);
    }

    limparMesa();
    setMensagem('Mesa salva.');
    carregarDados();
  }

  async function alternarMesaStatus(mesa) {
    const proximoStatus = mesa.status === 'inativa' ? 'ativa' : 'inativa';
    const { error } = await supabase
      .from('mesas')
      .update({ status: proximoStatus })
      .eq('id', mesa.id)
      .eq('empresa_id', store.id);
    if (error) {
      setMensagem(`Nao foi possivel alterar a mesa: ${error.message}`);
      return;
    }
    carregarDados();
  }

  async function copiarLinkMesa(mesa) {
    const link = linkPublicoMesa(mesa.id);
    try {
      await navigator.clipboard.writeText(link);
      setMensagem('Link publico da mesa copiado.');
    } catch {
      setMensagem(link);
    }
  }

  function imprimirQrMesa(mesa) {
    const link = linkPublicoMesa(mesa.id);
    const janela = window.open('', '_blank', 'noopener,noreferrer');
    if (!janela) {
      setMensagem('Permita pop-ups para imprimir o QR Code.');
      return;
    }
    janela.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>QR Code ${mesa.nome}</title>
          <style>
            body { font-family: Arial, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
            section { text-align: center; border: 1px solid #ddd; padding: 28px; border-radius: 8px; }
            img { width: 260px; height: 260px; }
            h1 { margin: 0 0 6px; font-size: 26px; }
            p { margin: 8px 0 0; color: #333; }
          </style>
        </head>
        <body>
          <section>
            <h1>${storeName}</h1>
            <strong>${mesa.nome}</strong>
            <p>${mesa.numero ? `Mesa ${mesa.numero}` : 'Atendimento por mesa'}</p>
            <img src="${qrCodeUrl(link)}" alt="QR Code" />
            <p>${link}</p>
          </section>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    janela.document.close();
  }

  async function salvarCategoria(event) {
    event.preventDefault();
    setMensagem('');
    if (!store?.id || !formCategoria.nome.trim()) {
      setMensagem('Nome da categoria e obrigatorio.');
      return;
    }

    const payload = {
      empresa_id: store.id,
      nome: formCategoria.nome.trim(),
      descricao: formCategoria.descricao.trim() || null,
      ordem: Number(formCategoria.ordem || 0),
      status: formCategoria.status,
    };

    const result = categoriaEditandoId
      ? await supabase.from('categorias_cardapio').update(payload).eq('id', categoriaEditandoId).eq('empresa_id', store.id)
      : await supabase.from('categorias_cardapio').insert(payload);

    if (result.error) {
      setMensagem(`Nao foi possivel salvar a categoria: ${result.error.message}`);
      return;
    }
    limparCategoria();
    setMensagem('Categoria salva.');
    carregarDados();
  }

  async function salvarProduto(event) {
    event.preventDefault();
    setMensagem('');
    const preco = parseMoedaBrasileira(formProduto.preco);
    if (!store?.id || !formProduto.nome.trim() || !formProduto.categoria_id || preco <= 0) {
      setMensagem('Produto, categoria e preco valido sao obrigatorios.');
      return;
    }

    const payload = {
      empresa_id: store.id,
      categoria_id: formProduto.categoria_id,
      nome: formProduto.nome.trim(),
      descricao: formProduto.descricao.trim() || null,
      preco,
      imagem_url: formProduto.imagem_url.trim() || null,
      status: formProduto.status,
      disponivel: formProduto.disponivel === 'sim',
      tempo_medio_preparo: formProduto.tempo_medio_preparo ? Number(formProduto.tempo_medio_preparo) : null,
    };

    const result = produtoEditandoId
      ? await supabase.from('produtos_cardapio').update(payload).eq('id', produtoEditandoId).eq('empresa_id', store.id)
      : await supabase.from('produtos_cardapio').insert(payload);

    if (result.error) {
      setMensagem(`Nao foi possivel salvar o produto: ${result.error.message}`);
      return;
    }
    limparProduto();
    setMensagem('Produto salvo.');
    carregarDados();
  }

  async function atualizarStatusPedido(pedido, status) {
    const { error } = await supabase
      .from('pedidos_garcon')
      .update({ status })
      .eq('id', pedido.id)
      .eq('empresa_id', store.id);
    if (error) {
      setMensagem(`Nao foi possivel atualizar o pedido: ${error.message}`);
      return;
    }
    carregarPedidos();
  }

  function categoriaNome(id) {
    return categorias.find((categoria) => categoria.id === id)?.nome || 'Sem categoria';
  }

  function editarMesa(mesa) {
    setMesaEditandoId(mesa.id);
    setFormMesa({
      nome: mesa.nome || '',
      numero: mesa.numero || '',
      descricao: mesa.descricao || '',
      status: mesa.status || 'livre',
    });
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
      tempo_medio_preparo: produto.tempo_medio_preparo ? String(produto.tempo_medio_preparo) : '',
    });
  }

  function renderTopo(titulo) {
    return (
      <header className="store-app-header">
        <button className="store-menu-button store-logo-menu" type="button" aria-label="Voltar" onClick={onBack}>
          <ArrowRight size={24} className="back-icon" />
        </button>
        <h1>{titulo}</h1>
        <button className={`store-connected-pill ${storeOpen ? 'open' : 'closed'}`} type="button" onClick={onToggleStoreStatus}>
          <span />{storeOpen ? 'Aberto' : 'Fechado'}
        </button>
      </header>
    );
  }

  function renderNavegacao() {
    const itens = [
      ['inicio', 'Inicio', <Store size={18} />],
      ['mesas', 'Mesas', <Table2 size={18} />],
      ['cardapio', 'Cardapio', <Utensils size={18} />],
      ['pedidos', 'Pedidos', <ShoppingCart size={18} />],
      ['cozinha', 'Cozinha / Bar', <ChefHat size={18} />],
      ['relatorio', 'Relatorio', <BarChart3 size={18} />],
    ];

    return (
      <nav className="garcon-tabs" aria-label="Navegacao do Beelbem Garcon">
        {itens.map(([id, label, icon]) => (
          <button key={id} type="button" className={aba === id ? 'active' : ''} onClick={() => setAba(id)}>
            {icon}
            {label}
          </button>
        ))}
      </nav>
    );
  }

  function renderResumo() {
    const cards = [
      { label: 'Mesas cadastradas', valor: resumo.mesas, icon: <Table2 size={28} /> },
      { label: 'Pedidos abertos', valor: resumo.abertos, icon: <ShoppingCart size={28} /> },
      { label: 'Pedidos em preparo', valor: resumo.preparo, icon: <ChefHat size={28} /> },
      { label: 'Pedidos prontos', valor: resumo.prontos, icon: <Clock3 size={28} /> },
      { label: 'Vendas do dia', valor: formatarMoeda(resumo.vendas), icon: <BarChart3 size={28} /> },
    ];

    return (
      <>
        <section className="garcon-summary-grid" aria-label="Resumo do Beelbem Garcon">
          {cards.map((card) => (
            <article className="garcon-summary-card" key={card.label}>
              <span>{card.icon}</span>
              <p>{card.label}</p>
              <strong>{card.valor}</strong>
            </article>
          ))}
        </section>

        <section className="garcon-action-grid" aria-label="Acoes rapidas do Garcon">
          <button type="button" onClick={() => setAba('mesas')}><Plus size={24} />Cadastrar mesa</button>
          <button type="button" onClick={() => setAba('cardapio')}><Utensils size={24} />Cardapio</button>
          <button type="button" onClick={() => setAba('pedidos')}><ShoppingCart size={24} />Pedidos</button>
          <button type="button" onClick={() => setAba('relatorio')}><FileText size={24} />Relatorio do dia</button>
        </section>
      </>
    );
  }

  function renderMesas() {
    return (
      <section className="garcon-two-column">
        <form className="garcon-panel" onSubmit={salvarMesa}>
          <header>
            <span><Table2 size={22} />Cadastro de mesas</span>
            {mesaEditandoId && <button type="button" onClick={limparMesa}>Nova mesa</button>}
          </header>
          <div className="garcon-form-grid">
            <label>Nome da mesa<input value={formMesa.nome} onChange={(event) => setFormMesa((atual) => ({ ...atual, nome: event.target.value }))} placeholder="Mesa 01" /></label>
            <label>Numero<input value={formMesa.numero} onChange={(event) => setFormMesa((atual) => ({ ...atual, numero: event.target.value }))} placeholder="01" /></label>
            <label className="wide">Descricao opcional<input value={formMesa.descricao} onChange={(event) => setFormMesa((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Area externa, balcao ou sala" /></label>
            <label>Status
              <select value={formMesa.status} onChange={(event) => setFormMesa((atual) => ({ ...atual, status: event.target.value }))}>
                {STATUS_MESA.map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <button className="primary-action" type="submit">{mesaEditandoId ? 'Salvar mesa' : 'Criar mesa'}</button>
        </form>

        <div className="garcon-list" aria-label="Mesas cadastradas">
          {mesas.map((mesa) => {
            const link = linkPublicoMesa(mesa.id);
            return (
              <article className="garcon-row mesa" key={mesa.id}>
                <div>
                  <strong>{mesa.nome}</strong>
                  <span>Mesa {mesa.numero} · {mesa.descricao || 'Sem descricao'}</span>
                  <mark className={`garcon-status ${mesa.status}`}>{mesa.status}</mark>
                </div>
                <div className="garcon-qr-card">
                  <img src={qrCodeUrl(link)} alt={`QR Code ${mesa.nome}`} />
                  <small>{link}</small>
                </div>
                <div className="garcon-row-actions">
                  <button type="button" onClick={() => editarMesa(mesa)}><Edit3 size={17} />Editar</button>
                  <button type="button" onClick={() => alternarMesaStatus(mesa)}>{mesa.status === 'inativa' ? 'Ativar' : 'Inativar'}</button>
                  <button type="button" onClick={() => copiarLinkMesa(mesa)}><Copy size={17} />Copiar link</button>
                  <a href={qrCodeUrl(link)} download={`qr-${mesa.nome}.png`} target="_blank" rel="noreferrer"><Download size={17} />Baixar QR</a>
                  <button type="button" onClick={() => imprimirQrMesa(mesa)}><QrCode size={17} />Imprimir</button>
                </div>
              </article>
            );
          })}
          {mesas.length === 0 && <p className="empty-state">Nenhuma mesa cadastrada.</p>}
        </div>
      </section>
    );
  }

  function renderCardapio() {
    return (
      <GarconCardapioCadastroView
        store={store}
        categorias={categorias}
        produtos={produtos}
        ingredientes={ingredientes}
        produtoIngredientes={produtoIngredientes}
        gruposOpcoes={gruposOpcoes}
        opcoesProduto={opcoesProduto}
        onReload={carregarDados}
        onMessage={setMensagem}
      />
    );

  }


  function renderPedidoCard(pedido, cozinha = false) {
    const itens = itensDoPedido(pedido);
    const acoes = cozinha
      ? pedido.status === 'confirmado'
        ? [['em_preparo', 'Iniciar preparo']]
        : [['pronto', 'Pedido pronto']]
      : STATUS_PEDIDO_ACOES[pedido.status] || [];

    return (
      <article className={`garcon-pedido-card ${cozinha ? 'kitchen' : ''}`} key={pedido.id}>
        <header>
          <div>
            <span>{pedido.numero_pedido}</span>
            <strong>{pedido.mesas?.nome || 'Mesa'} {pedido.mesas?.numero ? `nº ${pedido.mesas.numero}` : ''}</strong>
          </div>
          <mark className={`garcon-status pedido ${statusClasse(pedido.status)}`}>{STATUS_PEDIDO_LABEL[pedido.status] || pedido.status}</mark>
        </header>
        <div className="garcon-pedido-meta">
          <span>{formatarHora(pedido.criado_em)}</span>
          <span>{tempoDesde(pedido.criado_em)}</span>
          <strong>{formatarMoeda(pedido.total)}</strong>
        </div>
        <ul className="garcon-pedido-itens">
          {itens.map((item) => (
            <li key={item.id}>
              <strong>{item.quantidade}x {item.nome_produto}</strong>
              {(item.opcoes_item_pedido_garcon || []).map((opcao) => (
                <span key={opcao.id}>{opcao.grupo_nome}: {opcao.opcao_nome}{Number(opcao.preco_adicional || 0) > 0 ? ` + ${formatarMoeda(opcao.preco_adicional)}` : ''}</span>
              ))}
              {item.observacao && <span>{item.observacao}</span>}
            </li>
          ))}
        </ul>
        {pedido.observacao_geral && <p className="garcon-observacao">Obs.: {pedido.observacao_geral}</p>}
        <div className="garcon-pedido-actions">
          {acoes.map(([status, label]) => (
            <button type="button" key={status} onClick={() => atualizarStatusPedido(pedido, status)}>
              {status === 'cancelado' ? <XCircle size={18} /> : <RefreshCw size={18} />}
              {label}
            </button>
          ))}
        </div>
      </article>
    );
  }

  function renderPedidos() {
    return (
      <section className="garcon-pedidos-grid" aria-label="Pedidos do Garcon">
        {pedidos.map((pedido) => renderPedidoCard(pedido))}
        {pedidos.length === 0 && <p className="empty-state">Nenhum pedido recebido hoje.</p>}
      </section>
    );
  }

  function renderCozinha() {
    const pedidosCozinha = pedidos.filter((pedido) => ['confirmado', 'em_preparo'].includes(pedido.status));
    return (
      <section className="garcon-kitchen-grid" aria-label="Cozinha e bar">
        {pedidosCozinha.map((pedido) => renderPedidoCard(pedido, true))}
        {pedidosCozinha.length === 0 && <p className="empty-state">Nenhum pedido aguardando producao.</p>}
      </section>
    );
  }

  function renderRelatorio() {
    return (
      <section className="garcon-report">
        <div className="garcon-report-grid">
          <article><span>Total vendido no dia</span><strong>{formatarMoeda(relatorio.total)}</strong></article>
          <article><span>Quantidade de pedidos</span><strong>{relatorio.quantidadePedidos}</strong></article>
          <article><span>Ticket medio</span><strong>{formatarMoeda(relatorio.ticketMedio)}</strong></article>
          <article><span>Pedidos cancelados</span><strong>{resumo.cancelados}</strong></article>
        </div>

        <div className="garcon-report-columns">
          <section className="garcon-panel">
            <header><span><Utensils size={22} />Produtos mais vendidos</span></header>
            <div className="garcon-compact-list static">
              {relatorio.produtosMaisVendidos.map((produto) => (
                <article key={produto.nome}>
                  <strong>{produto.nome}</strong>
                  <span>{produto.quantidade} un. · {formatarMoeda(produto.total)}</span>
                </article>
              ))}
              {relatorio.produtosMaisVendidos.length === 0 && <p className="empty-state">Sem vendas de produtos hoje.</p>}
            </div>
          </section>

          <section className="garcon-panel">
            <header><span><Table2 size={22} />Vendas por mesa</span></header>
            <div className="garcon-compact-list static">
              {relatorio.vendasPorMesa.map((mesa) => (
                <article key={mesa.mesa}>
                  <strong>{mesa.mesa}</strong>
                  <span>{mesa.pedidos} pedido(s) · {formatarMoeda(mesa.total)}</span>
                </article>
              ))}
              {relatorio.vendasPorMesa.length === 0 && <p className="empty-state">Sem vendas por mesa hoje.</p>}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderConteudo() {
    if (aba === 'mesas') return renderMesas();
    if (aba === 'cardapio') return renderCardapio();
    if (aba === 'pedidos') return renderPedidos();
    if (aba === 'cozinha') return renderCozinha();
    if (aba === 'relatorio') return renderRelatorio();
    return renderResumo();
  }

  return (
    <LayoutLojista dataPage>
      {renderTopo('Beelbem Garçon')}
      <section className="garcon-shell" aria-label="Modulo Beelbem Garcon">
        <div className="garcon-title">
          <div>
            <span>Atendimento digital por mesa</span>
            <h2>{storeName}</h2>
            <p>{city?.name ? `${city.name} - ${city.state}` : 'Empresa vinculada ao lojista logado'}</p>
          </div>
          <button type="button" onClick={carregarDados} disabled={carregando}>
            <RefreshCw size={18} />
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        {renderNavegacao()}
        {mensagem && <p className={mensagem.includes('salv') || mensagem.includes('copiado') ? 'success-message' : 'field-error'}>{mensagem}</p>}
        {renderConteudo()}
      </section>
    </LayoutLojista>
  );
}
