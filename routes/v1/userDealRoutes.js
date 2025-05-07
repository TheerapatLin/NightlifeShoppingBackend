const express = require("express");
const router = express.Router();
const {
  claimDeal, getUserDeals, getUserDealById, useUserDeal, deleteUserDeal
} = require("../../controllers/userDealControllers");
const { verifyAccessTokenWeb } = require("../../middlewares/auth");

router.post("/claim", verifyAccessTokenWeb, claimDeal);
router.get("/byUser/:userId", verifyAccessTokenWeb, getUserDeals);
router.get("/:id", verifyAccessTokenWeb, getUserDealById);
router.put("/:id/use", verifyAccessTokenWeb, useUserDeal);
router.delete("/:id", verifyAccessTokenWeb, deleteUserDeal);

module.exports = router;