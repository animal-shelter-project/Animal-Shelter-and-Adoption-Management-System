import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { saveAuth } from '../api.js';
import { FosterForm, VolunteerForm } from '../components/SignupForms.jsx';
import { WishList } from '../components/WishList.jsx';
import { openStatus } from '../hours.js';
import StaffInbox from '../pages/StaffInbox.jsx';
import { jsonResponse, renderAt } from '../test/helpers.jsx';

// Fake server: { 'METHOD /api/path': (body) => Response }
function server(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init = {}) => {
    const url = new URL(String(input));
    const handler = routes[`${init.method || 'GET'} ${url.pathname}`];
    return handler ? handler(init.body ? JSON.parse(init.body) : undefined, url) : jsonResponse(404, { error: 'Not found' });
  });
}
const sent = (spy, method) => {
  const call = spy.mock.calls.find(([, init]) => init?.method === method);
  return call && JSON.parse(call[1].body);
};

describe('Sign-up forms', () => {
  it('T-VOL-UI-1: the volunteer form shows every missing answer, then sends the sign-up', async () => {
    const spy = server({ 'POST /api/inquiries': (b) => jsonResponse(201, { id: 1, ...b, status: 'New' }) });
    renderAt('/x', '/x', <VolunteerForm />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign me up to volunteer' }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Choose at least one way to help.')).toBeInTheDocument();
    expect(screen.getByText('Tick at least one time you are free.')).toBeInTheDocument();
    expect(screen.getByText('Volunteers must be 16 or older.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Your name'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.click(screen.getByLabelText('Dog walking'));
    await userEvent.click(screen.getByLabelText('Sat Morning'));
    await userEvent.click(screen.getByLabelText('Sun Afternoon'));
    expect(screen.getByText('2 times chosen.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('I am 16 or older'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign me up to volunteer' }));

    expect(await screen.findByText('Welcome aboard, Ana!')).toBeInTheDocument();
    expect(sent(spy, 'POST')).toEqual({
      kind: 'Volunteer',
      name: 'Ana',
      email: 'ana@example.com',
      phone: '',
      message: '',
      details: { interests: ['Dog walking'], availability: ['Sat Morning', 'Sun Afternoon'], over16: true },
    });
  });

  it('T-FOSTER-UI-1: the foster form sends the chosen animals and length; server errors are shown', async () => {
    let first = true;
    const spy = server({
      'POST /api/inquiries': (b) => {
        if (first) {
          first = false;
          return jsonResponse(400, { error: 'Enter a valid email address.', fields: { email: 'Enter a valid email address.' } });
        }
        return jsonResponse(201, { id: 2, ...b });
      },
    });
    renderAt('/x', '/x', <FosterForm />);
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.click(screen.getByLabelText('Kittens'));
    await userEvent.click(screen.getByLabelText('A few weeks'));
    await userEvent.click(screen.getByLabelText('Yes'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign me up to foster' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');

    await userEvent.click(screen.getByRole('button', { name: 'Sign me up to foster' }));
    expect(await screen.findByText('Thank you, Sam!')).toBeInTheDocument();
    expect(sent(spy, 'POST').details).toEqual({ animals: ['Kittens'], length: 'A few weeks', hasOtherPets: true });
  });
});

describe('Wish list', () => {
  it('T-WISH-UI-1: promising items updates the progress bar and thanks the person', async () => {
    const towels = { id: 7, name: 'Towels', category: 'Everyone', needed: 10, pledged: 4, remaining: 6 };
    const spy = server({
      'GET /api/wishlist': () => jsonResponse(200, [towels]),
      'POST /api/wishlist/7/pledges': (b) => jsonResponse(201, { ...towels, pledged: 4 + b.quantity, remaining: 6 - b.quantity }),
    });
    renderAt('/x', '/x', <WishList />);
    const card = (await screen.findByRole('heading', { name: 'Towels' })).closest('li');
    expect(within(card).getByText('6 still needed', { exact: false })).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: /I’ll bring some/ }));
    const form = screen.getByRole('form', { name: 'Promise to bring Towels' });
    await userEvent.click(within(form).getByRole('button', { name: 'One more' }));
    await userEvent.type(within(form).getByLabelText('Your name'), 'Jo');
    await userEvent.type(within(form).getByLabelText('Email'), 'jo@example.com');
    await userEvent.click(within(form).getByRole('button', { name: 'Promise to bring' }));

    expect(await screen.findByRole('status')).toHaveTextContent('We’ve noted 2 × towels');
    expect(within(card).getByText('4 still needed', { exact: false })).toBeInTheDocument();
    expect(sent(spy, 'POST')).toEqual({ name: 'Jo', email: 'jo@example.com', quantity: 2 });
  });
});

describe('Staff inbox', () => {
  it('T-INBOX-UI-1: staff see new sign-ups with their answers and mark one contacted', async () => {
    saveAuth({ token: 's-token', user: { id: 1, email: 'staff@shelter.test', role: 'Staff' } });
    const priya = {
      id: 3,
      kind: 'Foster',
      name: 'Priya Shah',
      email: 'priya@example.com',
      phone: '',
      message: 'Spare room',
      details: { animals: ['Kittens'], length: 'A few weeks', hasOtherPets: false },
      status: 'New',
      createdAt: '2026-11-13 10:00:00',
    };
    let items = [priya];
    const spy = server({
      'GET /api/inquiries': (b, url) =>
        jsonResponse(200, {
          items: items.filter((i) => !url.searchParams.get('status') || i.status === url.searchParams.get('status')),
          newCounts: { Foster: items.filter((i) => i.status === 'New').length, Volunteer: 0, Contact: 0 },
        }),
      'PATCH /api/inquiries/3': (b) => {
        items = [{ ...priya, status: b.status }];
        return jsonResponse(200, items[0]);
      },
    });
    renderAt('/staff/inbox', '/staff/inbox', <StaffInbox />);

    const card = await screen.findByTestId('inbox-item');
    expect(within(card).getByText('Priya Shah')).toBeInTheDocument();
    expect(within(card).getByText('Kittens')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Mark contacted' }));
    await waitFor(() => expect(screen.queryByTestId('inbox-item')).not.toBeInTheDocument());
    expect(sent(spy, 'PATCH')).toEqual({ status: 'Contacted' });
  });
});

describe('Opening hours', () => {
  it('T-HOURS-1: the "Open now" text follows the opening hours', () => {
    // Nov 17 2026 is a Tuesday (open 11 am – 7 pm); Nov 16 is a Monday (closed).
    expect(openStatus(new Date(2026, 10, 17, 12, 0))).toEqual({ open: true, text: 'Open now · closes at 7 pm' });
    expect(openStatus(new Date(2026, 10, 17, 9, 30))).toEqual({ open: false, text: 'Closed now · opens today at 11 am' });
    expect(openStatus(new Date(2026, 10, 17, 19, 0))).toEqual({ open: false, text: 'Closed now · opens tomorrow at 11 am' });
    expect(openStatus(new Date(2026, 10, 16, 12, 0))).toEqual({ open: false, text: 'Closed now · opens tomorrow at 11 am' });
    expect(openStatus(new Date(2026, 10, 15, 18, 0))).toEqual({ open: false, text: 'Closed now · opens Tuesday at 11 am' });
  });
});
