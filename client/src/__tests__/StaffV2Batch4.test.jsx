import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import AppointmentsPanel from '../components/AppointmentsPanel.jsx';
import MedicalRecordsPanel from '../components/MedicalRecordsPanel.jsx';
import StaffDashboard from '../pages/StaffDashboard.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// v2: medical records (R-10), appointments (R-11) and the staff dashboard.
function server(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const handler = routes[`${init.method || 'GET'} ${url.pathname}`];
    return handler ? handler(init.body ? JSON.parse(init.body) : undefined) : jsonResponse(404, { error: 'Not found' });
  });
}
const BUDDY = { id: '1', name: 'Buddy', status: 'Available' };
// A date-and-time box only accepts a complete value, so set it in one go.
const setValue = (el, value) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('Staff panels (v2)', () => {
  beforeEach(() => saveAuth({ token: 's', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } }));

  it('T-MED-UI-1: staff see medical records and add one', async () => {
    const records = [{ id: 1, recordDate: '2026-10-20', recordType: 'Vaccination', notes: 'Rabies vaccine' }];
    const spy = server({
      'GET /api/animals/1/medical-records': () => jsonResponse(200, records),
      'POST /api/animals/1/medical-records': (b) => {
        records.unshift({ id: 2, ...b });
        return jsonResponse(201, { id: 2, ...b });
      },
    });
    renderAt('/x', '/x', <MedicalRecordsPanel animal={BUDDY} />);
    expect(await screen.findByText('Rabies vaccine')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Check-up');
    await userEvent.type(screen.getByLabelText('Notes'), 'Healthy weight');
    await userEvent.click(screen.getByRole('button', { name: 'Add record' }));
    expect(await screen.findByText('Medical record added.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Healthy weight')).toBeInTheDocument());
    const post = spy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(post[1].body)).toMatchObject({ recordType: 'Check-up', notes: 'Healthy weight' });
  });

  it('T-APPT-UI-1: staff book an appointment; a clash shows the server’s reason', async () => {
    let clash = true;
    server({
      'GET /api/animals/1/appointments': () => jsonResponse(200, []),
      'POST /api/animals/1/appointments': (b) =>
        clash
          ? ((clash = false), jsonResponse(409, { error: 'Buddy already has "Vet visit" at 2030-01-10 10:00 (60 min). Choose another time.' }))
          : jsonResponse(201, { id: 3, ...b, status: 'Scheduled' }),
    });
    renderAt('/x', '/x', <AppointmentsPanel animal={BUDDY} />);
    await screen.findByText('No appointments booked.');
    await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
    expect(await screen.findByText('Choose a date and time.')).toBeInTheDocument();

    await setValue(screen.getByLabelText('Date and time'), '2030-01-10T10:30');
    await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
    expect(await screen.findByText(/already has "Vet visit"/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
    expect(await screen.findByText(/Vet visit booked for/)).toBeInTheDocument();
  });

  it('T-DASH-UI-1: the dashboard shows the counts, upcoming appointments and longest waiting', async () => {
    server({
      'GET /api/dashboard': () =>
        jsonResponse(200, {
          animals: { Available: 5, Pending: 1, Adopted: 2, Fostered: 1 },
          pendingApplications: 1,
          adoptionsThisMonth: 2,
          arrivalsThisMonth: 3,
          longestWaiting: [{ id: 1, name: 'Buddy', species: 'Dog', since: '2026-10-01 10:00:00' }],
          upcomingAppointments: [{ id: 4, animalId: 2, animalName: 'Luna', startsAt: '2030-01-10 10:00', purpose: 'Meet and greet' }],
        }),
    });
    renderAt('/staff/dashboard', '/staff/dashboard', <StaffDashboard />);
    expect(await screen.findByText('application waiting for review')).toBeInTheDocument();
    expect(screen.getByText('adopted this month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Luna' })).toHaveAttribute('href', '/animals/2');
    expect(screen.getByRole('link', { name: 'Buddy' })).toHaveAttribute('href', '/animals/1');
  });
});
