import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/useAuth.js';
import AnimalPhoto from '../components/AnimalPhoto.jsx';
import StaffStatusPanel from '../components/StaffStatusPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { canApply } from '../constants.js';
import { formatAge, formatDate } from '../format.js';
import { useDocumentTitle, useResource } from '../hooks.js';
import { ANIMAL_STATUS } from '../normalize.js';

// US-02: view one animal's profile.
//
// Nuances handled:
//  - Apply only when Available (T-UI-1), case-insensitive; Staff never see
//    Apply (they see Edit); logged-out users are told they'll log in first.
//  - Unknown or malformed IDs -> "Animal not found" (T-PROFILE-2), whether
//    the server answers 404 or 400.
//  - Navigating from one profile to another never shows the old animal.
//  - Status refreshes on tab focus and every 30 s while visible, so the badge
//    and Apply button update after staff approve or reject.
//  - A failed background refresh keeps the profile on screen.
const STATUS_NOTE = {
  [ANIMAL_STATUS.PENDING]: 'An adoption application for {name} is being reviewed.',
  [ANIMAL_STATUS.APPROVED]: '{name} has been approved for adoption.',
  [ANIMAL_STATUS.ADOPTED]: '{name} has found a home. Happy tails!',
  [ANIMAL_STATUS.FOSTERED]: '{name} is currently in foster care.',
};

export default function AnimalProfile() {
  const { id } = useParams();
  const { isStaff, isLoggedIn } = useAuth();
  // Set by the Add Animal form after a successful save.
  const added = useLocation().state?.added;
  const { data: animal, error, loading, reload, refresh } = useResource(
    `animal:${id}`,
    (signal) => api.getAnimal(id, { signal }),
    { pollMs: 30000 },
  );
  const notFound = error && (error.status === 404 || error.status === 400);

  useDocumentTitle(animal ? animal.name : notFound ? 'Not found' : 'Animal');

  if (loading) {
    return (
      <div className="page narrow">
        <p className="muted" role="status">
          Loading…
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page narrow">
        <div className="empty" data-testid="not-found">
          <h1>Animal not found</h1>
          <p className="muted">We couldn't find an animal with ID “{id}”. It may have been removed.</p>
          <Link to="/animals" className="btn">
            Back to all animals
          </Link>
        </div>
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="page narrow">
        <div className="notice error notice-row" role="alert">
          <span>{error?.message || 'Something went wrong.'}</span>
          <button type="button" className="btn" onClick={reload}>
            Retry
          </button>
        </div>
        <Link to="/animals">← Back to all animals</Link>
      </div>
    );
  }

  const facts = [
    ['Species', animal.species],
    ['Breed', animal.breed],
    ['Age', formatAge(animal.age, animal.ageMonths)],
    ['Sex', animal.sex],
    ['Size', animal.size],
    ['Intake date', animal.intakeDate ? formatDate(animal.intakeDate) : null],
  ].filter(([, v]) => v);

  const available = canApply(animal);
  const note = STATUS_NOTE[animal.status] || '{name} is not open for new applications right now.';

  return (
    <div className="page narrow">
      <Link to="/animals" className="back">
        ← All animals
      </Link>
      {added && (
        <div className="notice notice-success notice-row" role="status" data-testid="added-notice">
          <span>
            {added.name} was added
            {added.status === ANIMAL_STATUS.AVAILABLE ? ' and is now listed for adoption' : ''}.
          </span>
          {isStaff && (
            <Link to="/staff/animals/new" className="btn">
              Add another animal
            </Link>
          )}
        </div>
      )}
      <article className="profile">
        <AnimalPhoto animal={animal} large />
        <div className="profile-body">
          <StatusBadge status={animal.status} />
          <h1 className="profile-name">{animal.name}</h1>

          {facts.length > 0 && (
            <dl className="facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {animal.description && <p className="description">{animal.description}</p>}

          <div className="actions">
            {available && !isStaff && (
              <>
                <Link
                  to={`/animals/${encodeURIComponent(animal.id)}/apply`}
                  className="btn btn-primary"
                  data-testid="apply-button"
                >
                  <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.6h1.8c.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
                  </svg>
                  Apply to adopt {animal.name}
                </Link>
                {!isLoggedIn && (
                  <span className="muted small">You'll be asked to log in first.</span>
                )}
              </>
            )}
            {!available && (
              <p
                className={`status-note status-note-${String(animal.status).toLowerCase()}`}
                data-testid="not-available-note"
              >
                {note.replace('{name}', animal.name)}
              </p>
            )}
            {isStaff && (
              <Link to={`/staff/animals/${encodeURIComponent(animal.id)}/edit`} className="btn">
                Edit animal
              </Link>
            )}
          </div>
        </div>
      </article>
      {isStaff && <StaffStatusPanel animal={animal} onChanged={refresh} />}
    </div>
  );
}
