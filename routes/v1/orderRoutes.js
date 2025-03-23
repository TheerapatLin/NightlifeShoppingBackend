module.exports = function (io) {
  const express = require("express");
  const router = express.Router();
  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

  const {
    getAllOrders,
    createPaymentIntent,
    getOrdersByUserId,
  } = require("../../controllers/orderControllers");

  router.post("/create-payment-intent", createPaymentIntent);
  router.get("/", getAllOrders);
  router.get("/:userId", getOrdersByUserId);

  return {
    router,
  };
};
