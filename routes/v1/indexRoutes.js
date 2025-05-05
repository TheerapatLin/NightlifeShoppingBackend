const express = require("express");
const router = express.Router();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", {
    pageTitle: "Hiddengem Tech UAT-API : Endpoints",
    featuredContent: "version 1.0.4 (build 11)",
    environment: process.env.NODE_ENV
  });
});

module.exports = router;
