import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import AnimalProfile from '../pages/AnimalProfile.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// Proposal R-09 (status history) and R-12 (staff status changes).

// A tiny fake server holding one animal and its history.
function fakeServer({ status = 'Available', patchReply } = {}) {
  const state = {
    animal: { id: 1, name: 'Buddy', species: 'Dog', breed: 'Labrador Retriever', age: 3, status },
    history: [
      { id: 1, fromStatus: null, toStatus: 'Available', note: 'Added to the shelter', changedAt: '2026-09-14 10:00:00', changedBy: 'staff@shelter.test' },
    ],
  };
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/animals/1') return jsonResponse(200, state.animal);
    if (path === '/api/animals/1/history') return jsonResponse(200, state.history);
    if (path === '/api/animals/1/status' && init.method === 'PATCH') {
      if (patchReply) return patchReply(init);
      const { status: to, note } = JSON.parse(init.body);
      state.history.push({ id: state.history.length + 1, fromStatus: state.animal.status, toStatus: to, note: note || null, changedAt: '2026-10-14 09:00:00', changedBy: 'staff@shelter.test' });
      state.animal = { ...state.animal, status: to };
      return jsonResponse(200, state.animal);
    }
    return jsonResponse(404, { error: 'Not found' });
  });
  return { spy, state };
}

const renderProfile = () => renderAt('/animals/1', '/animals/:id', <AnimalProfile />);
const loginAs = (role) =>
  saveAuth({ token: `${role}-token`, user: { id: role === 'Staff' ? 1 : 2, email: `${role.toLowerCase()}@shelter.test`, role } });
const historyCalls = (spy) => spy.mock.calls.filter(([url]) => String(url).endsWith('/history'));

describe('Status history panel (proposal R-09, R-12)', () => {
  beforeEach(() => loginAs('Staff'));

  it('T-HIST-UI-1: staff see the animal\'s status history', async () => {
    fakeServer();
    renderProfile();

    const timeline = await screen.findByTestId('status-history');
    expect(within(timeline).getByText('Added to the shelter')).toBeInTheDocument();
    expect(within(timeline).getByText(/First status on .* by staff@shelter\.test/)).toBeInTheDocument();
  });

  it('T-HIST-UI-2: adopters and visitors never see or load the history', async () => {
    localStorage.clear();
    loginAs('Adopter');
    const { spy } = fakeServer();
    renderProfile();

    await screen.findByRole('heading', { name: 'Buddy' });
    expect(screen.queryByText('Status history')).not.toBeInTheDocument();
    expect(historyCalls(spy)).toHaveLength(0);
  });

  it('T-HIST-UI-3: changing the status updates the badge and adds a history entry', async () => {
    const { spy } = fakeServer();
    renderProfile();
    await screen.findByTestId('status-history');

    await userEvent.selectOptions(screen.getByLabelText('New status'), 'Fostered');
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Went to a foster home');
    await userEvent.click(screen.getByRole('button', { name: 'Update status' }));

    expect(await screen.findByText('Status changed to Fostered.')).toBeInTheDocument();
    const [, init] = spy.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'Fostered', note: 'Went to a foster home' });
    await waitFor(() =>
      expect(within(screen.getByTestId('status-history')).getByText('Went to a foster home')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('status-badge')[0]).toHaveTextContent('Fostered'),
    );
    // A Fostered animal can go back to Available or be adopted.
    await waitFor(() => expect(screen.getByLabelText('New status')).toHaveValue('Available'));
  });

  it('T-HIST-UI-4: a Pending animal can only change through its application', async () => {
    fakeServer({ status: 'Pending' });
    renderProfile();

    expect(await screen.findByTestId('status-locked')).toHaveTextContent('application under review');
    expect(screen.queryByLabelText('New status')).not.toBeInTheDocument();
  });

  it('T-HIST-UI-5: a refused change shows the server\'s reason', async () => {
    fakeServer({
      patchReply: () => jsonResponse(409, { error: 'Buddy has an adoption application under review.' }),
    });
    renderProfile();
    await screen.findByTestId('status-history');

    await userEvent.click(screen.getByRole('button', { name: 'Update status' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Buddy has an adoption application under review.');
    expect(screen.getByRole('button', { name: 'Update status' })).toBeEnabled();
  });

  it('T-HIST-UI-6: the status choices match the server rules (never Pending)', async () => {
    fakeServer({ status: 'Adopted' });
    renderProfile();
    await screen.findByTestId('status-history');

    const options = [...screen.getByLabelText('New status').querySelectorAll('option')].map((o) => o.value);
    expect(options).toEqual(['Available']);
  });
});
