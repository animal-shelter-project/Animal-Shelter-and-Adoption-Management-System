import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
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
export default function StaffApplications() {
  useDocumentTitle('Review applications');
  const { data: apps, error, loading, reload, refresh } = useResource(
    'applications:pending',
    (signal) => api.pendingApplications({ signal }),
  );
  const [busyId, setBusyId] = useState(null);
  const [done, setDone] = useState('');
  const [actionError, setActionError] = useState('');

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

  return (
    <div className="page">
      <div className="page-head">
        <h1>Review applications</h1>
        <p className="muted">Pending adoption applications, oldest first.</p>
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
          <p>No applications are waiting for review.</p>
          <Link to="/animals" className="btn">
            Back to the animals
          </Link>
        </div>
      )}
      {apps && apps.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Pending adoption applications</caption>
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Applicant</th>
                <th scope="col">Submitted</th>
                <th scope="col">Household details</th>
                <th scope="col">Decision</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <Link to={`/animals/${encodeURIComponent(app.animalId)}`}>
                      {app.animalName || `Animal #${app.animalId}`}
                    </Link>
                  </td>
                  <td>{app.applicantEmail || '—'}</td>
                  <td>{formatDate(app.submittedAt)}</td>
                  <td>{app.householdDetails || '—'}</td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}