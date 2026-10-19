const db = require("../db");
const AdoptionApplication = require("../models/AdoptionApplication");
const HttpError = require("../utils/HttpError");
const { changeStatus } = require("../services/AnimalStatusService");
const { parseId, optionalText } = require("../utils/validation");

const MAX_HOUSEHOLD_DETAILS = 1000;

// US-05: one transaction. changeStatus throws 404 (no such animal) or 409
// (animal isn't Available, R-08), so no application row is saved in those cases.
const submit = db.transaction((animalId, applicantId, householdDetails) => {
  changeStatus(animalId, "Pending", {
    changedBy: applicantId,
    note: "Adoption application submitted",
  });
  return AdoptionApplication.create({ animalId, applicantId, householdDetails });
});

// US-06 / US-07: approve or reject, in one transaction. The application and
// the animal change together (and the change is logged in the status history),
// or neither does: if the animal can't make the move, changeStatus throws 409
// and the application stays Pending.
//   Approved -> animal becomes Adopted (R-07)
//   Rejected -> animal goes back to Available
const decide = db.transaction((id, decision, staffId) => {
  const application = AdoptionApplication.findById(id);
  if (!application) throw new HttpError(404, "Application not found.");
  if (application.status !== "Pending") {
    throw new HttpError(409, `This application was already ${application.status.toLowerCase()}.`);
  }

  const approved = decision === "Approved";
  AdoptionApplication.setStatus(id, decision);
  changeStatus(application.animalId, approved ? "Adopted" : "Available", {
    changedBy: staffId,
    note: `Application #${id} ${approved ? "approved" : "rejected"}`,
  });
  return AdoptionApplication.findById(id);
});

class ApplicationController {
  // GET /api/applications/mine   (Adopter only) -> newest first
  static mine(req, res) {
    res.json(AdoptionApplication.findByApplicant(req.user.id));
  }

  // POST /api/applications   (Adopter only)  body: { animalId, householdDetails }
  // 201 with the new application; 400 bad input; 404 no such animal;
  // 409 animal is not Available.
  static submitApplication(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    const animalId = parseId(String(body.animalId ?? ""), "animal id");

    const details = typeof body.householdDetails === "string" ? body.householdDetails.trim() : "";
    if (!details) {
      throw new HttpError(400, "Household details are required.", {
        fields: { householdDetails: "Tell us a little about your household." },
      });
    }
    if (details.length > MAX_HOUSEHOLD_DETAILS) {
      throw new HttpError(400, `Household details must be ${MAX_HOUSEHOLD_DETAILS} characters or fewer.`, {
        fields: { householdDetails: `Keep this under ${MAX_HOUSEHOLD_DETAILS} characters.` },
      });
    }

    // The applicant always comes from the login token, never from the body.
    const application = submit(animalId, req.user.id, details);
    res.status(201).json(application);
  }

  // GET /api/applications?status=Pending   (Staff only) -> oldest first,
  // each with the animal's name and the applicant's email.
  static listPending(req, res) {
    const status = optionalText(req.query.status, "status");
    if (status && status.toLowerCase() !== "pending") {
      throw new HttpError(400, "Only status=Pending is supported.");
    }
    res.json(AdoptionApplication.findPending());
  }

  // PUT /api/applications/:id/approve   (Staff only)
  // 200 with the application; 404 unknown ID; 409 already decided.
  static approve(req, res) {
    const id = parseId(req.params.id, "application id");
    res.json(decide(id, "Approved", req.user.id));
  }

  // PUT /api/applications/:id/reject   (Staff only)
  static reject(req, res) {
    const id = parseId(req.params.id, "application id");
    res.json(decide(id, "Rejected", req.user.id));
  }
}

module.exports = ApplicationController;