import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { SHELTER } from '../siteContent.js';
import Icon from './Icon.jsx';

// On a visitor's first visit: a small welcome box offering Log in, Create an
// account, or Just browse. Whatever they pick is remembered in this browser,
// so it only appears once. It never appears for someone already logged in,
// or on the login and sign-up pages themselves.
//
// Uses the browser's own <dialog>: focus stays inside while it is open, and
// Escape closes it (counted as "Just browse").

const SEEN_KEY = 'paws.welcomeSeen';
const SKIP_PATHS = ['/login', '/register'];

function alreadySeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // storage blocked: don't nag on every page
  }
}

function remember() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked: it will simply show again next time
  }
}

export default function WelcomeDialog() {
  const { isLoggedIn } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => !alreadySeen());
  const ref = useRef(null);
  const firstChoice = useRef(null);
  const show = open && !isLoggedIn && !SKIP_PATHS.includes(pathname) && !pathname.startsWith('/staff');

  useEffect(() => {
    const dialog = ref.current;
    if (!show || !dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    firstChoice.current?.focus(); // start on "Log in", not the close button
  }, [show]);

  const close = () => {
    remember();
    setOpen(false);
  };

  if (!show) return null;
  return (
    <dialog ref={ref} className="welcome-dialog" aria-labelledby="welcome-title" aria-describedby="welcome-text" onClose={close}>
      <button type="button" className="welcome-close icon-button" onClick={close}>
        <Icon name="close" label="Close" />
      </button>
      <span className="welcome-mark" aria-hidden="true">
        <Icon name="paw" />
      </span>
      <h2 id="welcome-title">Welcome to {SHELTER.name}</h2>
      <p id="welcome-text">
        Log in to apply for an animal, follow your applications and add your picture. You can also look around first: no account
        is needed to meet the animals.
      </p>
      <div className="welcome-actions">
        <Link to="/login" className="btn btn-cta btn-block" onClick={close} ref={firstChoice}>
          Log in
        </Link>
        <Link to="/register" className="btn btn-block" onClick={close}>
          Create an account
        </Link>
        <button type="button" className="btn btn-ghost btn-block" onClick={close}>
          Just browse
        </button>
      </div>
      <p className="muted small welcome-staff">Shelter staff: use Log in with your staff email.</p>
    </dialog>
  );
}
