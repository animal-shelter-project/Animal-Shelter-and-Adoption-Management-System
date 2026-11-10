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
    household_details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending'
      CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Withdrawn', 'Returned')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (animal_id) REFERENCES animals(id),
    FOREIGN KEY (applicant_id) REFERENCES users(id)
  );

  -- Proposal R-09: every status change, with who made it and when.
  -- from_status is NULL for the first entry (the animal was added).
  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    from_status TEXT
      CHECK (from_status IS NULL OR from_status IN ('Available', 'Pending', 'Adopted', 'Fostered')),
    to_status TEXT NOT NULL
      CHECK (to_status IN ('Available', 'Pending', 'Adopted', 'Fostered')),
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- v2: in-app messages, e.g. "Your application for Buddy was approved".
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    link TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id);
  CREATE INDEX IF NOT EXISTS idx_status_history_animal ON status_history(animal_id, id);
  CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);
`);

// Columns added after the first release. CREATE TABLE IF NOT EXISTS doesn't
// change an existing table, so each missing column is added here. This keeps
// everyone's existing shelter.db working without deleting data.
function addMissingColumns(table, columns) {
  const existing = db.pragma(`table_info(${table})`).map((c) => c.name);
  for (const [name, definition] of columns) {
    if (!existing.includes(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

// v2 added the Withdrawn and Returned application statuses. A CHECK rule
// can't be changed in place in SQLite, so an older applications table is
// rebuilt once with the new rule, keeping every row and id.
function rebuildApplicationsIfNeeded() {
  const { sql } = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'applications'")
    .get();
  if (sql.includes("'Withdrawn'")) return;
  const newSql = sql
    .replace(/CREATE TABLE ("?)applications\1/, "CREATE TABLE applications_v2")
    .replace(/'Pending',\s*'Approved',\s*'Rejected'/, "'Pending', 'Approved', 'Rejected', 'Withdrawn', 'Returned'");
  const columns = db.pragma("table_info(applications)").map((c) => c.name).join(", ");
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(newSql);
      db.exec(`INSERT INTO applications_v2 (${columns}) SELECT ${columns} FROM applications`);
      db.exec("DROP TABLE applications");
      db.exec("ALTER TABLE applications_v2 RENAME TO applications");
      db.exec("CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id)");
    })();
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

// Steps run in this order, every time the server starts (each does nothing
// once it has been applied).
addMissingColumns("applications", [["household_details", "TEXT NOT NULL DEFAULT ''"]]);
rebuildApplicationsIfNeeded();

addMissingColumns("users", [
  // Contact details, so staff can reach and vet an applicant.
  ["name", "TEXT NOT NULL DEFAULT ''"],
  ["phone", "TEXT NOT NULL DEFAULT ''"],
  ["address", "TEXT NOT NULL DEFAULT ''"],
  // Bumped when the password changes: older login tokens stop working.
  ["token_version", "INTEGER NOT NULL DEFAULT 0"],
]);

addMissingColumns("animals", [
  // Age under a year: 0-11 extra months on top of age in years.
  ["age_months", "INTEGER NOT NULL DEFAULT 0 CHECK (age_months BETWEEN 0 AND 11)"],
  ["sex", "TEXT NOT NULL DEFAULT 'Unknown' CHECK (sex IN ('Male', 'Female', 'Unknown'))"],
  ["size", "TEXT NOT NULL DEFAULT '' CHECK (size IN ('', 'Small', 'Medium', 'Large'))"],
  ["description", "TEXT NOT NULL DEFAULT ''"],
  // 1 = yes, 0 = no, NULL = not known yet.
  ["good_with_kids", "INTEGER CHECK (good_with_kids IN (0, 1))"],
  ["good_with_dogs", "INTEGER CHECK (good_with_dogs IN (0, 1))"],
  ["good_with_cats", "INTEGER CHECK (good_with_cats IN (0, 1))"],
  ["adoption_fee", "INTEGER NOT NULL DEFAULT 0 CHECK (adoption_fee >= 0)"],
  // File name in the uploads folder, or NULL for the illustrated portrait.
  ["photo", "TEXT"],
  // Archived animals are hidden from the catalog but keep their history.
  ["archived_at", "TEXT"],
  ["archived_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL"],
]);

addMissingColumns("applications", [
  // Structured answers, so staff don't have to read one long paragraph.
  ["home_type", "TEXT NOT NULL DEFAULT ''"],
  ["own_or_rent", "TEXT NOT NULL DEFAULT ''"],
  ["landlord_ok", "INTEGER CHECK (landlord_ok IN (0, 1))"],
  ["has_yard", "INTEGER CHECK (has_yard IN (0, 1))"],
  ["adults", "INTEGER CHECK (adults >= 0)"],
  ["children", "INTEGER CHECK (children >= 0)"],
  ["other_pets", "TEXT NOT NULL DEFAULT ''"],
  ["hours_alone", "INTEGER CHECK (hours_alone BETWEEN 0 AND 24)"],
  // Staff-only notes, and who decided and when.
  ["staff_notes", "TEXT NOT NULL DEFAULT ''"],
  ["decided_at", "TEXT"],
  ["decided_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL"],
]);

module.exports = db;
