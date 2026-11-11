import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { validateRegister } from '../accountForm.js';
import { redirectAfterLogin, safeRedirect } from '../auth/redirects.js';
import { useAuth } from '../auth/useAuth.js';
import FormField from '../components/FormField.jsx';
import PetArt from '../components/PetArt.jsx';
import { useDocumentTitle } from '../hooks.js';

// errors minus one field (cleared as soon as it is edited).
const without = (obj, key) => {
  const next = { ...obj };
  delete next[key];
  return next;
};

// v2: a visitor creates an adopter account (staff accounts are never made
// here). Name and phone are required so the shelter can contact applicants.
// After signing up you're logged in and taken back to the page you wanted
// (e.g. the apply form).
const PET = { id: 'register', species: 'Dog', breed: 'Beagle' };
const EMPTY = { name: '', email: '', phone: '', address: '', password: '', confirm: '' };
const ORDER = ['name', 'email', 'phone', 'address', 'password', 'confirm'];

export default function Register() {
  useDocumentTitle('Create an account');
  const { register, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ? safeRedirect(location.state.from, '') : '';

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoggedIn && !submitting) return <Navigate to={redirectAfterLogin(from, user?.role)} replace />;

  const set = (key) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((errs) => without(errs, key));
  };

  const show = (fields, message) => {
    setErrors(fields);
    setFormError(message);
    const first = ORDER.find((f) => fields[f]);
    if (first) document.getElementById(`reg-${first}`)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const { fields, clean } = validateRegister(values);
    if (Object.keys(fields).length) {
      show(fields, 'Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const newUser = await register(clean);
      navigate(redirectAfterLogin(from, newUser.role), { replace: true });
    } catch (err) {
      setSubmitting(false);
      const fields = err.body?.fields;
      if (fields && typeof fields === 'object') show(fields, err.message);
      else setFormError(err.message || 'Could not create the account. Please try again.');
    }
  };

  const field = (key, label, props = {}) => (
    <FormField
      id={`reg-${key}`}
      label={label}
      error={errors[key]}
      value={values[key]}
      onChange={set(key)}
      {...props}
    />
  );

  return (
    <div className="page narrow auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate aria-describedby="register-msg">
        <PetArt animal={PET} className="auth-pet" />
        <h1>Create an account</h1>
        <p className="muted auth-lede">Sign up to apply for an animal and follow your applications.</p>
        <div id="register-msg">
          {formError && (
            <div className="notice error" role="alert">
              {formError}
            </div>
          )}
        </div>
        {field('name', 'Full name', { autoComplete: 'name', maxLength: 80 })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email', maxLength: 254 })}
        {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', maxLength: 20 })}
        {field('address', 'Address (optional)', { autoComplete: 'street-address', maxLength: 200 })}
        {field('password', 'Password', {
          type: 'password',
          autoComplete: 'new-password',
          hint: 'At least 8 characters.',
        })}
        {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
        <p className="small muted">
          Already have an account?{' '}
          <Link to="/login" state={from ? { from } : undefined}>
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
