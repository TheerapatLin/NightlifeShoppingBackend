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
    addVariantsProduct,
    removeVariantInProduct,
    editVariantProduct,
    addImageIntoProduct,
    addImagesIntoVariant,
 
} = require("../../controllers/shoppingProductController")

// Basket
const {
    createBasketShopping,
    getBasketByUserId,
    deleteBasket,
    clearBasketAllItems,
    addProductsInBasket,
    removeProductByIdInBasket
} = require("../../controllers/shoppingBasketController")

// Order
const {
    createShoppingPaymentIntent,
    getShoppingOrderByUserId,
    getAllShoppingOrderForSuperadmin,
    updateShoppingOrderById,
    getShoppingOrderByCreaterId,
    getOrderByIdUser
} = require("../../controllers/shoppingOrderController")

const {
    // verifyAccessToken,
    // verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
} = require("../../middlewares/auth");

module.exports = function () {
    const router = express.Router();

    // product API
    router.post("/product",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        createProductShopping
    )
    router.get("/product", getAllProductShopping)
    router.get("/product/:productId", getProductById)
    router.get("/product/creator/:creatorId", getProductByCreatorId)
    router.patch("/product/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        editProduct
    )
    router.delete("/product/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        deleteProduct
    )
    router.patch("/product/variant/add/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        addVariantsProduct
    )
    router.delete("/product/variant/delete/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        removeVariantInProduct
    )
    router.patch("/product/variant/edit/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        editVariantProduct
    )
    router.patch("/product/add-image/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        upload.array("image", 1), (req, res) =>
        addImageIntoProduct(req, res)
    )
    router.patch("/product/variant/add-image/:productId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        upload.array("image", 6), (req, res) =>
        addImagesIntoVariant(req, res)
    )
  


    // basket API
    router.post("/basket",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        createBasketShopping
    )
    router.get("/basket/:userId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        getBasketByUserId
    )
    router.delete("/basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        deleteBasket
    )
    router.patch("/basket/clear-basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        clearBasketAllItems
    )
    router.patch("/basket/addproduct-basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        addProductsInBasket
    )
    router.delete("/basket/removeproduct-basket/:basketId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        removeProductByIdInBasket
    )

    // PaymentIntent API
    router.post("/create-payment-intent", createShoppingPaymentIntent)

    // order API
    router.get("/order/:userId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        getShoppingOrderByUserId
    )
    router.get("/order",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        getAllShoppingOrderForSuperadmin)
    router.patch("/order/update/:orderId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        updateShoppingOrderById
    )
    router.get("/order/creator/:creatorId",
        [verifyAccessTokenWeb,
            authRoles(["admin", "superadmin"])
        ],
        getShoppingOrderByCreaterId
    )
    router.get("/order/id/:orderId",
        [verifyAccessTokenWeb,
            authRoles(["user", "admin", "superadmin"])
        ],
        getOrderByIdUser
    )

    module.exports = router;
    return router;
}