const mongoose = require("mongoose");
const chalk = require("chalk");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
const { MONGODBDATABASEURI } = process.env;
const { DATABASE_NAME } = process.env;

const connectMongoDB = async () => {
  console.log(chalk.yellow(`Databse Name: ${DATABASE_NAME}`));
  await mongoose
    .connect(
      MONGODBDATABASEURI,
      { dbName: DATABASE_NAME },
      { useNewUrlParser: true, useUnifiedTopology: true }
    )
    .then(() => {
      console.log(chalk.green("MongoDB Connected"));
    })
    .catch((err) => console.error(err));
};

module.exports = connectMongoDB;
