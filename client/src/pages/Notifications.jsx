import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isAbort } from '../api.js';
import { formatDate } from '../format.js';
import { useDocumentTitle } from '../hooks.js';

// v2: your messages from the shelter, newest first (e.g. "Your application
// for Buddy was approved"). Opening the page marks them as read.
export default function Notifications() {
  useDocumentTitle('Messages');
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .readNotifications({ signal: controller.signal })
      .then((data) => setState({ loading: false, error: null, items: data.items }))
      .catch((error) => {
        if (!isAbort(error)) setState({ loading: false, error, items: [] });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Messages</h1>
        <p className="muted">Updates from the shelter about your applications.</p>
      </div>
      {state.loading && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {state.error && (
        <div className="notice error notice-row" role="alert">
          <span>{state.error.message}</span>
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="empty">
          <p className="empty-title">No messages yet.</p>
          <p className="muted small">When staff decide on an application, you’ll see it here.</p>
        </div>
      )}
      {state.items.length > 0 && (
        <ul className="messages">
          {state.items.map((n) => (
            <li key={n.id} className={n.read ? '' : 'message-new'}>
              <p>{n.message}</p>
              <p className="muted small">
                {formatDate(n.createdAt)}
                {n.link && (
                  <>
                    {' · '}
                    <Link to={n.link}>View</Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
