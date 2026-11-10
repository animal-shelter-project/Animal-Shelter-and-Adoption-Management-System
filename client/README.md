# Client (React + Vite)

The website for the Animal Shelter & Adoption Management System. See the README in the project root for the whole system.

## Run it

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

Start the API first: `cd server && npm install && npm run seed && npm start` (port 4000).

The client calls `http://localhost:4000/api` by default. To use a different API, copy `.env.example` to `.env` and change `VITE_API_URL`.

## Tests and lint

```bash
npm test             # Vitest + React Testing Library (src/__tests__)
npm run lint         # ESLint
```

## Folder map

```
src/
  api.js                 every server call: Bearer token, timeout, readable errors,
                         logout on 401, session renewal, photo URLs
  normalize.js           turns server responses into the shapes the pages use
  format.js              ages, dates, fees, appointment times
  constants.js           statuses, species, allowed status changes, record types
  animalForm.js          Add / Edit Animal validation
  applicationForm.js     application form validation and the answers summary
  accountForm.js         sign-up, contact details and password validation
  photo.js               prepares a photo for upload (shrinks large ones)
  hooks.js               useResource, useDebounced, useRefetchOnFocus, useDocumentTitle
  auth/                  AuthProvider, useAuth, RequireRole, safe redirects after login
  components/            Navbar, AnimalCard, AnimalPhoto, StatusBadge, StaffStatusPanel,
                         StaffAnimalTools, MedicalRecordsPanel, AppointmentsPanel,
                         AnimalDetailsFields, NotificationsLink, FormField, ...
  pages/                 AnimalList, AnimalProfile, Login, Register, Account,
                         MyApplications, ApplicationForm, Notifications,
                         StaffDashboard, StaffApplications, StaffAnimalForm,
                         EditAnimalForm, StaffAccounts, NotFound
```

## Deploying (optional)

1. Set `VITE_API_URL` to the deployed API, then run `npm run build`.
2. Serve the `dist/` folder.
3. Make deep links like `/animals/3` survive a refresh:
   - Netlify and Vercel use `public/_redirects` and `vercel.json`.
   - On a Render static site, add the rewrite rule `/*` → `/index.html`.
4. The API must allow CORS from the site's URL (`CLIENT_ORIGIN` on the server).
