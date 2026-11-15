import { useState } from 'react';
import { api } from '../api.js';
import { formatDate } from '../format.js';
import { useResource } from '../hooks.js';

const EMPTY_FORM = {
  recordDate: '',
  recordType: '',
  notes: '',
};

export default function StaffMedicalRecordsPanel({ animal }) {
  const records = useResource(
    `medical-records:${animal.id}`,
    (signal) => api.listMedicalRecords(animal.id, { signal }),
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setFormError('');
    setSuccess('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const errors = {};
    if (!form.recordDate) errors.recordDate = 'Choose a record date.';
    if (!form.recordType.trim()) errors.recordType = 'Enter a record type.';

    setFieldErrors(errors);
    setFormError('');
    setSuccess('');

    if (Object.keys(errors).length > 0) return;

    setSaving(true);

    try {
      await api.createMedicalRecord(animal.id, {
        recordDate: form.recordDate,
        recordType: form.recordType.trim(),
        notes: form.notes.trim(),
      });

      setForm(EMPTY_FORM);
      setSuccess('Medical record added.');
      records.refresh();
    } catch (error) {
      const message = error.message || 'Could not add the medical record.';

      if (/recordDate/i.test(message)) {
        setFieldErrors({ recordDate: message });
      } else if (/recordType/i.test(message)) {
        setFieldErrors({ recordType: message });
      } else if (/notes/i.test(message)) {
        setFieldErrors({ notes: message });
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="staff-panel" aria-labelledby="medical-records-title">
      <h2 id="medical-records-title">Medical records</h2>

      {success && (
        <div className="notice notice-success" role="status">
          {success}
        </div>
      )}

      {formError && (
        <div className="notice error" role="alert">
          {formError}
        </div>
      )}

      <form className="status-form" onSubmit={submit} noValidate>
        <div className="field-row">
          <div className="field">
            <label htmlFor="medical-record-date">Record date</label>
            <input
              id="medical-record-date"
              type="date"
              value={form.recordDate}
              onChange={(event) => updateField('recordDate', event.target.value)}
              aria-invalid={Boolean(fieldErrors.recordDate)}
              aria-describedby={
                fieldErrors.recordDate ? 'medical-record-date-error' : undefined
              }
              required
            />
            {fieldErrors.recordDate && (
              <span className="field-error" id="medical-record-date-error">
                {fieldErrors.recordDate}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="medical-record-type">Record type</label>
            <input
              id="medical-record-type"
              type="text"
              value={form.recordType}
              onChange={(event) => updateField('recordType', event.target.value)}
              placeholder="e.g. Vaccination"
              aria-invalid={Boolean(fieldErrors.recordType)}
              aria-describedby={
                fieldErrors.recordType ? 'medical-record-type-error' : undefined
              }
              required
            />
            {fieldErrors.recordType && (
              <span className="field-error" id="medical-record-type-error">
                {fieldErrors.recordType}
              </span>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="medical-record-notes">Notes (optional)</label>
          <input
            id="medical-record-notes"
            type="text"
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Add details about the visit or treatment"
            aria-invalid={Boolean(fieldErrors.notes)}
            aria-describedby={
              fieldErrors.notes ? 'medical-record-notes-error' : undefined
            }
          />
          {fieldErrors.notes && (
            <span className="field-error" id="medical-record-notes-error">
              {fieldErrors.notes}
            </span>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add medical record'}
        </button>
      </form>

      <h3 className="staff-panel-sub">Record history</h3>

      {records.loading && !records.data && (
        <p className="muted" role="status">
          Loading medical records…
        </p>
      )}

      {records.error && (
        <div className="notice error notice-row" role="alert">
          <span>Couldn’t load medical records: {records.error.message}</span>
          <button type="button" className="btn" onClick={records.reload}>
            Retry
          </button>
        </div>
      )}

      {!records.loading && !records.error && records.data?.length === 0 && (
        <p className="muted">No medical records have been added for {animal.name}.</p>
      )}

      {records.data?.length > 0 && (
        <ul className="timeline" data-testid="medical-record-list">
          {records.data.map((record) => (
            <li key={record.id}>
              <div className="timeline-head">
                <strong>{record.recordType}</strong>
                <span className="muted small">{formatDate(record.recordDate)}</span>
              </div>
              {record.notes && <p className="timeline-note">{record.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}