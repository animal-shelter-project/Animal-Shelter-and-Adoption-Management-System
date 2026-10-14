const express = require("express");
const AnimalController = require("../controllers/AnimalController");

const router = express.Router();

router.get("/", AnimalController.list);
router.get("/:id", AnimalController.getById);
// M3 (US-06) adds: router.post("/", requireAuth, requireRole("Staff"), ...)
//                  router.put("/:id", requireAuth, requireRole("Staff"), ...)

module.exports = router;
