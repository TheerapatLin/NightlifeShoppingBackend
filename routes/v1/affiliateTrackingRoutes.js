const express = require("express");
const router = express.Router();
const {
  verifyAccessToken,
  verifyRefreshToken,
  verifyAccessTokenWeb,
  authRoles,
} = require("../../middlewares/auth");

const {
  trackAffiliateClick,
  markBookingAsConfirmed,
  getAffiliateStatsByUser,
} = require("../../controllers/affiliateTrackingController");

// เมื่อมีการคลิกผ่าน affiliate link
router.post("/track-click", trackAffiliateClick);

// หลังจากมีการจองสำเร็จ
router.post("/mark-booking", markBookingAsConfirmed);

// สรุปยอด referral และ reward
router.get("/stats", verifyAccessTokenWeb, getAffiliateStatsByUser);

module.exports = router;
