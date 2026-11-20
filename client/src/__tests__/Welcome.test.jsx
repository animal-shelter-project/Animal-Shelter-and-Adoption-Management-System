import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { saveAuth } from '../api.js';
import WelcomeDialog from '../components/WelcomeDialog.jsx';
import { renderAt } from '../test/helpers.jsx';

// The welcome box shown on a visitor's first visit.
const welcome = () => screen.queryByRole('dialog', { name: 'Welcome to Paws Shelter' });

describe('Welcome box', () => {
  it('T-WELCOME-UI-1: a first-time visitor is offered Log in, Create an account or Just browse; the choice is remembered', async () => {
    const first = renderAt('/', '*', <WelcomeDialog />);
    expect(await screen.findByRole('dialog', { name: 'Welcome to Paws Shelter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');

    await userEvent.click(screen.getByRole('button', { name: 'Just browse' }));
    expect(welcome()).not.toBeInTheDocument();

    first.unmount();
    renderAt('/', '*', <WelcomeDialog />);
    expect(welcome()).not.toBeInTheDocument(); // not shown a second time
  });

  it('T-WELCOME-UI-2: Log in goes to the login page; nobody logged in or on the login page sees the box', async () => {
    const first = renderAt('/', '*', <WelcomeDialog />);
    await userEvent.click(await screen.findByRole('link', { name: 'Log in' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(welcome()).not.toBeInTheDocument();
    first.unmount();

    localStorage.clear();
    const onLogin = renderAt('/login', '*', <WelcomeDialog />);
    expect(welcome()).not.toBeInTheDocument();
    onLogin.unmount();

    saveAuth({ token: 'a-token', user: { id: 2, email: 'adopter@shelter.test', role: 'Adopter' } });
    renderAt('/', '*', <WelcomeDialog />);
    expect(welcome()).not.toBeInTheDocument();
  });
});
