// Central settings, read from environment variables with safe local defaults.
//   PORT            API port (default 4000)
//   DB_PATH         SQLite file, or ":memory:" for tests (default server/data/shelter.db)
//   JWT_SECRET      signing key for login tokens (REQUIRED in production)
//   JWT_EXPIRES_IN  token lifetime (default "2h", as in the plan)
//   CLIENT_ORIGIN   allowed browser origin for CORS (default: any)

const path = require("path");

// Load server/.env if it exists (Node 20.12+). Values already set in the
// environment win, so tests can force DB_PATH=":memory:".
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // no .env file (or older Node): use real environment variables / defaults
}

const DEV_SECRET = "dev-only-secret-change-me";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production.");
}

module.exports = {
  PORT: Number(process.env.PORT) || 4000,
  JWT_SECRET: process.env.JWT_SECRET || DEV_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "2h",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || null,
  ANIMAL_STATUSES: ["Available", "Pending", "Adopted", "Fostered"],
  ROLES: ["Staff", "Adopter"],
};
