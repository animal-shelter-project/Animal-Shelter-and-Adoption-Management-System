import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import StaffApplications from '../pages/StaffApplications.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// Proposal R-06 and R-07 (staff approve or reject applications).

const PENDING = [
  {
    id: 11, animalId: 3, animalName: 'Max', animalStatus: 'Pending', applicantId: 2,
    applicantEmail: 'adopter@shelter.test', householdDetails: 'Two adults and a fenced yard.',
    status: 'Pending', submittedAt: '2026-10-10 10:00:00',
  },
  {
    id: 12, animalId: 2, animalName: 'Luna', animalStatus: 'Pending', applicantId: 3,
    applicantEmail: 'other@shelter.test', householdDetails: 'Small flat, no other pets.',
    status: 'Pending', submittedAt: '2026-10-11 10:00:00',
  },
];

// A tiny fake server holding the pending applications.
function fakeServer({ pending = PENDING, decideReply } = {}) {
  const state = { pending: [...pending] };
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/applications' && !init.method) return jsonResponse(200, state.pending);
    const m = /^\/api\/applications\/(\d+)\/(approve|reject)$/.exec(path);
    if (m && init.method === 'PUT') {
      if (decideReply) return decideReply(init);
      state.pending = state.pending.filter((a) => String(a.id) !== m[1]);
      return jsonResponse(200, { id: Number(m[1]), status: m[2] === 'approve' ? 'Approved' : 'Rejected' });
    }
    return jsonResponse(404, { error: 'Not found' });
  });
  return { spy, state };
}

const renderPage = () => renderAt('/staff/applications', '/staff/applications', <StaffApplications />);
const putCalls = (spy) => spy.mock.calls.filter(([, init]) => init?.method === 'PUT');

describe('Review applications page (proposal R-06, R-07)', () => {
  beforeEach(() =>
    saveAuth({ token: 'Staff-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } }),
  );

  it('T-REVIEW-UI-1: staff see each pending application with the animal, applicant and household details', async () => {
    fakeServer();
    renderPage();

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Max' })).toBeInTheDocument();
    expect(within(table).getByText('adopter@shelter.test')).toBeInTheDocument();
    expect(within(table).getByText('Two adults and a fenced yard.')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Approve application for Luna' })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Reject application for Luna' })).toBeInTheDocument();
  });

  it('T-REVIEW-UI-2: with nothing pending, the page says so', async () => {
    fakeServer({ pending: [] });
    renderPage();

    expect(await screen.findByText('No applications are waiting for review.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('T-REVIEW-UI-3: approving sends the decision, confirms it and removes the row', async () => {
    const { spy } = fakeServer();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve application for Max' }));

    expect(await screen.findByText(/Approved the application for Max/)).toBeInTheDocument();
    const [url] = putCalls(spy)[0];
    expect(String(url)).toMatch(/\/applications\/11\/approve$/);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Approve application for Max' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Approve application for Luna' })).toBeInTheDocument();
  });

  it('T-REVIEW-UI-4: rejecting sends the decision and says the animal is Available again', async () => {
    const { spy } = fakeServer();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Reject application for Luna' }));

    expect(await screen.findByText(/Rejected the application for Luna/)).toHaveTextContent('Available again');
    expect(String(putCalls(spy)[0][0])).toMatch(/\/applications\/12\/reject$/);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reject application for Luna' })).not.toBeInTheDocument(),
    );
  });

  it('T-REVIEW-UI-5: a refused decision shows the server\'s reason and the buttons work again', async () => {
    fakeServer({
      decideReply: () => jsonResponse(409, { error: 'This application was already approved.' }),
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Approve application for Max' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This application was already approved.');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Approve application for Max' })).toBeEnabled(),
    );
  });

  it('T-REVIEW-UI-6: if the list can\'t load, the page shows the error and a Retry button', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(500, { error: 'Database unavailable' }),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});