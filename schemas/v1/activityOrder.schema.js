// schemas/v1/activityOrder.schema.js
const mongoose = require("mongoose");

const activityOrderSchema = new mongoose.Schema(
  {
    paymentIntentId: { type: String, required: true },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
    },

    // ✅ เพิ่มเพื่อเก็บ ActivitySlot ที่ใช้จริงในรอบนี้
    activitySlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActivitySlot",
      default: null,
    },

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

    // ส่วนลดที่ได้รับ (อาจมาจากโค้ด หรือโปรโมชั่น)
    discountAmount: {
      type: Number,
      default: 0,
    },

    // ราคาที่จ่ายจริงหลังหักส่วนลด
    paidAmount: {
      type: Number,
      required: true,
    },

    // โมดของ payment (test / live)
    paymentMode: {
      type: String,
      enum: ["test", "live"],
      default: "test",
    },

    // จำนวนผู้ใหญ่และเด็ก
    adults: {
      type: Number,
      default: 1,
      min: 0,
    },

    children: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ID ของโค้ดส่วนลดที่ใช้ (ถ้ามี)
    discountCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscountCode",
      default: null,
    },

    // ID ของ affiliate ผู้ที่แชร์ลิงก์แล้วมีคนจ่ายเงิน
    affiliateUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // affiliate code
    affiliateCode: { type: String, default: "" },

    affiliateRewardAmount: {
      type: Number,
      default: 0,
    },

    affiliateDiscountAmount: {
      type: Number,
      default: 0,
    },

    affiliateBudgetApplyMode: {
      type: String,
      enum: ["per_order", "per_person"],
      default: "per_order",
    },

    // ช่องทางการชำระเงิน เช่น stripe
    paymentGateway: {
      type: String,
      default: "stripe",
    },

    // วันที่ลูกค้าทำการจอง (เวลาที่เริ่ม initiate booking)
    bookingDate: {
      type: Date,
      default: Date.now,
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

    // บันทึกหรือหมายเหตุจากแอดมิน
    adminNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

activityOrderSchema.index({ userId: 1, createdAt: -1 });
activityOrderSchema.index({ status: 1, createdAt: -1 });
activityOrderSchema.index({ activityId: 1 });
activityOrderSchema.index({ paidAt: -1 });
activityOrderSchema.index({ affiliateUserId: 1 });
activityOrderSchema.index({ discountCodeId: 1 });
activityOrderSchema.index({ paymentIntentId: 1 }, { unique: true });

const ActivityOrder = mongoose.model("ActivityOrder", activityOrderSchema);
module.exports = ActivityOrder;
