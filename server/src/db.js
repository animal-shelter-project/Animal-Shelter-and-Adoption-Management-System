const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

require("./config"); // loads server/.env before DB_PATH is read

// DB_PATH lets tests use an in-memory database (DB_PATH=":memory:").
const databasePath =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "shelter.db");

if (databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
if (databasePath !== ":memory:") {
  db.pragma("journal_mode = WAL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Staff', 'Adopter')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS animals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0),
    status TEXT NOT NULL DEFAULT 'Available'
      CHECK (status IN ('Available', 'Pending', 'Adopted', 'Fostered')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animal_id INTEGER NOT NULL,
    applicant_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending'
      CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_id) REFERENCES animals(id),
    FOREIGN KEY (applicant_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
  CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);
`);

module.exports = db;
