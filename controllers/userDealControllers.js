const UserDeal = require("../schemas/v1/userdeal.schema");
const Deal = require("../schemas/v1/deal.schema");

exports.claimDeal = async (req, res) => {
  try {
    const { dealId } = req.body;
    const userId = req.user.userId;

    // 📌 1. ดึงดีล และตรวจสอบสถานะหลัก
    const deal = await Deal.findById(dealId);
    if (!deal || !deal.isActive || !deal.isPublished) {
      return res.status(404).json({ error: "Deal not available" });
    }

    const now = new Date();

    // 📌 2. ตรวจช่วงเวลาเปิดรับดีล
    if ((deal.claimStartDate && now < deal.claimStartDate) ||
        (deal.claimEndDate && now > deal.claimEndDate)) {
      return res.status(400).json({ error: "Deal is not claimable at this time" });
    }

    // 📌 3. ตรวจจำนวนทั้งหมดว่าหมดหรือยัง
    if (deal.totalAvailable !== null && deal.totalClaimed >= deal.totalAvailable) {
      return res.status(400).json({ error: "Deal has been fully claimed" });
    }

    // 📌 4. ตรวจจำนวนที่ user คนนี้เคยเคลมไปแล้ว
    const existingClaimCount = await UserDeal.countDocuments({
      userId,
      dealId,
      isRevoked: false
    });

    if (deal.usageLimitPerUser !== null && existingClaimCount >= deal.usageLimitPerUser) {
      return res.status(400).json({ error: "You have reached the claim limit for this deal" });
    }

    // 📌 5. สร้าง expirationDate ของ user deal
    const expirationDate = deal.expirationDaysAfterClaim
      ? new Date(now.getTime() + deal.expirationDaysAfterClaim * 86400000)
      : deal.fixedExpirationDate || null;

    // 📌 6. สร้าง UserDeal instance
    const userDeal = new UserDeal({
      userId,
      dealId,
      pricePaid: deal.price,
      expirationDate,
      isPaid: deal.price > 0,
      metadata: {
        referrer: req.headers.referer || null,
        userAgent: req.headers["user-agent"] || null
      }
    });

    // 📌 7. เพิ่มจำนวน totalClaimed ใน Deal
    deal.totalClaimed += 1;

    // ⏳ Save ทั้ง deal และ user deal
    await Promise.all([userDeal.save(), deal.save()]);

    res.status(201).json(userDeal);
  } catch (err) {
    console.error("Error claiming deal:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getUserDeals = async (req, res) => {
  try {
    const userId = req.params.userId;
    const deals = await UserDeal.find({ userId }).populate("dealId").sort({ claimedAt: -1 });
    res.status(200).json(deals);
  } catch (err) {
    console.error("Error fetching user deals:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getUserDealById = async (req, res) => {
  try {
    const userDeal = await UserDeal.findById(req.params.id).populate("dealId");
    if (!userDeal) return res.status(404).json({ error: "User deal not found" });
    res.status(200).json(userDeal);
  } catch (err) {
    console.error("Error fetching user deal:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.useUserDeal = async (req, res) => {
  try {
    const userDeal = await UserDeal.findById(req.params.id);
    if (!userDeal) return res.status(404).json({ error: "User deal not found" });
    if (userDeal.isUsed) return res.status(400).json({ error: "Already used" });

    userDeal.isUsed = true;
    userDeal.usedAt = new Date();

    await userDeal.save();
    res.status(200).json({ message: "Deal marked as used", userDeal });
  } catch (err) {
    console.error("Error marking deal as used:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUserDeal = async (req, res) => {
  try {
    const deleted = await UserDeal.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "User deal not found" });
    res.status(200).json({ message: "User deal deleted" });
  } catch (err) {
    console.error("Error deleting user deal:", err);
    res.status(500).json({ error: err.message });
  }
};