// routes/v1/webhookRoutes.js
const express = require("express");
const router = express.Router();
const { handleDealUsedWebhook } = require("../../controllers/webhookControllers");

router.post("/deal-used", handleDealUsedWebhook);

module.exports = router;
