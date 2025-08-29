const multer = require("multer");
const processFiles = require("../../modules/multer/multer");
const upload = multer({ processFiles });

const express = require("express");
const app = express();
app.use(express.json());

const {
    createProductShopping,
    getAllProductShopping,
    getProductById,
    getProductByCreatorId,
    editProduct,
    deleteProduct,
    AddVariantProduct
} = require("../../controllers/shoppingProductController")

const {
    createBasketShopping,
    getBasketByUserId,
    deleteBasket,
    clearBasketAllItems,
    AddProductInBasket
} = require("../../controllers/shoppingBasketController")

const {
    createCategoryShopping,
    getAllCategories,
    getCategoryById,
    getCategoriesByCreatorId,
    editCategory,
    deleteCategory
} = require("../../controllers/shoppingCategoryController")

const {
    createShoppingPaymentIntent
} = require("../../controllers/shoppingOrderController")

const {
    verifyAccessToken,
    verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
} = require("../../middlewares/auth");

module.exports = function (io) {
    const router = express.Router();

    // product API
    router.post("/product",
        // [verifyAccessToken, 
        // authRoles(["admin", "superadmin"])], 
        upload.array("image", 5), (req, res) =>
        createProductShopping(req, res)
    )
    router.get("/product", getAllProductShopping)
    router.get("/product/:productId", getProductById)
    router.get("/product/creator:creatorId", getProductByCreatorId)
    router.patch("/product/:productId",
        upload.array("image", 3),
        editProduct
    )
    router.delete("/product/:productId", deleteProduct)
    router.patch("/product/variant/:productId", AddVariantProduct)

    // basket API
    router.post("/basket", createBasketShopping)
    router.get("/basket/:userId", getBasketByUserId)
    router.delete("/basket/:basketId", deleteBasket)
    router.patch("/basket/clear-basket/:basketId", clearBasketAllItems)
    router.patch("/basket/addproduct-basket/:basketId", AddProductInBasket)

    // category API
    router.post("/category", upload.array("image", 1), (req, res) => createCategoryShopping(req, res))
    router.get("/category", getAllCategories)
    router.get("/category/:categoryId", getCategoryById)
    router.get("/creator/category/:creatorId", getCategoriesByCreatorId)
    router.patch("/category/:categoryId",
        upload.array("image", 3),
        editCategory
    )
    router.delete("/category/:categoryId", deleteCategory)

    // PaymentIntent API
    router.post("/create-payment-intent", createShoppingPaymentIntent)

    module.exports = router;
    return router;
}