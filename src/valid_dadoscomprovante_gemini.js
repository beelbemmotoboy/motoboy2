export const CAMPOS_COMPROVANTE_GEMINI = [
  { chave: 'loja', rotulo: 'Loja' },
  { chave: 'numeroPedido', rotulo: 'Pedido' },
  { chave: 'entregaPrevista', rotulo: 'Entrega prevista' },
  { chave: 'cliente', rotulo: 'Cliente' },
  { chave: 'endereco', rotulo: 'Endereco' },
  { chave: 'bairro', rotulo: 'Bairro' },
  { chave: 'complemento', rotulo: 'Complemento' },
  { chave: 'valorPedido', rotulo: 'Valor do pedido' },
];

export function validar_dadoscomprovante_gemini(valores = {}, campos = CAMPOS_COMPROVANTE_GEMINI) {
  const camposNaoAnalisados = campos
    .filter((campo) => valorNaoEncontrado(valores?.[campo.chave]))
    .map((campo) => campo.rotulo);
  const quantidadeCampos = campos.length;
  const quantidadeNaoAnalisada = camposNaoAnalisados.length;
  const todosNaoEncontrados = quantidadeCampos > 0 && quantidadeNaoAnalisada === quantidadeCampos;

  return {
    valido: !todosNaoEncontrados,
    todosNaoEncontrados,
    camposNaoAnalisados,
    quantidadeCampos,
    quantidadeNaoAnalisada,
    mensagem: montarMensagemCamposNaoAnalisados(camposNaoAnalisados),
    mensagemTodosNaoEncontrados: 'Nao foi possivel identificar os dados do comprovante. Tire outra foto com o comprovante inteiro, bem iluminado e sem cortes, ou solicite manualmente.',
  };
}

function valorNaoEncontrado(valor) {
  const texto = String(valor ?? '').trim().toLowerCase();
  if (!texto) return true;
  return [
    'nao encontrado',
    'não encontrado',
    'nao informado',
    'não informado',
    'ilegivel',
    'ilegível',
    'n/a',
    '-',
  ].includes(texto);
}

function montarMensagemCamposNaoAnalisados(camposNaoAnalisados) {
  if (!camposNaoAnalisados.length) return '';
  const lista = camposNaoAnalisados.join(', ');
  return `Nao foi possivel analisar os seguintes campos: ${lista}. Confira a foto ou complete os dados manualmente.`;
}
