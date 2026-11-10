import { useEffect, useEffectEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import AnimalCard from '../components/AnimalCard.jsx';
import PetArt from '../components/PetArt.jsx';
import { AGE_GROUPS, ALL_STATUSES, DEFAULT_STATUS, SPECIES, STATUSES } from '../constants.js';
import { useDebounced, useDocumentTitle, useResource } from '../hooks.js';
import { ageInYears } from '../format.js';
import { canonicalAnimalStatus, matchesFilters } from '../normalize.js';

// Browse and search animals (proposal R-02/R-03, US-02/US-03; plan US-01).
//
// Default view: only Available animals (R-02). Visitors can still pick
// another status, or "All statuses", to see every animal with its badge.
// Filters: species, age group (R-03), breed and status; all combine (AND).
//
// Nuances handled:
//  - Filters live in the URL (?species=Dog&breed=lab), so results can be
//    bookmarked/shared and Back/Forward restore them (the breed box follows).
//  - Breed typing is debounced (300 ms); older requests are cancelled so the
//    list never shows stale results.
//  - An unknown ?status= value in the URL is ignored instead of breaking.
//  - Species not in the default list (e.g. "Guinea Pig") still get an option.
//  - The same filters are re-applied on the client as a safety net.
//  - First load shows "Loading"; later changes keep the list on screen.
//  - Errors show a Retry button; the list refreshes on tab focus and every 30 s.
//  - v2: search by name, sort (longest stay first by default, newest, name,
//    youngest, oldest), 12 animals
//    per page, and staff can include archived animals.
const PAGE_SIZE = 12;
const SORTS = [
  ['longest', 'Longest at the shelter'],
  ['newest', 'Newest arrivals'],
  ['name', 'Name (A–Z)'],
  ['youngest', 'Youngest first'],
  ['oldest', 'Oldest first'],
];
const byAge = (a) => ageInYears(a.age, a.ageMonths);
// Animals with an unknown age always go last.
const compareAge = (a, b, dir) => {
  const x = byAge(a);
  const y = byAge(b);
  if (x == null || y == null) return (x == null) - (y == null);
  return dir * (x - y);
};
// Ids grow as animals arrive (numbers in SQLite, hex strings in MongoDB).
const compareId = (a, b) => {
  const x = Number(a.id);
  const y = Number(b.id);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  return String(a.id).localeCompare(String(b.id));
};
const SORTERS = {
  longest: compareId,
  newest: (a, b) => compareId(b, a),
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  youngest: (a, b) => compareAge(a, b, 1),
  oldest: (a, b) => compareAge(a, b, -1),
};

// A text box kept in sync with a URL parameter: typing updates the URL after
// a 300 ms pause, and Back / Clear filters / a shared link update the box
// (during render: React's "adjust state on prop change").
function useUrlSearchBox(paramValue, commit) {
  const [input, setInput] = useState(paramValue);
  const debounced = useDebounced(input, 300).trim();
  const [synced, setSynced] = useState(paramValue);
  if (paramValue !== synced) {
    setSynced(paramValue);
    if (input.trim() !== paramValue) setInput(paramValue);
  }
  const push = useEffectEvent((value) => {
    if (value !== paramValue) commit(value);
  });
  useEffect(() => {
    push(debounced);
  }, [debounced]);
  return [input, setInput];
}
const QUICK_SPECIES = [
  ['Everyone', ''],
  ['Dogs', 'Dog'],
  ['Cats', 'Cat'],
  ['Rabbits', 'Rabbit'],
];

// The three friends peeking over the bottom of the welcome banner.
const HERO_PETS = [
  { id: 'cat', species: 'Cat', breed: 'Domestic Shorthair' },
  { id: 'dog', species: 'Dog', breed: 'Labrador Retriever' },
  { id: 'rabbit', species: 'Rabbit', breed: 'Holland Lop' },
];

// Default species plus any other species seen in the data or the URL
// (e.g. "Guinea Pig"), so every species can be picked in the dropdown.
function buildSpeciesOptions(seenList, current) {
  const known = new Set(SPECIES.map((s) => s.toLowerCase()));
  const extra = [];
  [...seenList, current].forEach((s) => {
    if (s && !known.has(s.toLowerCase())) {
      known.add(s.toLowerCase());
      extra.push(s);
    }
  });
  return [...SPECIES, ...extra.sort()];
}

export default function AnimalList() {
  useDocumentTitle('Find an animal');
  const [searchParams, setSearchParams] = useSearchParams();
  const species = (searchParams.get('species') || '').trim();
  const breedParam = (searchParams.get('breed') || '').trim();
  // ?status absent (or unknown) -> Available; ?status=all -> every status.
  const statusParam = (searchParams.get('status') || '').trim();
  const showAll = statusParam.toLowerCase() === ALL_STATUSES;
  const statusRaw = canonicalAnimalStatus(statusParam);
  const status = showAll ? '' : STATUSES.includes(statusRaw) ? statusRaw : DEFAULT_STATUS;
  const statusChoice = showAll ? ALL_STATUSES : status;
  const nameParam = (searchParams.get('name') || '').trim();
  const sortParam = (searchParams.get('sort') || '').trim();
  const sort = SORTERS[sortParam] ? sortParam : 'longest';
  const pageParam = Number(searchParams.get('page')) || 1;
  const { isStaff } = useAuth();
  const includeArchived = isStaff && searchParams.get('archived') === 'include';
  const ageParam = (searchParams.get('age') || '').trim().toLowerCase();
  const age = AGE_GROUPS.some((g) => g.value === ageParam) ? ageParam : '';
  // Sent to the server. Age is applied here in the browser.
  const serverFilters = {
    species,
    breed: breedParam,
    name: nameParam,
    status,
    archived: includeArchived ? 'include' : '',
  };
  const filters = { ...serverFilters, age };

  // ---- search boxes <-> URL -----------------------------------------------
  const [breedInput, setBreedInput] = useUrlSearchBox(breedParam, (v) => updateParam('breed', v));
  const [nameInput, setNameInput] = useUrlSearchBox(nameParam, (v) => updateParam('name', v));

  function updateParam(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const v = (value || '').trim();
        if (v) next.set(key, v);
        else next.delete(key);
        // Any other change (a filter, the sort) goes back to page 1.
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  // ---- data -------------------------------------------------------------
  const { data, previousData, error, loading, reload } = useResource(
    `animals?${species}|${breedParam}|${nameParam}|${status}|${includeArchived}`,
    (signal) => api.listAnimals(serverFilters, { signal }),
    { pollMs: 30000 },
  );
  const source = data || (loading ? previousData : null);
  const animals = source
    ? source.filter((a) => matchesFilters(a, filters)).sort(SORTERS[sort])
    : null;
  const pageCount = animals ? Math.max(1, Math.ceil(animals.length / PAGE_SIZE)) : 1;
  const page = Math.min(Math.max(1, Math.floor(pageParam)), pageCount);
  const pageAnimals = animals ? animals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : null;

  // Remember every species we've seen so the dropdown can offer it.
  const [seen, setSeen] = useState({ from: null, list: [] });
  if (data && seen.from !== data) {
    const all = new Set(seen.list);
    data.forEach((a) => a.species && all.add(a.species));
    setSeen({ from: data, list: [...all] });
  }

  // Cheap to compute; the React Compiler memoizes it, so no useMemo needed.
  const speciesOptions = buildSpeciesOptions(seen.list, species);

  // Match the URL value to an option case-insensitively (?species=dog -> "Dog").
  const speciesValue =
    speciesOptions.find((s) => s.toLowerCase() === species.toLowerCase()) || species;

  // "Filtered" = anything beyond the default view of all Available animals.
  const hasFilters = Boolean(
    species ||
      age ||
      breedParam ||
      breedInput.trim() ||
      nameParam ||
      nameInput.trim() ||
      statusChoice !== DEFAULT_STATUS,
  );

  const clearFilters = () => {
    setBreedInput('');
    setNameInput('');
    setSearchParams({}, { replace: true });
  };

  const goToPage = (n) => {
    updateParam('page', n > 1 ? String(n) : '');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">Who’s coming home with you?</h1>
          <p className="hero-lede">
            Every animal here is waiting for a family. Find a friend, read their story, and apply to
            adopt.
          </p>
          <div className="quick-species" role="group" aria-label="Show only">
            {QUICK_SPECIES.map(([label, value]) => {
              const active = value.toLowerCase() === species.toLowerCase();
              return (
                <button
                  key={label}
                  type="button"
                  className={`chip${active ? ' chip-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => updateParam('species', value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hero-pets" aria-hidden="true">
          {HERO_PETS.map((pet) => (
            <PetArt key={pet.id} animal={pet} className={`hero-pet hero-pet-${pet.id}`} />
          ))}
        </div>
      </section>

      <div className="page page-list">
        <form className="filters" role="search" aria-label="Filter animals" onSubmit={(e) => e.preventDefault()}>
          <label>
            Name
            <input
              type="search"
              placeholder="e.g. Buddy"
              value={nameInput}
              maxLength={60}
              onChange={(e) => setNameInput(e.target.value)}
              aria-label="Name"
            />
          </label>
          <label>
            Species
            <select
              value={speciesValue}
              onChange={(e) => updateParam('species', e.target.value)}
              aria-label="Species"
            >
              <option value="">All species</option>
              {speciesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Age
            <select value={age} onChange={(e) => updateParam('age', e.target.value)} aria-label="Age">
              <option value="">Any age</option>
              {AGE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Breed
            <input
              type="search"
              placeholder="e.g. Labrador"
              value={breedInput}
              maxLength={60}
              onChange={(e) => setBreedInput(e.target.value)}
              aria-label="Breed"
            />
          </label>
          <label>
            Status
            <select
              value={statusChoice}
              onChange={(e) =>
                updateParam('status', e.target.value === DEFAULT_STATUS ? '' : e.target.value)
              }
              aria-label="Status"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={ALL_STATUSES}>All statuses</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value === 'longest' ? '' : e.target.value)}
              aria-label="Sort"
            >
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {isStaff && (
            <label className="check">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => updateParam('archived', e.target.checked ? 'include' : '')}
              />
              Show archived
            </label>
          )}
          {hasFilters && (
            <button type="button" className="btn btn-ghost" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </form>

        {error && (
          <div className="notice error notice-row" role="alert">
            <span>{error.message}</span>
            <button type="button" className="btn" onClick={reload}>
              Retry
            </button>
          </div>
        )}

        {loading && !animals && (
          <div className="grid">
            <span className="visually-hidden" role="status">
              Loading animals…
            </span>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card card-skeleton" aria-hidden="true">
                <div className="photo" />
                <div className="card-body">
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && animals?.length === 0 && (
          <div className="empty" data-testid="empty-message">
            <PetArt animal={{ id: 'empty', species: 'Dog', breed: 'Beagle' }} className="empty-art" />
            {hasFilters ? (
              <>
                <p className="empty-title">No animals match your search.</p>
                <p className="muted small">Try another species, age, breed or status.</p>
                <button type="button" className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="empty-title">No animals are currently available for adoption.</p>
                <p className="muted small">New friends arrive often. Please check back soon.</p>
              </>
            )}
          </div>
        )}

        {!error && animals?.length > 0 && (
          <>
            <p className="muted small" role="status" aria-live="polite">
              {animals.length} {animals.length === 1 ? 'animal' : 'animals'} found
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
              {loading ? ' · updating…' : ''}
            </p>
            <div className="grid" aria-busy={loading}>
              {pageAnimals.map((a) => (
                <AnimalCard key={a.id} animal={a} />
              ))}
            </div>
            {pageCount > 1 && (
              <nav className="pager" aria-label="Pages">
                <button type="button" className="btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  ← Previous
                </button>
                <span className="muted">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={page >= pageCount}
                  onClick={() => goToPage(page + 1)}
                >
                  Next →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
