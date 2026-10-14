# M1 day-by-day checklist (Ammar)

The code is already written. This list covers getting it into the repo the way the plan requires (branches, pull requests, story-ID commits), plus the evidence to collect.

## Mon (tonight)
- [ ] `git config user.name "Ammar Baig"` and `git config user.email "<your GitHub email>"` (Section 11)
- [ ] Wait for M3's skeleton on `main`, then `git pull`
- [ ] Branch `feature/shell`. Copy in the shell: `App.jsx`, `main.jsx`, `api.js`, `normalize.js`, `format.js`, `constants.js`, `hooks.js`, `index.css`, `components/` (Navbar, ErrorBoundary, ScrollToTop), the placeholder pages, `mock-api/`, the test setup, `api.test.js`, `normalize.test.js`, and `docs/wireframes/`
  - `git commit -m "Shell: routing, navbar, API helper, placeholder pages"`
- [ ] Open a PR, ask a teammate to review, merge, then message the group: "Shell is on main. Use `request()` from `src/api.js`."
- [ ] Move the Jira cards. Screenshot the board.
- [ ] End of day: all three can run server + client and see the seeded animals.

## Tue
- [ ] `feature/US-01-search-animals`: AnimalList, AnimalCard, StatusBadge, AnimalPhoto, plus `AnimalList.test.jsx`
  - commits like `US-01: add species/breed/status filters`, `US-01: empty-state message`
- [ ] `feature/US-02-animal-profile`: AnimalProfile, plus `AnimalProfile.test.jsx`
- [ ] `feature/US-05-login-ui`: Login, AuthContext, RequireRole, plus `Login.test.jsx`, `Auth.test.jsx` and `Navbar.test.jsx`
- [ ] Ask M3 which shape the server returns (`id` or `_id`, bare array or `{ animals }`). The client handles both, but the 6.6 diagram and report should say which one you actually use.
- [ ] PR → review → merge each one. Screenshot the list, profile and login against the **real** server.
- [ ] Check the server field names match the client contract (see `client/README.md`). Adjust if M3 named something differently.

## Wed
- [ ] Badge refresh check (T-ACC-03): approve in a staff browser, switch back to the adopter tab, and confirm the badge changes
- [ ] My applications: log in as the adopter and confirm Max (Pending) and Daisy (Approved) are listed
- [ ] Fix UI bugs from the team demo. Take the captioned Section 4.1 screenshots.
- [ ] `npm test` and record the real results in 9.2
- [ ] Check the 6.6 diagram's server names against M3's code. Re-render with `mmdc -i 6.6-search-animals-sequence.mmd -o 6.6-search-animals-sequence.png`
- [ ] NFR: record the search time from the Network tab

## Thu
- [ ] Finish Sections 1, 2, 4, 7.3, your 5.1 rows and your 9.2 rows from `docs/report/M1-report-sections.md`

## Fri
- [ ] Review a section you didn't write, go through the Section 14 checklist, test from a fresh clone, and submit
