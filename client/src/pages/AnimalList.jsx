import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import AnimalCard from '../components/AnimalCard.jsx';
import PetArt from '../components/PetArt.jsx';
import { SPECIES, STATUSES } from '../constants.js';
import { useDebounced, useDocumentTitle, useResource } from '../hooks.js';
import { canonicalAnimalStatus, matchesFilters } from '../normalize.js';

// US-01: browse and search animals by species, breed and status.
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

export default function AnimalList() {
  useDocumentTitle('Find an animal');
  const [searchParams, setSearchParams] = useSearchParams();
  const species = (searchParams.get('species') || '').trim();
  const breedParam = (searchParams.get('breed') || '').trim();
  const statusRaw = canonicalAnimalStatus(searchParams.get('status') || '');
  const status = STATUSES.includes(statusRaw) ? statusRaw : '';
  const filters = { species, breed: breedParam, status };

  // ---- breed box <-> URL --------------------------------------------------
  const [breedInput, setBreedInput] = useState(breedParam);
  const breed = useDebounced(breedInput, 300).trim();

  // URL changed some other way (Back button, Clear filters, shared link):
  // update the box during render (React's "adjust state on prop change").
  const [syncedBreedParam, setSyncedBreedParam] = useState(breedParam);
  if (breedParam !== syncedBreedParam) {
    setSyncedBreedParam(breedParam);
    if (breedInput.trim() !== breedParam) setBreedInput(breedParam);
  }

  function updateParam(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const v = (value || '').trim();
        if (v) next.set(key, v);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  // Typing (debounced) -> URL.
  const pushBreed = useEffectEvent((value) => {
    if (value !== breedParam) updateParam('breed', value);
  });
  useEffect(() => {
    pushBreed(breed);
  }, [breed]);

  // ---- data -------------------------------------------------------------
  const { data, previousData, error, loading, reload } = useResource(
    `animals?${species}|${breedParam}|${status}`,
    (signal) => api.listAnimals(filters, { signal }),
    { pollMs: 30000 },
  );
  const animals = data
    ? data.filter((a) => matchesFilters(a, filters))
    : loading
      ? previousData || null
      : null;

  // Remember every species we've seen so the dropdown can offer it.
  const [seen, setSeen] = useState({ from: null, list: [] });
  if (data && seen.from !== data) {
    const all = new Set(seen.list);
    data.forEach((a) => a.species && all.add(a.species));
    setSeen({ from: data, list: [...all] });
  }

  const speciesOptions = useMemo(() => {
    const known = new Set(SPECIES.map((s) => s.toLowerCase()));
    const extra = [];
    [...seen.list, species].forEach((s) => {
      if (s && !known.has(s.toLowerCase())) {
        known.add(s.toLowerCase());
        extra.push(s);
      }
    });
    return [...SPECIES, ...extra.sort()];
  }, [seen.list, species]);

  // Match the URL value to an option case-insensitively (?species=dog -> "Dog").
  const speciesValue =
    speciesOptions.find((s) => s.toLowerCase() === species.toLowerCase()) || species;

  const hasFilters = Boolean(species || status || breedParam || breedInput.trim());

  const clearFilters = () => {
    setBreedInput('');
    setSearchParams({}, { replace: true });
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
              value={status}
              onChange={(e) => updateParam('status', e.target.value)}
              aria-label="Status"
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
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
            <p className="empty-title">No animals match your search.</p>
            {hasFilters ? (
              <>
                <p className="muted small">Try a different species, breed or status.</p>
                <button type="button" className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            ) : (
              <p className="muted small">There are no animals listed right now. Please check back soon.</p>
            )}
          </div>
        )}

        {!error && animals?.length > 0 && (
          <>
            <p className="muted small" role="status" aria-live="polite">
              {animals.length} {animals.length === 1 ? 'animal' : 'animals'} found
              {loading ? ' · updating…' : ''}
            </p>
            <div className="grid" aria-busy={loading}>
              {animals.map((a) => (
                <AnimalCard key={a.id} animal={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
