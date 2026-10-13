import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthProvider from '../auth/AuthProvider.jsx';
import { describe, expect, it, vi } from 'vitest';
import { loadAuth } from '../api.js';
import { redirectAfterLogin, safeRedirect } from '../auth/redirects.js';
import Login from '../pages/Login.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

const fillAndSubmit = async (email, password) => {
  if (email) await userEvent.type(screen.getByLabelText('Email'), email);
  if (password) await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
};

describe('US-05 Login UI', () => {
  it('T-LOGIN-UI-1: valid login stores the token and user', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(200, { token: 'tok', user: { id: 1, name: 'Alex', role: 'Adopter' } }),
    );
    renderAt('/login', '/login', <Login />, <Route path="/animals" element={<p>animals page</p>} />);

    await fillAndSubmit('adopter@shelter.test', 'password123');

    expect(await screen.findByText('animals page')).toBeInTheDocument();
    expect(loadAuth()?.token).toBe('tok');
    expect(loadAuth().user.role).toBe('Adopter');
  });

  it('T-LOGIN-UI-2: wrong password shows an error and clears the password', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(401, { error: 'Invalid credentials' }),
    );
    renderAt('/login', '/login', <Login />);

    await fillAndSubmit('adopter@shelter.test', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(loadAuth()).toBeNull();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('T-LOGIN-UI-3: empty and malformed email are caught before calling the server', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    renderAt('/login', '/login', <Login />);

    await fillAndSubmit('', '');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.');

    await fillAndSubmit('not-an-email', 'x');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('T-LOGIN-UI-4: Staff land on Review applications', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(200, { token: 'tok', user: { id: 2, name: 'Sam', role: 'staff' } }),
    );
    renderAt(
      '/login',
      '/login',
      <Login />,
      <Route path="/staff/applications" element={<p>staff page</p>} />,
    );

    await fillAndSubmit('staff@shelter.test', 'password123');

    expect(await screen.findByText('staff page')).toBeInTheDocument();
  });

  it('T-LOGIN-UI-5: redirects only to paths inside the app', () => {
    expect(safeRedirect('/animals/3/apply')).toBe('/animals/3/apply');
    expect(safeRedirect('https://evil.com')).toBe('/animals');
    expect(safeRedirect('//evil.com')).toBe('/animals');
    expect(safeRedirect('/login')).toBe('/animals');
    expect(safeRedirect(undefined)).toBe('/animals');
  });

  it('T-LOGIN-UI-6: returns to the saved page only if the role can open it', () => {
    expect(redirectAfterLogin('/animals/3/apply', 'Adopter')).toBe('/animals/3/apply');
    expect(redirectAfterLogin('/my-applications', 'Staff')).toBe('/staff/applications');
    expect(redirectAfterLogin('/staff/applications', 'Adopter')).toBe('/animals');
    expect(redirectAfterLogin('/animals?species=Dog', 'Staff')).toBe('/animals?species=Dog');
    expect(redirectAfterLogin('', 'Staff')).toBe('/staff/applications');
  });

  it('T-LOGIN-UI-7: a Staff login never lands on an adopter-only page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(200, { token: 'tok', user: { id: 2, name: 'Sam', role: 'Staff' } }),
    );
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/my-applications' } }]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/staff/applications" element={<p>staff page</p>} />
            <Route path="/my-applications" element={<p>adopter page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await fillAndSubmit('staff@shelter.test', 'password123');

    expect(await screen.findByText('staff page')).toBeInTheDocument();
  });
});
