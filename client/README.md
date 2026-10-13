# Client (React + Vite)

The catalog, login UI and app shell are M1 (Ammar). M2 and M3 pages plug into the routes already set up in `src/App.jsx`.

## Run it

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

Start the real API first: `cd server && npm install && npm run seed && npm start` (port 4000). The endpoints the client needs are in the `feature/server-catalog-auth-api` branch.

The client calls `http://localhost:4000/api` by default. To use a different API, copy `.env.example` to `.env` and change `VITE_API_URL`.

**No backend yet?** Run the temporary mock API in a second terminal:

```bash
npm run mock-api                          # SQLite-style responses (id)
MOCK_MODE=mongo npm run mock-api          # MongoDB-style (_id, wrapped lists, lowercase statuses)
MOCK_DELAY=1500 npm run mock-api          # slow server
MOCK_TOKEN_TTL=60 npm run mock-api        # logins expire after 60 s
```

On Windows PowerShell, set a variable first: `$env:MOCK_MODE="mongo"; npm run mock-api`.

Mock logins (password `password123`): `adopter@shelter.test` and `staff@shelter.test`. To demo a live status change:

```bash
curl -X POST localhost:4000/api/mock/status -H "Content-Type: application/json" -d "{\"id\":1,\"status\":\"Adopted\"}"
```

Stop the mock once M3's real server is running on port 4000.

## Tests

```bash
npm test             # Vitest + React Testing Library, all in src/__tests__
```

| File | Test IDs |
|---|---|
| `AnimalList.test.jsx` | T-SEARCH-1 to T-SEARCH-8, T-ERR-1, T-ERR-2 |
| `AnimalProfile.test.jsx` | T-PROFILE-1 to T-PROFILE-5, T-UI-1, T-UI-1b, T-UI-2, T-UI-3 |
| `Login.test.jsx` | T-LOGIN-UI-1 to T-LOGIN-UI-7 |
| `Auth.test.jsx` | T-ROLE-UI-1 to T-ROLE-UI-3, T-AUTH-1, T-AUTH-2 |
| `Navbar.test.jsx` | T-NAV-1 to T-NAV-3 |
| `api.test.js` | T-API-H1 to T-API-H10 |
| `normalize.test.js` | T-N-1 to T-N-8, T-F-1 |

That's 53 tests. See `docs/M1-edge-cases.md` for what each one protects against.

## Folder map

```
src/
  api.js                 request(path, options): Bearer token, timeout, ApiError, 401 handling
  normalize.js           server-shape independence (id/_id, wrappers, status/role casing)
  format.js              formatAge, formatDate
  constants.js           STATUSES, SPECIES, canApply()
  hooks.js               useDebounced, useRefetchOnFocus, useDocumentTitle
  auth/AuthProvider.jsx  holds the login state for the whole app
  auth/useAuth.js        useAuth() -> { user, token, isStaff, isAdopter, login, logout }
  auth/redirects.js      safe redirect after login (role-aware)
  auth/RequireRole.jsx   route guard (UI only; the server does the real check), safe redirects
  components/            Navbar, AnimalCard, AnimalPhoto, StatusBadge, ErrorBoundary, ScrollToTop
  pages/                 AnimalList, AnimalProfile, Login, MyApplications, NotFound
  pages/ApplicationForm.jsx     placeholder, M2 replaces (US-03)
  pages/StaffApplications.jsx   placeholder, M2 replaces (US-04)
  pages/StaffAnimalForm.jsx     placeholder, M3 replaces (US-06)
```

## For M2 and M3: using the shell

```js
import { request } from '../api.js';
import { useAuth } from '../auth/useAuth.js';

await request('/applications', { method: 'POST', body: { animalId, ...form } });
// body objects are JSON-encoded automatically; the token is attached if logged in.
// Errors throw ApiError with .status (0 = network, 400, 401, 403, 404, 408 = timeout, 409)
// and a readable .message taken from { error } / { message } / { errors: [{ msg }] }.
// A 401 on a logged-in call logs the user out automatically.
// Pass { signal } from an AbortController to cancel when your page unmounts.

const { user, isStaff } = useAuth();
```

Routes and role guards for your pages are already in `App.jsx`. Replace the contents of your placeholder file and keep the default export.

## API contract the client expects

| Call | Request | Response |
|---|---|---|
| List | `GET /api/animals?species=&breed=&status=` (all optional; breed is a partial, case-insensitive match) | `200 [ { id, name, species, breed, age, sex, status, description, photoUrl? } ]` |
| One | `GET /api/animals/:id` | `200 { ...animal }` or `404 { error }` |
| Login | `POST /api/auth/login { email, password }` | `200 { token, user: { id, name, email, role } }` or `401 { error }` |
| Mine | `GET /api/applications/mine` (Adopter token) | `200 [ { id, animalId, animalName, animalStatus, status, submittedAt } ]`, newest first |

`status` values: `Available`, `Pending`, `Adopted`, `Fostered` (from the CHECK constraint in `server/src/db.js`). `role` values: `Adopter`, `Staff`.

The client also accepts MongoDB-style `_id`, wrapped responses (`{ animals: [...] }`, `{ animal: {...} }`) and any casing of status or role values, so either backend works without changes here.

## Deploying (optional)

Run `npm run build`, then serve `dist/`. Set `VITE_API_URL` to the deployed API **before** building. `public/_redirects` (Netlify) and `vercel.json` (Vercel) make deep links like `/animals/3` survive a refresh. On a Render static site, add the rewrite rule `/*` → `/index.html`. The API must allow CORS from the site's URL.
