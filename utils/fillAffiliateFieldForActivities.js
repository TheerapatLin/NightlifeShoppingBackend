require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const mongoose = require("mongoose");

const fillAffiliateFieldForActivities = async () => {
  const dbUri = process.env.MONGODBDATABASEURI;

  if (!dbUri) {
    console.error("❌ MONGODBDATABASEURI is not defined");
    process.exit(1);
  }

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const db = conn.useDb(process.env.DATABASE_NAME || "nightlife");
  const activitiesCol = db.collection("activities");

  console.log("✅ Connected to MongoDB");

  const activities = await activitiesCol
    .find({
      $or: [
        { affiliate: { $exists: false } },
        { "affiliate.enabled": { $exists: false } },
        { "affiliate.rewardType": { $exists: false } },
        { "affiliate.rewardValue": { $exists: false } },
        { "affiliate.maxRewardPerUser": { $exists: false } },
      ],
    })
    .toArray();

  console.log(`📦 Found ${activities.length} activities missing affiliate field`);

  let updated = 0;

  for (const activity of activities) {
    const name = activity.nameTh || "(no name)";
    console.log(`🔧 Updating: ${name}`);

    await activitiesCol.updateOne(
      { _id: activity._id },
      {
        $set: {
          "affiliate.enabled": false,
          "affiliate.rewardType": "fixed",
          "affiliate.rewardValue": 100,
          "affiliate.maxRewardPerUser": 500,
        },
      }
    );

    updated++;
  }

  console.log(`🎉 Done. ${updated} activities updated.`);
  await conn.close();
};

fillAffiliateFieldForActivities();
