// Where to send someone after login. Kept out of the component files so
// they export only components (eslint react-refresh rule).

// Only allow redirects to paths inside this app ("/animals/3"), never to
// another site ("//evil.com" or "https://...") — prevents an open redirect.
export function safeRedirect(path, fallback = '/animals') {
  if (typeof path !== 'string') return fallback;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
  if (path.startsWith('/login')) return fallback; // avoid a login loop
  return path;
}

// Which role a path needs (mirrors the guards in App.jsx). null = anyone.
export function roleForPath(path = '') {
  const p = path.split('?')[0];
  if (p.startsWith('/staff')) return 'Staff';
  if (p === '/my-applications' || /^\/animals\/[^/]+\/apply$/.test(p)) return 'Adopter';
  return null;
}

// After login, only go back to the saved page if this user's role can open
// it. Example: an adopter's session expires on "My applications", then a
// staff member logs in on the same tab -> send them to their own home page,
// not to a page that would just say "Adopter accounts only".
export function redirectAfterLogin(from, role) {
  const fallback = role === 'Staff' ? '/staff/applications' : '/animals';
  const target = safeRedirect(from, '');
  if (!target) return fallback;
  const needed = roleForPath(target);
  return needed && needed !== role ? fallback : target;
}
