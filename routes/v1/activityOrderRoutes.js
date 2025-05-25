const { createOrderRateLimiter, getOrdersRateLimiter } = require("../../modules/ratelimit/orderRatelimiter");

module.exports = function (io) {
  const express = require("express");
  const router = express.Router();
  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

  const {
    getAllActivityOrders,
    createActivityPaymentIntent,
    getActivityOrdersByUserId,
  } = require("../../controllers/activityOrderControllers");

  router.post("/create-payment-intent", createOrderRateLimiter, createActivityPaymentIntent);
  router.get("/", getOrdersRateLimiter, getAllActivityOrders);
  router.get("/:userId", getOrdersRateLimiter, getActivityOrdersByUserId);

  return {
    router,
  };
};
