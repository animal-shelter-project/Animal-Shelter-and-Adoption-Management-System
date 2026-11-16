const express = require("express");
const WishListController = require("../controllers/WishListController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const staff = [requireAuth, requireRole("Staff")];

// Public: see what is needed and promise to bring something.
router.get("/", WishListController.list);
router.post("/:id/pledges", WishListController.pledge);
// Staff: manage the list and see who promised what.
router.get("/pledges", ...staff, WishListController.pledges);
router.post("/", ...staff, WishListController.create);
router.put("/:id", ...staff, WishListController.update);
router.delete("/:id", ...staff, WishListController.remove);

module.exports = router;
