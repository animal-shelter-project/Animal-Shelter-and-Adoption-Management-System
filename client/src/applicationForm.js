// Validation for the adoption application form (proposal R-05 / US-05).
// Mirrors the checks in ApplicationController.submitApplication on the
// server, so most mistakes are caught before a request is sent; the server
// still checks everything and its field errors are shown the same way.

export const MAX_DETAILS = 1000;

const tidy = (s) => String(s ?? '').trim();

// values: { householdDetails }
// Returns { fields, clean }. fields is {} when everything is valid.
export function validateApplicationForm(values) {
  const fields = {};
  const clean = {};

  const details = tidy(values.householdDetails);
  if (!details) {
    fields.householdDetails = 'Tell us a little about your household.';
  } else if (details.length > MAX_DETAILS) {
    fields.householdDetails = `Keep this under ${MAX_DETAILS} characters.`;
  } else {
    clean.householdDetails = details;
  }

  return { fields, clean };
}