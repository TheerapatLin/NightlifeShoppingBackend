// ✅ routes/dealRoutes.js
const express = require("express");
const router = express.Router();
const {
  createDeal, getAllDeals, getDealById, updateDeal, deleteDeal
} = require("../../controllers/dealControllers");
const { verifyAccessTokenWeb, authRoles } = require("../../middlewares/auth");

router.post("/createDeal", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], createDeal);
router.get("/", getAllDeals);
router.get("/:id", getDealById);
router.put("/:id", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], updateDeal);
router.delete("/:id", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], deleteDeal);

module.exports = router;