import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

export default function Navbar() {
  const { user, isLoggedIn, isStaff, isAdopter, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/animals', { replace: true });
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/animals" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" focusable="false">
              <ellipse cx="20" cy="25" rx="8" ry="6.5" />
              <ellipse cx="11" cy="16" rx="3.2" ry="4" />
              <ellipse cx="17" cy="11.5" rx="3.2" ry="4" />
              <ellipse cx="23" cy="11.5" rx="3.2" ry="4" />
              <ellipse cx="29" cy="16" rx="3.2" ry="4" />
            </svg>
          </span>
          Paws Shelter
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/animals" end>
            Animals
          </NavLink>
          {isAdopter && <NavLink to="/my-applications">My applications</NavLink>}
          {isStaff && <NavLink to="/staff/applications">Review applications</NavLink>}
          {isStaff && <NavLink to="/staff/animals/new">Add animal</NavLink>}
        </nav>
        <div className="nav-user">
          {isLoggedIn ? (
            <>
              <span className="small nav-name" title={user?.email}>
                {user?.name || user?.email} <span className="role">{user?.role}</span>
              </span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
