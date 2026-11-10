import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useResource } from '../hooks.js';

// v2: "Messages" in the navbar with the number of unread messages
// (checked on tab focus and every 30 seconds).
export default function NotificationsLink({ userId }) {
  const { data } = useResource(`notifications:${userId}`, (signal) => api.notifications({ signal }), {
    pollMs: 30000,
  });
  const unread = data?.unread || 0;
  return (
    <NavLink to="/notifications" aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}>
      Messages
      {unread > 0 && (
        <span className="count-badge" aria-hidden="true">
          {unread}
        </span>
      )}
    </NavLink>
  );
}
