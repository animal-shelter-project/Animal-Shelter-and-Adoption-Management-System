import { useState } from 'react';
import { api } from '../api.js';
import { RECORD_TYPES } from '../constants.js';
import { formatDate } from '../format.js';
import { useResource } from '../hooks.js';

// Staff-only panel on the profile (proposal R-10): the animal's medical
// records, newest first, a form to add one, and Edit / Delete on each record
// to correct a mistake.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dateProblem = (value) => (!value || value > today() ? 'Choose a date that is today or earlier.' : null);

// Inline form that replaces a record while staff correct it.
function EditRecordForm({ record, saving, onSave, onCancel }) {
  const [values, setValues] = useState({
    recordDate: record.recordDate,
    recordType: record.recordType,
    notes: record.notes || '',
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const id = (name) => `edit-${name}-${record.id}`;
  const types = RECORD_TYPES.includes(values.recordType) ? RECORD_TYPES : [values.recordType, ...RECORD_TYPES];

  return (
    <form
      className="status-form record-edit"
      aria-label={`Edit the ${record.recordType} record`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...values, notes: values.notes.trim() });
      }}
      noValidate
    >
      <div className="field-row">
        <div className="field">
          <label htmlFor={id('date')}>Date</label>
          <input id={id('date')} type="date" max={today()} value={values.recordDate} onChange={set('recordDate')} />
        </div>
        <div className="field">
          <label htmlFor={id('type')}>Type</label>
          <select id={id('type')} value={values.recordType} onChange={set('recordType')}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field field-wide">
        <label htmlFor={id('notes')}>Notes</label>
        <input id={id('notes')} type="text" maxLength={500} value={values.notes} onChange={set('notes')} />
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function MedicalRecordsPanel({ animal }) {
  const records = useResource(`medical:${animal.id}`, (signal) => api.medicalRecords(animal.id, { signal }));
  const [values, setValues] = useState({ recordDate: today(), recordType: 'Vaccination', notes: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [listMessage, setListMessage] = useState(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const problem = dateProblem(values.recordDate);
    if (problem) {
      setMessage({ kind: 'error', text: problem });
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
      setMessage({ kind: 'error', text: err.message || "We couldn’t add the record. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (record, changes) => {
    const problem = dateProblem(changes.recordDate);
    if (problem) {
      setListMessage({ kind: 'error', text: problem });
      return;
    }
    setBusyId(record.id);
    setListMessage(null);
    try {
      await api.updateMedicalRecord(animal.id, record.id, changes);
      setEditingId(null);
      setListMessage({ kind: 'success', text: 'Record updated.' });
      records.refresh();
    } catch (err) {
      setListMessage({ kind: 'error', text: err.message || "We couldn’t save the change. Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (record) => {
    const ok = window.confirm?.(
      `Delete the ${record.recordType} record from ${formatDate(record.recordDate)}? This can't be undone.`,
    );
    if (ok === false) return;
    setBusyId(record.id);
    setListMessage(null);
    try {
      await api.deleteMedicalRecord(animal.id, record.id);
      if (editingId === record.id) setEditingId(null);
      setListMessage({ kind: 'success', text: 'Record deleted.' });
      records.refresh();
    } catch (err) {
      setListMessage({ kind: 'error', text: err.message || "We couldn’t delete the record. Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="staff-panel" aria-labelledby="medical-title">
      <h2 id="medical-title">Medical records</h2>
      {records.loading && !records.data && <p className="muted">Loading records…</p>}
      {records.error && (
        <div className="notice error notice-row" role="alert">
          <span>We couldn’t load the records: {records.error.message}</span>
          <button type="button" className="btn" onClick={records.reload}>
            Retry
          </button>
        </div>
      )}
      {listMessage && (
        <div
          className={`notice ${listMessage.kind === 'error' ? 'error' : 'notice-success'}`}
          role={listMessage.kind === 'error' ? 'alert' : 'status'}
        >
          {listMessage.text}
        </div>
      )}
      {records.data?.length === 0 && <p className="muted">No medical records yet. Add the first one below.</p>}
      {records.data?.length > 0 && (
        <ul className="record-list" data-testid="medical-records">
          {records.data.map((r) => (
            <li key={r.id}>
              {editingId === r.id ? (
                <EditRecordForm
                  record={r}
                  saving={busyId === r.id}
                  onSave={(changes) => saveEdit(r, changes)}
                  onCancel={() => {
                    setEditingId(null);
                    setListMessage(null);
                  }}
                />
              ) : (
                <>
                  <div className="record-head">
                    <b>{r.recordType}</b> <span className="muted small">{formatDate(r.recordDate)}</span>
                  </div>
                  {r.notes && <p>{r.notes}</p>}
                  <div className="actions record-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      aria-label={`Edit the ${r.recordType} record from ${formatDate(r.recordDate)}`}
                      disabled={busyId !== null}
                      onClick={() => {
                        setEditingId(r.id);
                        setListMessage(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small btn-danger"
                      aria-label={`Delete the ${r.recordType} record from ${formatDate(r.recordDate)}`}
                      disabled={busyId !== null}
                      onClick={() => remove(r)}
                    >
                      {busyId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </>
              )}
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
        <div className="field field-wide">
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
