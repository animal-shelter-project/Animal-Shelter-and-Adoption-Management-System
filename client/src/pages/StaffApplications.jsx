import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { answersSummary } from '../applicationForm.js';
import { formatDate } from '../format.js';
import { useDocumentTitle, useResource } from '../hooks.js';

// Proposal R-06, R-07 / US-06, US-07 (UC-03): staff review pending adoption
// applications (Staff only; see App.jsx).
//
// Nuances handled:
//  - Lists only Pending applications, oldest first, with the animal, the
//    applicant's email, the date and their household details.
//  - Approve makes the animal Adopted and Reject makes it Available again;
//    the server does both changes together (R-07).
//  - One decision at a time: the buttons are disabled while a request is
//    running, so a double click can't send it twice.
//  - After a decision the list reloads. That also happens after a refused
//    one (e.g. 409, someone else decided first), so the page shows what is
//    really still pending, along with the server's reason.
//  - v2: the applicant's name and phone, their answers to the structured
//    questions, private staff notes, and a "Decided" tab with past decisions
//    (who decided and when).

export default function StaffApplications() {
  useDocumentTitle('Review applications');
  const [view, setView] = useState('pending'); // 'pending' | 'decided'
  const { data: apps, error, loading, reload, refresh } = useResource(
    `applications:${view}`,
    (signal) => (view === 'pending' ? api.pendingApplications({ signal }) : api.staffApplications('decided', { signal })),
  );
  const [busyId, setBusyId] = useState(null);
  const [done, setDone] = useState('');
  const [actionError, setActionError] = useState('');
  const [notesOpen, setNotesOpen] = useState(null); // application id
  const [notesDraft, setNotesDraft] = useState('');

  const decide = async (app, decision) => {
    if (busyId) return;
    setBusyId(app.id);
    setDone('');
    setActionError('');
    try {
      await api.decideApplication(app.id, decision);
      setDone(
        decision === 'approve'
          ? `Approved the application for ${app.animalName}. ${app.animalName} is now Adopted.`
          : `Rejected the application for ${app.animalName}. ${app.animalName} is Available again.`,
      );
    } catch (err) {
      setActionError(err.message || 'Could not save the decision. Please try again.');
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const openNotes = (app) => {
    setNotesOpen(notesOpen === app.id ? null : app.id);
    setNotesDraft(app.staffNotes || '');
  };

  const saveNotes = async (app) => {
    if (busyId) return;
    setBusyId(app.id);
    setActionError('');
    try {
      await api.saveApplicationNotes(app.id, notesDraft);
      setDone(`Notes saved for ${app.applicantName || app.applicantEmail}'s application.`);
      setNotesOpen(null);
    } catch (err) {
      setActionError(err.message || 'Could not save the notes.');
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const switchView = (next) => {
    setView(next);
    setDone('');
    setActionError('');
    setNotesOpen(null);
  };

  const pendingView = view === 'pending';

  return (
    <div className="page">
      <div className="page-head">
        <h1>Review applications</h1>
        <p className="muted">
          {pendingView
            ? 'Pending adoption applications, oldest first.'
            : 'Past decisions, most recent first.'}
        </p>
      </div>

      <div className="tabs" role="group" aria-label="Which applications">
        <button type="button" className={`chip${pendingView ? ' chip-active' : ''}`} aria-pressed={pendingView} onClick={() => switchView('pending')}>
          Waiting for review
        </button>
        <button type="button" className={`chip${!pendingView ? ' chip-active' : ''}`} aria-pressed={!pendingView} onClick={() => switchView('decided')}>
          Decided
        </button>
      </div>

      {done && (
        <div className="notice notice-success" role="status">
          {done}
        </div>
      )}
      {actionError && (
        <div className="notice error" role="alert">
          {actionError}
        </div>
      )}

      {loading && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {error && (
        <div className="notice error notice-row" role="alert">
          <span>{error.message}</span>
          <button type="button" className="btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {apps && apps.length === 0 && (
        <div className="empty">
          <p>{pendingView ? 'No applications are waiting for review.' : 'No decisions yet.'}</p>
          <Link to="/animals" className="btn">
            Back to the animals
          </Link>
        </div>
      )}
      {apps && apps.length > 0 && (
        <div className="table-wrap">
          <table className="table review-table">
            <caption className="visually-hidden">
              {pendingView ? 'Pending adoption applications' : 'Decided adoption applications'}
            </caption>
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Applicant</th>
                <th scope="col">Submitted</th>
                <th scope="col">Household details</th>
                <th scope="col">{pendingView ? 'Decision' : 'Outcome'}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <Fragment key={app.id}>
                  <tr>
                    <td>
                      <Link to={`/animals/${encodeURIComponent(app.animalId)}`}>
                        {app.animalName || `Animal #${app.animalId}`}
                      </Link>
                    </td>
                    <td>
                      {app.applicantName && <b className="applicant-name">{app.applicantName}</b>}
                      <span className="applicant-line">{app.applicantEmail || '—'}</span>
                      {app.applicantPhone && (
                        <a className="applicant-line" href={`tel:${app.applicantPhone.replace(/[^\d+]/g, '')}`}>
                          {app.applicantPhone}
                        </a>
                      )}
                    </td>
                    <td>{formatDate(app.submittedAt)}</td>
                    <td>
                      {answersSummary(app.answers) && <span className="answers">{answersSummary(app.answers)}</span>}
                      <span>{app.householdDetails || '—'}</span>
                      {app.staffNotes && notesOpen !== app.id && (
                        <span className="staff-note">
                          <b>Staff notes:</b> {app.staffNotes}
                        </span>
                      )}
                    </td>
                    <td>
                      {pendingView ? (
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busyId !== null}
                            aria-label={`Approve application for ${app.animalName}`}
                            onClick={() => decide(app, 'approve')}
                          >
                            {busyId === app.id ? 'Saving…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={busyId !== null}
                            aria-label={`Reject application for ${app.animalName}`}
                            onClick={() => decide(app, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="outcome">
                          <StatusBadge status={app.status} />
                          <span className="muted small">
                            {formatDate(app.decidedAt)}
                            {app.decidedBy ? ` · ${app.decidedBy}` : ''}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="link-button small"
                        aria-expanded={notesOpen === app.id}
                        onClick={() => openNotes(app)}
                      >
                        {app.staffNotes ? 'Edit notes' : 'Add notes'}
                      </button>
                    </td>
                  </tr>
                  {notesOpen === app.id && (
                    <tr className="notes-row">
                      <td colSpan={5}>
                        <label htmlFor={`notes-${app.id}`}>Staff notes (only staff see these)</label>
                        <textarea
                          id={`notes-${app.id}`}
                          rows={3}
                          maxLength={1000}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="e.g. Called landlord on 11/10: pets allowed."
                        />
                        <div className="actions">
                          <button type="button" className="btn btn-primary" disabled={busyId !== null} onClick={() => saveNotes(app)}>
                            Save notes
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setNotesOpen(null)}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
