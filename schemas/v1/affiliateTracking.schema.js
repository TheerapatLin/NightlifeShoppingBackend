const mongoose = require("mongoose");

const affiliateTrackingSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
    },

    clickTime: {
      type: Date,
      default: Date.now,
    },

    ipAddress: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },

    landingPage: {
      type: String,
      default: "", // หน้าแรกที่เข้ามา เช่น /activities/6787dd...
    },

    booked: {
      type: Boolean,
      default: false,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActivityOrder",
    },

    rewardAmount: {
      type: Number,
      default: 0,
    },

    rewardStatus: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
    },

    rewardPaidAt: {
      type: Date,
    },

    internalNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const AffiliateTracking = mongoose.model(
  "AffiliateTracking",
  affiliateTrackingSchema
);
module.exports = AffiliateTracking;

affiliateTrackingSchema.index({ referrer: 1 });
affiliateTrackingSchema.index({ referredUser: 1 });
affiliateTrackingSchema.index({ activityId: 1 });
affiliateTrackingSchema.index({ booked: 1 });
affiliateTrackingSchema.index({ rewardStatus: 1 });
affiliateTrackingSchema.index({ bookingId: 1 });
affiliateTrackingSchema.index({ clickTime: -1 }); // ถ้าอยากเรียงล่าสุดก่อน
affiliateTrackingSchema.index({ referrer: 1, activityId: 1 }); // compound สำหรับ analytics
