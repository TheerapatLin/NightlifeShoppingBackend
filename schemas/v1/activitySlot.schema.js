// schemas/v1/activitySlot.schema.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const activitySlotSchema = new Schema({
  businessId: { type: String, required: true }, // สำหรับ multi-tenant
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Activity",
    required: true,
  }, // เชื่อมกับ activity หลัก
  parentSlotId: { type: String, default: null }, // ถ้าต้องการทำ recurring slot
  creator: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    profileImage: String,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // เวลา
  date: { type: Date, required: true }, // วันที่จัด
  startTime: { type: Date, required: true }, // เวลาเริ่ม (เต็ม timestamp)
  endTime: { type: Date, required: true }, // เวลาสิ้นสุด (เต็ม timestamp)

  // ข้อมูลเพิ่มเติมของรอบ
  location: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
    name: String,
    description: String,
  },
  cost: { type: Number, default: 0 },
  // ✅ Subscription pricing - ราคาสำหรับระดับสมาชิกต่างๆ
  subscriptionPricing: {
    regular: { type: Number, default: 0 }, // ราคาปกติ (เหมือน cost เดิม)
    premium: { type: Number, default: 0 }, // ราคาสำหรับ premium members
    platinum: { type: Number, default: 0 }, // ราคาสำหรับ platinum members
    enabled: { type: Boolean, default: false }, // เปิด/ปิดระบบราคาแบบ subscription
  },
  participantLimit: { type: Number, default: 10 },
  requireRequestToJoin: { type: Boolean, default: true },
  notes: { type: String, default: "" },

  // การจัดการผู้เข้าร่วมในรอบนี้แยกจาก activity หลัก
  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      profileImage: String,
      paymentStatus: {
        type: String,
        enum: ["paid", "unpaid"],
        default: "unpaid",
      },
      attendanceStatus: {
        type: String,
        enum: ["interested", "requested", "joined", "banned"],
        default: "interested",
      },
      joinRequestTime: Date,
      postEventStatus: {
        type: String,
        enum: ["no show", "showed up", "good", "excellent"],
        default: "showed up",
      },
      adults: { type: Number, default: 1 }, // ✅ เพิ่ม
      children: { type: Number, default: 0 }, // ✅ เพิ่ม
    },
  ],

  // affiliate (กรณีต้องการแจก per-slot)
  affiliate: {
    enabled: { type: Boolean, default: false },
    rewardType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    rewardValue: { type: Number, default: 100 },
    maxRewardPerUser: { type: Number, default: 500 },
  },
});

// ✅ เพิ่ม index ก่อนสร้าง model
activitySlotSchema.index({ activityId: 1 });
activitySlotSchema.index({ date: 1 });
activitySlotSchema.index({ startTime: 1 });
activitySlotSchema.index({ businessId: 1 });
activitySlotSchema.index({ "participants.userId": 1 });
activitySlotSchema.index({ location: "2dsphere" }); // ต้องมาก่อน .model

const ActivitySlot = mongoose.model("ActivitySlot", activitySlotSchema);
module.exports = ActivitySlot;


