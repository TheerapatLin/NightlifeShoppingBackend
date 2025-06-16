const AffiliateTracking = require("../schemas/v1/affiliateTracking.schema");
const User = require("../schemas/v1/user.schema");
const Activity = require("../schemas/v1/activity.schema");

const trackAffiliateClick = async (req, res) => {
  try {
    const { refCode, activityId } = req.body;

    const referrer = await User.findOne({ affiliateCode: refCode });
    if (!referrer) {
      return res.status(404).json({ status: "error", message: "Invalid affiliate code" });
    }

    const newTracking = new AffiliateTracking({
      referrer: referrer._id,
      activityId,
    });

    await newTracking.save();

    res.status(200).json({ status: "success", message: "Click tracked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

const markBookingAsConfirmed = async (req, res) => {
  try {
    const { referredUserId, bookingId, activityId } = req.body;

    const existing = await AffiliateTracking.findOneAndUpdate(
      { referredUser: null, activityId, booked: false },
      {
        referredUser: referredUserId,
        bookingId,
        booked: true,
        rewardAmount: 50, // เปลี่ยนตาม reward logic
      },
      { new: true }
    );

    if (!existing) {
      return res.status(404).json({ status: "error", message: "Tracking entry not found" });
    }

    res.status(200).json({ status: "success", message: "Booking tracked", data: existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

const getAffiliateStatsByUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    const records = await AffiliateTracking.find({ referrer: userId }).populate("activityId");

    const totalClicks = records.length;
    const totalBookings = records.filter((r) => r.booked).length;
    const totalReward = records.reduce((acc, r) => acc + (r.rewardAmount || 0), 0);

    res.status(200).json({
      status: "success",
      data: {
        totalClicks,
        totalBookings,
        totalReward,
        records,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = {
  trackAffiliateClick,
  markBookingAsConfirmed,
  getAffiliateStatsByUser,
};
