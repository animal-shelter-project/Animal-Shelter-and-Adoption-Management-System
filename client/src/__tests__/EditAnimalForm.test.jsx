import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import StaffAnimalForm from '../pages/StaffAnimalForm.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// Proposal R-01 / US-06 (BUG-05): staff edit an existing animal.

const BUDDY = { id: 1, name: 'Buddy', species: 'Dog', breed: 'Labrador Retriever', age: 3, status: 'Available' };

// A tiny fake server holding one animal.
function fakeServer({ putReply } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/animals/1' && init.method === 'PUT') {
      if (putReply) return putReply(init);
      return jsonResponse(200, { ...BUDDY, ...JSON.parse(init.body) });
    }
    if (path === '/api/animals/1') return jsonResponse(200, BUDDY);
    return jsonResponse(404, { error: 'Animal not found.' });
  });
}

const renderEdit = (id = 1) =>
  renderAt(`/staff/animals/${id}/edit`, '/staff/animals/:id/edit', <StaffAnimalForm />);
const putCalls = (spy) => spy.mock.calls.filter(([, init]) => init?.method === 'PUT');

describe('Edit animal page (proposal R-01, BUG-05)', () => {
  beforeEach(() =>
    saveAuth({ token: 'Staff-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } }),
  );

  it('T-EDIT-UI-1: the form starts with the animal\'s current details', async () => {
    fakeServer();
    renderEdit();

    expect(await screen.findByLabelText('Name')).toHaveValue('Buddy');
    expect(screen.getByLabelText('Species')).toHaveValue('Dog');
    expect(screen.getByLabelText('Breed')).toHaveValue('Labrador Retriever');
    expect(screen.getByLabelText('Age (years)')).toHaveValue('3');
  });

  it('T-EDIT-UI-2: saving sends the details (never the status) and confirms', async () => {
    const spy = fakeServer();
    renderEdit();

    const age = await screen.findByLabelText('Age (years)');
    await userEvent.clear(age);
    await userEvent.type(age, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved changes to Buddy.')).toBeInTheDocument();
    const body = JSON.parse(putCalls(spy)[0][1].body);
    expect(body).toEqual({ name: 'Buddy', species: 'Dog', breed: 'Labrador Retriever', age: 4 });
    expect(body).not.toHaveProperty('status');
  });

  it('T-EDIT-UI-3: an invalid age is shown next to the field and nothing is sent', async () => {
    const spy = fakeServer();
    renderEdit();

    const age = await screen.findByLabelText('Age (years)');
    await userEvent.clear(age);
    await userEvent.type(age, 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Age must be a whole number of years, 0 or more.')).toBeInTheDocument();
    expect(putCalls(spy)).toHaveLength(0);
  });

  it('T-EDIT-UI-4: an unknown animal shows "Animal not found."', async () => {
    fakeServer();
    renderEdit(999);

    expect(await screen.findByRole('alert')).toHaveTextContent('Animal not found.');
  });

  it('T-EDIT-UI-5: the server\'s field errors are shown next to the field', async () => {
    fakeServer({
      putReply: () =>
        jsonResponse(400, { error: 'Check the age.', fields: { age: 'Age must be 40 or less.' } }),
    });
    renderEdit();

    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Age must be 40 or less.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});