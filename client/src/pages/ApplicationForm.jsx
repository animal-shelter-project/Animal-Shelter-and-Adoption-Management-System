import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { MAX_DETAILS, validateApplicationForm } from '../applicationForm.js';
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
const EMPTY = { householdDetails: '' };

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
    document.getElementById('application-householdDetails')?.focus();
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
      await api.submitApplication(animal.id, clean.householdDetails);
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

        <div className="field">
          <label htmlFor="application-householdDetails">About your household</label>
          <textarea
            {...fieldProps('householdDetails')}
            rows={6}
            maxLength={MAX_DETAILS}
            placeholder="Who lives with you, your home and yard, and any other pets."
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