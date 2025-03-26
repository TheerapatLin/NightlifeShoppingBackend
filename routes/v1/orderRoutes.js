const { createOrderRateLimiter, getOrdersRateLimiter } = require("../../modules/ratelimit/orderRatelimiter");

module.exports = function (io) {
  const express = require("express");
  const router = express.Router();
  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

  const {
    getAllOrders,
    createPaymentIntent,
    getOrdersByUserId,
  } = require("../../controllers/orderControllers");

  router.post("/create-payment-intent", createOrderRateLimiter, createPaymentIntent);
  router.get("/", getOrdersRateLimiter, getAllOrders);
  router.get("/:userId", getOrdersRateLimiter, getOrdersByUserId);

  return {
    router,
  };
};
