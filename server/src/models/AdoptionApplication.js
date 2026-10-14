const db = require("../db");

// M2 (US-03 / US-04) adds create, findById, findPending and setStatus to this
// class. findByApplicant is used by the adopter's "My applications" page.
class AdoptionApplication {
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
}

module.exports = AdoptionApplication;
