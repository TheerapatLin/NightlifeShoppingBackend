// routes/v1/subscriptionRoutes.js
const express = require("express");
const router = express.Router();
const subscriptionController = require("../../controllers/subscriptionControllers");
const { verifyAccessTokenWeb } = require("../../middlewares/auth");

// ===============================
// PUBLIC ROUTES
// ===============================

// ดูราคา subscription plans
router.get("/pricing", subscriptionController.getSubscriptionPricing);

// ===============================
// USER ROUTES (ต้อง login)
// ===============================

// ซื้อ subscription ใหม่หรือต่อเวลา
router.post("/purchase", verifyAccessTokenWeb, subscriptionController.purchaseSubscription);

// ดู subscription ปัจจุบัน
router.get("/current", verifyAccessTokenWeb, subscriptionController.getCurrentSubscription);

// ดูประวัติ subscription
router.get("/history", verifyAccessTokenWeb, subscriptionController.getSubscriptionHistory);
router.get("/history/:userId", verifyAccessTokenWeb, subscriptionController.getSubscriptionHistory);

// ยกเลิก subscription
router.patch("/cancel", verifyAccessTokenWeb, subscriptionController.cancelSubscription);

// ดูระดับปัจจุบันของ user
router.get("/level", verifyAccessTokenWeb, subscriptionController.getUserCurrentLevel);

// ===============================
// ADMIN ROUTES
// ===============================

// ดู subscription ทั้งหมด (สำหรับ admin)
router.get("/admin/all", verifyAccessTokenWeb, subscriptionController.getAllSubscriptions);

// ===============================
// SUPER ADMIN ROUTES
// ===============================

// สร้าง subscription ให้ user (สำหรับ super admin)
router.post("/admin-create", verifyAccessTokenWeb, subscriptionController.adminCreateSubscription);

// ยกเลิก subscription (สำหรับ super admin)
router.delete("/admin-delete/:subscriptionId", verifyAccessTokenWeb, subscriptionController.adminDeleteSubscription);

module.exports = router;
