import { createContext, useContext } from 'react';

// Kept separate from AuthProvider.jsx so that file exports only a component
// (required by the repo's eslint react-refresh rule).
export const AuthContext = createContext(null);

// { user, token, isLoggedIn, isStaff, isAdopter, sessionExpired, login, logout }
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
