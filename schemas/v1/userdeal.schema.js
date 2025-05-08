const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const userDealSchema = new Schema(
  {
    // 👤 ผู้ใช้ที่รับดีลนี้
    userId: { type: Types.ObjectId, ref: "User", required: true },

    // 🔗 อ้างอิงไปยังดีลต้นทาง
    dealId: { type: Types.ObjectId, ref: "Deal", required: true },

    // 🕒 เวลาที่กดรับดีล
    claimedAt: { type: Date, default: Date.now },

    // 💸 ราคาที่จ่ายจริงตอนรับดีล (เผื่อมี promo เฉพาะ user)
    pricePaid: { type: Number, required: true },

    // 🔢 เลข serial ของการใช้ดีลนี้ (เมื่อเริ่ม session)
    useSerialNumber: { type: Number },

    // ✅ ใช้ดีลแล้วหรือยัง (true เมื่อใช้ครบหมด หรือใช้ครั้งแรกแล้วในกรณีจำกัดครั้งเดียว)
    isUsed: { type: Boolean, default: false },

    // 🔢 ใช้ไปแล้วกี่ครั้ง (รองรับกรณีใช้ได้หลายครั้ง)
    usedCount: { type: Number, default: 0 },

    // 🕓 เวลาที่ใช้ดีลครั้งล่าสุด
    lastUsedAt: { type: Date, default: null },

    // 🕓 ใช้ดีลรอบนี้อยู่ระหว่างใช้งานหรือไม่ (session-based เช่น ใช้ได้ 15 นาที)
    isActiveSession: { type: Boolean, default: false },

    // ⏳ เวลา session ปัจจุบันจะหมดอายุ (ใช้คู่กับ isActiveSession)
    activeSessionExpiresAt: { type: Date, default: null },

    // 💳 จ่ายเงินแล้วหรือยัง (true = จ่ายแล้ว, false = ยัง)
    isPaid: { type: Boolean, default: true },

    // 🧾 ID การชำระเงิน (Stripe, QR, ฯลฯ)
    paymentId: { type: String, default: null },

    // 📆 วันหมดอายุของคูปองนี้ (เฉพาะ instance ของ user)
    expirationDate: { type: Date, default: null },

    // ❌ ถูกยกเลิกโดยระบบหรือ admin ไหม
    isRevoked: { type: Boolean, default: false },

    // 📝 หมายเหตุ admin
    platformNote: { type: String, default: "" },

    // 🧩 เผื่อเก็บข้อมูลเพิ่มเติม เช่น device, referrer, หรือที่มาของดีลนี้
    metadata: { type: Map, of: String, default: {} },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// 🔒 Unique serial number ต่อดีล (กันการซ้ำเลขภายในดีลเดียวกัน)
userDealSchema.index({ dealId: 1, useSerialNumber: 1 }, { unique: true, sparse: true });

// 🏃‍♂️ เพิ่ม index เร่งความเร็ว query สำคัญ
userDealSchema.index({ userId: 1, dealId: 1 }); // สำหรับค้นหาดีลของ user
userDealSchema.index({ isActiveSession: 1, activeSessionExpiresAt: 1 }); // session ยังไม่หมด
userDealSchema.index({ expirationDate: 1 }); // ดีลที่หมดอายุ

module.exports = model("UserDeal", userDealSchema);
