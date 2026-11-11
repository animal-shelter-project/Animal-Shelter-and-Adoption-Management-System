import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import StaffStatusPanel from '../components/StaffStatusPanel.jsx';
import ApplicationForm from '../pages/ApplicationForm.jsx';
import MyApplications from '../pages/MyApplications.jsx';
import Notifications from '../pages/Notifications.jsx';
import StaffApplications from '../pages/StaffApplications.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// v2: structured applications, withdrawing, decided list and notes,
// walk-in adoptions, and messages.
function server(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const handler = routes[`${init.method || 'GET'} ${url.pathname}`];
    return handler ? handler(init.body ? JSON.parse(init.body) : undefined, url) : jsonResponse(404, { error: 'Not found' });
  });
}
const sent = (spy, method, path) => {
  const call = spy.mock.calls.find(([u, i]) => (i?.method || 'GET') === method && new URL(String(u)).pathname === path);
  return call ? JSON.parse(call[1].body) : undefined;
};
const adopterLogin = () => saveAuth({ token: 'a-token', user: { id: 2, email: 'adopter@shelter.test', role: 'Adopter' } });
const staffLogin = () => saveAuth({ token: 's-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } });
const LUNA = { id: 2, name: 'Luna', species: 'Cat', breed: 'Tabby', age: 2, status: 'Available' };

describe('Applying (v2)', () => {
  beforeEach(adopterLogin);

  it('T-APPLY-V2-UI-1: the structured answers are sent with the application', async () => {
    const spy = server({
      'GET /api/animals/2': () => jsonResponse(200, LUNA),
      'POST /api/applications': () => jsonResponse(201, { id: 5, status: 'Pending' }),
    });
    renderAt('/animals/2/apply', '/animals/:id/apply', <ApplicationForm />, <Route path="/my-applications" element={<p>Mine</p>} />);
    await screen.findByText('Apply to adopt Luna');
    await userEvent.selectOptions(screen.getByLabelText('Type of home'), 'Apartment');
    await userEvent.selectOptions(screen.getByLabelText('Own or rent?'), 'Rent');
    await userEvent.selectOptions(screen.getByLabelText('Landlord allows pets?'), 'yes');
    await userEvent.selectOptions(screen.getByLabelText('Fenced yard?'), 'no');
    await userEvent.type(screen.getByLabelText('Adults'), '2');
    await userEvent.type(screen.getByLabelText('Children'), '1');
    await userEvent.type(screen.getByLabelText('Hours alone on a typical day'), '5');
    await userEvent.type(screen.getByLabelText('Other pets (optional)'), 'One cat');
    await userEvent.type(screen.getByLabelText('Anything else we should know?'), 'I work from home.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(await screen.findByText('Mine')).toBeInTheDocument();
    expect(sent(spy, 'POST', '/api/applications')).toEqual({
      animalId: '2', householdDetails: 'I work from home.', homeType: 'Apartment', ownOrRent: 'Rent',
      landlordOk: true, hasYard: false, adults: 2, children: 1, otherPets: 'One cat', hoursAlone: 5,
    });
  });

  it('T-APPLY-V2-UI-2: unanswered questions are flagged and nothing is sent', async () => {
    const spy = server({ 'GET /api/animals/2': () => jsonResponse(200, LUNA) });
    renderAt('/animals/2/apply', '/animals/:id/apply', <ApplicationForm />);
    await screen.findByText('Apply to adopt Luna');
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(await screen.findByText('Choose the type of home.')).toBeInTheDocument();
    expect(screen.getByText('Do you have a fenced yard?')).toBeInTheDocument();
    expect(spy.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
  });

  it('T-WD-UI-1: a Pending application can be withdrawn from My applications', async () => {
    let status = 'Pending';
    const spy = server({
      'GET /api/applications/mine': () => jsonResponse(200, [{ id: 5, animalId: 2, animalName: 'Luna', status, submittedAt: '2026-11-01 10:00:00' }]),
      'PUT /api/applications/5/withdraw': () => {
        status = 'Withdrawn';
        return jsonResponse(200, { id: 5, animalId: 2, animalName: 'Luna', status });
      },
    });
    window.confirm = () => true;
    renderAt('/my-applications', '/my-applications', <MyApplications />);
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw application for Luna' }));
    expect(await screen.findByText('Your application for Luna was withdrawn.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('You withdrew it.')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Withdraw application for Luna' })).toBeNull();
    expect(spy.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true);
  });

  it('T-NOTIF-UI-1: Messages lists the shelter’s updates and marks them read', async () => {
    const spy = server({
      'POST /api/notifications/read': () =>
        jsonResponse(200, { unread: 0, items: [{ id: 1, message: 'Good news! Your application to adopt Luna was approved.', link: '/my-applications', createdAt: '2026-11-02 10:00:00', read: true }] }),
    });
    renderAt('/notifications', '/notifications', <Notifications />);
    expect(await screen.findByText(/adopt Luna was approved/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/my-applications');
    expect(spy.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true);
  });
});

describe('Staff (v2)', () => {
  beforeEach(staffLogin);

  const APP = {
    id: 11, animalId: 3, animalName: 'Max', applicantEmail: 'adopter@shelter.test', applicantName: 'Alex Morgan',
    applicantPhone: '817-555-0142', householdDetails: 'We walk every day.', status: 'Pending', submittedAt: '2026-11-01 10:00:00',
    answers: { homeType: 'House', ownOrRent: 'Own', landlordOk: null, hasYard: true, adults: 2, children: 0, otherPets: 'None', hoursAlone: 3 },
    staffNotes: '',
  };

  it('T-REVIEW-V2-UI-1: staff see the applicant’s name, phone and answers, and save notes', async () => {
    const spy = server({
      'GET /api/applications': () => jsonResponse(200, [APP]),
      'PUT /api/applications/11/notes': (b) => jsonResponse(200, { ...APP, staffNotes: b.notes }),
    });
    renderAt('/staff/applications', '/staff/applications', <StaffApplications />);
    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument();
    expect(screen.getByText('817-555-0142')).toBeInTheDocument();
    expect(screen.getByText('House, own · fenced yard · 2 adults, 0 children · alone 3 h a day · Pets: None')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add notes' }));
    await userEvent.type(screen.getByLabelText('Staff notes (only staff see these)'), 'Called: lovely family.');
    await userEvent.click(screen.getByRole('button', { name: 'Save notes' }));
    expect(await screen.findByText(/Notes saved/)).toBeInTheDocument();
    expect(sent(spy, 'PUT', '/api/applications/11/notes')).toEqual({ notes: 'Called: lovely family.' });
  });

  it('T-REVIEW-V2-UI-2: the Decided tab shows past decisions with who decided', async () => {
    const spy = server({
      'GET /api/applications': (_, url) =>
        jsonResponse(200, url.searchParams.get('status') === 'decided'
          ? [{ ...APP, status: 'Rejected', decidedAt: '2026-11-03 10:00:00', decidedBy: 'staff@shelter.test' }]
          : []),
    });
    renderAt('/staff/applications', '/staff/applications', <StaffApplications />);
    await screen.findByText('No applications are waiting for review.');
    await userEvent.click(screen.getByRole('button', { name: 'Decided' }));
    expect(await screen.findByText(/staff@shelter.test/)).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(spy.mock.calls.some(([u]) => String(u).includes('status=decided'))).toBe(true);
  });

  it('T-WALKIN-UI-1: marking an animal Adopted asks who adopted it and sends the adopter', async () => {
    const spy = server({
      'GET /api/animals/5/history': () => jsonResponse(200, []),
      'GET /api/users': () => jsonResponse(200, [{ id: 7, email: 'jordan@shelter.test', role: 'Adopter', name: 'Jordan Lee' }]),
      'PATCH /api/animals/5/status': (b) => jsonResponse(200, { id: 5, name: 'Charlie', species: 'Dog', status: b.status }),
    });
    renderAt('/x', '/x', <StaffStatusPanel animal={{ id: '5', name: 'Charlie', status: 'Available' }} />);
    await userEvent.selectOptions(await screen.findByLabelText('New status'), 'Adopted');
    await userEvent.click(screen.getByRole('button', { name: 'Update status' }));
    expect(await screen.findByText('Choose who adopted this animal.')).toBeInTheDocument();
    expect(spy.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);

    await waitFor(() => expect(screen.getByText('Jordan Lee (jordan@shelter.test)')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Adopted by'), '7');
    await userEvent.click(screen.getByRole('button', { name: 'Update status' }));
    await screen.findByText('Status changed to Adopted.');
    expect(sent(spy, 'PATCH', '/api/animals/5/status')).toEqual({ status: 'Adopted', adopterId: 7 });
  });
});
