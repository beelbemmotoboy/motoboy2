export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

export function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(1).replace('.', ',')}%`;
}

export function formatMinutes(value) {
  return `${Math.max(0, Math.round(Number(value || 0)))} min`;
}
