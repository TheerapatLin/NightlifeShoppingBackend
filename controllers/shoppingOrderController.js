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
const CreatorShoppingOrder = require("../schemas/v1/shopping/shopping.creatorOrder.schema")
const RegularUserData = require("../schemas/v1/userData/regularUserData.schema");

exports.createShoppingPaymentIntent = async (req, res) => {
    const stripe = getStripeInstance();
    const { userId, newAddress } = req.body;

    try {
        if (!userId) {
            return res.status(400).json({ error: "ต้องระบุ userId" });
        }

        // ตรวจสอบและเตรียมข้อมูลที่อยู่
        let shippingAddress = null;

        if (!newAddress || newAddress.length === 0) {
            // ดึงที่อยู่จาก userData
            const user = await User.findById(userId).populate('userData');
            if (user && user.userData && user.userData.address && user.userData.address.length > 0) {
                shippingAddress = {
                    address: user.userData.address[0].address,
                    addressStatus: 'default',
                    addressName: 'ที่อยุ่เดิม'
                };
            } else {
                return res.status(404).json({ error: "ไม่พบข้อมูลที่อยู่ กรุณากรอกข้อมูลที่อยู่" });
            }
        } else if (newAddress && newAddress.length > 0) {
            // ใช้ที่อยู่ใหม่
            shippingAddress = {
                address: newAddress[0],
                addressStatus: 'default',
                addressName: 'ที่อยู่ใหม่'
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

        const shoppingOrders = await ProductShoppingOrder.find({ "user.id": userId })

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
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const rawLimit = parseInt(req.query.limit, 10) || 20;
        const limit = Math.min(Math.max(rawLimit, 1), 100);
        const sortKey = req.query.sortKey || "createdAt";
        const sortOrder = (req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1

        const sortMap = {
            createdAt: "createdAt",
            paidAt: "paidAt",
            originalPrice: "originalPrice",
            status: "status",
            paymentMode: "paymentMode",
            adminNote: "adminNote"
        };
        const sortField = sortMap[sortKey] || "createdAt";
        const sortOption = { [sortField]: sortOrder };

        const filter = {};
        if (req.query.status) {
            const statusArr = String(req.query.status)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const hasAll = statusArr.some((s) => s.toLowerCase() === "all");
            if (!hasAll && statusArr.length > 0) {
                filter.status = { $in: statusArr };
            }
        }

        const q = (req.query.q || "").trim();
        if (q) {
            const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ "user.name": regex }];
        }

        const skip = (page - 1) * limit;

        const shoppingOrders = await ProductShoppingOrder.find(filter).sort(sortOption).skip(skip).limit(limit)

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

    if (adminNote !== undefined) updateFields.adminNote = adminNote;
    if (status !== undefined) updateFields.status = status;
    if (paidAt !== undefined) updateFields.paidAt = new Date(paidAt);

    if (!orderId) {
        res.status(400).json({ message: `กรุณาระบุ orderId` });
    }

    try {
        const order = await ProductShoppingOrder.findById(orderId)
        if (!order) {
            res.status(404).json({ message: `ไม่พบ order: ${orderId}` });
        }
        if (adminNote !== undefined) {
            order.adminNote.push(...adminNote)
            order.save()
        }

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
        console.error("❌ Failed to update shoppingOrder:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getShoppingOrderByCreaterId = async (req, res) => { // not done yet
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

exports.getOrderById = async (req, res) => {
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

        return res.status(200).json(order)
    }
    catch (error) {
        console.error("Error fetching order by Id:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getCreatorShoppingOrderByCreatorId = async (req, res) => {
    const userId = req.params.userId

    if (!userId) {
        return res.status(400).json({ message: `กรุณาระบุ userId` })
    }

    try {
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: `ไม่พบ user` })
        }

        const creatorOrder = await CreatorShoppingOrder.find({ "creator.id": userId })
        if (!creatorOrder) {
            return res.status(404).json({ message: `ไม่พบ Order ของ Creator นี้` })
        }

        return res.status(200).json({
            message: "Fetched CreatorShoppingOrder by creatorId successful.",
            order: creatorOrder
        });
    }
    catch (error) {
        console.error("Error fetching CreatorShoppingOrder by creatorId:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getCreatorShoppingOrderById = async (req, res) => {
    const creatorOrderId = req.params.creatorOrderId
    if (!creatorOrderId) {
        return res.status(400).json({ message: `กรุณาระบุ creatorOrderId` })
    }

    try {
        const creatorOrder = await CreatorShoppingOrder.findById(creatorOrderId)
        if (!creatorOrder) {
            return res.status(404).json({ message: `ไม่พบ CreatorOrder ID: ${creatorOrderId} นี้` })
        }

        return res.status(200).json({
            message: "Fetched CreatorShoppingOrder by Id successful.",
            order: creatorOrder
        });
    }
    catch (error) {
        console.error("Error fetching CreatorShoppingOrder By Id:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.editCreatorShoppingOrderById = async (req, res) => {
    const creatorOrderId = req.params.creatorOrderId
    if (!creatorOrderId) {
        return res.status(400).json({ message: `กรุณาระบุ creatorOrderId` })
    }

    const {
        adminNote,
        status,
    } = req.body

    const updateFields = {};

    if (adminNote !== undefined) updateFields.adminNote = adminNote;
    if (status !== undefined) updateFields.status = status;

    try {
        const creatorOrder = await CreatorShoppingOrder.findByIdAndUpdate(
            creatorOrderId,
            updateFields,
            {
                // new: true → จะ return document ใหม่ (ที่อัปเดตแล้ว) กลับมา
                new: true,
                // runValidators: true → Mongoose จะบังคับใช้ validation rules ที่ตั้งไว้ใน schema
                runValidators: true,
            }
        )
        if (!creatorOrder) return res.status(404).json({ message: "CreatorOrder Not Found" });

        const order = await ProductShoppingOrder.findOneAndUpdate(
            { paymentIntentId: creatorOrder.paymentIntentId },
            {
                $set: {
                    adminNote: adminNote || []
                }
            },
            {
                // new: true → จะ return document ใหม่ (ที่อัปเดตแล้ว) กลับมา
                new: true,
                // runValidators: true → Mongoose จะบังคับใช้ validation rules ที่ตั้งไว้ใน schema
                runValidators: true,
            }
        )
        if (!order) return res.status(404).json({ message: "Order Not Found" });

        return res.status(200).json({
            message: "Updated CreatorShoppingOrder by Id successful.",
            creatorOrder: creatorOrder,
            order: order
        });
    }
    catch (error) {
        console.error("Error updating CreatorShoppingOrder By Id:", error);
        res.status(500).json({ message: "Server error" });
    }

}

exports.editProductCreaterOrderById = async (req, res) => {
    const creatorOrderId = req.params.creatorOrderId
    if (!creatorOrderId) {
        return res.status(400).json({ message: `กรุณาระบุ creatorOrderId` })
    }

    const {
        adminNote,
        status,
        productId,
        sku
    } = req.body

    try {
        const creatorOrder = await CreatorShoppingOrder.findById(creatorOrderId)
        if (!creatorOrder) {
            return res.status(404).json({ message: `ไม่พบ CreatorOrder ID: ${creatorOrderId} นี้` })
        }

        let foundItemCreatorOrder = false
        for (let index = 0; index < creatorOrder.variant.length; index++) {
            if (creatorOrder.variant[index].productId.toString() === productId && creatorOrder.variant[index].sku === sku) {
                creatorOrder.variant[index].adminNote = adminNote || []
                creatorOrder.variant[index].status = status || "preparing"
                foundItemCreatorOrder = true
                continue
            }
        }
        if (foundItemCreatorOrder === false) {
            return res.status(404).json({ message: `ไม่พบ productId: ${productId} และ sku: ${sku} นี้ใน CreatorOrder` })
        }

        const order = await ProductShoppingOrder.findOne({ paymentIntentId: creatorOrder.paymentIntentId })
        if (!order) {
            return res.status(404).json({ message: `ไม่พบ Order` })
        }

        let foundItemOrder = false
        for (let index = 0; index < order.items.length; index++) {
            if (order.items[index].productId.toString() === productId && order.items[index].variant.sku === sku) {
                order.items[index].adminNote = adminNote || []
                order.items[index].status = status || "preparing"
                foundItemOrder = true
                continue
            }
        }
        if (foundItemOrder === false) {
            return res.status(404).json({ message: `ไม่พบ productId: ${productId} และ sku: ${sku} นี้ใน Order` })
        }

        await creatorOrder.save()
        await order.save()

        return res.status(200).json({
            message: "Updated CreatorShoppingOrder by Id successful.",
            creatorOrder: creatorOrder,
            order: order
        });
    }
    catch (error) {
        console.error("Error updating ProductCreaterOrder By Id:", error);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getAllCreatorShoppingOrderSuperAdmin = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const rawLimit = parseInt(req.query.limit, 10) || 20;
        const limit = Math.min(Math.max(rawLimit, 1), 100);
        const sortKey = req.query.sortKey || "createdAt";
        const sortOrder = (req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1

        const sortMap = {
            createdAt: "createdAt",           
            "buyer.name": "buyer.name",
            "creator.name": "creator.name",
            paidAt: "paidAt",
            status: "status",
            paymentMode: "paymentMode",
            adminNote: "adminNote"
        };

        const sortField = sortMap[sortKey] || "createdAt";
        const sortOption = { [sortField]: sortOrder };

        const filter = {};
        if (req.query.status) {
            const statusArr = String(req.query.status)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const hasAll = statusArr.some((s) => s.toLowerCase() === "all");
            if (!hasAll && statusArr.length > 0) {
                filter.status = { $in: statusArr };
            }
        }

        const q = (req.query.q || "").trim();
        if (q) {
            const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ "buyer.name": regex },{ "creator.name": regex }];
        }

        const skip = (page - 1) * limit;

        const allCreatorOrder = await CreatorShoppingOrder.find(filter).sort(sortOption).skip(skip).limit(limit)
        if (!allCreatorOrder) {
            return res.status(404).json({ message: `ไม่พบ Order` })
        }

        return res.status(200).json({
            message: "Fetched All CreatorShoppingOrder successful.",
            order: allCreatorOrder
        });
    }
    catch (error) {
        console.error("Error fetching All CreatorShoppingOrder:", error);
        res.status(500).json({ message: "Server error" });
    }
}

