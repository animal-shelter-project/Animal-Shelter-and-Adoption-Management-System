import { useState } from 'react';
import { api } from '../api.js';
import { checkNewPassword, validateProfile } from '../accountForm.js';
import { useAuth } from '../auth/useAuth.js';
import FormField from '../components/FormField.jsx';
import { useDocumentTitle } from '../hooks.js';

// errors minus one field (cleared as soon as it is edited).
const without = (obj, key) => {
  const next = { ...obj };
  delete next[key];
  return next;
};

// v2: "My account" for any logged-in user: contact details (shown to staff
// when you apply) and changing your password. Changing the password logs out
// every other session; this one carries on with a fresh token.
export default function Account() {
  useDocumentTitle('My account');
  const { user } = useAuth();
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>My account</h1>
        <p className="muted">
          Logged in as <b>{user?.email}</b> ({user?.role}).
        </p>
      </div>
      <ProfileForm key={user?.id} />
      <PasswordForm />
    </div>
  );
}

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const [values, setValues] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setMessage(null);
    if (errors[key]) setErrors((errs) => without(errs, key));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const { fields, clean } = validateProfile(values);
    setErrors(fields);
    if (Object.keys(fields).length) {
      setMessage({ kind: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe(clean);
      updateUser(updated);
      setMessage({ kind: 'success', text: 'Your details were saved.' });
    } catch (err) {
      if (err.body?.fields) setErrors(err.body.fields);
      setMessage({ kind: 'error', text: err.message || 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-card account-card" onSubmit={handleSubmit} noValidate aria-labelledby="profile-title">
      <h2 id="profile-title">Your details</h2>
      <p className="muted small">Shelter staff see these when they review your applications.</p>
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}
      <FormField id="acc-name" label="Full name" error={errors.name} value={values.name} onChange={set('name')} autoComplete="name" maxLength={80} />
      <div className="field-row">
        <FormField id="acc-phone" label="Phone" type="tel" error={errors.phone} value={values.phone} onChange={set('phone')} autoComplete="tel" maxLength={20} />
        <FormField id="acc-address" label="Address (optional)" error={errors.address} value={values.address} onChange={set('address')} autoComplete="street-address" maxLength={200} />
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { setSession } = useAuth();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setMessage(null);
    if (errors[key]) setErrors((errs) => without(errs, key));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const fields = {};
    if (!values.current) fields.current = 'Enter your current password.';
    const problem = checkNewPassword(values.next);
    if (problem) fields.next = problem;
    else if (values.next === values.current) fields.next = 'Choose a password different from the current one.';
    else if (values.confirm !== values.next) fields.confirm = 'The passwords don’t match.';
    setErrors(fields);
    if (Object.keys(fields).length) return;

    setSaving(true);
    try {
      setSession(await api.changePassword(values.current, values.next));
      setValues({ current: '', next: '', confirm: '' });
      setMessage({ kind: 'success', text: 'Password changed. Any other devices you were logged in on have been logged out.' });
    } catch (err) {
      const server = err.body?.fields || {};
      setErrors({
        current: server.currentPassword,
        next: server.newPassword,
      });
      setMessage({ kind: 'error', text: err.message || 'Could not change the password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-card account-card" onSubmit={handleSubmit} noValidate aria-labelledby="password-title">
      <h2 id="password-title">Change password</h2>
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}
      <FormField id="pw-current" label="Current password" type="password" autoComplete="current-password" error={errors.current} value={values.current} onChange={set('current')} />
      <div className="field-row">
        <FormField id="pw-next" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." error={errors.next} value={values.next} onChange={set('next')} />
        <FormField id="pw-confirm" label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm} value={values.confirm} onChange={set('confirm')} />
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
