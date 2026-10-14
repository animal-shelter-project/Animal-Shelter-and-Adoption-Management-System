import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { redirectAfterLogin, safeRedirect } from '../auth/redirects.js';
import { useDocumentTitle } from '../hooks.js';
import PetArt from '../components/PetArt.jsx';

// US-05: log in as an Adopter or Staff member.
//
// Nuances handled:
//  - Returns you to the page you were trying to reach (e.g. the apply form),
//    but only to paths inside this app (no open redirect) and only if your
//    role can open that page.
//  - Staff with no "from" page land on Review applications; adopters on Animals.
//  - Explains why you're here if your session expired.
//  - 401 -> "Invalid email or password." (never says which one was wrong).
//  - Can't double-submit; the error is announced to screen readers and the
//    password box is cleared and focused after a failed attempt.
//  - Already logged in -> skip the form.
const LOGIN_PET = { id: 'login', species: 'Cat', breed: 'Siamese' };

export default function Login() {
  useDocumentTitle('Log in');
  const { login, isLoggedIn, user, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ? safeRedirect(location.state.from, '') : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  if (isLoggedIn && !submitting) return <Navigate to={redirectAfterLogin(from, user?.role)} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(cleanEmail, password);
      navigate(redirectAfterLogin(from, user.role), { replace: true });
    } catch (err) {
      setError(
        err.status === 401 || err.status === 400 ? 'Invalid email or password.' : err.message,
      );
      setPassword('');
      setSubmitting(false);
      passwordRef.current?.focus();
    }
  };

  return (
    <div className="page narrow auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate aria-describedby="login-msg">
        <PetArt animal={LOGIN_PET} className="auth-pet" />
        <h1>Log in</h1>
        <p className="muted auth-lede">Welcome back. Log in to apply for an animal and follow your applications.</p>
        <div id="login-msg">
          {sessionExpired && !error && (
            <div className="notice" role="status">
              Your session expired. Please log in again.
            </div>
          )}
          {!sessionExpired && from && !error && <p className="muted small">Please log in to continue.</p>}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
        </div>
        <label>
          Email
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            ref={passwordRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
