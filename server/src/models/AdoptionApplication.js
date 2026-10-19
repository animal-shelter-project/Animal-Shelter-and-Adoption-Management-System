const db = require("../db");

// Shared by findById and findPending: an application with its animal and applicant.
const WITH_DETAILS = `
  SELECT
    ap.id,
    ap.animal_id AS animalId,
    an.name AS animalName,
    an.status AS animalStatus,
    ap.applicant_id AS applicantId,
    u.email AS applicantEmail,
    ap.household_details AS householdDetails,
    ap.status,
    ap.created_at AS submittedAt
  FROM applications ap
  JOIN animals an ON an.id = ap.animal_id
  JOIN users u ON u.id = ap.applicant_id
`;

class AdoptionApplication {
  // Used by the adopter's "My applications" page.
  static findByApplicant(applicantId) {
    return db
      .prepare(
        `SELECT
           ap.id,
           ap.animal_id AS animalId,
           an.name AS animalName,
           an.status AS animalStatus,
           ap.status,
           ap.created_at AS submittedAt
         FROM applications ap
         JOIN animals an ON an.id = ap.animal_id
         WHERE ap.applicant_id = ?
         ORDER BY ap.created_at DESC, ap.id DESC`,
      )
      .all(applicantId);
  }

  // Returns undefined when there is no such application.
  static findById(id) {
    return db.prepare(`${WITH_DETAILS} WHERE ap.id = ?`).get(id);
  }

  // Staff review list (US-06): oldest first.
  static findPending() {
    return db
      .prepare(`${WITH_DETAILS} WHERE ap.status = 'Pending' ORDER BY ap.created_at ASC, ap.id ASC`)
      .all();
  }

  // US-05: insert, then return the saved row in the same shape as findById.
  static create({ animalId, applicantId, householdDetails }) {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO applications (animal_id, applicant_id, household_details) VALUES (?, ?, ?)")
      .run(animalId, applicantId, householdDetails);
    return AdoptionApplication.findById(Number(lastInsertRowid));
  }

  // US-06/07: Approved or Rejected.
  static setStatus(id, status) {
    db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, id);
  }
}

module.exports = AdoptionApplication;