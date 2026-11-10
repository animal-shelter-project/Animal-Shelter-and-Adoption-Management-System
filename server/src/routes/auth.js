const express = require("express");
const AuthController = require("../controllers/AuthController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);
router.get("/me", requireAuth, AuthController.me);
router.put("/me", requireAuth, AuthController.updateMe);
router.put("/password", requireAuth, AuthController.changePassword);
router.post("/refresh", requireAuth, AuthController.refresh);

module.exports = router;
