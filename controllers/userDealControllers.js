const UserDeal = require("../schemas/v1/userdeal.schema");
const Deal = require("../schemas/v1/deal.schema");
const mongoose = require("mongoose");

exports.claimDeal = async (req, res) => {
  try {
    const { dealId } = req.body;
    const userId = req.user.userId;

    // 📌 1. ดึงดีล และตรวจสอบสถานะหลัก
    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      console.log("dealId ไม่อยู่ใรรูปแบบ ObjectId");
      return res.status(400).json({ message: "ไม่พบ dealId" });
    }
    const deal = await Deal.findById(dealId);
    console.log(`dealId = ${dealId}`);
    console.log(`deal = ${deal}`);

    if (!deal || !deal.isActive || !deal.isPublished) {
      return res.status(404).json({ error: "Deal not available" });
    }

    const now = new Date();

    // 📌 2. ตรวจช่วงเวลาเปิดรับดีล
    if (
      (deal.claimStartDate && now < deal.claimStartDate) ||
      (deal.claimEndDate && now > deal.claimEndDate)
    ) {
      return res
        .status(400)
        .json({ error: "Deal is not claimable at this time" });
    }

    // 📌 3. ตรวจจำนวนทั้งหมดว่าหมดหรือยัง
    if (
      deal.totalAvailable !== null &&
      deal.totalClaimed >= deal.totalAvailable
    ) {
      return res.status(400).json({ error: "Deal has been fully claimed" });
    }

    // 📌 4. ตรวจจำนวนที่ user คนนี้เคยเคลมไปแล้ว
    const existingClaimCount = await UserDeal.countDocuments({
      userId,
      dealId,
      isRevoked: false,
    });

    if (
      deal.usageLimitPerUser !== null &&
      existingClaimCount >= deal.usageLimitPerUser
    ) {
      return res
        .status(400)
        .json({ error: "You have reached the claim limit for this deal" });
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
        userAgent: req.headers["user-agent"] || null,
      },
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
    const deals = await UserDeal.find({ userId })
      .populate("dealId")
      .sort({ claimedAt: -1 });
    res.status(200).json(deals);
  } catch (err) {
    console.error("Error fetching user deals:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getUserDealsByUserId = async (req, res) => {
  try {
    const userDeals = await UserDeal.find({ userId: req.params.id }).populate(
      "dealId"
    );
    if (!userDeals || userDeals.length === 0) {
      return res.status(404).json({ error: "No deals found for this user" });
    }
    res.status(200).json(userDeals);
  } catch (err) {
    console.error("Error fetching user deals:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.useUserDeal = async (req, res) => {
  try {
    const userDeal = await UserDeal.findById(req.params.id);
    if (!userDeal)
      return res.status(404).json({ error: "User deal not found" });
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

// ✅ เริ่มใช้งานดีล พร้อมกำหนด serial number และเวลาหมดอายุ
exports.startUserDealSession = async (req, res) => {
  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  let serialNumber, expiresAt;

  try {
    const { userDealId } = req.body;
    const userId = req.user.userId;

    await session.withTransaction(async () => {
      const userDeal = await UserDeal.findOne({ _id: userDealId, userId }).session(session);
      if (!userDeal) throw new Error("ไม่พบ user deal นี้");
      if (userDeal.isActiveSession) throw new Error("session นี้เริ่มไปแล้ว");

      const deal = await Deal.findById(userDeal.dealId).session(session);
      if (!deal) throw new Error("ไม่พบ deal ต้นทาง");

      const now = new Date();
      expiresAt = deal.expirationAfterUseMinutes
        ? new Date(now.getTime() + deal.expirationAfterUseMinutes * 60000)
        : null;

      userDeal.isActiveSession = true;
      userDeal.activeSessionExpiresAt = expiresAt;
      userDeal.useSerialNumber = deal.nextUseSerial;
      serialNumber = deal.nextUseSerial;

      deal.nextUseSerial += 1;

      await Promise.all([
        userDeal.save({ session }),
        deal.save({ session }),
      ]);
    });

    res.status(200).json({
      message: "เริ่มใช้งานดีลสำเร็จแล้ว",
      serialNumber,
      expiresAt
    });
  } catch (err) {
    console.error("🔥 Transaction failed:", err);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};
