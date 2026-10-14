const express = require("express");
const ApplicationController = require("../controllers/ApplicationController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", requireAuth, requireRole("Adopter"), ApplicationController.mine);
// M2 adds: POST / (Adopter), GET /?status=Pending (Staff),
//          PUT /:id/approve and PUT /:id/reject (Staff)

module.exports = router;
