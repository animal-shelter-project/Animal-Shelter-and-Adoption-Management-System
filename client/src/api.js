// Shared API helper used by every page (M1, M2 and M3).
// request(path, options) prefixes BASE, sends JSON, adds
// "Authorization: Bearer <token>" when logged in, applies a timeout, and
// turns every failure into an ApiError with a readable message and .status.

import {
  normalizeAnimal,
  normalizeAnimals,
  normalizeApplications,
  normalizeHistory,
  normalizeUser,
  unwrapOne,
} from './normalize.js';

const RAW_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:4000/api';
export const BASE = RAW_BASE.replace(/\/+$/, ''); // tolerate a trailing slash in .env

export const DEFAULT_TIMEOUT_MS = 10000;
const STORAGE_KEY = 'shelter.auth';
export const AUTH_EXPIRED_EVENT = 'shelter:auth-expired';
export const AUTH_REFRESHED_EVENT = 'shelter:auth-refreshed';
// v2: a session with less than this left is renewed on the next successful
// request, so someone who is actively working is never logged out mid-task.
export const REFRESH_WINDOW_MS = 30 * 60 * 1000;

// ---- JWT expiry (read-only decode; the server still verifies the signature) --

export function tokenExpiry(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null; // not a JWT (e.g. mock token): rely on the server's 401
  }
}

export function isTokenExpired(token, now = Date.now()) {
  const exp = tokenExpiry(token);
  return exp != null && exp <= now;
}

// ---- Saved login (token + user) --------------------------------------------

export function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (!auth?.token || isTokenExpired(auth.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return auth;
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    /* storage blocked (private mode): login still works until refresh */
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const AUTH_STORAGE_KEY = STORAGE_KEY;

export function getToken() {
  return loadAuth()?.token || null;
}

// ---- Errors -----------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const FRIENDLY = {
  0: 'Cannot reach the server. Check that the API is running, then try again.',
  401: 'Please log in to continue.',
  403: "You don't have permission to do that.",
  404: 'Not found.',
  408: 'The server took too long to respond. Please try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server had a problem. Please try again.',
};

function messageFrom(status, data) {
  if (data && typeof data === 'object') {
    const m = data.error ?? data.message ?? data.msg;
    if (typeof m === 'string' && m.trim()) return m;
    if (m && typeof m.message === 'string') return m.message;
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map((e) => e.msg || e.message || String(e)).join(' ');
    }
  }
  return FRIENDLY[status] || (status >= 500 ? FRIENDLY[500] : `Request failed (${status}).`);
}

// ---- Core helper ------------------------------------------------------------

// Renews the login token if it expires soon. At most one renewal at a time;
// a failed renewal is ignored (the normal expiry rules still apply).
let refreshing = null;
function maybeRefresh(token) {
  const exp = tokenExpiry(token);
  if (exp == null || refreshing || exp - Date.now() > REFRESH_WINDOW_MS) return;
  refreshing = request('/auth/refresh', { method: 'POST', refresh: false })
    .then((data) => {
      const user = normalizeUser(data?.user);
      if (data?.token && user && getToken() === token) {
        saveAuth({ token: data.token, user });
        window.dispatchEvent(new CustomEvent(AUTH_REFRESHED_EVENT));
      }
    })
    .catch(() => {})
    .finally(() => {
      refreshing = null;
    });
}

export async function request(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, auth = true, refresh = true, signal, ...fetchOptions } = options;
  const headers = { Accept: 'application/json', ...(fetchOptions.headers || {}) };

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = fetchOptions.body;
  if (body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  // Combine the caller's AbortSignal (page unmounted / filter changed)
  // with our own timeout.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const onCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let res;
  try {
    res = await fetch(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      ...fetchOptions,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) throw new ApiError(408, FRIENDLY[408]);
    if (signal?.aborted) throw err; // caller cancelled: let them ignore it
    throw new ApiError(0, FRIENDLY[0]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onCallerAbort);
  }

  let text = '';
  try {
    text = await res.text();
  } catch {
    /* empty body */
  }
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text; // e.g. an HTML error page from a proxy
    }
  }

  if (!res.ok) {
    // A protected call with our token was rejected: the session is over.
    if (res.status === 401 && token) {
      clearAuth();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(res.status, messageFrom(res.status, data), data);
  }
  if (token && refresh) maybeRefresh(token);
  return data;
}

