// routes/v1/subscriptionRoutes.js
const express = require("express");
const router = express.Router();
const subscriptionController = require("../../controllers/subscriptionControllers");
const auth = require("../../middlewares/auth");

// ===============================
// PUBLIC ROUTES
// ===============================

// ดูราคา subscription plans
router.get("/pricing", subscriptionController.getSubscriptionPricing);

// ===============================
// USER ROUTES (ต้อง login)
// ===============================

// ซื้อ subscription ใหม่หรือต่อเวลา
// router.post("/purchase", auth, subscriptionController.purchaseSubscription); // ปิดชั่วคราว

// ดู subscription ปัจจุบัน
router.get("/current", auth, subscriptionController.getCurrentSubscription);

// ดูประวัติ subscription
router.get("/history", auth, subscriptionController.getSubscriptionHistory);
router.get("/history/:userId", auth, subscriptionController.getSubscriptionHistory);

// ยกเลิก subscription
router.patch("/cancel", auth, subscriptionController.cancelSubscription);

// ดูระดับปัจจุบันของ user
router.get("/level", auth, subscriptionController.getUserCurrentLevel);

// ===============================
// ADMIN ROUTES
// ===============================

// ดู subscription ทั้งหมด (สำหรับ admin)
router.get("/admin/all", auth, subscriptionController.getAllSubscriptions);

// ===============================
// SUPER ADMIN ROUTES
// ===============================

// สร้าง subscription ให้ user (สำหรับ super admin)
router.post("/admin-create", auth, subscriptionController.adminCreateSubscription);

// ยกเลิก subscription (สำหรับ super admin)
router.delete("/admin-delete/:subscriptionId", auth, subscriptionController.adminDeleteSubscription);

module.exports = router;
