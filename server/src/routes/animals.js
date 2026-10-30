const express = require("express");
const AnimalController = require("../controllers/AnimalController");
const { requireAuth, requireRole } = require("../middleware/auth");
const MedicalRecordController = require('../controllers/MedicalRecordController');

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

// Staff can view an animal's medical records.
router.get(
  '/:id/medical-records',
  requireAuth,
  requireRole('Staff'),
  MedicalRecordController.listForAnimal
);

// Staff can add a medical record for an animal.
router.post(
  '/:id/medical-records',
  requireAuth,
  requireRole('Staff'),
  MedicalRecordController.createForAnimal
);

module.exports = router;
