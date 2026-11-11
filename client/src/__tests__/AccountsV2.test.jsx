import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAuth, saveAuth } from '../api.js';
import { validateRegister } from '../accountForm.js';
import Account from '../pages/Account.jsx';
import Register from '../pages/Register.jsx';
import StaffAccounts from '../pages/StaffAccounts.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// v2: sign-up, My account (details and password) and staff password resets.
const JANE = { id: 7, email: 'jane@example.com', role: 'Adopter', name: 'Jane Doe', phone: '817-555-0142', address: '' };

function server(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const key = `${init.method || 'GET'} ${url.pathname}`;
    const handler = routes[key];
    return handler ? handler(init.body ? JSON.parse(init.body) : undefined, url) : jsonResponse(404, { error: 'Not found' });
  });
}

const body = (spy, method, path) => {
  const call = spy.mock.calls.find(([u, i]) => (i?.method || 'GET') === method && new URL(String(u)).pathname === path);
  return call ? JSON.parse(call[1].body) : undefined;
};

describe('Sign-up (v2)', () => {
  it('T-REG-UI-1: a visitor signs up, is logged in and sent to the animals', async () => {
    const spy = server({ 'POST /api/auth/register': () => jsonResponse(201, { token: 'new-token', user: JANE }) });
    renderAt('/register', '/register', <Register />, <Route path="/animals" element={<p>Animals page</p>} />);
    await userEvent.type(screen.getByLabelText('Full name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'Jane@Example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '817-555-0142');
    await userEvent.type(screen.getByLabelText('Password'), 'kibble-2026');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'kibble-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Animals page')).toBeInTheDocument();
    expect(body(spy, 'POST', '/api/auth/register')).toEqual({
      name: 'Jane Doe', email: 'jane@example.com', phone: '817-555-0142', address: '', password: 'kibble-2026',
    });
    expect(loadAuth().user.email).toBe('jane@example.com');
  });

  it('T-REG-UI-2: every problem is shown at once and nothing is sent', async () => {
    const spy = server({});
    renderAt('/register', '/register', <Register />);
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('T-REG-UI-3: an email that already has an account is shown next to the email box', async () => {
    server({
      'POST /api/auth/register': () =>
        jsonResponse(409, { error: 'An account with this email already exists. Log in instead.', fields: { email: 'This email already has an account.' } }),
    });
    renderAt('/register', '/register', <Register />);
    await userEvent.type(screen.getByLabelText('Full name'), 'Jane');
    await userEvent.type(screen.getByLabelText('Email'), 'adopter@shelter.test');
    await userEvent.type(screen.getByLabelText('Phone'), '8175550142');
    await userEvent.type(screen.getByLabelText('Password'), 'kibble-2026');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'kibble-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('This email already has an account.')).toBeInTheDocument();
  });

  it('T-REG-UI-4: the rules match the server (phone digits, matching passwords)', () => {
    const base = { name: 'J', email: 'j@x.io', phone: '8175550142', password: 'abcdefgh', confirm: 'abcdefgh' };
    expect(validateRegister(base).fields).toEqual({});
    expect(validateRegister({ ...base, phone: '12' }).fields.phone).toBeTruthy();
    expect(validateRegister({ ...base, confirm: 'abcdefgx' }).fields.confirm).toBeTruthy();
  });
});

describe('My account (v2)', () => {
  beforeEach(() => saveAuth({ token: 'jane-token', user: JANE }));

  it('T-ACC-UI-1: saving contact details updates them', async () => {
    const spy = server({ 'PUT /api/auth/me': (b) => jsonResponse(200, { ...JANE, ...b }) });
    renderAt('/account', '/account', <Account />);
    const address = screen.getByLabelText('Address (optional)');
    await userEvent.type(address, '12 Elm St');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Your details were saved.')).toBeInTheDocument();
    expect(body(spy, 'PUT', '/api/auth/me')).toEqual({ name: 'Jane Doe', phone: '817-555-0142', address: '12 Elm St' });
    expect(loadAuth().user.address).toBe('12 Elm St');
  });

  it('T-ACC-UI-2: changing the password keeps you logged in with the new token', async () => {
    server({ 'PUT /api/auth/password': () => jsonResponse(200, { token: 'fresh-token', user: JANE }) });
    renderAt('/account', '/account', <Account />);
    await userEvent.type(screen.getByLabelText('Current password'), 'old-password');
    await userEvent.type(screen.getByLabelText('New password'), 'new-password-1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
    expect(loadAuth().token).toBe('fresh-token');
  });

  it('T-ACC-UI-3: a wrong current password is shown next to that box', async () => {
    server({
      'PUT /api/auth/password': () =>
        jsonResponse(400, { error: 'Your current password is not correct.', fields: { currentPassword: 'This is not your current password.' } }),
    });
    renderAt('/account', '/account', <Account />);
    await userEvent.type(screen.getByLabelText('Current password'), 'nope-nope');
    await userEvent.type(screen.getByLabelText('New password'), 'new-password-1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('This is not your current password.')).toBeInTheDocument();
    expect(loadAuth().token).toBe('jane-token');
  });
});

describe('Staff: adopter accounts (v2)', () => {
  it('T-STAFFACC-UI-1: staff see adopters and reset a password; the temporary one is shown once', async () => {
    saveAuth({ token: 'staff-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } });
    server({
      'GET /api/users': () => jsonResponse(200, [JANE]),
      'POST /api/users/7/reset-password': () => jsonResponse(200, { user: JANE, temporaryPassword: 'paws-1a2b3c4d' }),
    });
    window.confirm = () => true;
    renderAt('/staff/accounts', '/staff/accounts', <StaffAccounts />);
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('817-555-0142')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset password for Jane Doe' }));
    await waitFor(() => expect(screen.getByTestId('temp-password')).toHaveTextContent('paws-1a2b3c4d'));
  });
});
