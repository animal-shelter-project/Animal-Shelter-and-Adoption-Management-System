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
