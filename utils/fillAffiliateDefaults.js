// utils/fillAffiliateDefaults.js

require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const mongoose = require("mongoose");

const fillAffiliateDefaults = async () => {
  const dbUri = process.env.MONGODBDATABASEURI;

  if (!dbUri) {
    console.error("❌ MONGODBDATABASEURI is not defined");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const db = conn.useDb(process.env.DATABASE_NAME || "nightlife");

  const activitiesCol = db.collection("activities");
  const usersCol = db.collection("users");
  const activityOrdersCol = db.collection("activityorders");

  console.log("✅ Connected to MongoDB");

  // 1️⃣ Update activities
  const activities = await activitiesCol
    .find({
      $or: [
        { "affiliate.budgetApplyMode": { $exists: false } },
      ],
    })
    .toArray();

  console.log(`📦 Found ${activities.length} activities missing budgetApplyMode`);

  for (const activity of activities) {
    await activitiesCol.updateOne(
      { _id: activity._id },
      {
        $set: {
          "affiliate.budgetApplyMode": "per_order",
        },
      }
    );
  }

  console.log(`✅ Updated ${activities.length} activities.`);

  // 2️⃣ Update users (affiliateSettings.budgetApplyMode)
  const users = await usersCol
    .find({ "affiliateSettings.budgetApplyMode": { $exists: false } })
    .toArray();

  console.log(`📦 Found ${users.length} users missing affiliateSettings.budgetApplyMode`);

  for (const user of users) {
    const updatedSettings = (user.affiliateSettings || []).map((setting) => ({
      ...setting,
      budgetApplyMode: setting.budgetApplyMode || "per_order",
    }));

    await usersCol.updateOne(
      { _id: user._id },
      { $set: { affiliateSettings: updatedSettings } }
    );
  }

  console.log(`✅ Updated ${users.length} users.`);

  // 3️⃣ Update activityorders
  const activityOrders = await activityOrdersCol
    .find({ affiliateBudgetApplyMode: { $exists: false } })
    .toArray();

  console.log(`📦 Found ${activityOrders.length} activityOrders missing affiliateBudgetApplyMode`);

  for (const order of activityOrders) {
    await activityOrdersCol.updateOne(
      { _id: order._id },
      { $set: { affiliateBudgetApplyMode: "per_order" } }
    );
  }

  console.log(`✅ Updated ${activityOrders.length} activityOrders.`);

  console.log("🎉 Done filling affiliate defaults.");
  await conn.close();
};

fillAffiliateDefaults();