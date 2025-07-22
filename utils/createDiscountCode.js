require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const mongoose = require("mongoose");

const createFixedDiscount = async () => {
  const dbUri = process.env.MONGODBDATABASEURI;
  if (!dbUri) {
    console.error("❌ MONGODBDATABASEURI is not defined in .env file");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const db = conn.useDb("nightlife");
  const discountCodesCol = db.collection("discountcodes");

  console.log("✅ Connected to MongoDB (nightlife)");

  const now = new Date();
  const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // +90 วัน

  const code = "AIRBNBREVIEW300";

  // ตรวจสอบว่ามี code นี้แล้วหรือยัง
  const existing = await discountCodesCol.findOne({ code: code });
  if (existing) {
    console.error(`⚠️ Code '${code}' already exists in the database.`);
    await conn.close();
    process.exit(1);
  }

  const discountCode = {
    code: code,
    shortDescription: { th: "ส่วนลด 300 บาท", en: "300 Baht off" },
    description: {
      th: "รับส่วนลด 300 บาททันทีเมื่อทำการจอง",
      en: "Get 300 Baht off instantly when booking.",
    },
    discountType: "amount",
    discountValue: 300,
    validFrom: now,
    validUntil: endDate,
    usageLimit: null,
    usedCount: 0,
    perUserUsageLimit: 1,
    isActive: true,
    combinable: false,
    allowedUserLevels: [],
    eventIds: [],
    affiliateUserId: null,
    affiliateCommissionType: null,
    affiliateCommissionValue: 0,
    affiliateMinPayoutPerUse: 0,
    caseSensitive: false,
    notes: "Created via util script for AIRBNBREVIEW campaign",
    createdBy: new mongoose.Types.ObjectId("000000000000000000000001"), // แก้ ObjectId เป็น admin ของคุณ
    createdAt: now,
    updatedAt: now,
  };

  const result = await discountCodesCol.insertOne(discountCode);
  console.log(
    `🎉 Discount code '${code}' created with _id: ${result.insertedId}`
  );
  console.log(
    `📅 Valid from ${now.toISOString()} until ${endDate.toISOString()}`
  );

  await conn.close();
};

createFixedDiscount();

//npx dotenv -e .env-nl -- node utils/createDiscountCode.js
