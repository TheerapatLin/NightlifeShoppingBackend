const mongoose = require("mongoose");
const addressSchema = require("../address.schema");

const CreatorOrderSchema = new mongoose.Schema(
    {
        paymentIntentId: { type: String, required: true },

        buyerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductShopping',
            required: true
        },

        variant: [
            {
                sku: { type: String },
                quantity: { type: Number, required: true, min: 1 },
                originalPrice: { type: Number, required: true },
                totalPrice: { type: Number, required: true },
            }
        ],

        status: {
            type: String,
            enum: ["paid", "pending", "failed", "refunded", "cancelled"],
            default: "pending",
        },

        // โมดของ payment (test / live)
        paymentMode: {
            type: String,
            enum: ["test", "live"],
            default: "test",
        },

        // ช่องทางการชำระเงิน เช่น stripe
        paymentGateway: {
            type: String,
            default: "stripe",
        },

        // วันที่ทำการชำระเงินเสร็จ (เวลาจ่ายเสร็จ)
        paidAt: {
            type: Date,
            default: null,
        },

        // ข้อมูล debug หรือ webhook response ที่เกี่ยวข้อง
        paymentMetadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },

        // ที่อยู่จัดส่ง
        ShippingAddress:
        {
            address: { type: addressSchema },
            addressStatus: {
                type: String,
                default: "default"
            },
            addressName: {
                type: String,
                default: "undefined"
            },
        },
        adminNote: [
            {
                message: { type: String, required: true },
                _id: false,
            },
        ],

    },
    { timestamps: true }
)

const CreatorShoppingOrder = mongoose.model("creatorShoppingOrder", CreatorOrderSchema);
module.exports = CreatorShoppingOrder;