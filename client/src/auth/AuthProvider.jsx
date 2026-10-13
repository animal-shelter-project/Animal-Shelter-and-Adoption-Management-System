import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  AUTH_STORAGE_KEY,
  api,
  clearAuth,
  loadAuth,
  saveAuth,
  tokenExpiry,
} from '../api.js';
import { AuthContext } from './useAuth.js';

// Holds { token, user } for the whole app. user = { id, name, email, role }
// where role is 'Adopter' or 'Staff' (US-05).
//
// Edge cases handled here:
//  - token already expired on page load -> treated as logged out (loadAuth)
//  - token expires while the page is open -> logged out at that moment
//  - server answers 401 to any call -> api.js fires AUTH_EXPIRED_EVENT -> logged out
//  - login/logout in another tab -> this tab follows (storage event)
export default function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({ auth: loadAuth(), sessionExpired: false }));
  const { auth, sessionExpired } = state;

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password); // { token, user }
    saveAuth(result);
    setState({ auth: result, sessionExpired: false });
    return result.user;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setState({ auth: null, sessionExpired: false });
  }, []);

  // Server said 401 -> session over (only "expired" if someone was logged in).
  useEffect(() => {
    const onExpired = () =>
      setState((s) => ({ auth: null, sessionExpired: s.sessionExpired || Boolean(s.auth) }));
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  // Another tab logged in or out.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || e.key === AUTH_STORAGE_KEY) {
        setState((s) => ({ ...s, auth: loadAuth() }));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Log out exactly when the JWT's exp passes.
  useEffect(() => {
    const exp = auth?.token ? tokenExpiry(auth.token) : null;
    if (exp == null) return undefined;
    const ms = Math.min(Math.max(0, exp - Date.now()), 2 ** 31 - 1); // setTimeout max
    const t = setTimeout(() => {
      clearAuth();
      setState({ auth: null, sessionExpired: true });
    }, ms);
    return () => clearTimeout(t);
  }, [auth]);

  const value = useMemo(
    () => ({
      user: auth?.user || null,
      token: auth?.token || null,
      isLoggedIn: Boolean(auth?.token),
      isStaff: auth?.user?.role === 'Staff',
      isAdopter: auth?.user?.role === 'Adopter',
      sessionExpired,
      login,
      logout,
    }),
    [auth, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
