const db = require("../db");
const Animal = require("../models/Animal");
const StatusHistory = require("../models/StatusHistory");
const HttpError = require("../utils/HttpError");

// Allowed status changes (proposal R-09 and R-12). An animal can never jump
// to a state that contradicts its applications or history.
//   Available -> Pending   (an application was submitted)
//   Available -> Fostered  (sent to a foster home)
//   Available -> Adopted   (adopted without an online application)
//   Pending   -> Adopted   (application approved)
//   Pending   -> Available (application rejected)
//   Fostered  -> Available (back from foster care)
//   Fostered  -> Adopted   (adopted by, or from, the foster home)
//   Adopted   -> Available (returned to the shelter)
const TRANSITIONS = {
  Available: ["Pending", "Fostered", "Adopted"],
  Pending: ["Available", "Adopted"],
  Fostered: ["Available", "Adopted"],
  Adopted: ["Available"],
};

// Changes a staff member can make by hand on the profile page. Pending is
// left to the application workflow (submit / approve / reject), so an
// application can never be left pointing at an animal that moved on.
function allowedManualChanges(fromStatus) {
  if (fromStatus === "Pending") return [];
  return (TRANSITIONS[fromStatus] || []).filter((s) => s !== "Pending");
}

// THE way to change an animal's status. Updates the animal and writes the
// history row in one transaction, so both happen or neither does.
//   changeStatus(animalId, "Adopted", { changedBy: req.user.id, note: "Application #4 approved" })
// Throws 404 (no such animal) or 409 (change not allowed). Returns the animal.
// manual: true applies the stricter rules for hand edits (see above).
function applyStatusChange(animalId, toStatus, { changedBy = null, note = null, manual = false } = {}) {
  const animal = Animal.findById(animalId);
  if (!animal) throw new HttpError(404, "Animal not found.");
  const fromStatus = animal.status;

  if (fromStatus === toStatus) {
    throw new HttpError(409, `${animal.name} is already ${toStatus}.`);
  }
  if (manual && fromStatus === "Pending") {
    throw new HttpError(
      409,
      `${animal.name} has an adoption application under review. Approve or reject the application instead.`,
    );
  }
  const allowed = manual ? allowedManualChanges(fromStatus) : TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new HttpError(409, `${animal.name} can't go from ${fromStatus} to ${toStatus}.`, { allowed });
  }

  Animal.setStatus(animalId, toStatus);
  StatusHistory.record({ animalId, fromStatus, toStatus, changedBy, note });
  return Animal.findById(animalId);
}
const changeStatus = db.transaction(applyStatusChange);

// PUT /api/animals/:id (staff edit). Saves the details and, if the status
// was changed too, applies it through changeStatus (manual rules, logged),
// all in one transaction: if the status change is refused, nothing is saved.
const updateDetails = db.transaction((animalId, { status, ...details }, { changedBy = null } = {}) => {
  const current = Animal.findById(animalId);
  if (!current) throw new HttpError(404, "Animal not found.");
  Animal.updateDetails(animalId, details);
  if (status && status !== current.status) {
    return applyStatusChange(animalId, status, { changedBy, note: "Edited by staff", manual: true });
  }
  return Animal.findById(animalId);
});

module.exports = { changeStatus, updateDetails, allowedManualChanges, TRANSITIONS };
