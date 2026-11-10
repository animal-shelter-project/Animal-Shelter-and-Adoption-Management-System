const db = require("../db");
const Animal = require("../models/Animal");
const StatusHistory = require("../models/StatusHistory");
const HttpError = require("../utils/HttpError");
const User = require("../models/User");
const AdoptionApplication = require("../models/AdoptionApplication");
const Notification = require("../models/Notification");

// Allowed status changes (proposal R-09 and R-12). An animal can never jump
// to a state that contradicts its applications or history.
//   Available -> Pending   (an application was submitted)
//   Available -> Fostered  (sent to a foster home)
//   Available -> Adopted   (walk-in adoption: staff must say which adopter
//                           account adopted, and an Approved application is
//                           recorded for it, so every adoption has a record)
//   Pending   -> Adopted   (application approved)
//   Pending   -> Available (application rejected)
//   Fostered  -> Available (back from foster care)
//   Fostered  -> Adopted   (adopted by, or from, the foster home)
//   Adopted   -> Available (returned to the shelter: the adoption's
//                           application is marked Returned)
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

// v2: a status change made by hand on the profile page (PATCH .../status).
//   - To Adopted: adopterId is required; an Approved application is recorded
//     for that adopter ("walk-in" adoption) in the same transaction.
//   - Adopted -> Available: the adoption's application becomes Returned.
const manualChange = db.transaction(
  (animalId, toStatus, { changedBy = null, note = null, adopterId = null } = {}) => {
    const animal = Animal.findById(animalId);
    if (!animal) throw new HttpError(404, "Animal not found.");

    let adopter = null;
    if (toStatus === "Adopted") {
      if (!adopterId) {
        throw new HttpError(400, "Choose who adopted this animal.", {
          fields: { adopterId: "Choose the adopter's account." },
        });
      }
      adopter = User.findById(adopterId);
      if (!adopter || adopter.role !== "Adopter") {
        throw new HttpError(400, "That adopter account doesn't exist.", {
          fields: { adopterId: "Choose an adopter account." },
        });
      }
    }

    const returning = animal.status === "Adopted" && toStatus === "Available";
    const updated = applyStatusChange(animalId, toStatus, {
      changedBy,
      note: note || (adopter ? `Adopted by ${adopter.name || adopter.email}` : null),
      manual: true,
    });

    if (adopter) {
      AdoptionApplication.create({
        animalId,
        applicantId: adopter.id,
        householdDetails: "Adoption recorded by shelter staff (no online application).",
        status: "Approved",
        decidedBy: changedBy,
      });
      Notification.add(adopter.id, `Congratulations! Your adoption of ${animal.name} is complete.`, `/animals/${animalId}`);
    }
    if (returning) {
      const adoption = AdoptionApplication.latestApprovedFor(animalId);
      if (adoption) AdoptionApplication.setStatus(adoption.id, "Returned", { decidedBy: changedBy });
    }
    return updated;
  },
);

// PUT /api/animals/:id (staff edit). Saves the details and, if the status
// was changed too, applies it through changeStatus (manual rules, logged),
// all in one transaction: if the status change is refused, nothing is saved.
const updateDetails = db.transaction((animalId, { status, ...details }, { changedBy = null } = {}) => {
  const current = Animal.findById(animalId);
  if (!current) throw new HttpError(404, "Animal not found.");
  Animal.updateDetails(animalId, details);
  if (status && status !== current.status) {
    if (status === "Adopted") {
      throw new HttpError(400, "Mark an animal Adopted from its status panel, where you choose the adopter.");
    }
    return manualChange(animalId, status, { changedBy, note: "Edited by staff" });
  }
  return Animal.findById(animalId);
});

module.exports = { changeStatus, manualChange, updateDetails, allowedManualChanges, TRANSITIONS };
