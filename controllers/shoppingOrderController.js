const {
    getStripeInstance,
    getEndpointSecret,
} = require("../utils/stripeUtils");
const mongoose = require("mongoose");
const crypto = require("crypto");
const redis = require("../app");

const ProductShoppingOrder = require("../schemas/v1/shopping/shopping.productOrder.schema")
const User = require("../schemas/v1/user.schema");
const ProductShopping = require("../schemas/v1/shopping/shopping.products.schema")
const BasketShopping = require("../schemas/v1/shopping/shopping.baskets.schema")

exports.createShoppingPaymentIntent = async (req, res) => {
    const stripe = getStripeInstance();
    const { userId } = req.body;

    try {
        if (!userId) {
            return res.status(400).json({ error: "ต้องระบุ userId" });
        }

        const basket = await BasketShopping.findOne({ userId });
        if (!basket || !basket.items || basket.items.length === 0) {
            return res.status(404).json({ error: "ไม่พบ basket หรือ basket ว่างเปล่า" });
        }

        const amountInSatang = Math.round(basket.totalPrice * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInSatang,
            currency: "thb",
            automatic_payment_methods: { enabled: true },
            metadata: {
                basketId: basket._id.toString(),
                userId: userId,
                items: JSON.stringify(basket.items.map(item => ({
                    productId: item.productId,
                    variant: item.variant,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                    paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
                })))
            }
        });
        return res.send({
            clientSecret: paymentIntent.client_secret,
            // orderId: order._id // ถ้าสร้าง order
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};