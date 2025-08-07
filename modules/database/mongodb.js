const mongoose = require("mongoose");
const chalk = require("chalk");
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const { MONGODBDATABASEURI, DATABASE_NAME, NODE_ENV, SHOULD_SYNC_INDEXES } =
  process.env;

const connectMongoDB = async () => {
  console.log(chalk.yellow(`Database Name: ${DATABASE_NAME}`));
  console.log(">>> MongoDB URI used:", MONGODBDATABASEURI);

  const isProd = NODE_ENV === "production";

  await mongoose
    .connect(MONGODBDATABASEURI, {
      dbName: DATABASE_NAME,
      autoIndex: !isProd, // ✅ ปิด autoIndex ใน production เพื่อ performance และ safety
    })
    .then(() => {
      console.log(chalk.green("✅ MongoDB Connected"));
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Error:", err);
    });

  // ✅ Step: fill affiliateCode if needed
  try {
    const fillAffiliateCodes = require("../../utils/fillAffiliateCode.internal.js");
    await fillAffiliateCodes(); // ✅ รันในขั้นตอนเชื่อมต่อ
  } catch (err) {
    console.error("❌ Failed to fill affiliateCode:", err);
  }

  // ✅ Sync indexes ถ้าเปิด flag
  if (SHOULD_SYNC_INDEXES === "true") {
    try {
      console.log(chalk.cyan("🔄 Syncing indexes..."));

      // 🔽 เพิ่ม schema ที่คุณต้องการ sync index ที่นี่
      const path = require("path");

      const schemasToSync = [
        {
          name: "ActivityOrder",
          model: require(path.resolve(
            __dirname,
            "../../schemas/v1/activityOrder.schema.js"
          )),
        },
        {
          name: "User",
          model: require(path.resolve(
            __dirname,
            "../../schemas/v1/user.schema.js"
          )),
        },
        {
          name: "DiscountCode",
          model: require(path.resolve(
            __dirname,
            "../../schemas/v1/discountCode.schema.js"
          )),
        },
        {
          name: "ActivitySlot",
          model: require(path.resolve(
            __dirname,
            "../../schemas/v1/activitySlot.schema.js"
          )),
        },
        {
          name: "Activity",
          model: require(path.resolve(
            __dirname,
            "../../schemas/v1/activity.schema.js"
          )),
        },
        {
          name: "AffiliateTracking",
          model: require(path.resolve(
            __dirname,
            "../../schemas/v1/affiliateTracking.schema.js"
          )),
        },
      ];

      for (const { name, model } of schemasToSync) {
        const result = await model.syncIndexes();
        console.log(chalk.green(`✅ Indexes synced for ${name}:`), result);
      }
    } catch (err) {
      console.error("❌ Failed to sync indexes:", err);
    }
  }
};

module.exports = connectMongoDB;
