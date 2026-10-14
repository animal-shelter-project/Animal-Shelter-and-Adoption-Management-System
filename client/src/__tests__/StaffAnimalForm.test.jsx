import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import { validateAnimalForm } from '../animalForm.js';
import AnimalProfile from '../pages/AnimalProfile.jsx';
import StaffAnimalForm from '../pages/StaffAnimalForm.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// Proposal R-01 / US-01: staff add a new animal.
const ROCKY = { id: 9, name: 'Rocky', species: 'Dog', breed: 'Boxer', age: 2, status: 'Available' };

// Fake server: POST /api/animals answers with `postReply`; GET /api/animals/9 returns Rocky.
function mockServer(postReply = () => jsonResponse(201, ROCKY)) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/animals' && init.method === 'POST') return postReply(init);
    if (url.pathname === '/api/animals/9') return jsonResponse(200, ROCKY);
    return jsonResponse(404, { error: 'Not found' });
  });
}

const renderForm = () =>
  renderAt(
    '/staff/animals/new',
    '/staff/animals/new',
    <StaffAnimalForm />,
    <Route path="/animals/:id" element={<AnimalProfile />} />,
  );

const fill = async ({ name, breed, age, species }) => {
  if (name) await userEvent.type(screen.getByLabelText('Name'), name);
  if (species) await userEvent.selectOptions(screen.getByLabelText('Species'), species);
  if (breed) await userEvent.type(screen.getByLabelText('Breed'), breed);
  if (age !== undefined) await userEvent.type(screen.getByLabelText('Age (years)'), String(age));
};
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Add animal' }));

describe('Add animal form (proposal R-01 / US-01)', () => {
  beforeEach(() => {
    saveAuth({ token: 'staff-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } });
  });

  it('T-ADD-UI-1: a valid form saves the animal and opens its profile', async () => {
    const fetchSpy = mockServer();
    renderForm();

    await fill({ name: 'Rocky', breed: 'Boxer', age: 2 });
    await submit();

    expect(await screen.findByTestId('added-notice')).toHaveTextContent(
      'Rocky was added and is now listed for adoption.',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/animals/9');
    const [, init] = fetchSpy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Rocky', species: 'Dog', breed: 'Boxer', age: 2, status: 'Available',
    });
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer staff-token');
  });

  it('T-ADD-UI-2: an empty form shows every missing field and sends nothing', async () => {
    const fetchSpy = mockServer();
    renderForm();

    await submit();

    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.');
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Breed is required.')).toBeInTheDocument();
    expect(screen.getByText('Age is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('T-ADD-UI-3: negative or decimal ages are rejected before sending', async () => {
    const fetchSpy = mockServer();
    renderForm();

    await fill({ name: 'Rocky', breed: 'Boxer', age: -1 });
    await submit();
    expect(screen.getByText('Age must be a whole number of years, 0 or more.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Age (years)'));
    await userEvent.type(screen.getByLabelText('Age (years)'), '2.5');
    await submit();
    expect(screen.getByText('Age must be a whole number of years, 0 or more.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('T-ADD-UI-4: field errors from the server are shown next to the fields', async () => {
    mockServer(() =>
      jsonResponse(400, { error: 'Please fix the highlighted fields.', fields: { breed: 'Breed must be 60 characters or fewer.' } }),
    );
    renderForm();

    await fill({ name: 'Rocky', breed: 'Boxer', age: 2 });
    await submit();

    expect(await screen.findByText('Breed must be 60 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByLabelText('Breed')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Add animal' })).toBeEnabled();
  });

  it('T-ADD-UI-5: "Other" species asks for the species name and sends it', async () => {
    const fetchSpy = mockServer(() => jsonResponse(201, { ...ROCKY, species: 'Guinea Pig' }));
    renderForm();

    await fill({ name: 'Rocky', breed: 'Abyssinian', age: 1, species: 'Other' });
    await submit();
    expect(screen.getByText('Type the species.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Which species?'), 'Guinea Pig');
    await submit();

    await screen.findByTestId('added-notice');
    const [, init] = fetchSpy.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(init.body).species).toBe('Guinea Pig');
  });

  it('T-ADD-UI-6: a server error keeps the form filled in and can be retried', async () => {
    let calls = 0;
    mockServer(() => {
      calls += 1;
      return calls === 1 ? jsonResponse(500, { error: 'Database unavailable' }) : jsonResponse(201, ROCKY);
    });
    renderForm();

    await fill({ name: 'Rocky', breed: 'Boxer', age: 2 });
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.getByLabelText('Name')).toHaveValue('Rocky');

    await submit();
    expect(await screen.findByTestId('added-notice')).toBeInTheDocument();
  });

  it('T-ADD-UI-7: the button is disabled while saving (no double submit)', async () => {
    let release;
    const fetchSpy = mockServer(
      () => new Promise((resolve) => (release = () => resolve(jsonResponse(201, ROCKY)))),
    );
    renderForm();

    await fill({ name: 'Rocky', breed: 'Boxer', age: 2 });
    await submit();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Saving…' }));

    release();
    await screen.findByTestId('added-notice');
    expect(fetchSpy.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
  });

  it('T-ADD-UI-8: validation rules match the server (status defaults to Available)', () => {
    const ok = validateAnimalForm({ name: '  Mochi ', species: 'Cat', breed: 'Ragdoll  Mix', age: ' 4 ' });
    expect(ok.fields).toEqual({});
    expect(ok.clean).toEqual({ name: 'Mochi', species: 'Cat', breed: 'Ragdoll Mix', age: 4, status: 'Available' });
    expect(validateAnimalForm({ name: 'A', species: 'Dog', breed: 'B', age: '41' }).fields.age).toBe(
      'Age must be 40 or less.',
    );
  });
});