// { token, user } from a login-style response.
function session(data) {
  const token = data?.token ?? data?.accessToken ?? data?.access_token;
  const user = normalizeUser(data?.user ?? data?.data?.user);
  if (!token || !user) throw new ApiError(500, 'Unexpected login response from the server.');
  return { token, user };
}

// Treat "aborted because the page moved on" as a non-error.
export const isAbort = (err) => err?.name === 'AbortError';

// ---- Small helpers used by the catalog pages ---------------------------------

// Builds "?species=Dog&status=Available", skipping empty values.
export function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      qs.set(key, String(value).trim());
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// Photos are served by the API server (/uploads/...), which is a different
// origin from this app in development, so make their URLs absolute.
const API_ORIGIN = BASE.replace(/\/api$/, '');
export function withPhotoOrigin(animal) {
  if (animal?.photoUrl && animal.photoUrl.startsWith('/uploads/')) {
    return { ...animal, photoUrl: `${API_ORIGIN}${animal.photoUrl}` };
  }
  return animal;
}

// One animal from a response, or a 500 if the server sent something else.
function oneAnimal(data, missingStatus = 500) {
  const animal = normalizeAnimal(unwrapOne(data, 'animal'));
  if (!animal?.id) {
    throw new ApiError(missingStatus, missingStatus === 404 ? 'Animal not found.' : 'Unexpected response from the server.');
  }
  return withPhotoOrigin(animal);
}

