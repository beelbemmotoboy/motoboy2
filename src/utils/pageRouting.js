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

export function pageFromLocation() {
  if (hasSupabaseAuthCallback()) return 'create-password';
  return window.location.hash.replace(/^#/, '') || 'login';
}

export function resolveHomeByRole(role) {
  if (role === 'store_admin') return 'store-home';
  if (role === 'courier_admin') return 'courier-home';
  return 'overview';
}
