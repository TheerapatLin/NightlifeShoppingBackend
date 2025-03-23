const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const addressSchema = require("./address.schema");
const contactInfoSchema = require("./contact.schema");

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      required: true,
      //sparse: true,
    },
    user: {
      name: { type: String, required: true }, // ชื่อที่แสดง
      username: { type: String },
      email: {
        type: String,
        required: true,
        unique: true,
        match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
      },
      phone: { type: String },
      password: { type: String },
      token: { type: String },
      activated: { type: Boolean, default: false },
      verified: {
        email: { type: Boolean, default: false },
        phone: { type: Boolean, default: false },
      },
    },
    lang: { type: String, default: "TH" },
    deviceFingerPrint: [{ deviceType: { type: String }, fingerPrint: { type: String } }],
    groups: [{ groupId: { type: String }, roleInGroup: { type: String }, statusInGroup: { type: String } }], // จำนวนโพสต์
    chatGroups: [
      { chatGroupId: { type: String }, roleInChatGroup: { type: String }, statusInChatGroup: { type: String } },
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
  },
  { timestamps: true }
);

UserSchema.plugin(require("mongoose-unique-validator"));
const User = mongoose.model("User", UserSchema);
module.exports = User;
