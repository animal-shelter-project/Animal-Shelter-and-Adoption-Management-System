const db = require("../db");
const StatusHistory = require("./StatusHistory");

const COLUMNS = `
  id, name, species, breed, age, status, created_at AS createdAt
`;

// Escape % and _ so a breed search for "50%" matches literally.
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

class Animal {
  // US-01. All filters optional:
  //   species: exact, case-insensitive ("dog" finds "Dog")
  //   breed:   partial, case-insensitive ("lab" finds "Labrador Retriever")
  //   status:  exact (already validated against the allowed values)
  static findAll({ species, breed, status } = {}) {
    const where = [];
    const params = {};

    if (species) {
      where.push("species = @species COLLATE NOCASE");
      params.species = species;
    }
    if (breed) {
      where.push("breed LIKE @breed ESCAPE '\\'");
      params.breed = `%${escapeLike(breed)}%`;
    }
    if (status) {
      where.push("status = @status");
      params.status = status;
    }

    const sql = `
      SELECT ${COLUMNS}
      FROM animals
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY id
    `;
    return db.prepare(sql).all(params);
  }

  // US-02. Returns undefined when there is no such animal.
  static findById(id) {
    return db.prepare(`SELECT ${COLUMNS} FROM animals WHERE id = ?`).get(id);
  }

  // Insert a new animal into the database, then return the saved row.
  // Also starts its status history (R-09) in the same transaction, so an
  // animal never exists without its first history entry.
  static create({ name, species, breed, age, status }, { changedBy = null } = {}) {
    return createWithHistory({ name, species, breed, age, status }, changedBy);
  }

  // Only AnimalStatusService calls this, so every status change is recorded
  // in the status history.
  static setStatus(id, status) {
    db.prepare("UPDATE animals SET status = ? WHERE id = ?").run(status, id);
  }

  // Replace an animal's details (not its status), then return the updated row.
  // Status changes go through AnimalStatusService so they are checked and logged.
  static updateDetails(id, { name, species, breed, age }) {
    db.prepare(
      `UPDATE animals
       SET name = @name,
           species = @species,
           breed = @breed,
           age = @age
       WHERE id = @id`,
    ).run({ id, name, species, breed, age });

    return Animal.findById(id);
  }
}

const createWithHistory = db.transaction((animal, changedBy) => {
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO animals (name, species, breed, age, status) VALUES (@name, @species, @breed, @age, @status)",
    )
    .run(animal);
  StatusHistory.record({ animalId: lastInsertRowid, toStatus: animal.status, changedBy, note: "Added to the shelter" });
  // SQLite returns the new row's ID; look it up to return the same shape
  // used by findAll and findById.
  return Animal.findById(Number(lastInsertRowid));
});

module.exports = Animal;