export const api = {
  listAnimals: async (filters, opts) =>
    normalizeAnimals(await request(`/animals${buildQuery(filters)}`, opts)).map(withPhotoOrigin),

  getAnimal: async (id, opts) =>
    oneAnimal(await request(`/animals/${encodeURIComponent(id)}`, opts), 404),

  // Breeds already used, for the form's suggestions.
  breeds: async (species, opts) => {
    const data = await request(`/animals/breeds${buildQuery({ species })}`, opts);
    return Array.isArray(data) ? data.filter((b) => typeof b === 'string') : [];
  },

  // Staff only. image is a data: URL (JPEG, PNG or WebP, 2 MB max).
  uploadAnimalPhoto: async (id, image, opts) =>
    oneAnimal(
      await request(`/animals/${encodeURIComponent(id)}/photo`, {
        timeout: 30000,
        ...opts,
        method: 'PUT',
        body: { image },
      }),
    ),

  removeAnimalPhoto: async (id, opts) =>
    oneAnimal(await request(`/animals/${encodeURIComponent(id)}/photo`, { ...opts, method: 'DELETE' })),

  // Staff only: hide from the catalog / bring back.
  archiveAnimal: async (id, opts) =>
    oneAnimal(await request(`/animals/${encodeURIComponent(id)}`, { ...opts, method: 'DELETE' })),

  restoreAnimal: async (id, opts) =>
    oneAnimal(await request(`/animals/${encodeURIComponent(id)}/restore`, { ...opts, method: 'POST' })),

  login: async (email, password) =>
    session(
      await request('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false, // never send a stale token with a login attempt
      }),
    ),

  // v2: sign up as an adopter. details = { email, password, name, phone, address }
  register: async (details) =>
    session(await request('/auth/register', { method: 'POST', body: details, auth: false })),

  me: async (opts) => normalizeUser(await request('/auth/me', opts)),

  updateMe: async (details, opts) =>
    normalizeUser(await request('/auth/me', { ...opts, method: 'PUT', body: details })),

  // Returns a fresh { token, user }: the old token stops working.
  changePassword: async (currentPassword, newPassword, opts) =>
    session(
      await request('/auth/password', {
        ...opts,
        method: 'PUT',
        body: { currentPassword, newPassword },
        refresh: false,
      }),
    ),

  // Staff only.
  listAdopters: async (q, opts) => {
    const data = await request(`/users${buildQuery({ q })}`, opts);
    return (Array.isArray(data) ? data : []).map(normalizeUser).filter(Boolean);
  },

  // Staff only. Returns { user, temporaryPassword }.
  resetPassword: async (id, opts) => {
    const data = await request(`/users/${encodeURIComponent(id)}/reset-password`, { ...opts, method: 'POST' });
    return { user: normalizeUser(data?.user), temporaryPassword: data?.temporaryPassword };
  },

  // Staff only (proposal R-01 / US-01). Returns the new animal.
  // A 409 with err.body.duplicate means a same-named animal of that species
  // exists; send allowDuplicate: true to add it anyway.
  createAnimal: async (animal, opts) =>
    oneAnimal(await request('/animals', { ...opts, method: 'POST', body: animal })),

  // Staff only (proposal R-01 / US-06). Saves the animal's details; omitted
  // fields keep their values. Status changes go through changeAnimalStatus.
  updateAnimal: async (id, details, opts) =>
    oneAnimal(
      await request(`/animals/${encodeURIComponent(id)}`, { ...opts, method: 'PUT', body: details }),
    ),

  // Staff only (proposal R-09). Oldest first.
  getAnimalHistory: async (id, opts) =>
    normalizeHistory(await request(`/animals/${encodeURIComponent(id)}/history`, opts)),

  // Staff only (proposal R-09 / R-12). Returns the updated animal.
  // v2: changing to Adopted by hand needs adopterId (the adopter's account).
  changeAnimalStatus: async (id, status, note, opts = {}) => {
    const { adopterId, ...rest } = opts;
    const body = { status };
    if (note) body.note = note;
    if (adopterId) body.adopterId = Number(adopterId);
    return oneAnimal(
      await request(`/animals/${encodeURIComponent(id)}/status`, { ...rest, method: 'PATCH', body }),
    );
  },

  myApplications: async (opts) =>
    normalizeApplications(await request('/applications/mine', opts)),

  // Adopter only (proposal R-05 / US-05). 201 with the new application;
  // 400 field errors, 404 unknown animal, 409 animal not Available.
  // v2: answers = { homeType, ownOrRent, landlordOk, hasYard, adults,
  // children, otherPets, hoursAlone }.
  submitApplication: (animalId, householdDetails, answers = {}, opts) =>
    request('/applications', {
      ...opts,
      method: 'POST',
      body: { animalId, householdDetails, ...answers },
    }),

  // Adopter: withdraw your own Pending application.
  withdrawApplication: async (id, opts) =>
    normalizeApplications([
      await request(`/applications/${encodeURIComponent(id)}/withdraw`, { ...opts, method: 'PUT' }),
    ])[0],

  // Staff: status = pending | decided | all | Approved | Rejected | Withdrawn | Returned.
  staffApplications: async (status = 'pending', opts) =>
    normalizeApplications(await request(`/applications${buildQuery({ status })}`, opts)),

  // Staff: private notes on an application.
  saveApplicationNotes: async (id, notes, opts) =>
    normalizeApplications([
      await request(`/applications/${encodeURIComponent(id)}/notes`, { ...opts, method: 'PUT', body: { notes } }),
    ])[0],

  // Any logged-in user: { unread, items: [{ id, message, link, createdAt, read }] }.
  notifications: async (opts) => {
    const data = await request('/notifications', opts);
    return { unread: Number(data?.unread) || 0, items: Array.isArray(data?.items) ? data.items : [] };
  },

  readNotifications: async (opts) => {
    const data = await request('/notifications/read', { ...opts, method: 'POST' });
    return { unread: Number(data?.unread) || 0, items: Array.isArray(data?.items) ? data.items : [] };
  },

  // Staff only (proposal R-06). Pending applications, oldest first, each with
  // the animal's name and the applicant's email.
  pendingApplications: async (opts) =>
    normalizeApplications(await request('/applications?status=Pending', opts)),

  // Staff only (proposal R-06 / R-07). decision is 'approve' or 'reject'.
  // Approving makes the animal Adopted; rejecting makes it Available again.
  decideApplication: async (id, decision, opts) => {
    const data = await request(`/applications/${encodeURIComponent(id)}/${decision}`, {
      ...opts,
      method: 'PUT',
    });
    return normalizeApplications([data])[0];
  },
};