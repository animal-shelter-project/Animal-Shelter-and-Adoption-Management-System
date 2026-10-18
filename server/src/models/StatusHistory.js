const db = require("../db");

// Proposal R-09: the status history of each animal.
// Rows are only written through AnimalStatusService.changeStatus (or when an
// animal is added), so the history and the animal's status never disagree.
class StatusHistory {
  static record({ animalId, fromStatus = null, toStatus, changedBy = null, note = null, changedAt }) {
    const sql = changedAt
      ? `INSERT INTO status_history (animal_id, from_status, to_status, changed_by, note, changed_at)
         VALUES (@animalId, @fromStatus, @toStatus, @changedBy, @note, @changedAt)`
      : `INSERT INTO status_history (animal_id, from_status, to_status, changed_by, note)
         VALUES (@animalId, @fromStatus, @toStatus, @changedBy, @note)`;
    const params = { animalId, fromStatus, toStatus, changedBy, note };
    if (changedAt) params.changedAt = changedAt; // only bind parameters the SQL uses
    return db.prepare(sql).run(params);
  }

  // Oldest first, so it reads like the animal's journey.
  static forAnimal(animalId) {
    return db
      .prepare(
        `SELECT h.id,
                h.from_status AS fromStatus,
                h.to_status   AS toStatus,
                h.note,
                h.changed_at  AS changedAt,
                u.email       AS changedBy
           FROM status_history h
           LEFT JOIN users u ON u.id = h.changed_by
          WHERE h.animal_id = ?
          ORDER BY h.changed_at, h.id`,
      )
      .all(animalId);
  }
}

module.exports = StatusHistory;
