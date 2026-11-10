import { useState } from 'react';
import { api } from '../api.js';
import { RECORD_TYPES } from '../constants.js';
import { formatDate } from '../format.js';
import { useResource } from '../hooks.js';

// Staff-only panel on the profile (proposal R-10): the animal's medical
// records, newest first, and a form to add one.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function MedicalRecordsPanel({ animal }) {
  const records = useResource(`medical:${animal.id}`, (signal) => api.medicalRecords(animal.id, { signal }));
  const [values, setValues] = useState({ recordDate: today(), recordType: 'Vaccination', notes: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!values.recordDate || values.recordDate > today()) {
      setMessage({ kind: 'error', text: 'Choose a date that is today or earlier.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.addMedicalRecord(animal.id, { ...values, notes: values.notes.trim() });
      setValues((v) => ({ ...v, notes: '' }));
      setMessage({ kind: 'success', text: 'Medical record added.' });
      records.refresh();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Could not add the record.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="staff-panel" aria-labelledby="medical-title">
      <h2 id="medical-title">Medical records</h2>
      {records.loading && !records.data && <p className="muted">Loading records…</p>}
      {records.error && (
        <div className="notice error notice-row" role="alert">
          <span>Couldn't load the records: {records.error.message}</span>
          <button type="button" className="btn" onClick={records.reload}>
            Retry
          </button>
        </div>
      )}
      {records.data?.length === 0 && <p className="muted">No medical records yet.</p>}
      {records.data?.length > 0 && (
        <ul className="record-list" data-testid="medical-records">
          {records.data.map((r) => (
            <li key={r.id}>
              <b>{r.recordType}</b> <span className="muted small">{formatDate(r.recordDate)}</span>
              {r.notes && <p>{r.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <h3 className="staff-panel-sub">Add a record</h3>
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}
      <form className="status-form" onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <div className="field">
            <label htmlFor="record-date">Date</label>
            <input id="record-date" type="date" max={today()} value={values.recordDate} onChange={set('recordDate')} />
          </div>
          <div className="field">
            <label htmlFor="record-type">Type</label>
            <select id="record-type" value={values.recordType} onChange={set('recordType')}>
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ width: '100%' }}>
          <label htmlFor="record-notes">Notes</label>
          <input id="record-notes" type="text" maxLength={500} placeholder="e.g. Rabies vaccine, next due in 1 year" value={values.notes} onChange={set('notes')} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add record'}
        </button>
      </form>
    </section>
  );
}
