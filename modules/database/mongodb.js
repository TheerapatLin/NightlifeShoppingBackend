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
      console.log(chalk.green("MongoDB Connected"));
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Error:", err);
    });

  // ✅ หากต้องการให้ syncIndexes แบบ manual (เช่นใน CI/CD หรือ dev)
  if (SHOULD_SYNC_INDEXES === "true") {
    try {
      const ActivityOrder = require("../schemas/v1/activityOrder.schema.js");
      const result = await ActivityOrder.syncIndexes();
      console.log(chalk.cyan("🔄 ActivityOrder indexes synced:"), result);
    } catch (err) {
      console.error("❌ Failed to sync indexes:", err);
    }
  }
};

module.exports = connectMongoDB;
