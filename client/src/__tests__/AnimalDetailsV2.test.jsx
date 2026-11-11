import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import AnimalList from '../pages/AnimalList.jsx';
import AnimalProfile from '../pages/AnimalProfile.jsx';
import StaffAnimalForm from '../pages/StaffAnimalForm.jsx';
import { jsonResponse, mockApi, renderAt } from '../test/helpers.jsx';

// v2: richer animal profiles, duplicate warning, staff tools, name search,
// sorting and pages.
const staffLogin = () =>
  saveAuth({ token: 'staff-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } });

const ROCKY = {
  id: 9, name: 'Rocky', species: 'Dog', breed: 'Boxer', age: 0, ageMonths: 4, sex: 'Male',
  size: 'Large', description: 'Loves fetch.', goodWithKids: true, goodWithDogs: false,
  goodWithCats: null, adoptionFee: 150, status: 'Available', photoUrl: null, archived: false,
};

function addServer(postReply) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/animals' && init.method === 'POST') return postReply(JSON.parse(init.body));
    if (url.pathname === '/api/animals/breeds') return jsonResponse(200, ['Beagle', 'Boxer']);
    if (url.pathname === '/api/animals/9') return jsonResponse(200, ROCKY);
    return jsonResponse(404, { error: 'Not found' });
  });
}

const renderAdd = () =>
  renderAt(
    '/staff/animals/new',
    '/staff/animals/new',
    <StaffAnimalForm />,
    <Route path="/animals/:id" element={<AnimalProfile />} />,
  );

const fillBasics = async (name = 'Rocky') => {
  await userEvent.type(screen.getByLabelText('Name'), name);
  await userEvent.type(screen.getByLabelText('Breed'), 'Boxer');
  await userEvent.type(screen.getByLabelText('Age (years)'), '0');
};
const posts = (spy) => spy.mock.calls.filter(([, i]) => i?.method === 'POST').map(([, i]) => JSON.parse(i.body));

