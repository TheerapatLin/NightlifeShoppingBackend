// routes/v1/discountCodeRoutes.js
const express = require("express");
const router = express.Router();
const {
  validateDiscountCode,
  getAllDiscountCodes,
  getDiscountCodeById,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  validateCodeWithEmail
} = require("../../controllers/discountCodeControllers");
const {
  verifyAccessToken,
  verifyRefreshToken,
  verifyAccessTokenWeb,
  verifyAccessTokenWebPass,
  authRoles,
} = require("../../middlewares/auth");

// POST /api/v1/discount-code/validate
router.post("/validate", validateDiscountCode);

// POST: /api/v1/discount-code/validate-before-payment
router.post("/validate-before-payment", validateCodeWithEmail);

/** ✅ CRUD เฉพาะ superadmin */
router.get("/", [verifyAccessTokenWeb, authRoles(["superadmin"])], getAllDiscountCodes);
router.get("/:id", [verifyAccessTokenWeb, authRoles(["superadmin"])], getDiscountCodeById);
router.post("/", [verifyAccessTokenWeb, authRoles(["superadmin"])], createDiscountCode);
router.put("/:id", [verifyAccessTokenWeb, authRoles(["superadmin"])], updateDiscountCode);
router.delete("/:id", [verifyAccessTokenWeb, authRoles(["superadmin"])], deleteDiscountCode);

module.exports = router;
