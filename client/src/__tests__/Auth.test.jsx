import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AUTH_EXPIRED_EVENT, saveAuth } from '../api.js';
import AuthProvider from '../auth/AuthProvider.jsx';
import RequireRole from '../auth/RequireRole.jsx';
import Navbar from '../components/Navbar.jsx';
import LocationProbe from '../test/LocationProbe.jsx';
import { fakeJwt } from '../test/helpers.jsx';

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route
            path="/staff/applications"
            element={
              <RequireRole role="Staff">
                <p>staff page</p>
              </RequireRole>
            }
          />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/animals" element={<p>animals page</p>} />
        </Routes>
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>,
  );

describe('Route protection and session handling (US-05)', () => {
  it('T-ROLE-UI-1: logged-out user on a staff page is sent to login', () => {
    renderApp('/staff/applications');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('T-ROLE-UI-2: an Adopter on a staff page sees a clear message', () => {
    saveAuth({ token: 't', user: { id: 1, name: 'Alex', role: 'Adopter' } });
    renderApp('/staff/applications');
    expect(screen.getByTestId('wrong-role')).toHaveTextContent('for Staff accounts only');
    expect(screen.queryByText('staff page')).not.toBeInTheDocument();
  });

  it('T-ROLE-UI-3: Staff can open the staff page', () => {
    saveAuth({ token: 't', user: { id: 2, name: 'Sam', role: 'Staff' } });
    renderApp('/staff/applications');
    expect(screen.getByText('staff page')).toBeInTheDocument();
  });

  it('T-AUTH-1: an expired token on page load means logged out', () => {
    saveAuth({
      token: fakeJwt({ exp: Math.floor(Date.now() / 1000) - 5 }),
      user: { id: 2, name: 'Sam', role: 'Staff' },
    });
    renderApp('/animals');
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });

  it('T-AUTH-2: a server 401 (expired session) logs the UI out', () => {
    saveAuth({ token: 't', user: { id: 2, name: 'Sam', role: 'Staff' } });
    renderApp('/animals');
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    });

    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });
});
