const express = require("express");
const router = express.Router();
const {
  validateDiscountCode,
} = require("../../controllers/discountCodeControllers");
const {
  verifyAccessToken,
  verifyRefreshToken,
  verifyAccessTokenWeb,
  verifyAccessTokenWebPass,
} = require("../../middlewares/auth");

// POST /api/v1/discount-code/validate
router.post("/validate", validateDiscountCode);

module.exports = router;
