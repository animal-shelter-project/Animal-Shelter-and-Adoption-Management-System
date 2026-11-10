const db = require("../db");
const StatusHistory = require("./StatusHistory");

const COLUMNS = `
  id, name, species, breed, age, age_months, sex, size, description,
  good_with_kids, good_with_dogs, good_with_cats, adoption_fee, photo,
  status, archived_at, created_at
`;

// Fields staff can edit (everything except status, photo and archiving).
const DETAIL_FIELDS = [
  "name", "species", "breed", "age", "ageMonths", "sex", "size", "description",
  "goodWithKids", "goodWithDogs", "goodWithCats", "adoptionFee",
];

// Escape % and _ so a breed search for "50%" matches literally.
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// SQLite stores yes/no/unknown as 1/0/NULL.
const toBool = (v) => (v === null || v === undefined ? null : v === 1);
const fromBool = (v) => (v === null || v === undefined ? null : v ? 1 : 0);

// One database row -> the JSON shape the API returns.
function toAnimal(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    age: row.age,
    ageMonths: row.age_months,
    sex: row.sex,
    size: row.size,
    description: row.description,
    goodWithKids: toBool(row.good_with_kids),
    goodWithDogs: toBool(row.good_with_dogs),
    goodWithCats: toBool(row.good_with_cats),
    adoptionFee: row.adoption_fee,
    photoUrl: row.photo ? `/uploads/${row.photo}` : null,
    status: row.status,
    archived: Boolean(row.archived_at),
    createdAt: row.created_at,
  };
}

function toRow(animal) {
  return {
    name: animal.name,
    species: animal.species,
    breed: animal.breed ?? "",
    age: animal.age ?? 0,
    age_months: animal.ageMonths ?? 0,
    sex: animal.sex ?? "Unknown",
    size: animal.size ?? "",
    description: animal.description ?? "",
    good_with_kids: fromBool(animal.goodWithKids),
    good_with_dogs: fromBool(animal.goodWithDogs),
    good_with_cats: fromBool(animal.goodWithCats),
    adoption_fee: animal.adoptionFee ?? 0,
  };
}

