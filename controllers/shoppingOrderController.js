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
        if (!basket) {
            return res.status(404).json({ error: "ไม่พบ basket" });
        }

        if (!basket.items || basket.items.length === 0) {
            return res.status(404).json({ error: "ไม่พบ items ใน basket" });
        }

        const amountInSatang = Math.round(basket.totalPrice * 100);

        const basketId = basket._id.toString()

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInSatang,
            currency: "thb",
            automatic_payment_methods: { enabled: true },
            metadata: {
                basketId,
                userId,
                paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
            }
        });

        console.log("🎯 paymentIntent:", paymentIntent);

        return res.send({
            clientSecret: paymentIntent.client_secret,
            basketId,
            userId,
        });
    } catch (error) {
        console.error("❌ Error creating payment intent:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

exports.getShoppingOrderByUserId = async (req, res) => {
    try {
        const userId = req.params.userId;

        const shoppingOrders = await ProductShoppingOrder.find({ userId: userId })

        if (shoppingOrders.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" });
        }
        res.json(shoppingOrders);
    }
    catch (error) {
        console.error("Error fetching orders by userId:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getAllShoppingOrderForSuperadmin = async (req, res) => {
    try {
        const shoppingOrders = await ProductShoppingOrder.find({})

        if (!shoppingOrders || shoppingOrders.length === 0) {
            return res.status(404).json({ message: "ไม่มี Order ในขณะนี้" });
        }
        res.status(200).send(shoppingOrders)
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.updateShoppingOrderById = async (req, res) => {
    const orderId = req.params.orderId
    const {
        adminNote,
        status,
        originalPrice,
        paidAt } = req.body

    const updateFields = {};

    if (adminNote !== undefined) updateFields.adminNote = adminNote;
    if (status !== undefined) updateFields.status = status;
    if (originalPrice !== undefined) updateFields.originalPrice = originalPrice
    if (paidAt !== undefined) updateFields.paidAt = new Date(paidAt);

    try {
        const shoppingOrder = await ProductShoppingOrder.findByIdAndUpdate(
            orderId,
            updateFields,
            {
                new: true,
                runValidators: true,
            }
        )
        if (!shoppingOrder) return res.status(404).json({ message: "shoppingOrder not found" });
        res.json(shoppingOrder)
    }
    catch (error) {
        console.error("❌ Failed to update shoppingOrder:", err);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getShoppingOrderByCreaterId = async (req, res) => {
    try {
        const creatorId = req.params.creatorId;
        const orders = await ProductShoppingOrder.find({
            "items.creator.id": creatorId
        });
        if(!orders) {
            return res.status(404).json({ message: "ยังไม่มี order" })
        }
        res.json(orders);
    }
    catch (error) {
        console.error("Error fetching orders by creatorId:", error);
        res.status(500).json({ message: "Server error" });
    }
}