import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';

// Wrap a page element to require login, and optionally a role.
//   <RequireRole role="Staff"><StaffApplications /></RequireRole>
// Not logged in -> /login, then back to this exact URL (including ?query).
// Wrong role -> a clear message instead of a blank or broken page.
// The real security check is the server's requireRole middleware (M3);
// this only keeps the UI honest.
export default function RequireRole({ role, children }) {
  const { isLoggedIn, user } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    );
  }
  if (role && user?.role !== role) {
    return (
      <div className="page narrow">
        <div className="notice error" role="alert" data-testid="wrong-role">
          This page is for {role} accounts only. You're logged in as {user?.role || 'an unknown role'}.
        </div>
        <Link to="/animals">← Back to animals</Link>
      </div>
    );
  }
  return children;
}
