// ✅ routes/userDealRoutes.js
const express = require("express");
const router = express.Router();
const {
  claimDeal,
  getUserDeals,
  getUserDealsByUserId,
  useUserDeal,
  deleteUserDeal,
  startUserDealSession // ✅ เพิ่มใหม่
} = require("../../controllers/userDealControllers");
const { verifyAccessTokenWeb } = require("../../middlewares/auth");

router.post("/claim", verifyAccessTokenWeb, claimDeal);
router.get("/byUser/:userId", verifyAccessTokenWeb, getUserDeals);
router.get("/:id", verifyAccessTokenWeb, getUserDealsByUserId);
router.put("/:id/use", verifyAccessTokenWeb, useUserDeal);
router.delete("/:id", verifyAccessTokenWeb, deleteUserDeal);

// ✅ เริ่มใช้งานดีลพร้อม lock serial (ใช้ transaction)
router.post("/start-session", verifyAccessTokenWeb, startUserDealSession);

module.exports = router;
