const multer = require("multer");
const processFiles = require("../../modules/multer/multer");
const upload = multer({ processFiles });

const express = require("express");
const app = express();
app.use(express.json());


// Product
const {
    createProductShopping,
    getAllProductShopping,
    getProductById,
    getProductByCreatorId,
    editProduct,
    deleteProduct,
    AddVariantProduct
} = require("../../controllers/shoppingProductController")

// Basket
const {
    createBasketShopping,
    getBasketByUserId,
    deleteBasket,
    clearBasketAllItems,
    AddProductInBasket
} = require("../../controllers/shoppingBasketController")

// Category
const {
    createCategoryShopping,
    getAllCategories,
    getCategoryById,
    getCategoriesByCreatorId,
    editCategory,
    deleteCategory
} = require("../../controllers/shoppingCategoryController")

// Order
const {
    createShoppingPaymentIntent,
    getShoppingOrderByUserId,
    getAllShoppingOrderForSuperadmin,
    updateShoppingOrderById,
    getShoppingOrderByCreaterId
} = require("../../controllers/shoppingOrderController")

const {
    // verifyAccessToken,
    // verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
} = require("../../middlewares/auth");

module.exports = function (io) {
    const router = express.Router();

    // product API
    router.post("/product",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        upload.array("image", 5), (req, res) =>
        createProductShopping(req, res)
    )
    router.get("/product", getAllProductShopping)
    router.get("/product/:productId", getProductById)
    router.get("/product/creator:creatorId", getProductByCreatorId)
    router.patch("/product/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        upload.array("image", 3),
        editProduct
    )
    router.delete("/product/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        deleteProduct)
    router.patch("/product/variant/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        AddVariantProduct)

    // basket API
    router.post("/basket",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        createBasketShopping)
    router.get("/basket/:userId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        getBasketByUserId)
    router.delete("/basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        deleteBasket)
    router.patch("/basket/clear-basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        clearBasketAllItems)
    router.patch("/basket/addproduct-basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        AddProductInBasket)

    // category API
    router.post("/category",
        upload.array("image", 1),
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        (req, res) => createCategoryShopping(req, res))
    router.get("/category", getAllCategories)
    router.get("/category/:categoryId", getCategoryById)
    router.get("/creator/category/:creatorId", getCategoriesByCreatorId)
    router.patch("/category/:categoryId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        upload.array("image", 3),
        editCategory
    )
    router.delete("/category/:categoryId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        deleteCategory)

    // PaymentIntent API
    router.post("/create-payment-intent", createShoppingPaymentIntent)
    router.get("/order/:userId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        getShoppingOrderByUserId)
    router.get("/order",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        getAllShoppingOrderForSuperadmin)
    router.patch("/order/update/:orderId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        updateShoppingOrderById)
    router.get("/order/creator/:creatorId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        getShoppingOrderByCreaterId)

    module.exports = router;
    return router;
}