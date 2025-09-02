const mongoose = require("mongoose");

const OrderItemShoppingSchema = new mongoose.Schema(
  {
    creator: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductShopping',
      required: true
    },

    variant: {
      sku: { type: String }, // รหัส variant ที่เลือก
    },

    quantity: { type: Number, required: true, min: 1 },

    originalPrice: { type: Number, required: true },

    totalPrice: { type: Number, required: true },

  });

const productShoppingOrderSchema = new mongoose.Schema(
  {
    paymentIntentId: { type: String, required: true },

    items: [OrderItemShoppingSchema],

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["paid", "pending", "failed", "refunded", "cancelled"],
      default: "pending",
    },

    // ราคาที่ลูกค้าต้องจ่าย (ยังไม่รวมส่วนลด)
    originalPrice: {
      type: Number,
      required: true,
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

    // บันทึกหรือหมายเหตุจากแอดมิน (เก็บเป็น array ของ object)
    adminNote: [
      {
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const ProductShoppingOrder = mongoose.model("productShoppingOrder", productShoppingOrderSchema);
module.exports = ProductShoppingOrder;
