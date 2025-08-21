// schemas/v1/userSubscription.schema.js
const mongoose = require("mongoose");

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionType: {
      type: String,
      enum: ["premium", "platinum"],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    originalEndDate: {
      type: Date,
      required: true,
    },
    totalExtensions: {
      type: Number,
      default: 0,
    },
    extensionHistory: [
      {
        purchaseDate: { type: Date, default: Date.now },
        extensionType: {
          type: String,
          enum: ["monthly", "yearly"],
        },
        previousEndDate: { type: Date },
        newEndDate: { type: Date },
        extensionDays: { type: Number },
      },
    ],
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "THB",
    },
    paymentInfo: {
      transactionId: { type: String },
      paymentMethod: { type: String },
      paymentDate: { type: Date, default: Date.now },
      amount: { type: Number },
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    // TTL index จะใช้ field นี้ในการลบ subscription ที่หมดอายุ
    expireAt: {
      type: Date,
      required: true,
    },
    metadata: {
      purchaseSource: { type: String }, // web, mobile, etc.
      promotionCode: { type: String },
      originalLevel: { type: String }, // ระดับเดิมก่อนซื้อ subscription
    },
  },
  { 
    timestamps: true,
    // ตั้งค่า collection ให้ใช้ TTL
    index: { expireAt: 1 },
  }
);

// ===============================
// INDEXES
// ===============================

// TTL Index - ลบ subscription ที่หมดอายุอัตโนมัติ (หลังจากหมดอายุ 30 วัน)
userSubscriptionSchema.index(
  { expireAt: 1 }, 
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days after expireAt
);

// หา subscription ที่ active ของ user
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ userId: 1, endDate: -1 });

// หา subscription ตาม type และ status
userSubscriptionSchema.index({ subscriptionType: 1, status: 1 });

// สำหรับ admin dashboard - ดู subscription ทั้งหมด
userSubscriptionSchema.index({ createdAt: -1 });
userSubscriptionSchema.index({ status: 1, createdAt: -1 });

// ===============================
// METHODS
// ===============================

// ตรวจสอบว่า subscription ยังใช้งานได้หรือไม่
userSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && this.endDate > new Date();
};

// คำนวณวันที่เหลือ
userSubscriptionSchema.methods.getDaysRemaining = function() {
  if (!this.isActive()) return 0;
  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// ต่อเวลา subscription
userSubscriptionSchema.methods.extend = function(billingCycle, price) {
  const extensionDays = billingCycle === 'yearly' ? 365 : 30;
  const previousEndDate = new Date(this.endDate);
  
  // ต่อเวลาจากวันที่หมดอายุปัจจุบัน
  this.endDate = new Date(this.endDate.getTime() + (extensionDays * 24 * 60 * 60 * 1000));
  this.expireAt = new Date(this.endDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // +30 days for cleanup
  
  // บันทึกประวัติการต่อเวลา
  this.extensionHistory.push({
    purchaseDate: new Date(),
    extensionType: billingCycle,
    previousEndDate: previousEndDate,
    newEndDate: this.endDate,
    extensionDays: extensionDays,
  });
  
  this.totalExtensions += 1;
  
  return this.save();
};

// ===============================
// STATICS
// ===============================

// หา subscription ที่ active ของ user
userSubscriptionSchema.statics.findActiveSubscription = function(userId) {
  return this.findOne({
    userId: userId,
    status: 'active',
    endDate: { $gt: new Date() }
  }).sort({ endDate: -1 }); // เอาอันที่หมดอายุช้าที่สุด
};

// หา subscription ทั้งหมดของ user
userSubscriptionSchema.statics.findUserSubscriptions = function(userId) {
  return this.find({ userId: userId })
    .sort({ createdAt: -1 });
};

// สร้าง subscription ใหม่
userSubscriptionSchema.statics.createSubscription = function(data) {
  const { userId, subscriptionType, billingCycle, price } = data;
  
  // คำนวณวันหมดอายุ
  const startDate = new Date();
  const durationDays = billingCycle === 'yearly' ? 365 : 30;
  const endDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));
  const expireAt = new Date(endDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // +30 days for cleanup
  
  return this.create({
    userId,
    subscriptionType,
    billingCycle,
    price,
    startDate,
    endDate,
    originalEndDate: endDate,
    expireAt,
    paymentInfo: data.paymentInfo || {},
    metadata: data.metadata || {}
  });
};

// ===============================
// MIDDLEWARE
// ===============================

// อัพเดท status เป็น expired เมื่อหมดอายุ
userSubscriptionSchema.pre('find', function() {
  // อัพเดท subscription ที่หมดอายุแล้ว
  this.updateMany(
    { 
      status: 'active', 
      endDate: { $lt: new Date() } 
    },
    { 
      $set: { status: 'expired' } 
    }
  );
});

userSubscriptionSchema.pre('findOne', function() {
  // อัพเดท subscription ที่หมดอายุแล้ว
  this.model.updateMany(
    { 
      status: 'active', 
      endDate: { $lt: new Date() } 
    },
    { 
      $set: { status: 'expired' } 
    }
  );
});

const UserSubscription = mongoose.model("UserSubscription", userSubscriptionSchema);
module.exports = UserSubscription;
