require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const mongoose = require("mongoose");

const addAffiliateAvailabilityToUsers = async () => {
  const dbUri = process.env.MONGODBDATABASEURI;

  if (!dbUri) {
    console.error("❌ MONGODBDATABASEURI is not defined");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const db = conn.useDb(process.env.DATABASE_NAME || "nightlife");
  const usersCol = db.collection("users");

  console.log("✅ Connected to MongoDB");

  const usersToUpdate = await usersCol
    .find({ affiliateAvailability: { $exists: false } })
    .toArray();

  console.log(`📦 Found ${usersToUpdate.length} users missing affiliateAvailability field`);

  let updated = 0;

  for (const user of usersToUpdate) {
    await usersCol.updateOne(
      { _id: user._id },
      { $set: { affiliateAvailability: false } }
    );
    updated++;
  }

  console.log(`🎉 Done. ${updated} users updated.`);
  await conn.close();
};

addAffiliateAvailabilityToUsers();
