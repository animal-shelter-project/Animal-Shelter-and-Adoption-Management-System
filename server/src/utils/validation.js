const HttpError = require("./HttpError");
const { ANIMAL_STATUSES } = require("../config");

const MAX_FILTER_LENGTH = 60;

// Positive whole number from a URL segment, e.g. "/api/animals/3".
// Anything else ("abc", "1.5", "-2", "1e3") is a 400, not a 500.
function parseId(value, label = "id") {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  return Number(value);
}

// Optional text filter from the query string. Trimmed; empty -> undefined.
// Repeated params (?species=Dog&species=Cat) or very long values -> 400.
function optionalText(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(400, `Give one value for ${label}.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_FILTER_LENGTH) {
    throw new HttpError(400, `${label} is too long (max ${MAX_FILTER_LENGTH} characters).`);
  }
  return trimmed || undefined;
}

// Optional status filter, matched case-insensitively to the allowed values.
function optionalStatus(value) {
  const text = optionalText(value, "status");
  if (!text) return undefined;
  const match = ANIMAL_STATUSES.find((s) => s.toLowerCase() === text.toLowerCase());
  if (!match) {
    throw new HttpError(400, `Unknown status "${text}".`, { allowed: ANIMAL_STATUSES });
  }
  return match;
}

module.exports = { parseId, optionalText, optionalStatus, MAX_FILTER_LENGTH };
