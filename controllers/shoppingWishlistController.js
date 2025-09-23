const Wishlist = require("../schemas/v1/shopping/shopping.wishlist.schema");
const User = require("../schemas/v1/user.schema");
const ProductShopping = require("../schemas/v1/shopping/shopping.products.schema")

exports.createWishlist = async (req, res) => {
    try {
        const {
            userId,
            productId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const items = [];
        const product = await ProductShopping.findById(productId);
        if (!product) {
            return res.status(404).json({ error: `Product ${productId} not found` });
        }
        items.push({
            productId: productId,
            title: {
                en: product.title.en,
                th: product.title.th
            },
            image: product.image[0].fileName
        });

        await Wishlist.create({
            userId: userId,
            items: items
        });

        res.status(200).json({ message: "Wishlist created successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}