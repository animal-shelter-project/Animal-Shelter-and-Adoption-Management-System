const express = require("express");
const ApplicationController = require("../controllers/ApplicationController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const adopter = [requireAuth, requireRole("Adopter")];
const staff = [requireAuth, requireRole("Staff")];

router.get("/mine", ...adopter, ApplicationController.mine);
router.post("/", ...adopter, ApplicationController.submitApplication);
router.put("/:id/withdraw", ...adopter, ApplicationController.withdraw);

router.get("/", ...staff, ApplicationController.list);
router.put("/:id/approve", ...staff, ApplicationController.approve);
router.put("/:id/reject", ...staff, ApplicationController.reject);
router.put("/:id/notes", ...staff, ApplicationController.notes);

module.exports = router;
