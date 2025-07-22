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

    if (!discountDoc) {
      console.error(`Code ${code} not found.`);
      return res
        .status(404)
        .json({ valid: false, message: `Code ${code} not found.` });
    }

    // ถ้าโค้ดนี้ต้อง sensitive แต่ตัวอักษรไม่ตรง
    if (discountDoc.caseSensitive && discountDoc.code !== code) {
      console.error(`Code ${code} case does not match.`);
      return res
        .status(404)
        .json({ valid: false, message: `Code ${code} not found.` });
    }

    // ตรวจสอบว่าโค้ดเปิดใช้งานอยู่
    if (!discountDoc.isActive) {
      return res
        .status(400)
        .json({ valid: false, message: "This code is not active." });
    }

    if (discountDoc.loginNeed && !req.user) {
      return res
        .status(400)
        .json({ valid: false, message: "Code found.\nBut please login before using this code." });
    }

    // ตรวจสอบวันหมดอายุ
    const now = new Date();
    if (now < discountDoc.validFrom || now > discountDoc.validUntil) {
      return res
        .status(400)
        .json({ valid: false, message: "This code is expired." });
    }

    // ตรวจสอบ usageLimit
    if (
      discountDoc.usageLimit !== null &&
      discountDoc.usedCount >= discountDoc.usageLimit
    ) {
      return res
        .status(400)
        .json({ valid: false, message: "Usage limit reached for this code." });
    }

    // ตรวจสอบการใช้งานซ้ำใน user เดียวกัน ถ้า userId ถูกส่งมา
    // if (userId) {
    //   const user = await User.findById(userId);
    //   if (!user) {
    //     return res
    //       .status(404)
    //       .json({ valid: false, message: "User not found." });
    //   }

    //   const userUsageCount = 0; // TODO: นับการใช้งานจริงในระบบคุณ หากมี
    //   if (
    //     discountDoc.perUserUsageLimit &&
    //     userUsageCount >= discountDoc.perUserUsageLimit
    //   ) {
    //     return res.status(400).json({
    //       valid: false,
    //       message: "You have reached the usage limit for this code.",
    //     });
    //   }
    // }

    // ✅ Passed all checks
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
  } catch (error) {
    console.error("❌ Error validating discount code:", error);
    return res
      .status(500)
      .json({ valid: false, message: "Internal server error." });
  }
};
