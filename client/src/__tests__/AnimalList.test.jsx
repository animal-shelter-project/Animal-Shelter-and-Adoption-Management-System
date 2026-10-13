import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AnimalList from '../pages/AnimalList.jsx';
import { mockApi, renderAt } from '../test/helpers.jsx';

const renderList = (path = '/animals') => renderAt(path, '/animals', <AnimalList />);

describe('US-01 Search animals (FR-01, UC-01)', () => {
  it('T-SEARCH-1: filtering species=Dog shows only dogs', async () => {
    const fetchSpy = mockApi();
    renderList();

    expect(await screen.findAllByTestId('animal-card')).toHaveLength(5);

    await userEvent.selectOptions(screen.getByLabelText('Species'), 'Dog');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(2));
    const cards = screen.getAllByTestId('animal-card');
    cards.forEach((card) => expect(within(card).getByText(/Dog/)).toBeInTheDocument());
    expect(screen.getByText('Buddy')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.queryByText('Luna')).not.toBeInTheDocument();

    const lastUrl = String(fetchSpy.mock.calls.at(-1)[0]);
    expect(lastUrl).toContain('/api/animals?species=Dog');
    expect(screen.getByTestId('location')).toHaveTextContent('/animals?species=Dog');
  });

  it('T-SEARCH-2: a breed with no matches shows the empty message', async () => {
    mockApi();
    renderList();
    await screen.findAllByTestId('animal-card');

    await userEvent.type(screen.getByLabelText('Breed'), 'Poodle');

    expect(await screen.findByTestId('empty-message')).toHaveTextContent(
      'No animals match your search.',
    );
    expect(screen.queryAllByTestId('animal-card')).toHaveLength(0);
  });

  it('T-SEARCH-3: status filter in the URL is applied on load', async () => {
    const fetchSpy = mockApi();
    renderList('/animals?status=Available');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(3));
    expect(String(fetchSpy.mock.calls[0][0])).toContain('status=Available');
  });

  it('T-SEARCH-4: list is still correct if the server ignores a filter', async () => {
    mockApi(undefined, { ignoreFilters: true });
    renderList('/animals?species=Cat');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(2));
    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(screen.getByText('Oliver')).toBeInTheDocument();
  });

  it('T-SEARCH-5: breed search is partial and case-insensitive', async () => {
    mockApi();
    renderList();
    await screen.findAllByTestId('animal-card');

    await userEvent.type(screen.getByLabelText('Breed'), 'labr');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(1));
    expect(screen.getByText('Buddy')).toBeInTheDocument();
  });

  it('T-SEARCH-6: an unknown status in the URL is ignored', async () => {
    mockApi();
    renderList('/animals?status=Banana');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(5));
  });

  it('T-SEARCH-7: works with a MongoDB-shaped response (_id, wrapped, lowercase status)', async () => {
    mockApi(undefined, { shape: 'mongo' });
    renderList('/animals?status=Available');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(3));
    const buddy = screen.getByText('Buddy').closest('a');
    expect(buddy).toHaveAttribute('href', '/animals/000000000000000000000001');
    expect(within(buddy).getByTestId('status-badge')).toHaveTextContent('Available');
  });

  it('T-SEARCH-8: Clear filters resets the URL and the breed box', async () => {
    mockApi();
    renderList('/animals?species=Dog&breed=shep');

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(1));
    expect(screen.getByLabelText('Breed')).toHaveValue('shep');

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(5));
    expect(screen.getByLabelText('Breed')).toHaveValue('');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/animals$/);
  });
});

describe('List error handling', () => {
  it('T-ERR-1: a server error shows a message and Retry recovers', async () => {
    mockApi(undefined, { failTimes: 1 });
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getAllByTestId('animal-card')).toHaveLength(5));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('T-ERR-2: an empty shelter shows a friendly message, not an error', async () => {
    mockApi([]);
    renderList();

    expect(await screen.findByTestId('empty-message')).toHaveTextContent(
      'There are no animals listed right now',
    );
  });
});
