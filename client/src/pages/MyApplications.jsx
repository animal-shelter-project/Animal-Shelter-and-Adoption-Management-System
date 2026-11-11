import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, parseDate } from '../format.js';
import { useDocumentTitle, useResource } from '../hooks.js';

const newestFirst = (list) =>
  [...list].sort((a, b) => (parseDate(b.submittedAt) || 0) - (parseDate(a.submittedAt) || 0));

// An adopter's own applications, newest first (plan item 13).
// Uses GET /api/applications/mine (Adopter only). If the server in use
// doesn't have that route yet (404/501), the page says so instead of failing.
// v2: a Pending application can be withdrawn (the animal becomes Available
// for other families again); Withdrawn and Returned statuses are shown.
const STATUS_HELP = {
  Pending: 'Staff are reviewing it.',
  Approved: 'Approved! The shelter will call you.',
  Rejected: 'Not approved this time.',
  Withdrawn: 'You withdrew it.',
  Returned: 'The animal was returned to the shelter.',
};

export default function MyApplications() {
  const applied = useLocation().state?.applied;
  useDocumentTitle('My applications');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const { data: apps, error, loading, reload, refresh } = useResource(
    'applications:mine',
    (signal) => api.myApplications({ signal }).then(newestFirst),
  );
  const unavailable = error && (error.status === 404 || error.status === 501);

  const withdraw = async (app) => {
    if (busyId) return;
    if (window.confirm?.(`Withdraw your application for ${app.animalName}? ${app.animalName} will be open to other families again.`) === false) {
      return;
    }
    setBusyId(app.id);
    setMessage(null);
    try {
      await api.withdrawApplication(app.id);
      setMessage({ kind: 'success', text: `Your application for ${app.animalName} was withdrawn.` });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Could not withdraw the application.' });
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>My applications</h1>
        <p className="muted">Every animal you’ve applied for, newest first.</p>
      </div>

      {applied && (
        <div className="notice notice-success" role="status">
          Your application for {applied.animalName} was submitted. Staff will review it soon.
        </div>
      )}

      {message && (
        <div className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}

      {loading && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {unavailable && <div className="notice">This feature isn't available yet.</div>}
      {error && !unavailable && (
        <div className="notice error notice-row" role="alert">
          <span>{error.message}</span>
          <button type="button" className="btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {apps && apps.length === 0 && (
        <div className="empty">
          <p>You haven't applied for any animals yet.</p>
          <Link to="/animals?status=Available" className="btn">
            Browse available animals
          </Link>
        </div>
      )}
      {apps && apps.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Your adoption applications</caption>
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Submitted</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app, i) => (
                <tr key={app.id || i}>
                  <td>
                    {app.animalId ? (
                      <Link to={`/animals/${encodeURIComponent(app.animalId)}`}>
                        {app.animalName || `Animal #${app.animalId}`}
                      </Link>
                    ) : (
                      app.animalName || '—'
                    )}
                  </td>
                  <td>{formatDate(app.submittedAt)}</td>
                  <td>
                    <StatusBadge status={app.status} />
                    {STATUS_HELP[app.status] && <span className="muted small status-help">{STATUS_HELP[app.status]}</span>}
                  </td>
                  <td>
                    {app.status === 'Pending' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busyId != null}
                        onClick={() => withdraw(app)}
                        aria-label={`Withdraw application for ${app.animalName}`}
                      >
                        {busyId === app.id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    )}
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