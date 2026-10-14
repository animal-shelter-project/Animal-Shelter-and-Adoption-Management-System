// Display formatting shared by cards, profile and tables.

// age can be a number of years (3, 0.5), a numeric string ("3"), or free
// text ("8 weeks"). ageMonths, if present, wins for animals under a year.
export function formatAge(age, ageMonths) {
  if (ageMonths != null && ageMonths !== '' && Number(ageMonths) < 12) {
    const m = Math.max(0, Math.round(Number(ageMonths)));
    return m <= 0 ? 'Under 1 month' : m === 1 ? '1 month' : `${m} months`;
  }
  if (age == null || age === '') return null;
  const n = typeof age === 'number' ? age : Number(age);
  if (Number.isNaN(n)) return String(age).trim() || null;
  if (n < 0) return null;
  if (n < 1) {
    const m = Math.round(n * 12);
    return m <= 0 ? 'Under 1 month' : m === 1 ? '1 month' : `${m} months`;
  }
  const y = Math.floor(n);
  return y === 1 ? '1 year' : `${y} years`;
}

// Age filter groups (proposal R-03 / US-03). Ranges are in years:
// min is inclusive, max is exclusive.
export const AGE_GROUPS = [
  { value: 'young', label: 'Young (under 2)', min: 0, max: 2 },
  { value: 'adult', label: 'Adult (2 to 7)', min: 2, max: 8 },
  { value: 'senior', label: 'Senior (8 and up)', min: 8, max: Infinity },
];

// Age in years as a number (for the age filter), or null if unknown.
// Understands 3, 0.5, "3", "8 weeks", "6 months", "2 years" and ageMonths.
export function ageInYears(age, ageMonths) {
  if (ageMonths != null && ageMonths !== '' && !Number.isNaN(Number(ageMonths))) {
    return Number(ageMonths) / 12;
  }
  if (age == null || age === '') return null;
  if (typeof age === 'number') return age >= 0 ? age : null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(weeks?|wks?|months?|mos?|years?|yrs?)?\s*$/i.exec(String(age));
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || 'y').toLowerCase();
  if (unit.startsWith('w')) return n / 52;
  if (unit.startsWith('m')) return n / 12;
  return n;
}

// SQLite's CURRENT_TIMESTAMP looks like "2026-10-12 15:00:00" and is UTC.
// Some browsers (Safari) can't parse that form, so convert it to ISO first.
export function parseDate(value) {
  if (!value) return null;
  const s = String(value);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = parseDate(value) || new Date(NaN);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
