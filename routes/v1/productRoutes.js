const express = require("express");
const router = express.Router();
const verifyAccessToken = require("../../middlewares/auth");
const productController = require("../../controllers/productControllers");

// เส้นทางสร้างสินค้า
router.post("/add", verifyAccessToken, productController.createProduct);

// เส้นทางดูสินค้าทั้งหมด
router.get("/",  productController.getAllProducts);

// เส้นทางดูสินค้าตาม ID
router.get("/:id", productController.getProductById);

// เส้นทางอัปเดตสินค้า
router.put("/:id", verifyAccessToken, productController.updateProduct);

// เส้นทางลบสินค้า
router.delete("/:id", verifyAccessToken, productController.deleteProduct);

module.exports = router;
