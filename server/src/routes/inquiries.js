const express = require("express");
const InquiryController = require("../controllers/InquiryController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const staff = [requireAuth, requireRole("Staff")];

// Anyone can send a foster or volunteer sign-up or a message; staff read them.
router.post("/", InquiryController.create);
router.get("/", ...staff, InquiryController.list);
router.patch("/:id", ...staff, InquiryController.setStatus);

module.exports = router;
