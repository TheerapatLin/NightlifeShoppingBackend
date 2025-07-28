const DiscountCode = require("../schemas/v1/discountCode.schema");
const User = require("../schemas/v1/user.schema");

exports.validateDiscountCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res
        .status(400)
        .json({ valid: false, message: "Code is required." });
    }

    let discountDoc = await DiscountCode.findOne({
      code: { $regex: `^${code}$`, $options: "i" },
    });

    if (discountDoc) {
      // ถ้า case-sensitive แต่โค้ดไม่ตรง
      if (discountDoc.caseSensitive && discountDoc.code !== code) {
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
        return res
          .status(400)
          .json({
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

    // ✅ ไม่เจอใน DiscountCode → ไปเช็คใน User.affiliateCode แทน
    const matchedAffiliateUser = await User.findOne({
      affiliateCode: { $regex: `^${code}$`, $options: "i" },
    });

    if (matchedAffiliateUser) {
      return res.status(200).json({
        valid: false, // ไม่ใช่ discount code
        isAffiliateCode: true,
        affiliateCode: matchedAffiliateUser.affiliateCode,
        affiliateUserId: matchedAffiliateUser._id.toString(),
        discountValue: 0,
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
