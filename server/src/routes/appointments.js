const express = require("express");
const AppointmentController = require("../controllers/AppointmentController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const staff = [requireAuth, requireRole("Staff")];

router.get("/", ...staff, AppointmentController.upcoming);
router.patch("/:id", ...staff, AppointmentController.setStatus);

module.exports = router;
