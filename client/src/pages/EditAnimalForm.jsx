import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { OTHER_SPECIES, TEXT_LIMITS, validateAnimalForm } from '../animalForm.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { SPECIES } from '../constants.js';
import { useResource } from '../hooks.js';

// Proposal R-01 / US-06: staff edit an existing animal's details
// (Staff only; see App.jsx and StaffAnimalForm).
//
// Nuances handled:
//  - The animal is loaded first and the form starts with its current values.
//    An unknown ID shows "Animal not found".
//  - Same rules as the Add Animal form (animalForm.js): every problem is shown
//    next to its field, and nothing is sent until the form is valid. The
//    server's field errors are shown the same way.
//  - The status is shown but not edited here. Status changes are checked and
//    logged by the status panel on the profile (R-09, R-12), so this form
//    never sends a status.
//  - Can't double-submit. After saving, the page stays open with a
//    confirmation and a link back to the profile.
const FIELD_ORDER = ['name', 'species', 'breed', 'age'];

export default function EditAnimalForm({ id }) {
  const { data: animal, error, loading, reload } = useResource(
    `animal:${id}`,
    (signal) => api.getAnimal(id, { signal }),
  );

  if (loading) {
    return (
      <div className="page narrow">
        <p className="muted" role="status">
          Loading…
        </p>
      </div>
    );
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <div className="page narrow">
        <div className="notice error notice-row" role="alert">
          <span>{notFound ? 'Animal not found.' : error.message}</span>
          {!notFound && (
            <button type="button" className="btn" onClick={reload}>
              Retry
            </button>
          )}
        </div>
        <Link to="/animals" className="btn">
          Back to the animals
        </Link>
      </div>
    );
  }

  if (!animal) return null;
  return <EditForm key={animal.id} animal={animal} />;
}

// Turns a saved animal into the form's starting values. A species that isn't
// in the list is shown as "Other" with its name filled in.
function toValues(animal) {
  const known = SPECIES.find(
    (s) => s !== OTHER_SPECIES && s.toLowerCase() === animal.species.toLowerCase(),
  );
  return {
    name: animal.name,
    species: known || OTHER_SPECIES,
    otherSpecies: known ? '' : animal.species,
    breed: animal.breed,
    age: animal.age == null ? '' : String(animal.age),
  };
}

function EditForm({ animal }) {
  const [values, setValues] = useState(() => toValues(animal));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setDone('');
    // Clear a field's error as soon as it is edited, and the summary once
    // every field error is gone.
    const field = key === 'otherSpecies' ? 'species' : key;
    if (errors[field]) {
      const next = { ...errors };
      delete next[field];
      setErrors(next);
      if (!Object.keys(next).length) setFormError('');
    }
  };

  const showErrors = (fields, message) => {
    setErrors(fields);
    setFormError(message);
    const first = FIELD_ORDER.find((f) => fields[f]);
    const target =
      first === 'species' && values.species === OTHER_SPECIES ? 'otherSpecies' : first;
    if (target) document.getElementById(`animal-${target}`)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const { fields, clean } = validateAnimalForm({ ...values, status: animal.status });
    if (Object.keys(fields).length) {
      showErrors(fields, 'Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    setDone('');
    try {
      const details = { ...clean };
      delete details.status; // changed from the profile, not here
      const updated = await api.updateAnimal(animal.id, details);
      setDone(`Saved changes to ${updated.name}.`);
    } catch (err) {
      const fields = err.body?.fields;
      if (err.status === 400 && fields && typeof fields === 'object') {
        showErrors(fields, err.message || 'Please fix the highlighted fields.');
      } else {
        setFormError(err.message || 'Could not save the changes. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldProps = (key) => ({
    id: `animal-${key}`,
    'aria-invalid': errors[key === 'otherSpecies' ? 'species' : key] ? true : undefined,
    'aria-describedby': errors[key === 'otherSpecies' ? 'species' : key]
      ? `animal-${key === 'otherSpecies' ? 'species' : key}-error`
      : undefined,
  });

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Edit {animal.name}</h1>
        <p className="muted">
          Current status: <StatusBadge status={animal.status} />. To change it, use the status
          panel on the animal’s profile.
        </p>
      </div>

      <form className="form-card" onSubmit={handleSubmit} noValidate aria-describedby="edit-msg">
        <div id="edit-msg">
          {done && (
            <div className="notice notice-success" role="status">
              {done}
            </div>
          )}
          {formError && (
            <div className="notice error" role="alert">
              {formError}
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="animal-name">Name</label>
          <input
            {...fieldProps('name')}
            type="text"
            autoComplete="off"
            maxLength={TEXT_LIMITS.name}
            value={values.name}
            onChange={set('name')}
          />
          <FieldError name="name" errors={errors} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="animal-species">Species</label>
            <select {...fieldProps('species')} value={values.species} onChange={set('species')}>
              {SPECIES.filter((s) => s !== OTHER_SPECIES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={OTHER_SPECIES}>Other…</option>
            </select>
            {values.species !== OTHER_SPECIES && <FieldError name="species" errors={errors} />}
          </div>
          {values.species === OTHER_SPECIES && (
            <div className="field">
              <label htmlFor="animal-otherSpecies">Which species?</label>
              <input
                {...fieldProps('otherSpecies')}
                type="text"
                placeholder="e.g. Guinea Pig"
                maxLength={TEXT_LIMITS.species}
                value={values.otherSpecies}
                onChange={set('otherSpecies')}
              />
              <FieldError name="species" errors={errors} />
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="animal-breed">Breed</label>
          <input
            {...fieldProps('breed')}
            type="text"
            maxLength={TEXT_LIMITS.breed}
            value={values.breed}
            onChange={set('breed')}
          />
          <FieldError name="breed" errors={errors} />
        </div>

        <div className="field">
          <label htmlFor="animal-age">Age (years)</label>
          <input
            {...fieldProps('age')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            placeholder="0 for under a year"
            value={values.age}
            onChange={set('age')}
          />
          <FieldError name="age" errors={errors} />
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
          <Link to={`/animals/${encodeURIComponent(animal.id)}`} className="btn btn-ghost">
            Back to the profile
          </Link>
        </div>
      </form>
    </div>
  );
}

function FieldError({ name, errors }) {
  if (!errors[name]) return null;
  return (
    <span className="field-error" id={`animal-${name}-error`}>
      {errors[name]}
    </span>
  );
}