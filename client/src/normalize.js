// Turns whatever the server sends into the shape the UI expects.
//
// Why this exists: the plan says SQLite (numeric `id`), but the team
// originally chose MongoDB (`_id`). Servers also differ on wrapping
// ({ animals: [...] } vs [...]) and on casing ("available" vs "Available").
// Normalizing in one place means no page has to care.

import { AGE_GROUPS, ageInYears } from './format.js';

// ---- Statuses ----------------------------------------------------------------

// Canonical animal statuses = the values the server's database allows
// (server/src/db.js: CHECK status IN ('Available','Pending','Adopted','Fostered')).
export const ANIMAL_STATUS = {
  AVAILABLE: 'Available',
  PENDING: 'Pending',
  ADOPTED: 'Adopted',
  FOSTERED: 'Fostered',
  APPROVED: 'Approved', // the plan's wording for an approved animal; kept in case M2 uses it
};

const squash = (s) => String(s ?? '').toLowerCase().replace(/[\s_-]+/g, '');

// Different spellings a server or teammate might use -> one display value.
const ANIMAL_STATUS_ALIASES = {
  available: ANIMAL_STATUS.AVAILABLE,
  pending: ANIMAL_STATUS.PENDING,
  applicationpending: ANIMAL_STATUS.PENDING, // the plan's name for the same state
  adopted: ANIMAL_STATUS.ADOPTED,
  fostered: ANIMAL_STATUS.FOSTERED,
  approved: ANIMAL_STATUS.APPROVED,
};

export function canonicalAnimalStatus(value) {
  if (value == null || value === '') return '';
  return ANIMAL_STATUS_ALIASES[squash(value)] || String(value).trim();
}

const APP_STATUS_ALIASES = {
  pending: 'Pending',
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function canonicalApplicationStatus(value) {
  if (value == null || value === '') return '';
  return APP_STATUS_ALIASES[squash(value)] || String(value).trim();
}

// ---- Roles -------------------------------------------------------------------

export function canonicalRole(value) {
  const r = squash(value);
  if (r === 'staff' || r === 'admin') return 'Staff';
  if (r === 'adopter' || r === 'user' || r === 'public') return 'Adopter';
  return value ? String(value) : '';
}

// ---- Helpers -----------------------------------------------------------------

export function pickId(obj) {
  if (obj == null) return undefined;
  if (typeof obj !== 'object') return String(obj);
  const id = obj.id ?? obj._id ?? obj.animalId ?? obj.animal_id;
  if (id == null) return undefined;
  // Mongo may send { _id: { $oid: "..." } } when serialized oddly
  if (typeof id === 'object' && id.$oid) return String(id.$oid);
  return String(id);
}

// Accepts [..], { animals: [..] }, { data: [..] }, { results: [..] }, { items: [..] }
export function unwrapList(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of [...keys, 'data', 'results', 'items', 'rows']) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

// Accepts {..}, { animal: {..} }, { data: {..} }
export function unwrapOne(data, key) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (key && data[key] && typeof data[key] === 'object') return data[key];
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data;
  return data;
}

// Only allow image URLs that can't run script: http(s), site-relative, or data:image.
export function safeImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')) || /^data:image\//i.test(u)) {
    return u;
  }
  return null;
}

const cleanText = (v) => (v == null ? '' : String(v).trim());

// ---- Entities ----------------------------------------------------------------

export function normalizeAnimal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const age = raw.age ?? raw.ageYears ?? null;
  return {
    ...raw,
    id: pickId(raw),
    name: cleanText(raw.name) || 'Unnamed',
    species: cleanText(raw.species),
    breed: cleanText(raw.breed),
    sex: cleanText(raw.sex ?? raw.gender),
    size: cleanText(raw.size),
    age: age === '' ? null : age,
    ageMonths: raw.ageMonths ?? null,
    status: canonicalAnimalStatus(raw.status),
    description: cleanText(raw.description),
    intakeDate: raw.intakeDate ?? raw.intake_date ?? null,
    photoUrl: safeImageUrl(raw.photoUrl ?? raw.photo_url ?? raw.imageUrl ?? raw.image),
  };
}

export function normalizeAnimals(data) {
  return unwrapList(data, 'animals').map(normalizeAnimal).filter((a) => a && a.id);
}

export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    id: pickId(raw),
    name: cleanText(raw.name ?? raw.fullName ?? raw.username),
    email: cleanText(raw.email),
    role: canonicalRole(raw.role),
  };
}

export function normalizeApplication(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // animalId may be a plain id, or a populated object (Mongo .populate()).
  const animalRef = raw.animal ?? (typeof raw.animalId === 'object' ? raw.animalId : null);
  const animalId = animalRef ? pickId(animalRef) : pickId({ id: raw.animalId ?? raw.animal_id });
  return {
    ...raw,
    id: pickId({ id: raw.id ?? raw._id }),
    animalId,
    animalName: cleanText(raw.animalName ?? raw.animal_name ?? animalRef?.name),
    status: canonicalApplicationStatus(raw.status),
    submittedAt: raw.submittedAt ?? raw.submitted_at ?? raw.createdAt ?? raw.created_at ?? null,
  };
}

// One status-history entry (R-09): { id, fromStatus, toStatus, note, changedAt, changedBy }.
export function normalizeHistoryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const from = raw.fromStatus ?? raw.from_status ?? null;
  return {
    id: pickId({ id: raw.id ?? raw._id }),
    fromStatus: from ? canonicalAnimalStatus(from) : null,
    toStatus: canonicalAnimalStatus(raw.toStatus ?? raw.to_status),
    note: cleanText(raw.note) || null,
    changedAt: raw.changedAt ?? raw.changed_at ?? null,
    changedBy: cleanText(raw.changedBy ?? raw.changed_by) || null,
  };
}

export function normalizeHistory(data) {
  return unwrapList(data, 'history').map(normalizeHistoryEntry).filter((h) => h?.toStatus);
}

export function normalizeApplications(data) {
  return unwrapList(data, 'applications').map(normalizeApplication).filter(Boolean);
}

// ---- Client-side safety net for filters ---------------------------------------
// The server filters (that's what the sequence diagram shows). We apply the
// same rules again on the client so the list is still correct if a filter is
// missing or behaves differently on the server (e.g. exact vs partial breed).
export function matchesFilters(animal, { species, breed, status, age } = {}) {
  if (species && squash(animal.species) !== squash(species)) return false;
  if (breed && !animal.breed.toLowerCase().includes(String(breed).trim().toLowerCase())) return false;
  if (status && animal.status !== canonicalAnimalStatus(status)) return false;
  if (age) {
    const group = AGE_GROUPS.find((g) => g.value === age);
    const years = ageInYears(animal.age, animal.ageMonths);
    // An animal with an unknown age doesn't match a specific age group.
    if (group && (years == null || years < group.min || years >= group.max)) return false;
  }
  return true;
}
