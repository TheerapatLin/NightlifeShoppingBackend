// utils/fillAffiliateCode.js
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const mongoose = require("mongoose");

// 🔢 ใช้ตัวอักษร A-Z, a-z และตัวเลข 0-9
const generateAffiliateCode = (length = 8) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const fillAffiliateCodes = async () => {
  const dbUri = process.env.MONGODBDATABASEURI;

  if (!dbUri) {
    console.error("❌ MONGODBDATABASEURI is not defined in .env file");
    process.exit(1);
  }

  // ✅ เชื่อมต่อ Mongo
  const conn = await mongoose.createConnection(dbUri).asPromise();
  const dbName = process.env.DATABASE_NAME;
  const db = conn.useDb(dbName);
  const usersCol = db.collection("users");

  console.log(`✅ Connected to MongoDB ${dbName}`);

  // ✅ ดึง users ทั้งหมด
  const allUsers = await usersCol.find({}).toArray();
  console.log(`📦 Total users in DB: ${allUsers.length}`);

  let count = 0;

  for (const user of allUsers) {
    const email = user?.user?.email || "(no email)";
    const currentCode = user.affiliateCode;

    if (
      !currentCode ||
      typeof currentCode !== "string" ||
      currentCode.trim() === ""
    ) {
      let newCode;
      do {
        newCode = generateAffiliateCode();
      } while (await usersCol.findOne({ affiliateCode: newCode }));

      await usersCol.updateOne(
        { _id: user._id },
        { $set: { affiliateCode: newCode } }
      );

      console.log(`✅ ${email} → affiliateCode: ${newCode}`);
      count++;
    } else {
      console.log(`🟡 ${email} → already has code: ${currentCode}`);
    }
  }

  console.log(`🎉 Done. ${count} users updated.`);
  await conn.close();
};

module.exports = fillAffiliateCodes;
