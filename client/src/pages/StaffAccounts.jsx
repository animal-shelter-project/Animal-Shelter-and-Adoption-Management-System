import { useState } from 'react';
import { api } from '../api.js';
import { useDebounced, useDocumentTitle, useResource } from '../hooks.js';

// v2: staff look up adopter accounts and reset a forgotten password. There is
// no email service, so the temporary password is shown once here and staff
// give it to the adopter (phone or in person); the adopter then changes it
// on their My account page.
export default function StaffAccounts() {
  useDocumentTitle('Adopter accounts');
  const [query, setQuery] = useState('');
  const q = useDebounced(query, 300).trim();
  const { data: users, error, loading, reload } = useResource(`adopters:${q}`, (signal) =>
    api.listAdopters(q, { signal }),
  );
  const [reset, setReset] = useState(null); // { user, temporaryPassword }
  const [busyId, setBusyId] = useState(null);
  const [resetError, setResetError] = useState('');

  const doReset = async (user) => {
    const label = user.name || user.email;
    if (window.confirm?.(`Reset the password for ${label}? Their current password will stop working.`) === false) {
      return;
    }
    setBusyId(user.id);
    setResetError('');
    setReset(null);
    try {
      setReset(await api.resetPassword(user.id));
    } catch (err) {
      setResetError(err.message || 'Could not reset the password.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Adopter accounts</h1>
        <p className="muted">Find an adopter’s contact details, or reset a forgotten password.</p>
      </div>

      <div className="filters filters-plain">
        <label>
          Search
          <input
            type="search"
            placeholder="Name or email"
            value={query}
            maxLength={60}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search adopters"
          />
        </label>
      </div>

      {reset && (
        <div className="notice notice-warning" role="status" data-testid="temp-password">
          <p>
            Temporary password for <b>{reset.user?.name || reset.user?.email}</b>:{' '}
            <code className="temp-password">{reset.temporaryPassword}</code>
          </p>
          <p className="small">
            Give it to them by phone or in person. It is shown only once. They should change it on My account
            after logging in.
          </p>
        </div>
      )}
      {resetError && (
        <div className="notice error" role="alert">
          {resetError}
        </div>
      )}
      {error && (
        <div className="notice error notice-row" role="alert">
          <span>{error.message}</span>
          <button type="button" className="btn" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {loading && !users && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {users && users.length === 0 && (
        <div className="empty">
          <p className="empty-title">{q ? 'No adopters match your search.' : 'No adopter accounts yet.'}</p>
        </div>
      )}
      {users && users.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Address</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>
                    <a href={`mailto:${u.email}`}>{u.email}</a>
                  </td>
                  <td>{u.phone ? <a href={`tel:${u.phone.replace(/[^\d+]/g, '')}`}>{u.phone}</a> : '—'}</td>
                  <td>{u.address || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId != null}
                      onClick={() => doReset(u)}
                      aria-label={`Reset password for ${u.name || u.email}`}
                    >
                      {busyId === u.id ? 'Resetting…' : 'Reset password'}
                    </button>
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
