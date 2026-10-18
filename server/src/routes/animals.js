const express = require("express");
const AnimalController = require("../controllers/AnimalController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Public read routes.
router.get("/", AnimalController.list);
router.get("/:id", AnimalController.getById);

// Only authenticated Staff users may create or update animals.
router.post(
  "/",
  requireAuth,
  requireRole("Staff"),
  AnimalController.create,
);

router.put(
  "/:id",
  requireAuth,
  requireRole("Staff"),
  AnimalController.update,
);

// Proposal R-09 / R-12: status history and staff status changes.
router.get(
  "/:id/history",
  requireAuth,
  requireRole("Staff"),
  AnimalController.history,
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("Staff"),
  AnimalController.changeStatus,
);

module.exports = router;
