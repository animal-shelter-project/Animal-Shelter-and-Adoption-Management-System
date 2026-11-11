const db = require("../db");

// Proposal R-11: appointments for an animal. starts_at is the shelter's
// local time as "YYYY-MM-DD HH:MM".
const COLUMNS = `
  ap.id, ap.animal_id AS animalId, an.name AS animalName, ap.starts_at AS startsAt,
  ap.duration_minutes AS durationMinutes, ap.purpose, ap.notes, ap.status,
  u.email AS createdBy, ap.created_at AS createdAt
`;
const FROM = `
  FROM appointments ap
  JOIN animals an ON an.id = ap.animal_id
  LEFT JOIN users u ON u.id = ap.created_by
`;

class Appointment {
  static findById(id) {
    return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE ap.id = ?`).get(id);
  }

  // Soonest first.
  static forAnimal(animalId) {
    return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE ap.animal_id = ? ORDER BY ap.starts_at, ap.id`).all(animalId);
  }

  // Scheduled appointments from `from` up to `to` (both "YYYY-MM-DD HH:MM").
  static upcoming(from, to) {
    return db
      .prepare(
        `SELECT ${COLUMNS} ${FROM}
          WHERE ap.status = 'Scheduled' AND ap.starts_at >= ? AND ap.starts_at < ?
          ORDER BY ap.starts_at, ap.id`,
      )
      .all(from, to);
  }

  // A Scheduled appointment for the same animal whose time overlaps.
  static findOverlap(animalId, startsAt, durationMinutes, exceptId = 0) {
    return db
      .prepare(
        `SELECT ${COLUMNS} ${FROM}
          WHERE ap.animal_id = @animalId AND ap.status = 'Scheduled' AND ap.id <> @exceptId
            AND datetime(ap.starts_at) < datetime(@startsAt, '+' || @duration || ' minutes')
            AND datetime(@startsAt) < datetime(ap.starts_at, '+' || ap.duration_minutes || ' minutes')
          LIMIT 1`,
      )
      .get({ animalId, startsAt, duration: durationMinutes, exceptId });
  }

  static create({ animalId, startsAt, durationMinutes, purpose, notes, createdBy }) {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO appointments (animal_id, starts_at, duration_minutes, purpose, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(animalId, startsAt, durationMinutes, purpose, notes, createdBy);
    return Appointment.findById(Number(lastInsertRowid));
  }

  static setStatus(id, status) {
    db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
    return Appointment.findById(id);
  }
}

module.exports = Appointment;
