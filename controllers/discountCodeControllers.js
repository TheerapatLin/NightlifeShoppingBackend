// controllers/discountCodeControllers.js
const DiscountCode = require("../schemas/v1/discountCode.schema");
const User = require("../schemas/v1/user.schema");

exports.validateDiscountCode = async (req, res) => {
  try {
    const { code } = req.body;
    console.log(`req.user.userId = ${req.user?.userId}`);
    console.log(`code = ${code}`);
    if (!code) {
      return res
        .status(400)
        .json({ valid: false, message: "Code is required." });
    }

    let discountDoc = await DiscountCode.findOne({
      code: { $regex: `^${code}$`, $options: "i" },
    });

    if (discountDoc) {
      // ถ้าโค้ดนี้ต้อง sensitive แต่ตัวอักษรไม่ตรง
      if (discountDoc.caseSensitive && discountDoc.code !== code) {
        console.error(`Code ${code} case does not match.`);
        return res
          .status(404)
          .json({ valid: false, message: `Code ${code} not found.` });
      }

      if (!discountDoc.isActive) {
        return res
          .status(400)
          .json({ valid: false, message: "This code is not active." });
      }

      if (discountDoc.loginNeed && !req.user) {
        return res.status(400).json({
          valid: false,
          message: "Code found.\nBut please login before using this code.",
        });
      }

      const now = new Date();
      if (now < discountDoc.validFrom || now > discountDoc.validUntil) {
        return res
          .status(400)
          .json({ valid: false, message: "This code is expired." });
      }

      if (
        discountDoc.usageLimit !== null &&
        discountDoc.usedCount >= discountDoc.usageLimit
      ) {
        return res.status(400).json({
          valid: false,
          message: "Usage limit reached for this code.",
        });
      }

      return res.status(200).json({
        valid: true,
        message: "Code is valid.",
        discountType: discountDoc.discountType,
        discountValue: discountDoc.discountValue,
        combinable: discountDoc.combinable,
        shortDescription: discountDoc.shortDescription,
        description: discountDoc.description,
        code: discountDoc.code,
      });
    }

    // 🔻 ถ้าไม่เจอใน DiscountCode → หาใน User (affiliateCode)
    const matchedAffiliateUser = await User.findOne({
      affiliateCode: { $regex: `^${code}$`, $options: "i" },
    });

    if (matchedAffiliateUser) {
      return res.status(200).json({
        valid: false,
        isAffiliateCode: true,
        affiliateCode: matchedAffiliateUser.affiliateCode,
        affiliateUserId: matchedAffiliateUser._id.toString(),
        message: "Affiliate code recognized.",
      });
    }

    // ❌ ไม่เจอทั้งคู่
    return res
      .status(404)
      .json({ valid: false, message: `Code ${code} not found.` });
  } catch (error) {
    console.error("❌ Error validating discount code:", error);
    return res
      .status(500)
      .json({ valid: false, message: "Internal server error." });
  }
};

// ✅ ตรวจว่า superadmin เท่านั้น
function ensureSuperadmin(req, res) {
  if (req.user?.role !== "superadmin") {
    return res
      .status(403)
      .json({ message: "Permission denied. Superadmin only." });
  }
}

// GET: /api/v1/discount-code
exports.getAllDiscountCodes = async (req, res) => {
  if (ensureSuperadmin(req, res)) return;

  try {
    const codes = await DiscountCode.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, codes });
  } catch (err) {
    console.error("getAllDiscountCodes error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET: /api/v1/discount-code/:id
exports.getDiscountCodeById = async (req, res) => {
  if (ensureSuperadmin(req, res)) return;

  try {
    const code = await DiscountCode.findById(req.params.id);
    if (!code) {
      return res
        .status(404)
        .json({ success: false, message: "Code not found" });
    }
    res.status(200).json({ success: true, code });
  } catch (err) {
    console.error("getDiscountCodeById error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST: /api/v1/discount-code
// POST: /api/v1/discount-code
exports.createDiscountCode = async (req, res) => {
  if (ensureSuperadmin(req, res)) return;

  try {
    const codeData = req.body;
    codeData.createdBy = req.user.userId;

    // ✅ ตรวจว่าโค้ดนี้ซ้ำกับที่มีอยู่แล้วแบบ case-insensitive
    const existing = await DiscountCode.findOne({
      code: { $regex: `^${codeData.code}$`, $options: "i" },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Code "${codeData.code}" already exists (case-insensitive).`,
      });
    }

    const newCode = await DiscountCode.create(codeData);
    res.status(201).json({ success: true, code: newCode });
  } catch (err) {
    console.error("createDiscountCode error:", err);
    res.status(500).json({ success: false, message: "Failed to create code" });
  }
};

// PUT: /api/v1/discount-code/:id
exports.updateDiscountCode = async (req, res) => {
  if (ensureSuperadmin(req, res)) return;

  try {
    const updated = await DiscountCode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Code not found" });
    }
    res.status(200).json({ success: true, code: updated });
  } catch (err) {
    console.error("updateDiscountCode error:", err);
    res.status(500).json({ success: false, message: "Failed to update code" });
  }
};

// DELETE: /api/v1/discount-code/:id
exports.deleteDiscountCode = async (req, res) => {
  if (ensureSuperadmin(req, res)) return;

  try {
    const deleted = await DiscountCode.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Code not found" });
    }
    res.status(200).json({ success: true, message: "Code deleted" });
  } catch (err) {
    console.error("deleteDiscountCode error:", err);
    res.status(500).json({ success: false, message: "Failed to delete code" });
  }
};
