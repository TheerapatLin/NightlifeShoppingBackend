const express = require("express");
const router = express.Router();
const productController = require("../../controllers/productControllers");
const getProductsRateLimiter = require("../../modules/ratelimit/productRatelimiter");

const {
    verifyAccessToken,
    verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
  } = require("../../middlewares/auth");  

// เส้นทางสร้างสินค้า
router.post("/add", [getProductsRateLimiter, verifyAccessTokenWeb, authRoles], productController.createProduct);

// เส้นทางดูสินค้าทั้งหมด
router.get("/", [getProductsRateLimiter, verifyAccessTokenWeb], productController.getAllProducts);

// เส้นทางดูสินค้าตาม ID
router.get("/:id", [getProductsRateLimiter, verifyAccessTokenWeb], productController.getProductById);

// เส้นทางอัปเดตสินค้า
router.put("/:id", [getProductsRateLimiter, verifyAccessTokenWeb, authRoles], productController.updateProduct);

// เส้นทางลบสินค้า
router.delete("/:id", [getProductsRateLimiter, verifyAccessTokenWeb, authRoles], productController.deleteProduct);

module.exports = router;
