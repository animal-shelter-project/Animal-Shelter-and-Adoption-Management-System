// Slows down password guessing: after 5 wrong passwords for the same email
// from the same address within 15 minutes, logins for that email are
// refused for 15 minutes (429). Kept in memory, so a server restart clears it.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map(); // key -> { count, first, lockedUntil }

const keyFor = (email, ip) => `${String(email).trim().toLowerCase()}|${ip || ""}`;

function check(email, ip, now = Date.now()) {
  const entry = failures.get(keyFor(email, ip));
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return Math.ceil((entry.lockedUntil - now) / 60000); // minutes left
  }
  return 0;
}

function fail(email, ip, now = Date.now()) {
  const key = keyFor(email, ip);
  let entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS || (entry.lockedUntil && entry.lockedUntil <= now)) {
    entry = { count: 0, first: now, lockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.lockedUntil = now + WINDOW_MS;
  failures.set(key, entry);
}

function succeed(email, ip) {
  failures.delete(keyFor(email, ip));
}

function reset() {
  failures.clear();
}

module.exports = { check, fail, succeed, reset, MAX_FAILURES };