class Animal {
  // US-01. All filters optional:
  //   species: exact, case-insensitive ("dog" finds "Dog")
  //   breed:   partial, case-insensitive ("lab" finds "Labrador Retriever")
  //   name:    partial, case-insensitive ("bud" finds "Buddy")
  //   status:  exact (already validated against the allowed values)
  // Archived animals are left out unless includeArchived is set (staff view).
  static findAll({ species, breed, name, status, includeArchived = false } = {}) {
    const where = [];
    const params = {};

    if (!includeArchived) where.push("archived_at IS NULL");
    if (species) {
      where.push("species = @species COLLATE NOCASE");
      params.species = species;
    }
    if (breed) {
      where.push("breed LIKE @breed ESCAPE '\\'");
      params.breed = `%${escapeLike(breed)}%`;
    }
    if (name) {
      where.push("name LIKE @name ESCAPE '\\'");
      params.name = `%${escapeLike(name)}%`;
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
    return db.prepare(sql).all(params).map(toAnimal);
  }

  // US-02. Returns undefined when there is no such animal (archived or not).
  static findById(id) {
    return toAnimal(db.prepare(`SELECT ${COLUMNS} FROM animals WHERE id = ?`).get(id));
  }

  // An animal already in the shelter with the same name and species
  // (case-insensitive), so staff are warned before adding a duplicate.
  static findDuplicate({ name, species }, exceptId = 0) {
    return toAnimal(
      db
        .prepare(
          `SELECT ${COLUMNS} FROM animals
            WHERE name = ? COLLATE NOCASE AND species = ? COLLATE NOCASE
              AND archived_at IS NULL AND id <> ?
            ORDER BY id LIMIT 1`,
        )
        .get(name, species, exceptId),
    );
  }

  // Breeds already used, for the form's suggestions, so staff pick
  // "Labrador Retriever" instead of typing "Lab" one day and "labrador" the next.
  static breeds(species) {
    const rows = species
      ? db
          .prepare(
            `SELECT DISTINCT breed FROM animals
              WHERE breed <> '' AND species = ? COLLATE NOCASE ORDER BY breed COLLATE NOCASE`,
          )
          .all(species)
      : db
          .prepare(
            "SELECT DISTINCT breed FROM animals WHERE breed <> '' ORDER BY breed COLLATE NOCASE",
          )
          .all();
    // DISTINCT is case-sensitive; keep the first spelling of each breed.
    const seen = new Set();
    return rows
      .map((r) => r.breed)
      .filter((b) => (seen.has(b.toLowerCase()) ? false : seen.add(b.toLowerCase())));
  }

  // Insert a new animal into the database, then return the saved row.
  // Also starts its status history (R-09) in the same transaction, so an
  // animal never exists without its first history entry.
  static create(animal, { changedBy = null } = {}) {
    return createWithHistory(animal, changedBy);
  }

  // Only AnimalStatusService calls this, so every status change is recorded
  // in the status history.
  static setStatus(id, status) {
    db.prepare("UPDATE animals SET status = ? WHERE id = ?").run(status, id);
  }

  // Replace an animal's details (not its status), then return the updated row.
  // Fields left out keep their current values.
  static updateDetails(id, details) {
    const current = Animal.findById(id);
    const merged = { ...current };
    for (const key of DETAIL_FIELDS) {
      if (details[key] !== undefined) merged[key] = details[key];
    }
    db.prepare(
      `UPDATE animals
          SET name = @name, species = @species, breed = @breed, age = @age,
              age_months = @age_months, sex = @sex, size = @size,
              description = @description, good_with_kids = @good_with_kids,
              good_with_dogs = @good_with_dogs, good_with_cats = @good_with_cats,
              adoption_fee = @adoption_fee
        WHERE id = @id`,
    ).run({ ...toRow(merged), id });
    return Animal.findById(id);
  }

  // Photo file name (in the uploads folder), or null to remove it.
  static setPhoto(id, fileName) {
    db.prepare("UPDATE animals SET photo = ? WHERE id = ?").run(fileName, id);
    return Animal.findById(id);
  }

  // The current photo's file name, so the old file can be deleted.
  static photoFile(id) {
    return db.prepare("SELECT photo FROM animals WHERE id = ?").get(id)?.photo ?? null;
  }

  // Archive = hide from the catalog without losing its history or
  // applications. Restore brings it back.
  static setArchived(id, archived, byUserId = null) {
    if (archived) {
      db.prepare(
        "UPDATE animals SET archived_at = CURRENT_TIMESTAMP, archived_by = ? WHERE id = ?",
      ).run(byUserId, id);
    } else {
      db.prepare("UPDATE animals SET archived_at = NULL, archived_by = NULL WHERE id = ?").run(id);
    }
    return Animal.findById(id);
  }

  // Counts per status for the staff dashboard (archived animals left out).
  static countByStatus() {
    const counts = { Available: 0, Pending: 0, Adopted: 0, Fostered: 0 };
    for (const row of db
      .prepare("SELECT status, COUNT(*) AS n FROM animals WHERE archived_at IS NULL GROUP BY status")
      .all()) {
      counts[row.status] = row.n;
    }
    return counts;
  }
}

const createWithHistory = db.transaction((animal, changedBy) => {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO animals
         (name, species, breed, age, age_months, sex, size, description,
          good_with_kids, good_with_dogs, good_with_cats, adoption_fee, status)
       VALUES
         (@name, @species, @breed, @age, @age_months, @sex, @size, @description,
          @good_with_kids, @good_with_dogs, @good_with_cats, @adoption_fee, @status)`,
    )
    .run({ ...toRow(animal), status: animal.status });
  StatusHistory.record({ animalId: lastInsertRowid, toStatus: animal.status, changedBy, note: "Added to the shelter" });
  // SQLite returns the new row's ID; look it up to return the same shape
  // used by findAll and findById.
  return Animal.findById(Number(lastInsertRowid));
});

module.exports = Animal;
module.exports.DETAIL_FIELDS = DETAIL_FIELDS;
