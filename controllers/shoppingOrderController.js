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
const RegularUserData = require("../schemas/v1/userData/regularUserData.schema")

exports.createShoppingPaymentIntent = async (req, res) => {
    const stripe = getStripeInstance();
    const { userId, newAddress } = req.body;



    try {
        if (!userId) {
            return res.status(400).json({ error: "ต้องระบุ userId" });
        }

        // ตรวจสอบและเตรียมข้อมูลที่อยู่
        let shippingAddress = null;

        if (!newAddress) {
            // ดึงที่อยู่จาก userData
            const user = await User.findById(userId).populate('userData');
            shippingAddress = {
                address: user.userData.address[0].address,
                addressStatus: 'default',
                addressName: 'new address'
            };
            console.log(`shippingAddress => ${shippingAddress}`)
        } else if (newAddress) {
            // ใช้ที่อยู่ใหม่
            shippingAddress = {
                address: newAddress,
                addressStatus: 'default',
                addressName: 'new address'
            };
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
                shippingAddress: JSON.stringify(shippingAddress),
                paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
            }
        });

        return res.send({
            clientSecret: paymentIntent.client_secret,
            basketId,
            userId,
            shippingAddress: JSON.stringify(shippingAddress),
        });
    } catch (error) {
        console.error("❌ Error creating payment intent:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

exports.getShoppingOrderByUserId = async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "ต้องระบุ userId" });
        }

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
        paidAt } = req.body

    const updateFields = {};

    if (status !== undefined) updateFields.status = status;
    if (paidAt !== undefined) updateFields.paidAt = new Date(paidAt);

    if (!orderId) {
        res.status(400).json({ message: `กรุณาระบุ orderId` });
    }

    const order = await ProductShoppingOrder.findById(orderId)
    if (!order) {
        res.status(404).json({ message: `ไม่พบ order: ${orderId}` });
    }
    if (adminNote !== undefined) {
        console.log(`adminNote => ${JSON.stringify(adminNote)}`)
        order.adminNote.push(...adminNote)
        order.save()
        console.log(`order.adminNote => ${order.adminNote}`)
    }

    try {
        const shoppingOrder = await ProductShoppingOrder.findByIdAndUpdate(
            orderId,
            updateFields,
            {
                // new: true → จะ return document ใหม่ (ที่อัปเดตแล้ว) กลับมา
                new: true,
                // runValidators: true → Mongoose จะบังคับใช้ validation rules ที่ตั้งไว้ใน schema
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
        if (!orders) {
            return res.status(404).json({ message: "ยังไม่มี order" })
        }
        res.json(orders);
    }
    catch (error) {
        console.error("Error fetching orders by creatorId:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getOrderByIdUser = async (req, res) => {
    try {
        const orderId = req.params.orderId
        const userId = req.params.userId || req.body.userId || req.query.userId

        if (!orderId) {
            return res.status(400).json({ message: `กรุณาระบุ orderId` })
        }

        const order = await ProductShoppingOrder.findById(orderId)
        if (!order) {
            return res.status(404).json({ message: `ไม่พบ order` })
        }

        if (!userId) {
            return res.status(400).json({ message: `กรุณาระบุ userId` })
        }

        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: `ไม่พบ user` })
        }

        if (order.userId.toString() !== userId.toString()) {
            return res.status(401).json({ message: `คุณสามารถดู Order ได้แค่ของตัวเองเท่านั้น` })
        }

        return res.status(200).json(order)
    }
    catch (error) {
        console.error("Error fetching order by Id:", error);
        res.status(500).json({ message: "Server error" });
    }
}

