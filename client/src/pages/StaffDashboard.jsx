import { Link } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatWhen } from '../format.js';
import { useDocumentTitle, useResource } from '../hooks.js';

// v2: the staff overview: animals by status, applications waiting,
// adoptions and arrivals this month, the next 7 days of appointments and the
// animals who have waited longest for a home. Refreshes every 30 seconds.
const STATUS_LINKS = [
  ['Available', 'Available'],
  ['Pending', 'Pending'],
  ['Fostered', 'Fostered'],
  ['Adopted', 'Adopted'],
];

export default function StaffDashboard() {
  useDocumentTitle('Dashboard');
  const { data, error, loading, reload } = useResource('dashboard', (signal) => api.dashboard({ signal }), {
    pollMs: 30000,
  });

  if (loading && !data) {
    return (
      <div className="page">
        <p className="muted" role="status">
          Loading…
        </p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="page">
        <div className="notice error notice-row" role="alert">
          <span>{error?.message || 'Could not load the dashboard.'}</span>
          <button type="button" className="btn" onClick={reload}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">Today at the shelter.</p>
      </div>

      <div className="stat-row" data-testid="stats">
        <Link to="/staff/applications" className="stat stat-accent">
          <span className="stat-number">{data.pendingApplications}</span>
          <span className="stat-label">
            {data.pendingApplications === 1 ? 'application' : 'applications'} waiting for review
          </span>
        </Link>
        <div className="stat">
          <span className="stat-number">{data.adoptionsThisMonth}</span>
          <span className="stat-label">adopted this month</span>
        </div>
        <div className="stat">
          <span className="stat-number">{data.arrivalsThisMonth}</span>
          <span className="stat-label">new arrivals this month</span>
        </div>
      </div>

      <section className="dash-section" aria-labelledby="by-status">
        <h2 id="by-status">Animals by status</h2>
        <div className="stat-row">
          {STATUS_LINKS.map(([status, label]) => (
            <Link key={status} to={`/animals?status=${status}`} className="stat stat-small">
              <span className="stat-number">{data.animals?.[status] ?? 0}</span>
              <StatusBadge status={label} />
            </Link>
          ))}
        </div>
      </section>

      <div className="dash-columns">
        <section className="dash-section" aria-labelledby="upcoming">
          <h2 id="upcoming">Next 7 days</h2>
          {data.upcomingAppointments?.length ? (
            <ul className="record-list">
              {data.upcomingAppointments.map((a) => (
                <li key={a.id}>
                  <b>{formatWhen(a.startsAt)}</b> · {a.purpose} ·{' '}
                  <Link to={`/animals/${encodeURIComponent(a.animalId)}`}>{a.animalName}</Link>
                  {a.notes && <p className="muted small">{a.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No appointments in the next 7 days.</p>
          )}
        </section>

        <section className="dash-section" aria-labelledby="waiting">
          <h2 id="waiting">Waiting longest for a home</h2>
          {data.longestWaiting?.length ? (
            <ol className="record-list">
              {data.longestWaiting.map((a) => (
                <li key={a.id}>
                  <Link to={`/animals/${encodeURIComponent(a.id)}`}>{a.name}</Link>{' '}
                  <span className="muted small">
                    {a.species} · since {formatDate(a.since)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No animals are available right now.</p>
          )}
        </section>
      </div>
    </div>
  );
}
