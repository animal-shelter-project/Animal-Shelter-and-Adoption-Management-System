const db = require("../db");
const AdoptionApplication = require("../models/AdoptionApplication");
const HttpError = require("../utils/HttpError");
const { changeStatus } = require("../services/AnimalStatusService");
const { parseId } = require("../utils/validation");

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
}

module.exports = ApplicationController;