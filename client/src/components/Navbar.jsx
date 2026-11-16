import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { MAIN_MENU, MEGA_MENU, SHELTER } from '../siteContent.js';
import Icon from './Icon.jsx';
import NotificationsLink from './NotificationsLink.jsx';

// The site header, in three rows:
//  1. a thin top bar: visit info, and the user's account links
//  2. (staff only) the staff tools
//  3. the main bar: logo, menus with dropdowns, "Meet the animals",
//     a full-screen "Menu" and a search box
//
// Menus open on click, Enter or Space (and on hover with a mouse), close on
// Escape, a click elsewhere, or moving to another page. Their links are only
// in the page while open, so screen readers don't hear hidden links.

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

function PawMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Icon name="paw" />
    </span>
  );
}

export default function Navbar() {
  const { user, isLoggedIn, isStaff, isAdopter, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(null); // label of the open dropdown
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const headerRef = useRef(null);
  const triggers = useRef({});
  const searchInput = useRef(null);
  const id = useId();

  const closeAll = () => {
    setOpenMenu(null);
    setMegaOpen(false);
    setSearchOpen(false);
  };

  // Moving to another page closes everything.
  const where = location.pathname + location.search + location.hash;
  const [lastWhere, setLastWhere] = useState(where);
  if (where !== lastWhere) {
    setLastWhere(where);
    closeAll();
  }

  const anyOpen = Boolean(openMenu) || megaOpen || searchOpen;
  useEffect(() => {
    if (!anyOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const back = openMenu ? triggers.current[openMenu] : megaOpen ? triggers.current.mega : triggers.current.search;
      closeAll();
      back?.focus();
    };
    const onPointer = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) closeAll();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [anyOpen, openMenu, megaOpen]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const name = query.trim();
    setQuery('');
    closeAll();
    navigate(name ? `/animals?name=${encodeURIComponent(name)}&status=all` : '/animals');
  };

  return (
    <header className="site-header" ref={headerRef}>
      {/* 1. Top bar */}
      <div className="utility-bar">
        <div className="wrap utility-inner">
          <div className="utility-info">
            <Link to="/contact">
              <Icon name="pin" /> Visit us
            </Link>
            <a href={SHELTER.phoneHref}>
              <Icon name="phone" /> {SHELTER.phone}
            </a>
          </div>
          <nav className="utility-account" aria-label="Your account">
            {isAdopter && <NavLink to="/my-applications">My applications</NavLink>}
            {isAdopter && <NotificationsLink userId={user?.id} />}
            {isLoggedIn ? (
              <>
                <Link to="/account" className="nav-name" title={`${user?.email}: my account`}>
                  <Icon name="user" /> {user?.name || user?.email} <span className="role">{user?.role}</span>
                </Link>
                <button type="button" className="utility-button" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="nav-signup">
                  Sign up
                </Link>
                <Link to="/login" className="nav-login">
                  Login
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* 2. Staff tools */}
      {isStaff && (
        <div className="staff-bar">
          <nav className="wrap staff-inner" aria-label="Staff">
            <span className="staff-label">Staff</span>
            <NavLink to="/staff/dashboard">Dashboard</NavLink>
            <NavLink to="/staff/applications">Review applications</NavLink>
            <NavLink to="/staff/animals/new">Add animal</NavLink>
            <NavLink to="/staff/inbox">Inbox</NavLink>
            <NavLink to="/staff/accounts">Accounts</NavLink>
          </nav>
        </div>
      )}

      {/* 3. Main bar */}
      <div className="main-bar">
        <div className="wrap main-inner">
          <Link to="/" className="brand" aria-label={`${SHELTER.name} home`}>
            <PawMark />
            <span className="brand-text">
              <span className="brand-name">{SHELTER.name}</span>
              <span className="brand-tagline">{SHELTER.tagline}</span>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Main">
            <ul>
              {MAIN_MENU.map((menu) => {
                const open = openMenu === menu.label;
                const panelId = `${id}-${menu.label}`;
                return (
                  <li
                    key={menu.label}
                    className={`menu-item${open ? ' is-open' : ''}`}
                    onMouseEnter={() => canHover() && setOpenMenu(menu.label)}
                    onMouseLeave={() => canHover() && setOpenMenu((m) => (m === menu.label ? null : m))}
                  >
                    <button
                      type="button"
                      className="menu-trigger"
                      aria-expanded={open}
                      aria-controls={panelId}
                      ref={(el) => {
                        triggers.current[menu.label] = el;
                      }}
                      onClick={() => {
                        setMegaOpen(false);
                        setSearchOpen(false);
                        setOpenMenu(open ? null : menu.label);
                      }}
                    >
                      {menu.label}
                      <Icon name="chevronDown" className="menu-chevron" />
                    </button>
                    {open && (
                      <ul className="dropdown" id={panelId}>
                        {menu.links.map((l) => (
                          <li key={l.to}>
                            <Link to={l.to}>{l.label}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="main-actions">
            <Link to="/animals" className="btn btn-cta">
              Meet the animals
            </Link>
            <button
              type="button"
              className="icon-button"
              aria-expanded={megaOpen}
              aria-controls={`${id}-mega`}
              ref={(el) => {
                triggers.current.mega = el;
              }}
              onClick={() => {
                setOpenMenu(null);
                setSearchOpen(false);
                setMegaOpen((o) => !o);
              }}
            >
              <span className="icon-button-text">{megaOpen ? 'Close' : 'Menu'}</span>
              <Icon name={megaOpen ? 'close' : 'menu'} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-expanded={searchOpen}
              aria-controls={`${id}-search`}
              ref={(el) => {
                triggers.current.search = el;
              }}
              onClick={() => {
                setOpenMenu(null);
                setMegaOpen(false);
                setSearchOpen((o) => !o);
              }}
            >
              <Icon name="search" label="Search animals" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="search-panel" id={`${id}-search`}>
            <form className="wrap search-form" role="search" onSubmit={submitSearch}>
              <label htmlFor={`${id}-q`}>Search animals by name</label>
              <div className="search-row">
                <input
                  id={`${id}-q`}
                  ref={searchInput}
                  type="search"
                  value={query}
                  maxLength={60}
                  placeholder="e.g. Buddy"
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-cta">
                  Search
                </button>
              </div>
            </form>
          </div>
        )}

        {megaOpen && (
          <div className="mega" id={`${id}-mega`}>
            <div className="wrap mega-grid">
              {MEGA_MENU.map((group) => (
                <nav key={group.heading} aria-label={group.heading} className="mega-col">
                  <h2>{group.heading}</h2>
                  <ul>
                    {group.links.map((l) => (
                      <li key={l.to}>
                        <Link to={l.to}>{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
