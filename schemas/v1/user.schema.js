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
      password: {
        type: String,
        default: null,
      },
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
        // ✅ NEW: specify whether affiliate budget applies "per_order" or "per_person"
        budgetApplyMode: {
          type: String,
          enum: ["per_order", "per_person"],
          default: "per_order",
        },
      },
    ],
    // ✅ New field for affiliate bank info
    affiliateBankInfo: {
      accountName: { type: String },
      accountNumber: { type: String },
      bankCode: { type: String }, // e.g., "SCB", "KTB", "OTHER"
      bankName: { type: String }, // e.g., "Siam Commercial Bank" or custom
      contactEmail: {type: String},
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

const User = mongoose.model("User", UserSchema);
module.exports = User;
