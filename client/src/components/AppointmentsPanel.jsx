import { useState } from 'react';
import { api } from '../api.js';
import { APPOINTMENT_PURPOSES as PURPOSES } from '../constants.js';
import { formatWhen } from '../format.js';
import { useResource } from '../hooks.js';
import StatusBadge from './StatusBadge.jsx';

// Staff-only panel on the profile (proposal R-11): the animal's
// appointments, soonest first, a form to book one (the server refuses a
// time that overlaps another appointment for the same animal), and Done /
// Cancel for scheduled ones.
const LENGTHS = [15, 30, 45, 60, 90, 120];

export default function AppointmentsPanel({ animal }) {
  const list = useResource(`appointments:${animal.id}`, (signal) => api.appointments(animal.id, { signal }));
  const [values, setValues] = useState({ startsAt: '', durationMinutes: '30', purpose: 'Vet visit', notes: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const run = async (action, success) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'success', text: success });
      list.refresh();
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Something went wrong.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.startsAt) {
      setMessage({ kind: 'error', text: 'Choose a date and time.' });
      return;
    }
    const ok = await run(
      () =>
        api.bookAppointment(animal.id, {
          startsAt: values.startsAt,
          durationMinutes: Number(values.durationMinutes),
          purpose: values.purpose,
          notes: values.notes.trim(),
        }),
      `${values.purpose} booked for ${formatWhen(values.startsAt)}.`,
    );
    if (ok) setValues((v) => ({ ...v, startsAt: '', notes: '' }));
  };

  return (
    <section className="staff-panel" aria-labelledby="appointments-title">
      <h2 id="appointments-title">Appointments</h2>
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}
      {list.loading && !list.data && <p className="muted">Loading appointments…</p>}
      {list.error && (
        <div className="notice error notice-row" role="alert">
          <span>Couldn't load appointments: {list.error.message}</span>
          <button type="button" className="btn" onClick={list.reload}>
            Retry
          </button>
        </div>
      )}
      {list.data?.length === 0 && <p className="muted">No appointments booked.</p>}
      {list.data?.length > 0 && (
        <ul className="record-list" data-testid="appointments">
          {list.data.map((a) => (
            <li key={a.id}>
              <div className="record-head">
                <b>{a.purpose}</b>
                <span className="muted small">
                  {formatWhen(a.startsAt)} · {a.durationMinutes} min
                </span>
                {a.status !== 'Scheduled' && <StatusBadge status={a.status} />}
              </div>
              {a.notes && <p>{a.notes}</p>}
              {a.status === 'Scheduled' && (
                <div className="actions">
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.setAppointmentStatus(a.id, 'Done'), 'Marked as done.')}>
                    Mark done
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.setAppointmentStatus(a.id, 'Cancelled'), 'Appointment cancelled.')}>
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="staff-panel-sub">Book an appointment</h3>
      <form className="status-form" onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <div className="field">
            <label htmlFor="appt-when">Date and time</label>
            <input id="appt-when" type="datetime-local" value={values.startsAt} onChange={set('startsAt')} />
          </div>
          <div className="field">
            <label htmlFor="appt-length">Length</label>
            <select id="appt-length" value={values.durationMinutes} onChange={set('durationMinutes')}>
              {LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="appt-purpose">For</label>
            <select id="appt-purpose" value={values.purpose} onChange={set('purpose')}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ width: '100%' }}>
          <label htmlFor="appt-notes">Notes (optional)</label>
          <input id="appt-notes" type="text" maxLength={300} placeholder="e.g. Dr. Patel, bring vaccine card" value={values.notes} onChange={set('notes')} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Book appointment'}
        </button>
      </form>
    </section>
  );
}
