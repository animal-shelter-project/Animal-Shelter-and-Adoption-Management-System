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

module.exports = router;
