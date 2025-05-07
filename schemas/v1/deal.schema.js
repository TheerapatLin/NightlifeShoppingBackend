const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const dealSchema = new Schema({
  // 🏷️ ชื่อดีลในหลายภาษา เช่น { en: "50% off", th: "ลด 50%" }
  title: { type: Map, of: String, required: true },
  subTitle: { type: Map, of: String, required: true },

  // 📝 คำอธิบายรายละเอียดของดีลในหลายภาษา
  description: { type: Map, of: String, required: true },

  // ℹ️ วิธีใช้งานดีล เช่น “แสดงคูปองให้พนักงาน” (multi-language)
  howToUse: { type: Map, of: String, default: {} },

  // 🧩 แท็กที่ใช้ค้นหาหรือจัดหมวดหมู่ เช่น { en: ["cocktail"], th: ["ค็อกเทล"] }
  tags: { type: Map, of: [String], default: {} },

  // 🖼️ รูปภาพประกอบดีล (อาร์เรย์ของ URL)
  images: { type: [String], default: [] },

  // 📍 ดีลนี้เป็นของร้านไหน ถ้า null = ดีลของแพลตฟอร์ม
  venueId: { type: Types.ObjectId, ref: "Venue", default: null },

  // 🛍️ ใช้กับสินค้ารายการไหนบ้าง (อาร์เรย์ของ productId)
  productIds: [{ type: Types.ObjectId, ref: "Product" }],

  // 💰 ราคาที่ต้องจ่ายเพื่อรับดีล (0 = ฟรี)
  price: { type: Number, required: true, default: 0 },

  // 💎 มูลค่าที่แท้จริงของดีล เช่น ลดราคา 200 บาท
  originalValue: { type: Number, required: true },

  // 🔢 ประเภทของส่วนลด: ลดจำนวนเงิน (amount) หรือเปอร์เซ็นต์ (percentage)
  discountType: { type: String, enum: ["amount", "percentage"], required: true },

  // 🔽 จำนวนที่ลด เช่น 50 บาท หรือ 20%
  discountValue: { type: Number, required: true },

  // 📉 ยอดใช้จ่ายขั้นต่ำก่อนใช้ดีลนี้ได้ (nullable)
  minSpend: { type: Number, default: null },

  // 💵 ดีลนี้สามารถแลกเป็นเงินสดได้ไหม (default = ไม่ได้)
  isRedeemableForCash: { type: Boolean, default: false },

  // 🕐 วันเริ่มต้นให้กดรับหรือซื้อดีลนี้
  claimStartDate: { type: Date, default: null },

  // 🕐 วันสิ้นสุดการเปิดรับดีล
  claimEndDate: { type: Date, default: null },

  // ⏳ หมดอายุหลังจากกดรับดีลกี่วัน (nullable)
  expirationDaysAfterClaim: { type: Number, default: null },

  // 📆 หมดอายุแบบกำหนดวันแน่นอน
  fixedExpirationDate: { type: Date, default: null },

  // 🕓 เวลาหมดอายุหลังจากกดใช้คูปอง (หน่วยเป็นนาที) เช่น 15 นาทีหลังจากกดใช้
  expirationAfterUseMinutes: { type: Number, default: null },

  // 🔢 จำนวนดีลทั้งหมดที่มี (null = ไม่จำกัด)
  totalAvailable: { type: Number, default: null },

  // 📊 จำนวนดีลที่ถูกกดรับไปแล้ว
  totalClaimed: { type: Number, default: 0 },

  // 🙋 จำกัดจำนวนครั้งที่ user ใช้ดีลนี้ได้ต่อคน (nullable = ไม่จำกัด)
  usageLimitPerUser: { type: Number, default: 1 },

  // ✅ ดีลนี้เปิดใช้งานอยู่หรือไม่
  isActive: { type: Boolean, default: true },

  // 🌍 ดีลนี้ถูกเผยแพร่ให้ผู้ใช้เห็นหรือยัง
  isPublished: { type: Boolean, default: false },

  // 📌 ใช้ในการจัดลำดับการแสดงผล
  sortOrder: { type: Number, default: 0 },

  // 📝 หมายเหตุที่ admin ใช้เห็นเองเท่านั้น
  platformNote: { type: String, default: "" },

  // 👤 ผู้สร้างดีลนี้
  createdBy: { type: Types.ObjectId, ref: "User" }
}, {
  timestamps: true // เพิ่ม createdAt และ updatedAt อัตโนมัติ
});

module.exports = model("Deal", dealSchema);