describe('Animal details (v2)', () => {
  beforeEach(staffLogin);

  it('T-DETAILS-UI-1: the add form sends months, sex, size, good with, fee and description', async () => {
    const spy = addServer(() => jsonResponse(201, ROCKY));
    renderAdd();
    await fillBasics();
    await userEvent.type(screen.getByLabelText('and months'), '4');
    await userEvent.selectOptions(screen.getByLabelText('Sex'), 'Male');
    await userEvent.selectOptions(screen.getByLabelText('Size'), 'Large');
    await userEvent.type(screen.getByLabelText('Adoption fee ($)'), '150');
    await userEvent.selectOptions(screen.getByLabelText('Children'), 'yes');
    await userEvent.selectOptions(screen.getByLabelText('Dogs'), 'no');
    await userEvent.type(screen.getByLabelText('About this animal'), 'Loves fetch.');
    await userEvent.click(screen.getByRole('button', { name: 'Add animal' }));

    await screen.findByTestId('added-notice');
    expect(posts(spy)[0]).toEqual({
      name: 'Rocky', species: 'Dog', breed: 'Boxer', age: 0, ageMonths: 4, sex: 'Male', size: 'Large',
      adoptionFee: 150, goodWithKids: true, goodWithDogs: false, goodWithCats: null,
      description: 'Loves fetch.', status: 'Available',
    });
  });

  it('T-DETAILS-UI-2: months over 11 or a fee that is not a whole number are shown and nothing is sent', async () => {
    const spy = addServer(() => jsonResponse(201, ROCKY));
    renderAdd();
    await fillBasics();
    await userEvent.type(screen.getByLabelText('and months'), '14');
    await userEvent.type(screen.getByLabelText('Adoption fee ($)'), '12.50');
    await userEvent.click(screen.getByRole('button', { name: 'Add animal' }));

    expect(await screen.findByText('Months must be 0 to 11.')).toBeInTheDocument();
    expect(screen.getByText('Fee must be a whole number of dollars.')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(0);
  });

  it('T-DUP-UI-1: a duplicate warning links to the existing animal; "add anyway" sends allowDuplicate', async () => {
    const spy = addServer((body) =>
      body.allowDuplicate
        ? jsonResponse(201, ROCKY)
        : jsonResponse(409, {
            error: 'A dog named Rocky is already in the shelter.',
            duplicate: { id: 3, name: 'Rocky', breed: 'Boxer', status: 'Available' },
          }),
    );
    renderAdd();
    await fillBasics();
    await userEvent.click(screen.getByRole('button', { name: 'Add animal' }));

    const warning = await screen.findByTestId('duplicate-warning');
    expect(warning).toHaveTextContent('already a dog named Rocky (Boxer)');
    expect(screen.getByRole('link', { name: 'View Rocky' })).toHaveAttribute('href', '/animals/3');

    await userEvent.click(screen.getByRole('button', { name: 'It’s a different animal: add anyway' }));
    await screen.findByTestId('added-notice');
    expect(posts(spy)[1].allowDuplicate).toBe(true);
  });

  it('T-PROFILE-V2-1: the profile shows age in months, sex, size, good with and the fee', async () => {
    mockApi([ROCKY]);
    renderAt('/animals/9', '/animals/:id', <AnimalProfile />);
    expect(await screen.findByText('4 months')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
    expect(screen.getByText('Children; not dogs')).toBeInTheDocument();
    expect(screen.getByText('$150')).toBeInTheDocument();
    expect(screen.getByText('Loves fetch.')).toBeInTheDocument();
  });
});

describe('Staff tools on the profile (v2)', () => {
  it('T-TOOLS-UI-1: staff can archive an animal; the profile then says it is archived', async () => {
    staffLogin();
    let archived = false;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/animals/9' && init.method === 'DELETE') {
        archived = true;
        return jsonResponse(200, { ...ROCKY, archived: true });
      }
      if (url.pathname === '/api/animals/9') return jsonResponse(200, { ...ROCKY, archived });
      if (url.pathname === '/api/animals/9/history') return jsonResponse(200, []);
      return jsonResponse(404, { error: 'Not found' });
    });
    window.confirm = () => true;
    renderAt('/animals/9', '/animals/:id', <AnimalProfile />);

    await userEvent.click(await screen.findByRole('button', { name: 'Archive animal' }));
    expect(await screen.findByText('Rocky was archived.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('archived-notice')).toBeInTheDocument());
    expect(spy.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(true);
    expect(screen.getByRole('button', { name: 'Restore to catalog' })).toBeInTheDocument();
  });

  it('T-TOOLS-UI-2: adopters and visitors never see the staff tools', async () => {
    mockApi([ROCKY]);
    renderAt('/animals/9', '/animals/:id', <AnimalProfile />);
    await screen.findByText('Rocky');
    expect(screen.queryByText('Staff tools')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive animal' })).toBeNull();
  });
});

describe('Name search, sorting and pages (v2)', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({
    id: i + 1,
    name: `Pet ${String.fromCharCode(78 - i)}`, // Pet N, Pet M, ... Pet A
    species: 'Dog',
    breed: 'Mixed',
    age: i,
    status: 'Available',
  }));

  it('T-LIST-V2-1: typing a name narrows the list and puts ?name= in the URL', async () => {
    mockApi();
    renderAt('/animals', '/animals', <AnimalList />);
    await screen.findByText('Buddy');
    await userEvent.type(screen.getByLabelText('Name'), 'lun');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('name=lun'));
    await waitFor(() => expect(screen.queryByText('Buddy')).toBeNull());
    expect(screen.getByText('Luna')).toBeInTheDocument();
  });

  it('T-LIST-V2-2: 12 animals per page, with Next and Previous', async () => {
    mockApi(many);
    renderAt('/animals', '/animals', <AnimalList />);
    await screen.findByText('Pet N');
    expect(screen.getAllByTestId('animal-card')).toHaveLength(12);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(2));
    expect(screen.getByText('Pet A')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('page=2');
  });

  it('T-LIST-V2-3: sorting by name and by age', async () => {
    mockApi(many);
    renderAt('/animals', '/animals', <AnimalList />);
    await screen.findByText('Pet N');
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'name');
    await waitFor(() => expect(screen.getAllByTestId('animal-card')[0]).toHaveTextContent('Pet A'));
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'oldest');
    await waitFor(() => expect(screen.getAllByTestId('animal-card')[0]).toHaveTextContent('Pet A'));
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'youngest');
    await waitFor(() => expect(screen.getAllByTestId('animal-card')[0]).toHaveTextContent('Pet N'));
  });
});
