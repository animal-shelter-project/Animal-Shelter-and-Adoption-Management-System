const AdoptionApplication = require("../models/AdoptionApplication");

// M2 adds submitApplication, listPending, approve and reject here (US-03/04).
class ApplicationController {
  // GET /api/applications/mine   (Adopter only) -> newest first
  static mine(req, res) {
    res.json(AdoptionApplication.findByApplicant(req.user.id));
  }
}

module.exports = ApplicationController;
