const { Stripe } = require("stripe");
require("dotenv").config();

const getStripeInstance = () => {
  const mode = (process.env.STRIPE_MODE || "test").toUpperCase();
  const secretKey = process.env[`STRIPE_SECRET_KEY_${mode}`];
  console.log("secretKey :", secretKey);
  return new Stripe(secretKey);
};

const getEndpointSecret = () => {
  const mode = (process.env.STRIPE_MODE || "test").toUpperCase();
  return process.env[`STRIPE_ENDPOINT_SECRET_${mode}`];
};

const calculateOrderAmount = (items) => {
  return (
    items.reduce(
      (total, item) =>
        total + item.costPerPerson * (item.amountAdults + item.amountChildren),
      0
    ) * 100
  ); // รวมจำนวนเงินและคูณด้วย 100
};

module.exports = {
  getStripeInstance,
  getEndpointSecret,
  calculateOrderAmount,
};
