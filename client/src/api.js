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

export async function request(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, auth = true, signal, ...fetchOptions } = options;
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
  return data;
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

export const api = {
  listAnimals: async (filters, opts) =>
    normalizeAnimals(await request(`/animals${buildQuery(filters)}`, opts)),

  getAnimal: async (id, opts) => {
    const data = await request(`/animals/${encodeURIComponent(id)}`, opts);
    const animal = normalizeAnimal(unwrapOne(data, 'animal'));
    if (!animal?.id) throw new ApiError(404, 'Animal not found.');
    return animal;
  },

  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false, // never send a stale token with a login attempt
    });
    const token = data?.token ?? data?.accessToken ?? data?.access_token;
    const user = normalizeUser(data?.user ?? data?.data?.user);
    if (!token || !user) throw new ApiError(500, 'Unexpected login response from the server.');
    return { token, user };
  },

  // Staff only (proposal R-01 / US-01). Returns the new animal.
  createAnimal: async (animal, opts) => {
    const data = await request('/animals', { ...opts, method: 'POST', body: animal });
    const created = normalizeAnimal(unwrapOne(data, 'animal'));
    if (!created?.id) throw new ApiError(500, 'Unexpected response from the server.');
    return created;
  },

  // Staff only (proposal R-09). Oldest first.
  getAnimalHistory: async (id, opts) =>
    normalizeHistory(await request(`/animals/${encodeURIComponent(id)}/history`, opts)),

  // Staff only (proposal R-09 / R-12). Returns the updated animal.
  changeAnimalStatus: async (id, status, note, opts) => {
    const data = await request(`/animals/${encodeURIComponent(id)}/status`, {
      ...opts,
      method: 'PATCH',
      body: note ? { status, note } : { status },
    });
    const animal = normalizeAnimal(unwrapOne(data, 'animal'));
    if (!animal?.id) throw new ApiError(500, 'Unexpected response from the server.');
    return animal;
  },

  myApplications: async (opts) =>
    normalizeApplications(await request('/applications/mine', opts)),
};
