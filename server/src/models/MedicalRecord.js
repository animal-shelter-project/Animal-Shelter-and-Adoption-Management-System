const db = require('../db');

function create({ animalId, recordDate, recordType, notes }) {
  const result = db.prepare(`
    INSERT INTO medical_records
      (animal_id, record_date, record_type, notes)
    VALUES
      (?, ?, ?, ?)
  `).run(animalId, recordDate, recordType, notes);

  return findById(result.lastInsertRowid);
}

function findById(id) {
  return db.prepare(`
    SELECT
      id,
      animal_id AS animalId,
      record_date AS recordDate,
      record_type AS recordType,
      notes,
      created_at AS createdAt
    FROM medical_records
    WHERE id = ?
  `).get(id);
}

function findByAnimalId(animalId) {
  return db.prepare(`
    SELECT
      id,
      animal_id AS animalId,
      record_date AS recordDate,
      record_type AS recordType,
      notes,
      created_at AS createdAt
    FROM medical_records
    WHERE animal_id = ?
    ORDER BY record_date DESC, id DESC
  `).all(animalId);
}

module.exports = {
  create,
  findById,
  findByAnimalId
};