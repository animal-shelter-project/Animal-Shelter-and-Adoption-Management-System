# M1 report sections (draft): Ammar Baig

> **How to use this draft.** Match the headings to your course template's exact wording. Anything in **[brackets]** is yours to fill in from real work: actual test results, dates, and screenshots taken against the **real** server.
>
> The screenshots in `docs/screenshots/` were taken against the temporary mock API. They're fine for layout reference, but retake them on Wednesday once M2's and M3's code is merged.
>
> Check every ID (FR / US / UC) against M2's Section 6.1 table before submitting.

---

## 1. Introduction

### 1.1 Purpose
This report covers the first working increment of the **Animal Shelter & Adoption Management System**. The system helps a shelter publish the animals in its care, lets the public search them and apply to adopt, and lets staff manage animals and review applications.

### 1.2 Scope of this increment
The increment covers the core adoption path end to end:

- **Search animals** by species, breed and status (US-01)
- **View an animal profile** (US-02)
- **Submit an adoption application** (US-03)
- **Staff review**: approve or reject an application (US-04)
- **Login** with role-based access for Adopters and Staff (US-05)
- **Staff add and update animals** (US-06)

Notifications, medical records, appointments and the fostering workflow are planned for later increments. Animals already marked `Fostered` are still shown and can be filtered. They are listed in Section 12 as remaining work.

### 1.3 Team

| Member | Area |
|---|---|
| Ammar Baig (M1) | Catalog and front-end shell: search, profile, login UI, navigation |
| [Rutuja Dudhagundi or Omar Elsaghir: M2] | Adoption workflow: submit application, staff review |
| [Rutuja Dudhagundi or Omar Elsaghir: M3] | Platform and staff tools: repo, database, authentication, staff animal management |

### 1.4 Intended users
- **Adopters** (the public): browse and search animals, view profiles, apply to adopt, and track their applications.
- **Shelter staff**: add and update animals, and approve or reject applications.

---

## 2. System overview

### 2.1 Problem
Shelters often track animals and adoption requests in spreadsheets, on paper and over the phone. Adopters can't easily see which animals are actually available. Staff can't easily see which requests are pending, and an animal can end up promised to two families.

### 2.2 Proposed solution
A web application with a single animal catalog and a status lifecycle that every page reads from:

`Available → Pending → Adopted` (or back to `Available` on rejection). These are the values the database allows (`server/src/db.js`); `Fostered` is also shown and filterable.

- Submitting an application moves the animal to **Pending**, so a second application can't succeed. The server enforces this inside a database transaction.
- The status badge is shown on every card and profile, and the **Apply** button only appears for Available animals.

### 2.3 Architecture

| Layer | Technology | Notes |
|---|---|---|
| Client | React (Vite) and React Router | Pages per feature; a shared `api.js` helper attaches the JWT |
| Server | Node.js and Express | Controller, service and model classes |
| Database | SQLite (better-sqlite3) | Tables: users, animals, applications |
| Auth | JWT and bcrypt | Roles: Adopter, Staff |
| Testing | Vitest and React Testing Library (client); Jest and Supertest (server); Postman | |

The client talks only to `/api/...`. Every request goes through `request()` in `client/src/api.js`, which adds the `Authorization: Bearer <token>` header and turns error responses into `ApiError` objects carrying the HTTP status.

### 2.4 Client page map

| Route | Page | Story | Access |
|---|---|---|---|
| `/animals` | AnimalList | US-01 | Everyone |
| `/animals/:id` | AnimalProfile | US-02 | Everyone |
| `/login` | Login | US-05 | Everyone |
| `/my-applications` | MyApplications | — | Adopter |
| `/animals/:id/apply` | ApplicationForm | US-03 | Adopter |
| `/staff/applications` | StaffApplications | US-04 | Staff |
| `/staff/animals/new`, `/staff/animals/:id/edit` | StaffAnimalForm | US-06 | Staff |

