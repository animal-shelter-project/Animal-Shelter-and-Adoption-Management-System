import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { FORM_CHOICES } from '../siteContent.js';
import Icon from './Icon.jsx';

// The public sign-up forms: foster, volunteer, and "send us a message".
// Each one checks its answers in the browser first (every problem shown at
// once, next to its field), then sends them to POST /api/inquiries. Staff
// read them on the Inbox page.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function contactProblems(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Enter your name.';
  if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  return errors;
}

// Shared submit logic: validate, send, show the thank-you or the errors.
function useInquiry(kind, validate) {
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(null);
  const summaryRef = useRef(null);

  const submit = async (values, build) => {
    const problems = validate(values);
    setErrors(problems);
    setFormError('');
    if (Object.keys(problems).length) {
      setFormError('Please fix the highlighted answers.');
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaving(true);
    try {
      const saved = await api.sendInquiry({ kind, ...build(values) });
      setSent(saved || { name: values.name });
    } catch (err) {
      setErrors(err.body?.fields || {});
      setFormError(err.message || 'We couldn’t send that. Please try again.');
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSaving(false);
    }
  };
  return { errors, formError, saving, sent, setSent, submit, summaryRef };
}

function Field({ id, label, error, children, hint }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span className="muted small" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {children}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

const describedBy = (id, error, hint) => [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

function ContactFields({ prefix, values, set, errors }) {
  return (
    <div className="field-row">
      <Field id={`${prefix}-name`} label="Your name" error={errors.name}>
        <input
          id={`${prefix}-name`}
          type="text"
          autoComplete="name"
          maxLength={80}
          value={values.name}
          onChange={set('name')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy(`${prefix}-name`, errors.name)}
        />
      </Field>
      <Field id={`${prefix}-email`} label="Email" error={errors.email}>
        <input
          id={`${prefix}-email`}
          type="email"
          autoComplete="email"
          maxLength={120}
          value={values.email}
          onChange={set('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy(`${prefix}-email`, errors.email)}
        />
      </Field>
      <Field id={`${prefix}-phone`} label="Phone (optional)" error={errors.phone}>
        <input
          id={`${prefix}-phone`}
          type="tel"
          autoComplete="tel"
          maxLength={30}
          value={values.phone}
          onChange={set('phone')}
        />
      </Field>
    </div>
  );
}

// Checkboxes that look like chips. `value` is the list of chosen options.
function ChipGroup({ legend, options, value, onChange, error, name }) {
  const errorId = useId();
  return (
    <fieldset className="chip-group" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
      <legend>{legend}</legend>
      <div className="chip-options">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <label key={o} className={`chip-check${on ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                name={name}
                checked={on}
                onChange={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              />
              <Icon name={on ? 'check' : 'paw'} className="chip-icon" />
              {o}
            </label>
          );
        })}
      </div>
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </fieldset>
  );
}

function Notice({ formError, summaryRef }) {
  if (!formError) return null;
  return (
    <div className="notice error" role="alert" tabIndex={-1} ref={summaryRef}>
      {formError}
    </div>
  );
}

function ThankYou({ title, text, onAgain }) {
  return (
    <div className="thanks" role="status" data-reveal="pop">
      <span className="thanks-icon" aria-hidden="true">
        <Icon name="heart" />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="actions">
        <Link to="/animals" className="btn btn-cta">
          Meet the animals
        </Link>
        <button type="button" className="btn btn-ghost" onClick={onAgain}>
          Send another
        </button>
      </div>
    </div>
  );
}

const EMPTY_CONTACT = { name: '', email: '', phone: '' };

export function FosterForm() {
  const [values, setValues] = useState({ ...EMPTY_CONTACT, animals: [], length: '', hasOtherPets: '', message: '' });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const form = useInquiry('Foster', (v) => {
    const errors = contactProblems(v);
    if (v.animals.length === 0) errors.animals = 'Choose at least one kind of animal.';
    if (!v.length) errors.length = 'Choose how long you can foster.';
    return errors;
  });
  const { errors } = form;

  if (form.sent) {
    return (
      <ThankYou
        title={`Thank you, ${form.sent.name}!`}
        text="Our foster team will call or email you within two days to talk about which animal would suit your home."
        onAgain={() => form.setSent(null)}
      />
    );
  }

  return (
    <form
      className="form-card signup-form"
      noValidate
      aria-label="Foster sign-up"
      onSubmit={(e) => {
        e.preventDefault();
        form.submit(values, (v) => ({
          name: v.name,
          email: v.email,
          phone: v.phone,
          message: v.message,
          details: { animals: v.animals, length: v.length, hasOtherPets: v.hasOtherPets === 'yes' },
        }));
      }}
    >
      <Notice formError={form.formError} summaryRef={form.summaryRef} />
      <ContactFields prefix="foster" values={values} set={set} errors={errors} />
      <ChipGroup
        legend="Which animals could you foster?"
        name="foster-animals"
        options={FORM_CHOICES.fosterAnimals}
        value={values.animals}
        onChange={(animals) => setValues((v) => ({ ...v, animals }))}
        error={errors.animals}
      />
      <fieldset className="chip-group" aria-invalid={Boolean(errors.length)}>
        <legend>How long could you foster?</legend>
        <div className="chip-options">
          {FORM_CHOICES.fosterLengths.map((o) => (
            <label key={o} className={`chip-check${values.length === o ? ' is-on' : ''}`}>
              <input type="radio" name="foster-length" value={o} checked={values.length === o} onChange={set('length')} />
              <Icon name={values.length === o ? 'check' : 'clock'} className="chip-icon" />
              {o}
            </label>
          ))}
        </div>
        {errors.length && <span className="field-error">{errors.length}</span>}
      </fieldset>
      <fieldset className="chip-group">
        <legend>Do you have pets at home?</legend>
        <div className="chip-options">
          {[
            ['yes', 'Yes'],
            ['no', 'No'],
          ].map(([v, l]) => (
            <label key={v} className={`chip-check${values.hasOtherPets === v ? ' is-on' : ''}`}>
              <input type="radio" name="foster-pets" value={v} checked={values.hasOtherPets === v} onChange={set('hasOtherPets')} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="foster-message" label="Anything else we should know? (optional)">
        <textarea id="foster-message" rows={3} maxLength={1000} value={values.message} onChange={set('message')} />
      </Field>
      <button type="submit" className="btn btn-cta btn-large" disabled={form.saving}>
        {form.saving ? 'Sending…' : 'Sign me up to foster'}
      </button>
    </form>
  );
}

export function VolunteerForm() {
  const [values, setValues] = useState({ ...EMPTY_CONTACT, interests: [], availability: [], over16: false, message: '' });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const form = useInquiry('Volunteer', (v) => {
    const errors = contactProblems(v);
    if (v.interests.length === 0) errors.interests = 'Choose at least one way to help.';
    if (v.availability.length === 0) errors.availability = 'Tick at least one time you are free.';
    if (!v.over16) errors.over16 = 'Volunteers must be 16 or older.';
    return errors;
  });
  const { errors } = form;
  const toggleSlot = (slot) =>
    setValues((v) => ({
      ...v,
      availability: v.availability.includes(slot) ? v.availability.filter((s) => s !== slot) : [...v.availability, slot],
    }));

  if (form.sent) {
    return (
      <ThankYou
        title={`Welcome aboard, ${form.sent.name}!`}
        text="We’ll email you within two days to book your orientation. Bring comfy shoes!"
        onAgain={() => form.setSent(null)}
      />
    );
  }

  return (
    <form
      className="form-card signup-form"
      noValidate
      aria-label="Volunteer sign-up"
      onSubmit={(e) => {
        e.preventDefault();
        form.submit(values, (v) => ({
          name: v.name,
          email: v.email,
          phone: v.phone,
          message: v.message,
          details: { interests: v.interests, availability: v.availability, over16: v.over16 },
        }));
      }}
    >
      <Notice formError={form.formError} summaryRef={form.summaryRef} />
      <ContactFields prefix="volunteer" values={values} set={set} errors={errors} />
      <ChipGroup
        legend="How would you like to help?"
        name="volunteer-interests"
        options={FORM_CHOICES.volunteerInterests}
        value={values.interests}
        onChange={(interests) => setValues((v) => ({ ...v, interests }))}
        error={errors.interests}
      />
      <fieldset className="chip-group" aria-invalid={Boolean(errors.availability)}>
        <legend>When are you free? Tick every time that works.</legend>
        <table className="slot-grid">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Day</span>
              </th>
              {FORM_CHOICES.times.map((t) => (
                <th scope="col" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORM_CHOICES.days.map((d) => (
              <tr key={d}>
                <th scope="row">{d}</th>
                {FORM_CHOICES.times.map((t) => {
                  const slot = `${d} ${t}`;
                  const on = values.availability.includes(slot);
                  return (
                    <td key={t}>
                      <label className={`slot${on ? ' is-on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleSlot(slot)} aria-label={`${d} ${t}`} />
                        <Icon name={on ? 'check' : 'minus'} />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" aria-live="polite">
          {values.availability.length === 0
            ? 'No times chosen yet.'
            : `${values.availability.length} time${values.availability.length === 1 ? '' : 's'} chosen.`}
        </p>
        {errors.availability && <span className="field-error">{errors.availability}</span>}
      </fieldset>
      <label className="check-line">
        <input
          type="checkbox"
          checked={values.over16}
          onChange={(e) => setValues((v) => ({ ...v, over16: e.target.checked }))}
          aria-invalid={Boolean(errors.over16)}
        />
        I am 16 or older
      </label>
      {errors.over16 && <span className="field-error">{errors.over16}</span>}
      <Field id="volunteer-message" label="Anything else? (optional)">
        <textarea id="volunteer-message" rows={3} maxLength={1000} value={values.message} onChange={set('message')} />
      </Field>
      <button type="submit" className="btn btn-cta btn-large" disabled={form.saving}>
        {form.saving ? 'Sending…' : 'Sign me up to volunteer'}
      </button>
    </form>
  );
}

export function ContactForm() {
  const [values, setValues] = useState({ ...EMPTY_CONTACT, topic: '', message: '' });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const form = useInquiry('Contact', (v) => {
    const errors = contactProblems(v);
    if (!v.topic) errors.topic = 'Choose a topic.';
    if (v.message.trim().length < 5) errors.message = 'Write a short message (at least 5 characters).';
    return errors;
  });
  const { errors } = form;

  if (form.sent) {
    return (
      <ThankYou
        title="Message sent!"
        text="Thanks for getting in touch. We reply to every message within two working days."
        onAgain={() => form.setSent(null)}
      />
    );
  }

  return (
    <form
      className="form-card signup-form"
      noValidate
      aria-label="Contact form"
      onSubmit={(e) => {
        e.preventDefault();
        form.submit(values, (v) => ({
          name: v.name,
          email: v.email,
          phone: v.phone,
          message: v.message,
          details: { topic: v.topic },
        }));
      }}
    >
      <Notice formError={form.formError} summaryRef={form.summaryRef} />
      <ContactFields prefix="contact" values={values} set={set} errors={errors} />
      <Field id="contact-topic" label="What is it about?" error={errors.topic}>
        <select
          id="contact-topic"
          value={values.topic}
          onChange={set('topic')}
          aria-invalid={Boolean(errors.topic)}
          aria-describedby={describedBy('contact-topic', errors.topic)}
        >
          <option value="">Choose…</option>
          {FORM_CHOICES.contactTopics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field id="contact-message" label="Your message" error={errors.message}>
        <textarea
          id="contact-message"
          rows={4}
          maxLength={1000}
          value={values.message}
          onChange={set('message')}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy('contact-message', errors.message)}
        />
      </Field>
      <button type="submit" className="btn btn-cta btn-large" disabled={form.saving}>
        {form.saving ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
