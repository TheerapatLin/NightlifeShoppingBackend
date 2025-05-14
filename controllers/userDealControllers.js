const UserDeal = require("../schemas/v1/userdeal.schema");
const Deal = require("../schemas/v1/deal.schema");
const mongoose = require("mongoose");

exports.claimDeal = async (req, res) => {
  try {
    const { dealId } = req.body;
    const userId = req.user.userId;

    // 📌 1. ตรวจสอบ dealId ถูกต้อง
    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      console.log("dealId ไม่อยู่ในรูปแบบ ObjectId");
      return res.status(400).json({ message: "ไม่พบ dealId ที่ถูกต้อง" });
    }

    // 📌 2. ดึงดีลจาก DB และตรวจสอบสถานะ
    const deal = await Deal.findById(dealId);
    console.log(`dealId = ${dealId}`);
    console.log(`deal = ${deal}`);

    if (!deal || !deal.isActive || !deal.isPublished) {
      return res.status(404).json({ error: "ดีลนี้ไม่สามารถใช้งานได้" });
    }

    const now = new Date();

    // 📌 3. ตรวจช่วงเวลาที่เปิดให้เคลม
    if (
      (deal.claimStartDate && now < deal.claimStartDate) ||
      (deal.claimEndDate && now > deal.claimEndDate)
    ) {
      return res
        .status(400)
        .json({ error: "ยังไม่ถึงเวลาหรือหมดเวลารับดีลนี้แล้ว" });
    }

    // 📌 4. ตรวจว่าดีลหมดจำนวนหรือยัง (totalAvailable)
    if (
      deal.totalAvailable !== null &&
      deal.totalClaimed >= deal.totalAvailable
    ) {
      return res.status(400).json({ error: "ดีลนี้ถูกใช้ครบจำนวนแล้ว" });
    }

    // 📌 5. ตรวจว่าผู้ใช้คนนี้เคลมดีลนี้ไปแล้วกี่ครั้ง
    const existingClaimCount = await UserDeal.countDocuments({
      userId,
      dealId,
      isRevoked: false,
    });

    if (
      deal.usageLimitPerUser !== null &&
      existingClaimCount >= deal.usageLimitPerUser
    ) {
      return res.status(400).json({
        error: "คุณใช้สิทธิ์เคลมดีลนี้ครบแล้ว",
        errorCode: "claimLimitExceeded",
      });
    }

    // 📌 6. คำนวณวันหมดอายุเฉพาะของ user
    const expirationDate = deal.expirationDaysAfterClaim
      ? new Date(now.getTime() + deal.expirationDaysAfterClaim * 86400000)
      : deal.fixedExpirationDate || null;

    // 📌 7. ✅ สร้าง UserDeal (ห้ามมี useSerialNumber เด็ดขาด)
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

    // 📌 8. อัปเดตยอด totalClaimed ในดีล
    deal.totalClaimed += 1;

    // 📌 9. บันทึกทั้ง userDeal และ deal
    await Promise.all([userDeal.save(), deal.save()]);

    res.status(201).json(userDeal);
  } catch (err) {
    console.error("❌ Error claiming deal:", err);
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

// ✅ เริ่มใช้งานดีล พร้อมกำหนด serial number, session, และยิง webhook
exports.startUserDealSession = async (req, res) => {
  const session = await mongoose.startSession();
  let serialNumber, expiresAt, userDeal, deal;

  try {
    const { userDealId } = req.body;
    const userId = req.user.userId;

    await session.withTransaction(async () => {
      // 🔍 ตรวจสอบ user deal และดีลต้นทาง
      userDeal = await UserDeal.findOne({ _id: userDealId, userId }).session(
        session
      );
      if (!userDeal) throw new Error("ไม่พบ user deal นี้");
      if (userDeal.isActiveSession) throw new Error("session นี้เริ่มไปแล้ว");

      deal = await Deal.findById(userDeal.dealId).session(session);
      if (!deal) throw new Error("ไม่พบ deal ต้นทาง");

      // ⏳ คำนวณเวลาหมดอายุ session
      const now = new Date();
      expiresAt = deal.expirationAfterUseMinutes
        ? new Date(now.getTime() + deal.expirationAfterUseMinutes * 60000)
        : null;

      // 🔢 กำหนด serial และ session
      userDeal.isActiveSession = true;
      userDeal.activeSessionExpiresAt = expiresAt;
      userDeal.useSerialNumber = deal.nextUseSerial;
      serialNumber = deal.nextUseSerial;
      userDeal.lastUsedAt = new Date();

      // ➕ เพิ่ม serial ไปยัง deal
      deal.nextUseSerial += 1;

      await Promise.all([userDeal.save({ session }), deal.save({ session })]);
    });

    // 🔽 Webhook หลังใช้ดีล (backend → backend เท่านั้น)
    if (process.env.WEBHOOK_ON_DEAL_USE) {
      try {
        await axios.post(
          process.env.WEBHOOK_ON_DEAL_USE,
          {
            userDealId: userDeal._id,
            dealId: deal._id,
            userId: userDeal.userId,
            serialNumber: serialNumber,
            expiresAt: expiresAt,
            timestamp: new Date().toISOString(),
          },
          {
            headers: {
              "x-webhook-secret": process.env.WEBHOOK_SECRET,
            },
          }
        );
      } catch (err) {
        console.warn("⚠️ Webhook failed:", err.message);
      }
    }

    res.status(200).json({
      message: "เริ่มใช้งานดีลสำเร็จแล้ว",
      serialNumber,
      expiresAt,
    });
  } catch (err) {
    console.error("🔥 Transaction failed:", err);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};
