const express = require("express");
const ApplicationController = require("../controllers/ApplicationController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/mine", requireAuth, requireRole("Adopter"), ApplicationController.mine);
router.post("/", requireAuth, requireRole("Adopter"), ApplicationController.submitApplication);

router.get("/", requireAuth, requireRole("Staff"), ApplicationController.listPending);
router.put("/:id/approve", requireAuth, requireRole("Staff"), ApplicationController.approve);
router.put("/:id/reject", requireAuth, requireRole("Staff"), ApplicationController.reject);

module.exports = router;