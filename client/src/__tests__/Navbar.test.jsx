import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { saveAuth } from '../api.js';
import AuthProvider from '../auth/AuthProvider.jsx';
import Navbar from '../components/Navbar.jsx';

const renderNav = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Navbar />
      </AuthProvider>
    </MemoryRouter>,
  );

describe('Navbar role links (US-05)', () => {
  it('T-NAV-1: logged out shows Login and no staff links', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByText('Review applications')).not.toBeInTheDocument();
  });

  it('T-NAV-2: Staff sees staff links and Logout', () => {
    saveAuth({ token: 't', user: { id: 2, name: 'Sam', role: 'Staff' } });
    renderNav();
    expect(screen.getByText('Review applications')).toBeInTheDocument();
    expect(screen.getByText('Add animal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('T-NAV-3: Adopter sees My applications but no staff links', () => {
    saveAuth({ token: 't', user: { id: 1, name: 'Alex', role: 'Adopter' } });
    renderNav();
    expect(screen.getByText('My applications')).toBeInTheDocument();
    expect(screen.queryByText('Add animal')).not.toBeInTheDocument();
  });
});
