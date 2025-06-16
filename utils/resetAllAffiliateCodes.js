require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`
});

const mongoose = require("mongoose");

const generateAffiliateCode = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const resetAffiliateCodes = async () => {
  const dbUri = process.env.MONGODBDATABASEURI;

  if (!dbUri) {
    console.error("❌ MONGODBDATABASEURI is not defined in .env file");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const db = conn.useDb("nightlife");
  const usersCol = db.collection("users");

  console.log("✅ Connected to MongoDB (nightlife)");

  const allUsers = await usersCol.find({}).toArray();
  console.log(`🔁 Resetting affiliate codes for ${allUsers.length} users...`);

  const usedCodes = new Set();
  let updatedCount = 0;

  for (const user of allUsers) {
    const email = user?.user?.email || "(no email)";
    let newCode;

    do {
      newCode = generateAffiliateCode();
    } while (
      usedCodes.has(newCode) ||
      await usersCol.findOne({ affiliateCode: newCode })
    );

    usedCodes.add(newCode);

    await usersCol.updateOne(
      { _id: user._id },
      { $set: { affiliateCode: newCode } }
    );

    console.log(`✅ ${email} → new affiliateCode: ${newCode}`);
    updatedCount++;
  }

  console.log(`🎉 Done. ${updatedCount} users updated.`);
  await conn.close();
};

resetAffiliateCodes();
