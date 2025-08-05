const {
  createOrderRateLimiter,
  getOrdersRateLimiter,
} = require("../../modules/ratelimit/orderRatelimiter");

module.exports = function (io) {
  const express = require("express");
  const router = express.Router();
  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

  const {
    getAllActivityOrders,
    createActivityPaymentIntent,
    getActivityOrdersByUserId,
    getAllOrdersForSuperadmin, // ✅ เพิ่ม
    updateOrderById, // ✅ เพิ่ม
  } = require("../../controllers/activityOrderControllers");

  const {
    verifyAccessToken,
    verifyRefreshToken,
    verifyAccessTokenWeb,
    verifyAccessTokenWebPass,
    authRoles,
  } = require("../../middlewares/auth");

  // ✅ Superadmin routes
  router.get(
    "/superadmin",
    [verifyAccessTokenWeb, authRoles(["superadmin"])],
    getAllOrdersForSuperadmin
  );
  router.put(
    "/superadmin/:id",
    [verifyAccessTokenWeb, authRoles(["superadmin"])],
    updateOrderById
  );

  router.post(
    "/create-payment-intent",
    createOrderRateLimiter,
    createActivityPaymentIntent
  );
  router.get("/", getOrdersRateLimiter, getAllActivityOrders);
  router.get("/:userId", getOrdersRateLimiter, getActivityOrdersByUserId);

  return {
    router,
  };
};