---

## 4. Working increment

### 4.1 Implemented features and evidence
*Retake each screenshot against the real server and replace the file names below.*

| Feature | Story | Use case | Evidence | Status |
|---|---|---|---|---|
| Animal list with species, breed and status filters | US-01 | UC-01 [confirm] | Fig. 4.1: `01-animal-list.png`; Fig. 4.2: `02-filter-dog.png` (species = Dog) | [Done] |
| Empty-search message | US-01 | UC-01 | Fig. 4.3: `03-no-results.png` | [Done] |
| Animal profile with status badge | US-02 | UC-01 | Fig. 4.4: `04-profile-available.png` | [Done] |
| Apply hidden when the animal isn't Available | US-02 | UC-02 | Fig. 4.5: `05-profile-pending.png` | [Done] |
| Unknown animal ID shows "not found" | US-02 | UC-01 | Fig. 4.6: `06-not-found.png` | [Done] |
| Login, invalid-credentials message, role-based navbar | US-05 | [UC-xx] | Fig. 4.7: `07-login-error.png`; Fig. 4.8: `09-staff-nav.png` | [Done] |
| Submit application | US-03 | UC-02 | [M2's screenshot] | [ ] |
| Approve / reject | US-04 | UC-03 | [M2's screenshot] | [ ] |
| Staff add / edit animal | US-06 | [UC-xx] | [M3's screenshot] | [ ] |
| My applications | — | — | Fig. 4.9: `08-my-applications.png` | [Done] |

**Example caption format:** *Figure 4.2: Animal list filtered to Species = Dog. Only dogs are shown and the filter is kept in the URL (US-01, UC-01).*

### 4.2 End-to-end demo flow
1. An adopter opens `/animals` and filters Species = Dog.
2. They open an Available dog's profile and click **Apply to adopt**. Logged-out users go to Login first, then return to the form.
3. They submit the application. The animal's badge changes to **Pending**, and its Apply button disappears.
4. A staff member logs in and lands on **Review applications**, then approves the application.
5. The adopter's profile view shows the new status the next time the tab regains focus, with no manual reload. [Use whichever final status M2 and M3 agree on for approval: `Adopted` in the current schema.]

[Record the actual demo result: date, who ran it, and whether it passed.]

### 4.3 Known limitations (client)
- No pagination or sorting. The full filtered list is returned in one response, which is fine at shelter scale.
- Status updates aren't pushed live. The list and profile refetch when the tab regains focus and every 30 s while visible, so a change can take up to 30 s to appear in a tab left open.
- There's no token refresh. Sessions end when the JWT expires (2 h, per the plan). The user is then sent back to Login with a "session expired" message and returned to the same page afterwards.
- The JWT is kept in `localStorage` for simplicity. An httpOnly cookie would be safer in production.
- Client route guards only affect the UI. The real access check is the server's `requireRole` middleware.
- Photos appear only if the server provides a `photoUrl`. Otherwise a species icon is shown.
- [Add any real bugs found during Wednesday's integration.]

Robustness work done in this increment (full list in `docs/M1-edge-cases.md`):
- The client accepts SQLite-style (`id`) and MongoDB-style (`_id`) responses, wrapped or bare lists, and any casing of status or role values.
- Server down, slow responses (10 s timeout) and 5xx errors show a readable message with Retry. A failed background refresh keeps the current data on screen.
- Expired sessions (on page load, while the page is open, or a 401 from the server) log the user out cleanly. Logging out in one tab logs out the others.
- Redirects after login stay inside the app and respect the user's role.
- **Defect found and fixed during testing (for 9.3):** if an adopter's session ended on an adopter-only page and a staff member then logged in on the same tab, the staff member was sent to that page and saw "Adopter accounts only". Login now returns a user to the saved page only if their role can open it (tests T-LOGIN-UI-6 and T-LOGIN-UI-7). [Log this as a Jira Bug if you're using it in 9.3.]

---

## 5.1 Functional requirements status (M1 rows)

| FR | Requirement | Status | Implemented by | Evidence |
|---|---|---|---|---|
| FR-01 | Users can search and filter animals by species, breed and status | [Implemented] | Ammar (M1) | `AnimalList.jsx`; tests T-SEARCH-1, T-SEARCH-2; Fig. 4.1–4.3 |
| FR-02 | Users can view an animal's full profile | [Implemented] | Ammar (M1) | `AnimalProfile.jsx`; tests T-PROFILE-1, T-PROFILE-2; Fig. 4.4, 4.6 |
| FR-08 | The current adoption status is shown on listings and profiles | [Implemented] | Ammar (M1) | `StatusBadge.jsx`; test T-UI-1; Fig. 4.1, 4.5 |

*Use the exact FR wording from your requirements section.*

---

## 7.3 Screens: wireframes vs implemented

| Screen | Wireframe (Monday) | Implemented screen | Differences |
|---|---|---|---|
| Animal list | `wireframes/WF-1-animal-list.png` | Fig. 4.1 | Added an "N animals found" count and a Clear filters button |
| Animal profile | `wireframes/WF-2-animal-profile.png` | Fig. 4.4 | Added a "not open for applications" note when Apply is hidden; staff see Edit instead of Apply |
| Login | `wireframes/WF-3-login.png` | Fig. 4.7 | As designed |
| Navbar | `wireframes/WF-4-navbar-states.png` | Fig. 4.8 | Shows the user's name and role badge; on phones, links move to a second row |

Design notes: badge colors are consistent everywhere (green = Available, amber = Pending, blue = Adopted). Layouts were checked at desktop width and at 390 px phone width with no horizontal scrolling.

---

## 6.6 Second sequence diagram: Search Animals

Diagram: `docs/diagrams/6.6-search-animals-sequence.png` (source: `.mmd`).

Actor-triggered request: the Adopter selects Species = Dog in **AnimalList**, which calls `api.listAnimals()`. That sends `GET /api/animals?species=Dog` to `routes/animals.js`, which calls `AnimalController.list()`. The controller validates the filters and calls `Animal.findAll()`, which queries SQLite. The rows return as JSON, and AnimalList renders an **AnimalCard** for each animal, or the empty message.

Every name in the diagram matches the code (`server/src/controllers/AnimalController.js`, `server/src/models/Animal.js`). If Omar renames anything when he merges the server branch, update the `.mmd` file the same day and re-render it.

---

## 9.2 Executed tests (M1 rows)
Run `npm test` in `client/`, then fill in the **Actual** and **Result** columns from what you see. Don't copy the expected result. There are 53 automated tests in total; the main ones for the report are below, and the rest are summarized in the last automated row.

| Test ID | Level | FR | Story | UC | Steps | Expected | Actual | Result |
|---|---|---|---|---|---|---|---|---|
| T-SEARCH-1 | UI (automated) | FR-01 | US-01 | UC-01 | Load the list, choose Species = Dog | Only Buddy and Max; the request has `species=Dog`; the URL updates | [ ] | [ ] |
| T-SEARCH-2 | UI (automated) | FR-01 | US-01 | UC-01 | Type breed "Poodle" | "No animals match your search." and no cards | [ ] | [ ] |
| T-SEARCH-3 | UI (automated) | FR-01 | US-01 | UC-01 | Open `/animals?status=Available` | 3 Available animals | [ ] | [ ] |
| T-SEARCH-4 | UI (automated) | FR-01 | US-01 | UC-01 | Server ignores the species filter | List still shows only cats | [ ] | [ ] |
| T-SEARCH-5 | UI (automated) | FR-01 | US-01 | UC-01 | Type "labr" | Partial, case-insensitive match: Buddy | [ ] | [ ] |
| T-SEARCH-7 | UI (automated) | FR-01 | US-01 | UC-01 | MongoDB-shaped response | Cards link by `_id`; statuses shown correctly | [ ] | [ ] |
| T-SEARCH-8 | UI (automated) | FR-01 | US-01 | UC-01 | Click Clear filters | URL and breed box reset; all 5 shown | [ ] | [ ] |
| T-ERR-1 | UI (automated) | FR-01 | US-01 | UC-01 | Server returns 500, then Retry | Error message, then the list after Retry | [ ] | [ ] |
| T-PROFILE-1 | UI (automated) | FR-02 | US-02 | UC-01 | Open `/animals/1` | Buddy's name, breed and Available badge | [ ] | [ ] |
| T-PROFILE-2 | UI (automated) | FR-02 | US-02 | UC-01 | Open `/animals/999` | "Animal not found" | [ ] | [ ] |
| T-PROFILE-3 | UI (automated) | FR-02 | US-02 | UC-01 | Malformed id (server 400) | "Animal not found" | [ ] | [ ] |
| T-PROFILE-5 | UI (automated) | FR-02 | US-02 | UC-01 | Server error on a profile | Retry button, not "not found" | [ ] | [ ] |
| T-UI-1 | UI (automated) | FR-08 | US-02 | UC-02 | Profile of a Pending animal | No Apply button; "being reviewed" note | [ ] | [ ] |
| T-UI-2 | UI (automated) | FR-08 | US-02 | UC-02 | Profile of an Available animal | Apply links to `/animals/1/apply` | [ ] | [ ] |
| T-UI-3 | UI (automated) | FR-08 | US-02 | UC-02 | Staff opens an Available profile | Edit shown, Apply hidden | [ ] | [ ] |
| T-LOGIN-UI-1 | UI (automated) | [FR-xx] | US-05 | [UC-xx] | Valid credentials | Token and user saved; redirected | [ ] | [ ] |
| T-LOGIN-UI-2 | UI (automated) | [FR-xx] | US-05 | [UC-xx] | Wrong password (401) | "Invalid email or password."; password cleared | [ ] | [ ] |
| T-LOGIN-UI-7 | UI (automated) | [FR-xx] | US-05 | [UC-xx] | Staff logs in with a saved adopter-only page | Lands on Review applications | [ ] | [ ] |
| T-ROLE-UI-1/2/3 | UI (automated) | [FR-xx] | US-05 | — | Open a staff page logged out, as Adopter, and as Staff | Login / clear message / page shown | [ ] | [ ] |
| T-AUTH-1/2 | UI (automated) | [FR-xx] | US-05 | — | Expired JWT on load; server 401 | Logged out in both cases | [ ] | [ ] |
| T-API-H1..H10, T-N-1..8, T-F-1, T-NAV-1..3 | Unit (automated) | — | — | — | Helper, normalizer and navbar tests | All pass | [ ] | [ ] |
| T-ACC-01 | Acceptance (manual) | FR-01 | US-01 | UC-01 | On the real server: filter by each species and status; search a breed | Results match the database | [ ] | [ ] |
| T-ACC-02 | Acceptance (manual) | FR-02 | US-02 | UC-01 | On the real server: open three profiles, including one non-Available | Correct details; Apply only for Available | [ ] | [ ] |
| T-ACC-03 | Acceptance (manual) | FR-08 | US-02 | UC-03 | Staff approves in one browser; adopter's profile is open in another | Within 30 s (or on tab focus) the badge changes from Available and Apply disappears | [ ] | [ ] |

**NFR evidence for 5.2:**
- **Search time:** open DevTools → Network, filter by Species, and record the duration of `GET /api/animals?...`. [Record the ms value and screenshot it.]
- **Usability and accessibility:** keyboard-only walkthrough (Tab from "Skip to content" through filters and cards), plus a screenshot at 390 px phone width.
- **Reliability:** stop the server and screenshot the "Cannot reach the server" message with Retry.
