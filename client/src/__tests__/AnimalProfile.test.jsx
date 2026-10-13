import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { saveAuth } from '../api.js';
import AnimalProfile from '../pages/AnimalProfile.jsx';
import { mockApi, renderAt } from '../test/helpers.jsx';

const renderProfile = (id) => renderAt(`/animals/${id}`, '/animals/:id', <AnimalProfile />);

describe('US-02 View animal profile (FR-02, UC-01)', () => {
  it('T-PROFILE-1: a valid ID shows the correct animal', async () => {
    mockApi();
    renderProfile(1);

    expect(await screen.findByRole('heading', { name: 'Buddy' })).toBeInTheDocument();
    expect(screen.getByText('Labrador Retriever')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Available');
  });

  it('T-PROFILE-2: an invalid ID shows not found', async () => {
    mockApi();
    renderProfile(999);

    expect(await screen.findByTestId('not-found')).toHaveTextContent('Animal not found');
  });

  it('T-PROFILE-3: a malformed ID (server 400) also shows not found', async () => {
    mockApi(undefined, { shape: 'mongo' });
    renderProfile('abc');

    expect(await screen.findByTestId('not-found')).toBeInTheDocument();
  });

  it('T-PROFILE-4: works with a MongoDB-shaped response', async () => {
    mockApi(undefined, { shape: 'mongo' });
    renderProfile('000000000000000000000001');

    expect(await screen.findByRole('heading', { name: 'Buddy' })).toBeInTheDocument();
    expect(screen.getByTestId('apply-button')).toHaveAttribute(
      'href',
      '/animals/000000000000000000000001/apply',
    );
  });

  it('T-PROFILE-5: a server error shows Retry instead of "not found"', async () => {
    mockApi(undefined, { failTimes: 1 });
    renderProfile(1);

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });
});

describe('Apply button visibility (FR-08)', () => {
  it('T-UI-1: Apply is hidden for a non-Available animal', async () => {
    mockApi();
    renderProfile(3); // Max: Pending

    await screen.findByRole('heading', { name: 'Max' });
    expect(screen.queryByTestId('apply-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('not-available-note')).toHaveTextContent('being reviewed');
  });

  it('T-UI-1b: Apply is hidden for an Adopted animal', async () => {
    mockApi();
    renderProfile(5); // Oliver: Adopted

    await screen.findByRole('heading', { name: 'Oliver' });
    expect(screen.queryByTestId('apply-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('not-available-note')).toHaveTextContent('found a home');
  });

  it('T-UI-2: Apply is shown for an Available animal and links to the form', async () => {
    mockApi();
    renderProfile(1);

    const button = await screen.findByTestId('apply-button');
    expect(button).toHaveAttribute('href', '/animals/1/apply');
    expect(screen.getByText("You'll be asked to log in first.")).toBeInTheDocument();
  });

  it('T-UI-3: Staff see Edit instead of Apply', async () => {
    saveAuth({ token: 't', user: { id: 2, name: 'Sam', role: 'Staff' } });
    mockApi();
    renderProfile(1);

    await screen.findByRole('heading', { name: 'Buddy' });
    expect(screen.queryByTestId('apply-button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit animal' })).toHaveAttribute(
      'href',
      '/staff/animals/1/edit',
    );
  });
});
