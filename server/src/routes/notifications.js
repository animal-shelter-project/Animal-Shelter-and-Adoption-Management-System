const express = require("express");
const NotificationController = require("../controllers/NotificationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, NotificationController.list);
router.post("/read", requireAuth, NotificationController.readAll);

module.exports = router;
