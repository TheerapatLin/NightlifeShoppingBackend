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

exports.getWishlistByUserId = async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            const newWishlist = await Wishlist.create({
                userId: userId,
                items: []
            });
            return res.status(200).json({
                message: "New Wishlist",
                wishlist: newWishlist
            });
        } else {
            return res.status(200).json({
                message: "Wishlist found",
                wishlist: wishlist
            });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

exports.addItemToWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const product = await ProductShopping.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            return res.status(404).json({ error: "Wishlist not found" });
        }

        for (const item of wishlist.items) {
            if (item.productId.toString() === productId.toString()) {
                return res.status(400).json({ error: "Product already in wishlist" });
            }
        }

        wishlist.items.push({
            productId: productId,
            title: {
                en: product.title.en,
                th: product.title.th
            },
            image: product.image[0].fileName
        });

        await wishlist.save();

        res.status(200).json({ message: "Item added to wishlist successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.removeItemFromWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            return res.status(404).json({ error: "Wishlist not found" });
        }

        let foundItem = false;
        for (const item of wishlist.items) {
            if (item.productId.toString() === productId.toString()) {
                wishlist.items = wishlist.items.filter(item => item.productId.toString() !== productId.toString());
                foundItem = true;
                await wishlist.save();
                return res.status(200).json({ message: "Item removed from wishlist successfully" });
            }
        }
        if (!foundItem) {
            return res.status(404).json({ error: "Item not found in wishlist" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.clearWishlist = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            return res.status(404).json({ error: "Wishlist not found" });
        }

        wishlist.items = [];
        await wishlist.save();

        return res.status(200).json({ message: "Wishlist cleared successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.deleteWishlist = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            return res.status(404).json({ error: "Wishlist not found" });
        }

        await wishlist.deleteOne();

        return res.status(200).json({ message: "Wishlist deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}