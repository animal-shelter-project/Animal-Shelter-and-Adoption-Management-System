const express = require("express");
const AnimalController = require("../controllers/AnimalController");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");

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

module.exports = router;
