const express = require("express");
const AuthController = require("../controllers/AuthController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Staff only: adopter accounts and password resets.
router.get("/", requireAuth, requireRole("Staff"), AuthController.listAdopters);
router.post("/:id/reset-password", requireAuth, requireRole("Staff"), AuthController.resetPassword);

module.exports = router;
