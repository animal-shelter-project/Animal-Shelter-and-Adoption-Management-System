import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  EMPTY_APPLICATION,
  HOME_TYPES,
  MAX_DETAILS,
  MAX_OTHER_PETS,
  validateApplicationForm,
} from '../applicationForm.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { useDocumentTitle, useResource } from '../hooks.js';

// Proposal R-05 / US-05: an adopter applies for an Available animal
// (Adopter only; see App.jsx).
//
// Nuances handled:
//  - The animal is loaded first. An unknown ID shows "Animal not found", and
//    an animal that is not Available shows a note instead of the form (R-08).
//    The server checks again and answers 409.
//  - Household details are required, up to 1000 characters. The error is
//    shown next to the field and nothing is sent until the form is valid.
//    The server's field errors are shown the same way.
//  - Can't double-submit. On success: My applications, with a confirmation.
//  - v2: structured questions (home, own/rent, landlord, yard, people,
//    other pets, hours alone) so staff can compare applicants quickly.
const EMPTY = EMPTY_APPLICATION;
const FIELD_ORDER = ['homeType', 'ownOrRent', 'landlordOk', 'hasYard', 'adults', 'children', 'hoursAlone', 'otherPets', 'householdDetails'];

export default function ApplicationForm() {
  const { id } = useParams();
  useDocumentTitle('Apply to adopt');
  const navigate = useNavigate();
  const { data: animal, error, loading, reload } = useResource(
    `animal:${id}`,
    (signal) => api.getAnimal(id, { signal }),
  );

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    // Clear a field's error as soon as it is edited, and the summary once
    // every field error is gone.
    if (errors[key]) {
      const next = { ...errors };
      delete next[key];
      setErrors(next);
      if (!Object.keys(next).length) setFormError('');
    }
  };

  const showErrors = (fields, message) => {
    setErrors(fields);
    setFormError(message);
    const first = FIELD_ORDER.find((f) => fields[f]);
    if (first) document.getElementById(`application-${first}`)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const { fields, clean } = validateApplicationForm(values);
    if (Object.keys(fields).length) {
      showErrors(fields, 'Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await api.submitApplication(animal.id, clean.householdDetails, clean.answers);
      navigate('/my-applications', { state: { applied: { animalName: animal.name } } });
    } catch (err) {
      setSubmitting(false);
      const fields = err.body?.fields;
      if (err.status === 400 && fields && typeof fields === 'object') {
        showErrors(fields, err.message || 'Please fix the highlighted fields.');
      } else {
        // Includes 409: the animal is no longer Available.
        setFormError(err.message || 'Could not submit the application. Please try again.');
      }
    }
  };

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

  if (animal.status !== 'Available') {
    return (
      <div className="page narrow">
        <div className="placeholder">
          <h1>Adoption application</h1>
          <p>
            <strong>{animal.name}</strong> <StatusBadge status={animal.status} />
          </p>
          <p className="muted">{animal.name} isn’t available for applications right now.</p>
          <Link to={`/animals/${encodeURIComponent(animal.id)}`} className="btn">
            Back to the profile
          </Link>
        </div>
      </div>
    );
  }

  const fieldProps = (key) => ({
    id: `application-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `application-${key}-error` : undefined,
  });

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Apply to adopt {animal.name}</h1>
        <p className="muted">
          {animal.name} <StatusBadge status={animal.status} />
        </p>
      </div>

      <form className="form-card" onSubmit={handleSubmit} noValidate aria-describedby="apply-msg">
        <div id="apply-msg">
          {formError && (
            <div className="notice error" role="alert">
              {formError}
            </div>
          )}
        </div>

        <fieldset className="field good-with">
          <legend>Your home</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor="application-homeType">Type of home</label>
              <select {...fieldProps('homeType')} value={values.homeType} onChange={set('homeType')}>
                <option value="">Choose…</option>
                {HOME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldError name="homeType" errors={errors} />
            </div>
            <div className="field">
              <label htmlFor="application-ownOrRent">Own or rent?</label>
              <select {...fieldProps('ownOrRent')} value={values.ownOrRent} onChange={set('ownOrRent')}>
                <option value="">Choose…</option>
                <option value="Own">Own</option>
                <option value="Rent">Rent</option>
              </select>
              <FieldError name="ownOrRent" errors={errors} />
            </div>
            {values.ownOrRent === 'Rent' && (
              <div className="field">
                <label htmlFor="application-landlordOk">Landlord allows pets?</label>
                <select {...fieldProps('landlordOk')} value={values.landlordOk} onChange={set('landlordOk')}>
                  <option value="">Choose…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <FieldError name="landlordOk" errors={errors} />
              </div>
            )}
            <div className="field">
              <label htmlFor="application-hasYard">Fenced yard?</label>
              <select {...fieldProps('hasYard')} value={values.hasYard} onChange={set('hasYard')}>
                <option value="">Choose…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              <FieldError name="hasYard" errors={errors} />
            </div>
          </div>
        </fieldset>

        <fieldset className="field good-with">
          <legend>Your household</legend>
          <div className="field-row">
            {[
              ['adults', 'Adults', '1 or more'],
              ['children', 'Children', '0 if none'],
              ['hoursAlone', 'Hours alone on a typical day', '0 to 24'],
            ].map(([key, label, placeholder]) => (
              <div className="field" key={key}>
                <label htmlFor={`application-${key}`}>{label}</label>
                <input
                  {...fieldProps(key)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={2}
                  placeholder={placeholder}
                  value={values[key]}
                  onChange={set(key)}
                />
                <FieldError name={key} errors={errors} />
              </div>
            ))}
          </div>
          <div className="field">
            <label htmlFor="application-otherPets">Other pets (optional)</label>
            <input
              {...fieldProps('otherPets')}
              type="text"
              maxLength={MAX_OTHER_PETS}
              placeholder="e.g. One older cat, very calm"
              value={values.otherPets}
              onChange={set('otherPets')}
            />
            <FieldError name="otherPets" errors={errors} />
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="application-householdDetails">Anything else we should know?</label>
          <textarea
            {...fieldProps('householdDetails')}
            rows={6}
            maxLength={MAX_DETAILS}
            placeholder="Your experience with pets, your daily routine, why this animal…"
            value={values.householdDetails}
            onChange={set('householdDetails')}
          />
          <FieldError name="householdDetails" errors={errors} />
          <span className="muted">
            {values.householdDetails.length}/{MAX_DETAILS}
          </span>
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
          <Link to={`/animals/${encodeURIComponent(animal.id)}`} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function FieldError({ name, errors }) {
  if (!errors[name]) return null;
  return (
    <span className="field-error" id={`application-${name}-error`}>
      {errors[name]}
    </span>
  );
}