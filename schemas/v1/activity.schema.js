// schemas/v1/activity.schema.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const participantSchema = new Schema({
  businessId: { type: String },
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
});

const scheduleSchema = new Schema({
  dayString: { type: String, required: true }, // เช่น "monday,wednesday,friday"
  detail: { type: String, default: "" }, // รายละเอียดของกิจกรรมในวันนั้น
  cost: { type: Number, default: 0 }, // ค่าใช้จ่าย
  startTime: { type: Date, required: true }, // เวลาเริ่มในวันนั้น
  endTime: { type: Date, required: true }, // เวลาสิ้นสุดในวันนั้น
});

const activitySchema = new Schema({
  businessId: { type: String },
  parentId: { type: String, default: null },
  creator: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    profileImage: String,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  location: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
    name: String,
    description: String,
  },
  activityTime: {
    start: Date,
    end: Date,
  },
  schedule: [scheduleSchema],
  chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" },
  category: { type: String, default: "healworld" },
  cost: { type: Number, default: 0 },
  certificate: {
    provided: { type: Boolean, default: false },
    hours: { type: Number, default: 0 },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  certificateRequest: [
    {
      realNameTH: String,
      realNameEN: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      requestTime: Date,
    },
  ],
  name: String,
  description: String,
  image: [{ order: Number, fileName: String }],
  points: Number,
  participantLimit: { type: Number, default: 10 },
  requireRequestToJoin: { type: Boolean, default: true },
  participants: [participantSchema],
  notes: { type: String, default: "" },
  announcements: [
    {
      message: String,
      date: { type: Date, default: Date.now },
    },
  ],
  reports: [
    {
      message: String,
      value: String,
      type: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],
  status: {
    type: { type: String, default: "normal" },
    value1: { type: String, default: "" },
    value2: { type: String, default: "" },
  },
  privacy: {
    visibility: {
      type: String,
      enum: ["public", "private", "group-specific"],
      default: "public",
    },
    visibleToGroups: [String],
    visibleToTags: [String],
  },
  tags: [String],
  activityCode: { type: String, default: "" },
  affiliate: {
    enabled: { type: Boolean, default: false }, // เปิดหรือปิดระบบ affiliate
    totalValue: { type: Number, default: 200 }, // เลขเป็นเลขที่ให้ affiliator ไปจัดสรรเอาเองได้ว่าถ้ามีคนลงผ่านลิงก์ตัวเองจะได้ส่วนแบ่งเท่าไหร่ และลดให้ลูกค้าเท่าไหร่ แต่รวมทั้งต้องได้เป็น totalvalue เช่น ถ้าเลือกให้ตัวเองได้ 150 ก็แปลว่าลูกค้าได้ลด 50 บาท ถ้า totalValue เป็น 200 บาท
    rewardType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    rewardValue: { type: Number, default: 100 }, // ถ้า fixed คือจำนวนเงิน / ถ้า percent คือ %
    maxRewardPerUser: { type: Number, default: 500 }, // (optional) จำกัดค่าตอบแทนต่อ user
    // ✅ NEW: specify whether budget applies "per_order" or "per_person"
    budgetApplyMode: {
      type: String,
      enum: ["per_order", "per_person"],
      default: "per_order",
    },
  },
});

activitySchema.index({ businessId: 1 });
activitySchema.index({ "creator.id": 1 });
activitySchema.index({ category: 1 });
activitySchema.index({ "privacy.visibility": 1 });
activitySchema.index({ activityCode: 1 });
activitySchema.index({ location: "2dsphere" });
activitySchema.index({ tags: 1 });


const Activity = mongoose.model("Activity", activitySchema);
module.exports = Activity;

