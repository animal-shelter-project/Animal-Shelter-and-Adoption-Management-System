// Shared test setup: an in-memory database with known data, and the app.
// Must be required BEFORE anything that requires ../src/db.
process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../src/db");
const app = require("../src/app");

const PASSWORD = "password123";
const hash = bcrypt.hashSync(PASSWORD, 4); // low cost: fast tests

function resetData() {
  db.exec(`
    DELETE FROM applications; DELETE FROM animals; DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
  const user = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)");
  const staffId = user.run("staff@shelter.test", hash, "Staff").lastInsertRowid;
  const adopterId = user.run("adopter@shelter.test", hash, "Adopter").lastInsertRowid;
  const otherAdopterId = user.run("other@shelter.test", hash, "Adopter").lastInsertRowid;

  const animal = db.prepare(
    "INSERT INTO animals (name, species, breed, age, status) VALUES (?, ?, ?, ?, ?)",
  );
  const ids = {};
  for (const [name, species, breed, age, status] of [
    ["Buddy", "Dog", "Labrador Retriever", 3, "Available"],
    ["Luna", "Cat", "Domestic Shorthair", 2, "Available"],
    ["Max", "Dog", "German Shepherd", 5, "Pending"],
    ["Daisy", "Cat", "Siamese", 4, "Adopted"],
    ["Charlie", "Dog", "Beagle", 1, "Available"],
    ["Bella", "Rabbit", "Holland Lop", 1, "Fostered"],
    ["Pip", "Bird", "50% Budgie_Mix", 1, "Available"],
  ]) {
    ids[name] = animal.run(name, species, breed, age, status).lastInsertRowid;
  }

  const application = db.prepare(
    "INSERT INTO applications (animal_id, applicant_id, status, created_at) VALUES (?, ?, ?, ?)",
  );
  application.run(ids.Daisy, adopterId, "Approved", "2026-10-01 10:00:00");
  application.run(ids.Max, adopterId, "Pending", "2026-10-10 10:00:00");
  application.run(ids.Buddy, otherAdopterId, "Pending", "2026-10-11 10:00:00");

  return { staffId, adopterId, otherAdopterId, animalIds: ids };
}

const tokenFor = (id, role, options = { expiresIn: "2h" }) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, options);

module.exports = { app, db, resetData, tokenFor, PASSWORD };
