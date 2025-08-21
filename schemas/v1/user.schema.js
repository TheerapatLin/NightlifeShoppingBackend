// schemas/v1/user.schema.js
const mongoose = require("mongoose");
const addressSchema = require("./address.schema");
const contactInfoSchema = require("./contact.schema");

const UserSchema = new mongoose.Schema(
  {
    role: { type: String, default: "user" },
    user: {
      name: { type: String, required: true },
      username: { type: String },
      email: {
        type: String,
        required: true,
        match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
      },
      phone: { type: String },
      password: { type: String, default: null },
      token: { type: String },
      activated: { type: Boolean, default: false },
      verified: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
      },
    },
    lang: { type: String, default: "TH" },
    deviceFingerPrint: [
      { deviceType: { type: String }, fingerPrint: { type: String } },
    ],
    groups: [
      {
        groupId: { type: String },
        roleInGroup: { type: String },
        statusInGroup: { type: String },
      },
    ],
    chatGroups: [
      {
        chatGroupId: { type: String },
        roleInChatGroup: { type: String },
        statusInChatGroup: { type: String },
      },
    ],
    userType: {
      type: String,
      required: true,
      enum: ["regular", "organization", "sponsor"],
    },
    userData: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userTypeData",
    },
    userTypeData: {
      type: String,
      required: true,
      enum: ["RegularUserData", "OrganizationUserData"],
    },
    affiliateCode: { type: String, unique: true, required: true },
    // NOTE: คงชื่อเดิมไว้ก่อนเพื่อไม่ให้กระทบโค้ดส่วนอื่น
    affiliateAvaiability: { type: Boolean, default: false },
    affiliateSettings: [
      {
        activityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Activity",
          required: true,
        },
        customerDiscount: { type: Number, default: 0 },
        affiliatorReward: { type: Number, default: 0 },
        rewardType: {
          type: String,
          enum: ["fixed", "percent"],
          default: "fixed",
        },
        enabled: { type: Boolean, default: true },
        budgetApplyMode: {
          type: String,
          enum: ["per_order", "per_person"],
          default: "per_order",
        },
      },
    ],
    affiliateBankInfo: {
      accountName: { type: String },
      accountNumber: { type: String },
      bankCode: { type: String }, // e.g., "SCB", "KTB", "OTHER"
      bankName: { type: String }, // e.g., "Siam Commercial Bank" or custom
      contactEmail: { type: String },
      updatedAt: { type: Date, default: Date.now },
    },
    businessId: { type: String },
    loggedInDevices: [
      {
        deviceFingerprint: { type: String, required: true },
        lastLogin: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/** =======================
 *  Hooks
 *  ======================= */
// ✅ ทำ email เป็น lower-case ก่อนบันทึก (กันซ้ำไม่สนตัวพิมพ์)
UserSchema.pre("save", function (next) {
  if (this.user?.email) {
    this.user.email = this.user.email.toLowerCase();
  }
  next();
});
UserSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  // รองรับทั้ง $set.user.email และ user.email
  if (update.$set?.["user.email"]) {
    update.$set["user.email"] = String(update.$set["user.email"]).toLowerCase();
  } else if (update["user.email"]) {
    update["user.email"] = String(update["user.email"]).toLowerCase();
  }
  this.setUpdate(update);
  next();
});

/** =======================
 *  Indexes
 *  ======================= */
UserSchema.index({ "user.email": 1 }, { unique: true });
UserSchema.index({ affiliateCode: 1 }, { unique: true });

// เรียง/ค้นหาตามชื่อ อีเมล โรล
UserSchema.index({ "user.name": 1 });
UserSchema.index({ role: 1 });

// ✅ สำคัญสำหรับ pagination/sort (ใหม่→เก่า)
UserSchema.index({ createdAt: -1 });

// ✅ ถ้ากรอง role บ่อย + เรียงตาม createdAt ให้เร็วขึ้น
UserSchema.index({ role: 1, createdAt: -1 });

// อื่น ๆ ตามการใช้งานเดิม
UserSchema.index({ "user.verified.email": 1 });
UserSchema.index({ userType: 1, userData: 1 });
UserSchema.index({ "loggedInDevices.deviceFingerprint": 1 });

// ✅ ปรับเป็น partial index เพื่อลดภาระ หากไม่มี accountNumber
UserSchema.index(
  { "affiliateBankInfo.accountNumber": 1 },
  {
    partialFilterExpression: {
      "affiliateBankInfo.accountNumber": { $type: "string", $ne: "" },
    },
  }
);

// ===============================
// VIRTUAL FIELDS
// ===============================

// Virtual field สำหรับดูระดับปัจจุบัน (รวม subscription)
UserSchema.virtual('currentLevel').get(async function() {
  const UserSubscription = require('./userSubscription.schema');
  
  try {
    const activeSubscription = await UserSubscription.findActiveSubscription(this._id);
    
    if (activeSubscription && activeSubscription.isActive()) {
      return {
        level: activeSubscription.subscriptionType,
        source: 'subscription',
        expiresAt: activeSubscription.endDate,
        subscriptionId: activeSubscription._id
      };
    }
    
    return {
      level: 'regular',
      source: 'default',
      expiresAt: null,
      subscriptionId: null
    };
  } catch (error) {
    console.error('Error getting current level:', error);
    return {
      level: 'regular',
      source: 'default',
      expiresAt: null,
      subscriptionId: null
    };
  }
});

// Instance method สำหรับดูระดับปัจจุบัน
UserSchema.methods.getCurrentLevel = async function() {
  const UserSubscription = require('./userSubscription.schema');
  
  try {
    const activeSubscription = await UserSubscription.findActiveSubscription(this._id);
    
    if (activeSubscription && activeSubscription.isActive()) {
      return {
        level: activeSubscription.subscriptionType,
        source: 'subscription',
        expiresAt: activeSubscription.endDate,
        daysRemaining: activeSubscription.getDaysRemaining(),
        subscriptionId: activeSubscription._id
      };
    }
    
    return {
      level: 'regular',
      source: 'default',
      expiresAt: null,
      daysRemaining: null,
      subscriptionId: null
    };
  } catch (error) {
    console.error('Error getting current level:', error);
    return {
      level: 'regular',
      source: 'default',
      expiresAt: null,
      daysRemaining: null,
      subscriptionId: null
    };
  }
};

const User = mongoose.model("User", UserSchema);
module.exports = User;
