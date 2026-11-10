// Validation for sign-up, contact details and password forms (v2).
// Mirrors server/src/controllers/AuthController.js; the server checks again.

export const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

// { name, phone, address } -> { fields, clean }
export function validateProfile(values) {
  const fields = {};
  const clean = { name: tidy(values.name), phone: tidy(values.phone), address: tidy(values.address) };
  if (!clean.name) fields.name = 'Name is required.';
  else if (clean.name.length > 80) fields.name = 'Use 80 characters or fewer.';
  if (!clean.phone) fields.phone = 'Phone is required, so the shelter can call you about your application.';
  else if (!PHONE.test(clean.phone) || clean.phone.replace(/\D/g, '').length < 7) {
    fields.phone = 'Enter a phone number with at least 7 digits.';
  }
  if (clean.address.length > 200) fields.address = 'Use 200 characters or fewer.';
  return { fields, clean };
}

export function checkNewPassword(password, confirm) {
  if (!password || password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > 128) return 'Use 128 characters or fewer.';
  if (confirm !== undefined && confirm !== password) return 'The passwords don’t match.';
  return '';
}

// { name, email, phone, address, password, confirm } -> { fields, clean }
export function validateRegister(values) {
  const { fields, clean } = validateProfile(values);
  const email = String(values.email ?? '').trim().toLowerCase();
  if (!email) fields.email = 'Email is required.';
  else if (!EMAIL.test(email)) fields.email = 'Enter a valid email address.';
  const passwordProblem = checkNewPassword(values.password);
  if (passwordProblem) fields.password = passwordProblem;
  else if (values.confirm !== values.password) fields.confirm = 'The passwords don’t match.';
  return { fields, clean: { ...clean, email, password: values.password } };
}
