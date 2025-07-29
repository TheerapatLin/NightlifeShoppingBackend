const mongoose = require("mongoose");

const discountCodeSchema = new mongoose.Schema({
  // รหัสโค้ด เช่น "WELCOME100"
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  // คำอธิบายโค้ดแบบย่อ รองรับหลายภาษา เช่น { th: "ลด 100 บาท", en: "100 Baht off" }
  shortDescription: {
    type: Object,
    default: {},
  },

  // คำอธิบายโค้ดแบบเต็ม เช่น { th: "ลดทันที 100 บาท สำหรับการจองครั้งแรก", en: "..." }
  description: {
    type: Object,
    default: {},
  },

  // คำอธิบายสิทธิพิเศษแบบย่อ เช่น { th: "ฟรี 1 ดริ้งค์", en: "Free drink" }
  shortBonusDescription: {
    type: Object,
    default: {},
  },

  // คำอธิบายสิทธิพิเศษแบบเต็ม เช่น { th: "รับฟรีเครื่องดื่ม 1 แก้วที่บาร์แรก", en: "..." }
  bonusDescription: {
    type: Object,
    default: {},
  },

  // ประเภทส่วนลด:
  // - percent = ลด % จากราคาปกติ
  // - amount = ลดจำนวนเงิน
  // - fixed_price = จ่ายราคาตายตัว
  // - free = ไม่ต้องจ่ายเลย
  // - bonus_only = ไม่มีส่วนลด แต่มีของแถมหรือสิทธิพิเศษ
  discountType: {
    type: String,
    enum: ["percent", "amount", "fixed_price", "free", "bonus_only"],
    required: true,
  },

  // ค่าที่ใช้ร่วมกับประเภทส่วนลด เช่น 20, 100, 199 (หรือ 0 สำหรับ free)
  discountValue: {
    type: Number,
    default: 0,
  },

  // วันที่เริ่มใช้งานโค้ด
  validFrom: {
    type: Date,
    required: true,
  },

  // วันที่หมดอายุของโค้ด
  validUntil: {
    type: Date,
    required: true,
  },

  // จำกัดจำนวนครั้งที่โค้ดนี้ถูกใช้งานได้ทั้งหมด (null = ไม่จำกัด)
  usageLimit: {
    type: Number,
    default: null,
  },

  // นับจำนวนครั้งที่ถูกใช้งานแล้ว
  usedCount: {
    type: Number,
    default: 0,
  },

  // จำกัดจำนวนครั้งที่ "ผู้ใช้ 1 คน" ใช้โค้ดนี้ได้ (default: 1)
  perUserUsageLimit: {
    type: Number,
    default: 1,
  },

  // สถานะการเปิดใช้งาน (true = เปิดใช้ได้, false = ปิดชั่วคราว)
  isActive: {
    type: Boolean,
    default: true,
  },

  // ใช้ร่วมกับโค้ดอื่นได้หรือไม่ (default: false)
  combinable: {
    type: Boolean,
    default: false,
  },

  // กำหนด user level ที่มีสิทธิ์ใช้ เช่น ['member', 'vip']
  allowedUserLevels: {
    type: [String],
    default: [],
  },
  eventIdsInorExclude: { type: String, default: "exclude" },
  // จำกัดให้ใช้กับเฉพาะ event ที่กำหนด (ถ้าไม่ระบุ = ใช้ได้ทุก event)
  eventIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Event",
    default: [],
  },

  // affiliate ที่โปรโมทโค้ดนี้ (ถ้ามี)
  affiliateUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  // รูปแบบค่าตอบแทน affiliate:
  // - fixed = จ่ายเป็นจำนวนเงินตายตัว
  // - percent_total = % จากราคารวม
  // - percent_paid = % จากยอดชำระจริง
  affiliateCommissionType: {
    type: String,
    enum: ["fixed", "percent_total", "percent_paid"],
    default: null,
  },

  // มูลค่าค่าคอมมิชชั่นที่ต้องจ่ายให้ affiliate
  affiliateCommissionValue: {
    type: Number,
    default: 0,
  },

  // ค่าคอมขั้นต่ำต่อการใช้งานโค้ด 1 ครั้ง
  affiliateMinPayoutPerUse: {
    type: Number,
    default: 0,
  },

  // หมายเหตุอื่นๆ สำหรับ admin
  notes: {
    type: String,
    default: null,
  },

  loginNeed: {
    type: Boolean,
    default: false,
  },

  caseSensitive: {
    type: Boolean,
    default: false,
  },

  isPerOrder: { type: Boolean, default: true },

  userRestrictionMode: {
    type: String,
    enum: ["all", "include", "exclude"],
    default: "all",
  },

  allowedUserEmails: [
    {
      type: String,
      lowercase: true,
      trim: true,
    },
  ],

  blockedUserEmails: [
    {
      type: String,
      lowercase: true,
      trim: true,
    },
  ],

  // ผู้สร้างโค้ดนี้ (admin หรือระบบ)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },

  // เวลาที่สร้าง
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // เวลาที่แก้ไขล่าสุด
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// อัปเดต updatedAt อัตโนมัติเมื่อมีการ save
discountCodeSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("DiscountCode", discountCodeSchema);
