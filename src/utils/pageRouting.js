export function hasSupabaseAuthCallback() {
  const routeHash = window.location.hash.replace(/^#/, '');
  const paramsText = `${window.location.search}&${routeHash}`;
  return [
    'access_token=',
    'refresh_token=',
    'token_hash=',
    'type=invite',
    'type=recovery',
    'type=signup',
    'error=',
    'error_code=',
    'code=',
  ].some((part) => paramsText.includes(part));
}

export function garconCardapioFromLocation(location = window.location) {
  const pathParts = location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'garcon' && pathParts[1] === 'cardapio' && pathParts[2] && pathParts[3]) {
    return { empresaId: pathParts[2], mesaId: pathParts[3] };
  }

  const hashParts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (hashParts[0] === 'garcon' && hashParts[1] === 'cardapio' && hashParts[2] && hashParts[3]) {
    return { empresaId: hashParts[2], mesaId: hashParts[3] };
  }

  return null;
}

export function pageFromLocation() {
  if (garconCardapioFromLocation()) return 'garcon-cardapio';
  if (hasSupabaseAuthCallback()) return 'create-password';
  return window.location.hash.replace(/^#/, '') || 'login';
}

export function resolveHomeByRole(role) {
  if (role === 'store_admin') return 'store-home';
  if (role === 'courier_admin') return 'courier-home';
  return 'overview';
}
