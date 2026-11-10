// Display formatting shared by cards, profile and tables.

// age is whole years (3) and ageMonths the extra months, 0-11, on top
// (age 1 + ageMonths 6 = a year and a half). Older data may send only
// ageMonths as the total (no age), a fraction of a year (0.5), a numeric
// string ("3") or free text ("8 weeks"); all are understood.
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Total age in whole months, or null when unknown / free text.
function totalMonths(age, ageMonths) {
  const months = ageMonths == null || ageMonths === '' ? null : Number(ageMonths);
  if (age == null || age === '') {
    return months == null || Number.isNaN(months) ? null : Math.max(0, Math.round(months));
  }
  const years = typeof age === 'number' ? age : Number(age);
  if (Number.isNaN(years) || years < 0) return null;
  const extra = months != null && !Number.isNaN(months) && months < 12 ? Math.max(0, months) : 0;
  return Math.round(years * 12) + Math.round(extra);
}

export function formatAge(age, ageMonths) {
  const total = totalMonths(age, ageMonths);
  if (total == null) {
    const text = age == null ? '' : String(age).trim();
    return text && Number.isNaN(Number(text)) ? text : null;
  }
  if (total < 1) return 'Under 1 month';
  if (total < 12) return plural(total, 'month');
  const years = Math.floor(total / 12);
  const months = total % 12;
  return months ? `${plural(years, 'year')}, ${plural(months, 'month')}` : plural(years, 'year');
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
  const total = totalMonths(age, ageMonths);
  if (total != null) return total / 12;
  if (age == null || age === '') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(weeks?|wks?|months?|mos?|years?|yrs?)?\s*$/i.exec(String(age));
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || 'y').toLowerCase();
  if (unit.startsWith('w')) return n / 52;
  if (unit.startsWith('m')) return n / 12;
  return n;
}

// Whole dollars: 0 -> "No fee", 150 -> "$150".
export function formatFee(fee) {
  if (fee == null || fee === '') return null;
  const n = Number(fee);
  if (Number.isNaN(n) || n < 0) return null;
  return n === 0 ? 'No fee' : `$${n.toLocaleString('en-US')}`;
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
