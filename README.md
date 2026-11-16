# Animal Shelter & Adoption Management System

CSE 5324-001, Fall 2026. Team: Ammar Baig (1001847502), Rutuja Dudhagundi (1002318091), Omar Elsaghir (1001768494).

A web app for an animal shelter.

- **Public site:** a home page (rotating banner, ways to help, the animals waiting longest, live shelter numbers), menus with dropdowns and a full-screen menu, search by name, and information pages: how adoption works, adoption FAQs, fostering, volunteering, ways to give, our story, and visit/contact.
- **Get involved:** foster and volunteer sign-up forms (with an availability grid), a contact form, and a donation wish list where visitors promise items and watch the progress bars fill. Everything is saved to the database; no payments are taken.
- **Public:** browse the animals that are Available; search by name; filter by species, age group, breed and status; sort; open each animal's profile (photo, age, sex, size, good with children/dogs/cats, adoption fee, description).
- **Adopters:**
  - sign up, log in and edit their contact details
  - add a profile picture (everyone, staff too)
  - change their password
  - apply for an animal (structured questions about their home and household, plus up to 3 optional photos of their home)
  - follow and withdraw their applications
  - get messages when staff decide
- **Staff:**
  - **Dashboard:** animals by status, applications waiting, adoptions this month, upcoming appointments, the animals waiting longest
  - **Animals:** add, edit, upload photos, archive and restore
  - **Applications:** review with the applicant's picture, contact details, answers and home photos; approve or reject; keep private notes; see past decisions
  - **Status:** change an animal's status, with a full history of who changed it, when and why. A walk-in adoption needs the adopter's account. A return is recorded on the adoption.
  - **Care:** medical records (add, correct and delete) and appointments (overlapping bookings are refused)
  - **Accounts:** look up adopters and reset a forgotten password
  - **Inbox:** foster and volunteer sign-ups and contact messages (mark them contacted or closed), and the wish list (change what is needed, see who promised what)

## Folder layout

```
client/   React 19 + Vite single-page app (pages/, components/, api.js, auth/)
server/   Node.js + Express 5 REST API with SQLite (routes/ -> controllers/ -> services/ -> models/)
docs/     wireframes and UML diagrams
```

## Requirements

- Node.js 20 or newer (includes npm). No database server is needed: SQLite is a file.

## Install and run

Open two terminals in this folder.

```bash
# Terminal 1: API on http://localhost:4000
cd server
npm install
npm run seed     # demo animals, accounts and applications (resets the data)
npm start

# Terminal 2: website on http://localhost:5173
cd client
npm install
npm run dev
```

Open http://localhost:5173.

An existing `server/data/shelter.db` from the first release is upgraded automatically the first time the new server starts. No data is lost.

## Demo accounts (password `password123`)

| Role    | Email                  |
|---------|------------------------|
| Staff   | staff@shelter.test     |
| Adopter | adopter@shelter.test   |
| Adopter | jordan@shelter.test    |

New adopters can also sign up on the site.

## Tests

```bash
cd server && npm test      # Jest + Supertest API tests
cd client && npm test      # Vitest + React Testing Library tests
cd client && npm run lint  # ESLint
```

## Backups

```bash
cd server && npm run backup    # one backup now, in server/backups/
```

The server also makes a backup when it starts and every 24 hours. It keeps the newest 14. You can change this with `BACKUP_EVERY_HOURS` (0 turns it off) and `BACKUP_KEEP`.

To restore a backup:

1. Stop the server.
2. Copy a backup file over `server/data/shelter.db`.
3. Start the server again.

## Configuration (optional)

Copy `server/.env.example` to `server/.env` to change these settings:

- `PORT`
- `JWT_SECRET`, which is **required in production**
- `DB_PATH`
- `UPLOAD_DIR`, the folder for photos (default `server/uploads`)
- `CLIENT_ORIGIN`

Copy `client/.env.example` to `client/.env` to point the client at another API (`VITE_API_URL`).

## Accessibility

The site aims for WCAG 2.2 level AA:

- Text and background colours meet the 4.5:1 contrast ratio (3:1 for large text).
- Colour is never the only signal. Every status has an icon and a word, and errors are written out.
- Everything works with the keyboard. There is a "Skip to content" link, menus close with Escape, and the focus outline is always visible.
- Form fields have labels, decorative pictures are hidden from screen readers, and messages are announced.
- The home page banner can be paused and does not move for people who turn on "reduce motion".
- Pages work at 200% zoom and down to 320 px wide.

## Security notes

- Passwords are stored as bcrypt hashes.
- Logins use JWTs that last 2 hours. Active sessions renew themselves.
- Changing a password logs out the user's other sessions.
- After 5 wrong passwords, that email is locked for 15 minutes.
- Role checks run on every protected API route.
- Photos (animal photos, profile pictures and home photos) are checked by their bytes (JPEG, PNG or WebP, 2 MB maximum) and saved with random file names.
- The login token is kept in the browser's localStorage. On a public deployment, consider moving it to an httpOnly cookie.

## Known limitations

- The app is not deployed; it runs locally.
- Messages are in-app only. There is no email service, so staff reset forgotten passwords.
- It is English only and supports one shelter.
