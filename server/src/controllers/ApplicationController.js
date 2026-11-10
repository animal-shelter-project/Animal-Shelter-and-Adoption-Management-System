const db = require("../db");
const AdoptionApplication = require("../models/AdoptionApplication");
const Notification = require("../models/Notification");
const HttpError = require("../utils/HttpError");
const { changeStatus } = require("../services/AnimalStatusService");
const { parseId, optionalText } = require("../utils/validation");

const MAX_HOUSEHOLD_DETAILS = 1000;
const MAX_OTHER_PETS = 300;
const MAX_NOTES = 1000;
const HOME_TYPES = ["House", "Apartment", "Condo", "Mobile home", "Other"];
const OWN_OR_RENT = ["Own", "Rent"];

const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });

function wholeNumber(value, field, min, max, label) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw fieldError(field, `${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function choice(value, field, choices, label) {
  const match =
    typeof value === "string" && choices.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw fieldError(field, `Choose ${label}.`);
  return match;
}

function yesNo(value, field, label) {
  if (typeof value !== "boolean") throw fieldError(field, `Answer yes or no: ${label}`);
  return value;
}

// v2: the structured questions staff asked for. All required, except
// otherPets (may be empty) and landlordOk (only when renting).
function readAnswers(body) {
  const answers = {
    homeType: choice(body.homeType, "homeType", HOME_TYPES, "the type of home"),
    ownOrRent: choice(body.ownOrRent, "ownOrRent", OWN_OR_RENT, "whether you own or rent"),
    hasYard: yesNo(body.hasYard, "hasYard", "do you have a fenced yard?"),
    adults: wholeNumber(body.adults, "adults", 1, 20, "Adults in the home"),
    children: wholeNumber(body.children, "children", 0, 20, "Children in the home"),
    hoursAlone: wholeNumber(body.hoursAlone, "hoursAlone", 0, 24, "Hours alone on a typical day"),
    landlordOk: null,
    otherPets: "",
  };
  if (answers.ownOrRent === "Rent") {
    answers.landlordOk = yesNo(body.landlordOk, "landlordOk", "does your landlord allow pets?");
  }
  if (body.otherPets !== undefined && body.otherPets !== null) {
    if (typeof body.otherPets !== "string") throw fieldError("otherPets", "Other pets must be text.");
    answers.otherPets = body.otherPets.trim();
    if (answers.otherPets.length > MAX_OTHER_PETS) {
      throw fieldError("otherPets", `Keep this under ${MAX_OTHER_PETS} characters.`);
    }
  }
  return answers;
}

// US-05: one transaction. changeStatus throws 404 (no such animal) or 409
// (animal isn't Available, R-08), so no application row is saved in those cases.
const submit = db.transaction((animalId, applicantId, householdDetails, answers) => {
  changeStatus(animalId, "Pending", {
    changedBy: applicantId,
    note: "Adoption application submitted",
  });
  return AdoptionApplication.create({ animalId, applicantId, householdDetails, answers });
});

// US-06 / US-07: approve or reject, in one transaction. The application and
// the animal change together (and the change is logged in the status history),
// or neither does: if the animal can't make the move, changeStatus throws 409
// and the application stays Pending.
//   Approved -> animal becomes Adopted (R-07)
//   Rejected -> animal goes back to Available
// v2: the applicant also gets an in-app notification.
const decide = db.transaction((id, decision, staffId) => {
  const application = AdoptionApplication.findById(id);
  if (!application) throw new HttpError(404, "Application not found.");
  if (application.status !== "Pending") {
    throw new HttpError(409, `This application was already ${application.status.toLowerCase()}.`);
  }

  const approved = decision === "Approved";
  AdoptionApplication.setStatus(id, decision, { decidedBy: staffId });
  changeStatus(application.animalId, approved ? "Adopted" : "Available", {
    changedBy: staffId,
    note: `Application #${id} ${approved ? "approved" : "rejected"}`,
  });
  Notification.add(
    application.applicantId,
    approved
      ? `Good news! Your application to adopt ${application.animalName} was approved. The shelter will call you to arrange pick-up.`
      : `Your application to adopt ${application.animalName} was not approved this time. You're welcome to apply for another animal.`,
    "/my-applications",
  );
  return AdoptionApplication.findById(id);
});

// v2: the applicant withdraws a Pending application; the animal is
// Available again for other families.
const withdraw = db.transaction((id, applicantId) => {
  const application = AdoptionApplication.findById(id);
  if (!application || application.applicantId !== applicantId) {
    throw new HttpError(404, "Application not found.");
  }
  if (application.status !== "Pending") {
    throw new HttpError(409, `This application was already ${application.status.toLowerCase()}.`);
  }
  AdoptionApplication.setStatus(id, "Withdrawn", { decidedBy: applicantId });
  changeStatus(application.animalId, "Available", {
    changedBy: applicantId,
    note: `Application #${id} withdrawn by the applicant`,
  });
  return AdoptionApplication.findById(id);
});

class ApplicationController {
  // GET /api/applications/mine   (Adopter only) -> newest first
  static mine(req, res) {
    res.json(AdoptionApplication.findByApplicant(req.user.id));
  }

  // POST /api/applications   (Adopter only)
  // body: { animalId, householdDetails, homeType, ownOrRent, landlordOk?,
  //         hasYard, adults, children, otherPets?, hoursAlone }
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
    const answers = readAnswers(body);

    // The applicant always comes from the login token, never from the body.
    const application = submit(animalId, req.user.id, details, answers);
    res.status(201).json(AdoptionApplication.forApplicant(application));
  }

  // GET /api/applications?status=Pending|Approved|Rejected|Withdrawn|Returned|decided|all
  // (Staff only). Pending: oldest first. Others: most recently decided first.
  // Each with the animal, the applicant's contact details and their answers.
  static list(req, res) {
    const status = (optionalText(req.query.status, "status") || "pending").toLowerCase();
    if (!AdoptionApplication.STATUS_FILTERS[status]) {
      throw new HttpError(400, `Unknown status "${req.query.status}".`, {
        allowed: Object.keys(AdoptionApplication.STATUS_FILTERS),
      });
    }
    res.json(AdoptionApplication.findForStaff(status));
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

  // PUT /api/applications/:id/withdraw   (Adopter only, own Pending application)
  static withdraw(req, res) {
    const id = parseId(req.params.id, "application id");
    res.json(AdoptionApplication.forApplicant(withdraw(id, req.user.id)));
  }

  // PUT /api/applications/:id/notes { notes }   (Staff only; never shown to the applicant)
  static notes(req, res) {
    const id = parseId(req.params.id, "application id");
    if (!AdoptionApplication.findById(id)) throw new HttpError(404, "Application not found.");
    const notes = req.body?.notes;
    if (typeof notes !== "string") throw fieldError("notes", "Notes must be text.");
    if (notes.trim().length > MAX_NOTES) throw fieldError("notes", `Keep notes under ${MAX_NOTES} characters.`);
    res.json(AdoptionApplication.setNotes(id, notes.trim()));
  }
}

module.exports = ApplicationController;
module.exports.HOME_TYPES = HOME_TYPES;
