import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { OTHER_SPECIES, TEXT_LIMITS, validateAnimalForm } from '../animalForm.js';
import AnimalPhoto from '../components/AnimalPhoto.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { SPECIES, STATUSES } from '../constants.js';
import { formatAge } from '../format.js';
import { useDocumentTitle } from '../hooks.js';
import EditAnimalForm from './EditAnimalForm.jsx';

// Proposal R-01 / US-01: staff add a new animal (Staff only; see App.jsx).
//
// Nuances handled:
//  - Name, species, breed and age are required; age must be a whole number
//    0-40. Age is a text box with a numeric keypad (inputMode) rather than
//    type="number", which behaves inconsistently across browsers. Every problem is shown at once, next to its field, and the first
//    bad field gets focus. Nothing is sent until the form is valid.
//  - The server checks again; its field errors are shown the same way.
//  - Status defaults to Available (acceptance criterion), so the animal shows
//    up in the public list immediately.
//  - "Other" species lets staff type any species (e.g. "Guinea Pig").
//  - A live preview shows the card adopters will see.
//  - Can't double-submit. On success: the new animal's profile, with a
//    confirmation and a link to add another.
//  - /staff/animals/:id/edit is in EditAnimalForm.jsx.); it shows a clear note.
const EMPTY = { name: '', species: 'Dog', otherSpecies: '', breed: '', age: '', status: 'Available' };
const FIELD_ORDER = ['name', 'species', 'breed', 'age', 'status'];

export default function StaffAnimalForm() {
  const { id } = useParams();
  useDocumentTitle(id ? 'Edit animal' : 'Add an animal');
  if (id) return <EditAnimalForm id={id} />;
  return <AddAnimalForm />;
}

function AddAnimalForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
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
    const { fields, clean } = validateAnimalForm(values);
    if (Object.keys(fields).length) {
      showErrors(fields, 'Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const animal = await api.createAnimal(clean);
      navigate(`/animals/${encodeURIComponent(animal.id)}`, {
        state: { added: { name: animal.name, status: animal.status } },
      });
    } catch (err) {
      setSubmitting(false);
      const fields = err.body?.fields;
      if (err.status === 400 && fields && typeof fields === 'object') {
        showErrors(fields, err.message || 'Please fix the highlighted fields.');
      } else {
        setFormError(err.message || 'Could not add the animal. Please try again.');
      }
    }
  };

  const fieldProps = (key) => ({
    id: `animal-${key}`,
    'aria-invalid': errors[key === 'otherSpecies' ? 'species' : key] ? true : undefined,
    'aria-describedby': errors[key === 'otherSpecies' ? 'species' : key]
      ? `animal-${key === 'otherSpecies' ? 'species' : key}-error`
      : undefined,
  });

  // Live preview of the card adopters will see.
  const previewSpecies =
    values.species === OTHER_SPECIES ? values.otherSpecies.trim() : values.species;
  const preview = {
    name: values.name.trim().replace(/\s+/g, ' ') || 'Your new friend',
    species: previewSpecies || 'Other',
    breed: values.breed.trim(),
    age: /^\d+$/.test(values.age.trim()) ? Number(values.age) : null,
    status: values.status,
  };
  const previewDetails = [preview.breed, formatAge(preview.age)].filter(Boolean).join(', ');

  return (
    <div className="page">
      <div className="page-head">
        <h1>Add an animal</h1>
        <p className="muted">New animals are listed for adoption as soon as you save them.</p>
      </div>

      <div className="add-layout">
        <form className="form-card" onSubmit={handleSubmit} noValidate aria-describedby="add-msg">
          <div id="add-msg">
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
              placeholder="e.g. Labrador Retriever, or Mixed"
              maxLength={TEXT_LIMITS.breed}
              value={values.breed}
              onChange={set('breed')}
            />
            <FieldError name="breed" errors={errors} />
          </div>

          <div className="field-row">
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
            <div className="field">
              <label htmlFor="animal-status">Status</label>
              <select {...fieldProps('status')} value={values.status} onChange={set('status')}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <FieldError name="status" errors={errors} />
            </div>
          </div>

          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add animal'}
            </button>
            <Link to="/staff/applications" className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="preview" aria-label="Preview">
          <p className="preview-label">How adopters will see it</p>
          <div className="card preview-card" aria-hidden="true">
            <div className="card-photo">
              <AnimalPhoto animal={preview} />
              <span className="card-status">
                <StatusBadge status={preview.status} />
              </span>
            </div>
            <div className="card-body">
              <p className="card-name">{preview.name}</p>
              <p className="card-details">
                <span className="species-chip">{preview.species}</span>
                {previewDetails && <span className="muted">{previewDetails}</span>}
              </p>
            </div>
          </div>
        </aside>
      </div>
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
