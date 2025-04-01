const express = require("express");
const router = express.Router();
const {
    createProductRateLimiter,
    getProductRateLimiter,
    deleteProductRateLimiter,
  } = require("../../modules/ratelimit/productRatelimiter");

const {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
  } = require("../../controllers/productControllers");

const {
    verifyAccessToken,
    verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
  } = require("../../middlewares/auth");  

router.post("/product", createProductRateLimiter, [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], createProduct);
router.get("/", getProductRateLimiter, [verifyAccessTokenWeb], getAllProducts);
router.get("/:id", getProductRateLimiter, [verifyAccessTokenWeb], getProductById);
router.put("/:id", getProductRateLimiter, [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], updateProduct);
router.delete("/:id", deleteProductRateLimiter, [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], deleteProduct);

module.exports = router;