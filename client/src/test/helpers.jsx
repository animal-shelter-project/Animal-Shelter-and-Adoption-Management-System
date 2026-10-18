import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import AuthProvider from '../auth/AuthProvider.jsx';
import LocationProbe from './LocationProbe.jsx';

export const ANIMALS = [
  { id: 1, name: 'Buddy', species: 'Dog', breed: 'Labrador Retriever', age: 3, status: 'Available' },
  { id: 2, name: 'Luna', species: 'Cat', breed: 'Siamese', age: 2, status: 'Available' },
  { id: 3, name: 'Max', species: 'Dog', breed: 'German Shepherd', age: 5, status: 'Pending' },
  { id: 4, name: 'Coco', species: 'Rabbit', breed: 'Holland Lop', age: 1, status: 'Available' },
  { id: 5, name: 'Oliver', species: 'Cat', breed: 'Maine Coon', age: 4, status: 'Adopted' },
];

export const jsonResponse = (status, body) =>
  Promise.resolve(
    new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const oid = (n) => String(n).padStart(24, '0');

// Replaces global fetch with a fake server that filters ANIMALS the same way
// the real GET /api/animals does. Returns the spy so tests can inspect calls.
// Options:
//   shape: 'sqlite' (default) | 'mongo'  -> _id, { animals: [] }, lowercase status
//   ignoreFilters: true                  -> server returns everything (bug simulation)
//   failTimes: n                          -> first n requests fail with 500
export function mockApi(animals = ANIMALS, { shape = 'sqlite', ignoreFilters = false, failTimes = 0 } = {}) {
  let failures = 0;
  const mongo = shape === 'mongo';
  const out = (a) => (mongo ? { ...a, id: undefined, _id: oid(a.id), status: a.status.toLowerCase() } : a);

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    if (failures < failTimes) {
      failures += 1;
      return jsonResponse(500, { error: 'Database unavailable' });
    }
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api/, '');

    if (path === '/animals') {
      const species = ignoreFilters ? null : url.searchParams.get('species');
      const breed = ignoreFilters ? null : url.searchParams.get('breed');
      const status = ignoreFilters ? null : url.searchParams.get('status');
      const list = animals
        .filter(
          (a) =>
            (!species || a.species === species) &&
            (!breed || a.breed.toLowerCase().includes(breed.toLowerCase())) &&
            (!status || a.status === status),
        )
        .map(out);
      return jsonResponse(200, mongo ? { animals: list } : list);
    }
    if (/^\/animals\/[^/]+\/history$/.test(path)) return jsonResponse(200, []);
    const m = /^\/animals\/(.+)$/.exec(path);
    if (m) {
      const key = decodeURIComponent(m[1]);
      if (mongo && !/^\d{24}$/.test(key)) return jsonResponse(400, { message: 'Invalid id' });
      const a = animals.find((x) => (mongo ? oid(x.id) : String(x.id)) === key);
      if (!a) return jsonResponse(404, { error: 'Animal not found' });
      return jsonResponse(200, mongo ? { animal: out(a) } : a);
    }
    return jsonResponse(404, { error: 'Not found' });
  });
}

// Renders `element` at `path` inside the router and auth provider.
// `extraRoutes` lets a test add e.g. a /login route to observe redirects.
export function renderAt(path, routePattern, element, extraRoutes = null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={routePattern} element={element} />
          {extraRoutes}
        </Routes>
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

// A JWT-shaped token with the given exp (seconds since epoch).
export function fakeJwt(payload) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}
