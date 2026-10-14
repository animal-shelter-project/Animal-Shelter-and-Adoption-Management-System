const db = require("../db");

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
}

module.exports = Animal;
