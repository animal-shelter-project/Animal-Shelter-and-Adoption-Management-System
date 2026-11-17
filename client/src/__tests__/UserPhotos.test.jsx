import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { loadAuth, saveAuth } from '../api.js';
import Account from '../pages/Account.jsx';
import ApplicationForm from '../pages/ApplicationForm.jsx';
import StaffApplications from '../pages/StaffApplications.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// Pictures uploaded by users: a profile picture, and photos of the home on
// an adoption application.
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
const png = (name = 'me.png') => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], name, { type: 'image/png' });
const ALEX = { id: 2, email: 'adopter@shelter.test', role: 'Adopter', name: 'Alex Adopter', phone: '817-555-0100', address: '' };

describe('Profile picture', () => {
  it('T-AVATAR-UI-1: a user uploads a profile picture, sees it, and can remove it', async () => {
    saveAuth({ token: 'a-token', user: ALEX });
    const photoUrl = '/uploads/user-2-abc.png';
    const spy = server({
      'GET /api/auth/me': () => jsonResponse(200, ALEX),
      'PUT /api/auth/me/photo': () => jsonResponse(200, { ...ALEX, photoUrl }),
      'DELETE /api/auth/me/photo': () => jsonResponse(200, { ...ALEX, photoUrl: null }),
    });
    renderAt('/account', '/account', <Account />);

    expect(screen.getByRole('button', { name: 'Upload a picture' })).toBeInTheDocument();
    await userEvent.upload(screen.getByTestId('avatar-input'), png());

    expect(await screen.findByText('Your picture was saved.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Your profile picture' }).getAttribute('src')).toMatch(/\/uploads\/user-2-abc\.png$/);
    expect(sent(spy, 'PUT', '/api/auth/me/photo').image).toMatch(/^data:image\/png;base64,/);
    expect(loadAuth().user.photoUrl).toBe(photoUrl); // the top bar shows it too

    await userEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
    expect(await screen.findByText('Your picture was removed.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Your profile picture' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload a picture' })).toBeInTheDocument();
  });
});

describe('Home photos on an application', () => {
  it('T-HOME-UI-1: an adopter adds home photos, removes one, and the rest are sent with the application', async () => {
    saveAuth({ token: 'a-token', user: ALEX });
    const spy = server({
      'GET /api/animals/2': () => jsonResponse(200, { id: 2, name: 'Luna', species: 'Cat', breed: 'Tabby', age: 2, status: 'Available' }),
      'POST /api/applications': () => jsonResponse(201, { id: 5, status: 'Pending' }),
    });
    renderAt('/animals/2/apply', '/animals/:id/apply', <ApplicationForm />, <Route path="/my-applications" element={<p>Mine</p>} />);
    await screen.findByText('Apply to adopt Luna');
    await userEvent.selectOptions(screen.getByLabelText('Type of home'), 'House');
    await userEvent.selectOptions(screen.getByLabelText('Own or rent?'), 'Own');
    await userEvent.selectOptions(screen.getByLabelText('Fenced yard?'), 'yes');
    await userEvent.type(screen.getByLabelText('Adults'), '2');
    await userEvent.type(screen.getByLabelText('Children'), '0');
    await userEvent.type(screen.getByLabelText('Hours alone on a typical day'), '3');
    await userEvent.type(screen.getByLabelText('Anything else we should know?'), 'Big garden.');

    await userEvent.upload(screen.getByTestId('home-photos-input'), [png('yard.png'), png('living-room.png')]);
    expect(screen.getByText('yard.png')).toBeInTheDocument();
    expect(screen.getByText('living-room.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add another photo (1 left)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove home photo 1' }));
    expect(screen.queryByText('yard.png')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }));
    expect(await screen.findByText('Mine')).toBeInTheDocument();
    const body = sent(spy, 'POST', '/api/applications');
    expect(body.homePhotos).toHaveLength(1);
    expect(body.homePhotos[0]).toMatch(/^data:image\/png;base64,/);
    expect(body.householdDetails).toBe('Big garden.');
  });

  it('T-HOME-UI-2: staff see the applicant’s picture and home photos when reviewing', async () => {
    saveAuth({ token: 's-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } });
    server({
      'GET /api/applications': () =>
        jsonResponse(200, [
          {
            id: 11, animalId: 2, animalName: 'Luna', applicantId: 2, applicantName: 'Alex Adopter',
            applicantEmail: 'adopter@shelter.test', applicantPhotoUrl: '/uploads/user-2-abc.png',
            householdDetails: 'Big garden.', status: 'Pending', submittedAt: '2026-11-10 10:00:00',
            homePhotos: [{ id: 1, url: '/uploads/home-aaa.jpg' }, { id: 2, url: '/uploads/home-bbb.png' }],
          },
        ]),
    });
    renderAt('/staff/applications', '/staff/applications', <StaffApplications />);

    const photos = await screen.findByRole('list', { name: 'Home photos from Alex Adopter' });
    const links = within(photos).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toMatch(/\/uploads\/home-aaa\.jpg$/);
    expect(within(photos).getByRole('img', { name: 'Home photo 2 from Alex Adopter (opens in a new tab)' })).toBeInTheDocument();
    const row = screen.getByText('Alex Adopter').closest('tr');
    expect(row.querySelector('.avatar img').getAttribute('src')).toMatch(/\/uploads\/user-2-abc\.png$/);
  });
});
