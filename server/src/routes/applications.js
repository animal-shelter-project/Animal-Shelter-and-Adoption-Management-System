const express = require("express");
const ApplicationController = require("../controllers/ApplicationController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", requireAuth, requireRole("Adopter"), ApplicationController.mine);
router.post("/", requireAuth, requireRole("Adopter"), ApplicationController.submitApplication);
// Step 3 adds: GET /?status=Pending (Staff), PUT /:id/approve and /:id/reject (Staff)

module.exports = router;