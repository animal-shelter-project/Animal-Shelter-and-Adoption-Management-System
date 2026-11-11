import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { MANUAL_STATUS_CHANGES } from '../constants.js';
import { formatDate } from '../format.js';
import { useDebounced, useResource } from '../hooks.js';
import StatusBadge from './StatusBadge.jsx';

// Staff-only panel on the animal profile (proposal R-09, R-12):
//  - the animal's status history, oldest first, with date, who and why;
//  - a "Change status" control offering only the changes the server allows
//    (Pending is left to the application workflow, so it's never offered).
// After a change it refreshes the history and tells the profile to refresh,
// so the badge and the Apply button update at once.
// v2: choosing Adopted asks which adopter account adopted the animal (a
// walk-in adoption), so every adoption is on record. Adopted -> Available
// is labelled as a return.
const MAX_NOTE = 200;

export default function StaffStatusPanel({ animal, onChanged }) {
  const history = useResource(`history:${animal.id}`, (signal) =>
    api.getAnimalHistory(animal.id, { signal }),
  );
  const options = MANUAL_STATUS_CHANGES[animal.status] || [];
  // Kept here (not in the form) so it survives the form resetting after a change.
  const [done, setDone] = useState('');

  return (
    <section className="staff-panel" aria-labelledby="status-panel-title">
      <h2 id="status-panel-title">Status history</h2>
      <History {...history} />
      <h3 className="staff-panel-sub">Change status</h3>
      {done && (
        <div className="notice notice-success" role="status">
          {done}
        </div>
      )}
      {options.length > 0 ? (
        <ChangeStatusForm
          key={animal.status}
          animal={animal}
          options={options}
          onStart={() => setDone('')}
          onChanged={(updated) => {
            setDone(`Status changed to ${updated.status}.`);
            history.refresh();
            onChanged?.(updated);
          }}
        />
      ) : (
        <p className="status-note status-note-pending" data-testid="status-locked">
          {animal.name} has an adoption application under review. Approve or reject it on{' '}
          <Link to="/staff/applications">Review applications</Link> to change the status.
        </p>
      )}
    </section>
  );
}

function History({ data, error, loading, reload }) {
  if (loading && !data) return <p className="muted">Loading history…</p>;
  if (error) {
    return (
      <div className="notice error notice-row" role="alert">
        <span>Couldn't load the history: {error.message}</span>
        <button type="button" className="btn" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }
  if (!data?.length) return <p className="muted">No status changes recorded yet.</p>;
  return (
    <ol className="timeline" data-testid="status-history">
      {data.map((h, i) => (
        <li key={h.id || i}>
          <div className="timeline-head">
            <StatusBadge status={h.toStatus} />
            <span className="muted small">
              {h.fromStatus ? `From ${h.fromStatus}` : 'First status'} on {formatDate(h.changedAt)}
              {h.changedBy ? ` by ${h.changedBy}` : ''}
            </span>
          </div>
          {h.note && <p className="timeline-note">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

function ChangeStatusForm({ animal, options, onStart, onChanged }) {
  const [status, setStatus] = useState(options[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [adopterId, setAdopterId] = useState('');
  const [adopterQuery, setAdopterQuery] = useState('');
  const needsAdopter = status === 'Adopted';
  const q = useDebounced(adopterQuery, 300).trim();
  const adopters = useResource(needsAdopter ? `adopters:${q}` : 'adopters:off', (signal) =>
    needsAdopter ? api.listAdopters(q, { signal }) : Promise.resolve([]),
  );
  const returning = animal.status === 'Adopted' && status === 'Available';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (needsAdopter && !adopterId) {
      setError('Choose who adopted this animal.');
      document.getElementById('adopter-select')?.focus();
      return;
    }
    setSaving(true);
    setError('');
    onStart();
    try {
      const updated = await api.changeAnimalStatus(animal.id, status, note.trim(), {
        adopterId: needsAdopter ? adopterId : undefined,
      });
      setNote('');
      onChanged(updated); // the profile refreshes; the new status re-keys (resets) this form
    } catch (err) {
      setError(err.message || 'Could not change the status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="status-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="field-row">
        <div className="field">
          <label htmlFor="new-status">New status</label>
          <select id="new-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status-note">Note (optional)</label>
          <input
            id="status-note"
            type="text"
            maxLength={MAX_NOTE}
            placeholder={returning ? 'e.g. Returned: allergies in the family' : 'e.g. Went to a foster home'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      {returning && (
        <p className="muted small">This records a return: the adoption will be marked Returned.</p>
      )}
      {needsAdopter && (
        <div className="field-row adopter-pick">
          <div className="field">
            <label htmlFor="adopter-search">Find the adopter</label>
            <input
              id="adopter-search"
              type="search"
              placeholder="Name or email"
              value={adopterQuery}
              onChange={(e) => setAdopterQuery(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="adopter-select">Adopted by</label>
            <select id="adopter-select" value={adopterId} onChange={(e) => setAdopterId(e.target.value)}>
              <option value="">Choose an adopter…</option>
              {(adopters.data || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
            <span className="muted small">
              Not listed? Ask them to <Link to="/register">create an account</Link> first.
            </span>
          </div>
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Update status'}
      </button>
    </form>
  );
}
