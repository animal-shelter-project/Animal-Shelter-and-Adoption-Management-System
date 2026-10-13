# M1 edge cases: what's handled and where

Every row is covered by an automated test (ID in the last column) or was checked in the browser against the mock API. Useful for Sections 4.3 (limitations), 5.2 (NFRs) and 9 (testing).

## Talking to the backend

| Situation | What the client does | Where | Test |
|---|---|---|---|
| Backend is MongoDB (`_id`) rather than SQLite (`id`) | Uses whichever id it gets | `normalize.js` | T-N-1, T-SEARCH-7, T-PROFILE-4 |
| List comes back wrapped (`{ animals: [...] }`, `{ data: [...] }`) | Unwraps it | `normalize.js` | T-N-2 |
| Status spelling differs (`available`, `PENDING`, the plan's `Application Pending`) | Maps to the database values: Available / Pending / Adopted / Fostered | `normalize.js` | T-N-3 |
| Role casing differs (`staff`, `ADOPTER`) | Maps to Staff / Adopter | `normalize.js` | T-N-4, T-API-H6 |
| Unknown status (e.g. `Quarantine`) | Shown as-is in a neutral badge; Apply hidden | `normalize.js`, `StatusBadge` | T-N-3, T-N-7 |
| Server ignores a filter, or does exact instead of partial breed match | Same filters re-applied on the client | `matchesFilters` | T-SEARCH-4, T-N-8 |
| Mongo `populate()`d application (`animalId: { _id, name }`) | Flattened to an id and a name | `normalizeApplication` | T-N-6 |
| `photoUrl` is `javascript:` or `//other-site` | Ignored; species icon shown | `safeImageUrl` | T-N-5 |
| Image URL is broken | Falls back to the species icon | `AnimalPhoto` | browser |
| Validation errors as an array (`{ errors: [{ msg }] }`) | Joined into one message | `api.js` | T-API-H10 |
| Server down or network error | "Cannot reach the server…" plus Retry | `api.js`, pages | T-API-H7, T-ERR-1, browser |
| Server hangs | 10 s timeout, then "took too long" plus Retry | `api.js` | T-API-H8 |
| Slow server | "Loading…" on first load; later changes keep the old list visible with "updating…" | `AnimalList` | browser (`MOCK_DELAY`) |
| Rapid filter changes | Older requests cancelled; the last one always wins | `AnimalList` (AbortController) | browser |
| `.env` URL has a trailing slash | Normalized | `api.js` | browser |

## Login and sessions

| Situation | What the client does | Test |
|---|---|---|
| Wrong password | "Invalid email or password." (never says which); password cleared and focused | T-LOGIN-UI-2 |
| Empty or malformed email | Caught before any request is sent | T-LOGIN-UI-3 |
| Old token still stored when logging in | Not sent with the login request | T-API-H6 |
| JWT already expired when the page loads | Treated as logged out | T-API-H9, T-AUTH-1 |
| JWT expires while the page is open | Logged out at that moment; "Your session expired"; back to the same page after re-login | browser (`MOCK_TOKEN_TTL=3`) |
| Server returns 401 on any call | Logged out everywhere in the app | T-API-H5, T-AUTH-2 |
| Logout in another tab | This tab logs out too | browser |
| Malicious `from` redirect (`//evil.com`) | Ignored; goes to the home page | T-LOGIN-UI-5 |
| Different role logs in on the same tab (adopter's session ended on an adopter page, staff logs in) | Staff go to their own home page, not to a page that would refuse them. *This was a real bug found in testing, now fixed.* | T-LOGIN-UI-6, T-LOGIN-UI-7 |
| Logged out and opening a protected page | Sent to Login, then back to the exact URL (including `?query`) | T-ROLE-UI-1 |
| Wrong role on a protected page | Clear "for Staff accounts only" message | T-ROLE-UI-2 |
| Staff viewing a profile | See Edit, never Apply | T-UI-3 |

## Catalog (US-01, US-02, FR-08)

| Situation | What the client does | Test |
|---|---|---|
| Filters | Stored in the URL, so they're shareable and survive refresh | T-SEARCH-1, T-SEARCH-3 |
| Back button after opening a profile | Filters and breed box restored | browser |
| `?species=dog` (lowercase) or `?status=Banana` in a link | Case-insensitive match; invalid status ignored | T-SEARCH-6, browser |
| A species outside the default list (e.g. "Guinea Pig") | Added to the dropdown automatically | code only (not yet tested) |
| Breed search | Partial, case-insensitive, debounced 300 ms, trimmed, max 60 characters | T-SEARCH-5 |
| No matches vs. shelter empty | Different messages; "Clear filters" shown only when filters are set | T-SEARCH-2, T-ERR-2 |
| Clear filters | Resets the URL and the breed box | T-SEARCH-8 |
| Unknown id (404) or malformed id (400, e.g. bad ObjectId) | "Animal not found" | T-PROFILE-2, T-PROFILE-3 |
| Server error on a profile | Retry, not a misleading "not found" | T-PROFILE-5 |
| Status changes elsewhere (staff approves) | Refetched on tab focus (throttled to every 5 s) and every 30 s while visible; Apply disappears | browser |
| Background refresh fails | Current list or profile stays on screen | browser |
| Ages | `0.5` → "6 months", `"8 weeks"` kept as written, negative values hidden | T-F-1 |
| Very long names or descriptions | Wrap instead of overflowing; line breaks kept | CSS |

## Usability, accessibility and deployment

| Item | Detail |
|---|---|
| Tab titles | Each page sets one (e.g. "Buddy · Paws Shelter") |
| Scroll position | Opening a profile starts at the top; changing filters keeps your scroll position |
| Keyboard | A "Skip to content" link is the first tab stop; focus outlines visible; the login email field is focused on load |
| Screen readers | Labeled inputs, `role=alert` for errors, `role=status` for result counts, "Status:" prefix on badges, table caption |
| Color | Status text always shown, so color is never the only signal |
| Reduced motion | Transitions turned off when the OS asks for it |
| Phone | Checked at 390 px wide; no horizontal scroll |
| Crashes | An error boundary shows "Something went wrong" plus Reload instead of a white screen |
| Deploying (Render, Netlify or Vercel static) | `public/_redirects` and `vercel.json` make refreshing `/animals/3` work. On Render, add the rewrite `/*` → `/index.html` in the dashboard. |

## Possible future improvements (beyond the plan's requirements)

- Pagination, sorting, and a server-side text search on name.
- Real-time push (websockets). Status refresh uses focus and polling instead.
- Token refresh. Users log in again after 2 h, as the plan specifies.
- The token is kept in `localStorage`, which is standard for a class project. An httpOnly cookie would be safer in production.
- Internationalization.
