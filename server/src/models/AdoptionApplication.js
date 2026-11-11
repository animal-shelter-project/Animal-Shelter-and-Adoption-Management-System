const db = require("../db");

// An application with its animal and applicant (for staff and for the
// applicant's own view).
const WITH_DETAILS = `
  SELECT
    ap.id,
    ap.animal_id AS animalId,
    an.name AS animalName,
    an.species AS animalSpecies,
    an.status AS animalStatus,
    ap.applicant_id AS applicantId,
    u.email AS applicantEmail,
    u.name AS applicantName,
    u.phone AS applicantPhone,
    u.address AS applicantAddress,
    ap.household_details AS householdDetails,
    ap.home_type, ap.own_or_rent, ap.landlord_ok, ap.has_yard,
    ap.adults, ap.children, ap.other_pets, ap.hours_alone,
    ap.staff_notes AS staffNotes,
    ap.status,
    ap.created_at AS submittedAt,
    ap.decided_at AS decidedAt,
    d.email AS decidedBy
  FROM applications ap
  JOIN animals an ON an.id = ap.animal_id
  JOIN users u ON u.id = ap.applicant_id
  LEFT JOIN users d ON d.id = ap.decided_by
`;

const toBool = (v) => (v === null || v === undefined ? null : v === 1);
const fromBool = (v) => (v === null || v === undefined ? null : v ? 1 : 0);

// Row -> API shape: the structured answers are grouped under `answers`.
function toApplication(row) {
  if (!row) return row;
  const { home_type, own_or_rent, landlord_ok, has_yard, adults, children, other_pets, hours_alone, ...rest } = row;
  return {
    ...rest,
    answers: {
      homeType: home_type,
      ownOrRent: own_or_rent,
      landlordOk: toBool(landlord_ok),
      hasYard: toBool(has_yard),
      adults,
      children,
      otherPets: other_pets,
      hoursAlone: hours_alone,
    },
  };
}

// Applicants never see staff notes or who decided.
function forApplicant(application) {
  const { staffNotes: _notes, decidedBy: _by, ...rest } = application;
  return rest;
}

// Which statuses a staff list filter means.
const STATUS_FILTERS = {
  pending: ["Pending"],
  approved: ["Approved"],
  rejected: ["Rejected"],
  withdrawn: ["Withdrawn"],
  returned: ["Returned"],
  decided: ["Approved", "Rejected", "Withdrawn", "Returned"],
  all: ["Pending", "Approved", "Rejected", "Withdrawn", "Returned"],
};

class AdoptionApplication {
  // The adopter's "My applications" page: newest first.
  static findByApplicant(applicantId) {
    return db
      .prepare(`${WITH_DETAILS} WHERE ap.applicant_id = ? ORDER BY ap.created_at DESC, ap.id DESC`)
      .all(applicantId)
      .map(toApplication)
      .map(forApplicant);
  }

  // Returns undefined when there is no such application.
  static findById(id) {
    return toApplication(db.prepare(`${WITH_DETAILS} WHERE ap.id = ?`).get(id));
  }

  // Staff lists. Pending: oldest first (first come, first served).
  // Decided ones: most recently decided first.
  static findForStaff(filter = "pending") {
    const statuses = STATUS_FILTERS[filter];
    const placeholders = statuses.map(() => "?").join(", ");
    const order =
      filter === "pending"
        ? "ap.created_at ASC, ap.id ASC"
        : "COALESCE(ap.decided_at, ap.created_at) DESC, ap.id DESC";
    return db
      .prepare(`${WITH_DETAILS} WHERE ap.status IN (${placeholders}) ORDER BY ${order}`)
      .all(...statuses)
      .map(toApplication);
  }

  // Kept for the v1 name used in the controller and tests.
  static findPending() {
    return AdoptionApplication.findForStaff("pending");
  }

  // The adoption that a returned animal ends (latest Approved one).
  static latestApprovedFor(animalId) {
    const row = db
      .prepare(
        "SELECT id FROM applications WHERE animal_id = ? AND status = 'Approved' ORDER BY COALESCE(decided_at, created_at) DESC, id DESC LIMIT 1",
      )
      .get(animalId);
    return row ? AdoptionApplication.findById(row.id) : undefined;
  }

  // US-05: insert, then return the saved row in the same shape as findById.
  // status/decidedBy are only set when staff record a walk-in adoption.
  static create({ animalId, applicantId, householdDetails, answers = {}, status = "Pending", decidedBy = null }) {
    const decided = status !== "Pending";
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO applications
           (animal_id, applicant_id, household_details, home_type, own_or_rent, landlord_ok,
            has_yard, adults, children, other_pets, hours_alone, status, decided_at, decided_by)
         VALUES
           (@animalId, @applicantId, @householdDetails, @homeType, @ownOrRent, @landlordOk,
            @hasYard, @adults, @children, @otherPets, @hoursAlone, @status,
            CASE WHEN @decided THEN CURRENT_TIMESTAMP END, @decidedBy)`,
      )
      .run({
        animalId,
        applicantId,
        householdDetails,
        homeType: answers.homeType ?? "",
        ownOrRent: answers.ownOrRent ?? "",
        landlordOk: fromBool(answers.landlordOk),
        hasYard: fromBool(answers.hasYard),
        adults: answers.adults ?? null,
        children: answers.children ?? null,
        otherPets: answers.otherPets ?? "",
        hoursAlone: answers.hoursAlone ?? null,
        status,
        decided: decided ? 1 : 0,
        decidedBy,
      });
    return AdoptionApplication.findById(Number(lastInsertRowid));
  }

  // Approved / Rejected / Withdrawn / Returned, with who did it and when.
  static setStatus(id, status, { decidedBy = null } = {}) {
    db.prepare(
      "UPDATE applications SET status = ?, decided_at = CURRENT_TIMESTAMP, decided_by = COALESCE(?, decided_by) WHERE id = ?",
    ).run(status, decidedBy, id);
  }

  static setNotes(id, notes) {
    db.prepare("UPDATE applications SET staff_notes = ? WHERE id = ?").run(notes, id);
    return AdoptionApplication.findById(id);
  }

  // Number of applications waiting, for the staff dashboard and navbar.
  static countPending() {
    return db.prepare("SELECT COUNT(*) AS n FROM applications WHERE status = 'Pending'").get().n;
  }
}

module.exports = AdoptionApplication;
module.exports.forApplicant = forApplicant;
module.exports.STATUS_FILTERS = STATUS_FILTERS;
