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
export default function MyApplications() {
  const applied = useLocation().state?.applied;
  useDocumentTitle('My applications');
  const { data: apps, error, loading, reload } = useResource(
    'applications:mine',
    (signal) => api.myApplications({ signal }).then(newestFirst),
  );
  const unavailable = error && (error.status === 404 || error.status === 501);

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