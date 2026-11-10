const express = require("express");
const AnimalController = require("../controllers/AnimalController");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const MedicalRecordController = require('../controllers/MedicalRecordController');
const AppointmentController = require("../controllers/AppointmentController");

const router = express.Router();
const staff = [requireAuth, requireRole("Staff")];

// Public read routes (staff also see archived animals).
router.get("/", optionalAuth, AnimalController.list);
router.get("/breeds", AnimalController.breeds);
router.get("/:id", optionalAuth, AnimalController.getById);

// Only authenticated Staff users may create, update or archive animals.
router.post("/", ...staff, AnimalController.create);
router.put("/:id", ...staff, AnimalController.update);
router.delete("/:id", ...staff, AnimalController.archive);
router.post("/:id/restore", ...staff, AnimalController.restore);

// Photos.
router.put("/:id/photo", ...staff, AnimalController.uploadPhoto);
router.delete("/:id/photo", ...staff, AnimalController.deletePhoto);

// Proposal R-09 / R-12: status history and staff status changes.
router.get("/:id/history", ...staff, AnimalController.history);
router.patch("/:id/status", ...staff, AnimalController.changeStatus);

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

// Proposal R-11: appointments for an animal (Staff only).
router.get("/:id/appointments", ...staff, AppointmentController.listForAnimal);
router.post("/:id/appointments", ...staff, AppointmentController.create);

module.exports = router;
