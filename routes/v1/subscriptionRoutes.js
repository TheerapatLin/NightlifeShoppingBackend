// routes/v1/subscriptionRoutes.js
const express = require("express");
const router = express.Router();
const subscriptionController = require("../../controllers/subscriptionControllers");
// const auth = require("../../middlewares/auth"); // เอาออกชั่วคราวเพื่อหลีกเลี่ยงปัญหา auth

// ===============================
// PUBLIC ROUTES
// ===============================

// ดูราคา subscription plans
router.get("/pricing", subscriptionController.getSubscriptionPricing);

// ===============================
// USER ROUTES (ต้อง login)
// ===============================

// ซื้อ subscription ใหม่หรือต่อเวลา
router.post("/purchase", subscriptionController.purchaseSubscription);

// ดู subscription ปัจจุบัน
router.get("/current", subscriptionController.getCurrentSubscription);

// ดูประวัติ subscription
router.get("/history", subscriptionController.getSubscriptionHistory);

// ยกเลิก subscription
router.patch("/cancel", subscriptionController.cancelSubscription);

// ดูระดับปัจจุบันของ user
router.get("/level", subscriptionController.getUserCurrentLevel);

// ===============================
// ADMIN ROUTES
// ===============================

// ดู subscription ทั้งหมด (สำหรับ admin)
router.get("/admin/all", subscriptionController.getAllSubscriptions);

module.exports = router;
