const mongoose = require("mongoose");
const addressSchema = require("../address.schema");

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

    status: {
      type: String,
      enum: ["preparing", "packed", "pending", "picked", "transit", "hub", "delivering", "delivered", "failed", "cancelled", "returning"],
      // [preparing => ร้านค้ากำลังจัดเตรียมสินค้า, packed => สินค้าถูกแพ็คเรียบร้อยแล้ว, pending => รอพนักงานขนส่งมารับสินค้า, picked => ขนส่งรับสินค้าเรียบร้อยแล้ว, 
      // transit => สินค้ากำลังเดินทาง, hub => สินค้าอยู่ที่ศูนย์กระจายสินค้า, delivering => พนักงานกำลังนำส่งสินค้า, delivered => ส่งถึงปลายทางเรียบร้อย, 
      // failed => ส่งไม่สำเร็จ เช่น ไม่พบผู้รับ, cancelled => สินค้าถูกส่งกลับต้นทาง, returning => สินค้ากำลังส่งกลับต้นทาง]
      default: "preparing",
    },

    adminNote: [
      {
        message: { type: String, required: true },
        _id: false,
      },
    ],

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

    // บันทึกหรือหมายเหตุจากแอดมิน (เก็บเป็น array ของ object)
    adminNote: [
      {
        message: { type: String, required: true },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

const ProductShoppingOrder = mongoose.model("productShoppingOrder", productShoppingOrderSchema);
module.exports = ProductShoppingOrder;
