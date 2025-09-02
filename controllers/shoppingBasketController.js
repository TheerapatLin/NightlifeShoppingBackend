const BasketShopping = require('../schemas/v1/shopping/shopping.baskets.schema')
const ProductShopping = require("../schemas/v1/shopping/shopping.products.schema")
const User = require("../schemas/v1/user.schema");
const mongoose = require("mongoose");


exports.createBasketShopping = async (req, res) => {
    try {
        const { userId } = req.body;

        // ตรวจสอบว่ามี userId หรือไม่
        if (!userId) {
            return res.status(400).send({ error: "ต้องระบุ userId" });
        }

        // ตรวจสอบว่า creatorId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "ไม่พบ userId ที่ถูกต้อง" });
        }

        // ตรวจสอบ user ว่ามีอยู่จริงหรือไม่
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send({ error: "ไม่พบข้อมูลผู้ใช้ (user)" });
        }

        // ตรวจสอบว่าผู้ใช้มี basket อยู่แล้วหรือไม่ (1 user มี 1 basket)
        const existingBasket = await BasketShopping.findOne({ userId: userId });
        if (existingBasket) {
            return res.status(400).send({ error: "ผู้ใช้นี้มี basket อยู่แล้ว" });
        }

        let itemData = [];

        let totalPrice = 0

        // เตรียมข้อมูล basket ใหม่
        const newBasket = new BasketShopping({
            userId: userId,
            items: itemData,
            totalPrice: totalPrice
        });

        // บันทึก basket
        await newBasket.save();

        res.status(201).send({ message: "สร้าง basket สำเร็จ" });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.getBasketByUserId = async (req, res) => {
    try {
        const userId = req.params.userId

        // ตรวจสอบว่ามี userId หรือไม่
        if (!userId) {
            return res.status(400).send({ error: "ต้องระบุ userId" });
        }

        // ตรวจสอบว่า userId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "ไม่พบ userId ที่ถูกต้อง" });
        }

        const basket = await BasketShopping.findOne({ userId: userId });
        if (!basket) {
            return res.status(404).json({ message: "ไม่พบ Basket" });
        }

        res.status(200).send(basket)
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.deleteBasket = async (req, res) => {
    try {
        const basketId = req.params.basketId

        // ตรวจสอบว่ามี basketId หรือไม่
        if (!basketId) {
            return res.status(400).send({ error: "ต้องระบุ basketId" });
        }

        // ตรวจสอบว่า basketId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(basketId)) {
            return res.status(400).json({ message: "ไม่พบ basketId ที่ถูกต้อง" });
        }

        const basket = await BasketShopping.findByIdAndDelete(basketId)

        if (!basket) {
            return res.status(404).json({ message: "Basket not found" });
        }

        res.status(200).json({ message: "Basket deleted successfully" });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.clearBasketAllItems = async (req, res) => {
    try {
        const { basketId } = req.params
        const userId = req.body.userId

        // ตรวจสอบว่ามี userId หรือไม่
        if (!userId) {
            return res.status(400).send({ error: "ต้องระบุ userId" });
        }

        // ตรวจสอบว่า userId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "ไม่พบ userId ที่ถูกต้อง" });
        }

        const existingBasket = await BasketShopping.findById(basketId);

        if (!existingBasket) {
            return res.status(404).send({ error: "basketId not found" });
        }

        try {
            existingBasket.items = []
        }
        catch (error) {
            console.error("Failed to clear the basket:", error);

            res.status(500).send({
                message: "Error claering items in the basket (mayby type of datas mismatched)",
                error: error.toString(),
            });
        }

        existingBasket.updatedAt = new Date()
        existingBasket.totalPrice = 0
        await existingBasket.save()

        res.status(200).json({ message: "Basket cleared successfully" });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.addProductsInBasket = async (req, res) => {
    try {
        const { basketId } = req.params;
        const { userId, items } = req.body;

        // Validate basketId & userId
        if (!basketId || !mongoose.Types.ObjectId.isValid(basketId)) {
            return res.status(400).json({ error: "basketId ไม่ถูกต้อง" });
        }
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "userId ไม่ถูกต้อง" });
        }

        // หา basket
        const basket = await BasketShopping.findById(basketId);
        if (!basket) return res.status(404).json({ error: "ไม่พบ basketId" });
        if (basket.userId.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own basket." });
        }

        let totalPrice = 0;
        const itemData = [];

        for (const { productId, quantity, variant } of items) {
            if (!quantity || quantity === 0) continue;
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ error: "productId ไม่ถูกต้อง" });
            }

            const product = await ProductShopping.findById(productId);
            if (!product) return res.status(404).json({ error: "ไม่พบ product" });

            const originalItem = basket.items.find(
                item =>
                    item.productId.toString() === productId.toString() &&
                    item.variant.sku === variant.sku
            );
            if (originalItem) {
                for (let index = 0; index < basket.items.length; index++) {
                    if (basket.items[index].productId.toString() === productId && basket.items[index].variant.sku === variant.sku) {
                        basket.items[index].quantity += quantity
                        basket.items[index].totalPrice += basket.items[index].originalPrice * quantity
                        totalPrice += basket.items[index].totalPrice
                        continue
                    }
                    console.log(`basket.items => ${basket.items[index].productId}`)
                }
                continue
            }

            const foundVariant = product.variants.find(v => v.sku === variant.sku);
            if (!foundVariant) {
                return res.status(404).json({ error: `ไม่พบ variant sku: ${variant.sku}` });
            }
            if (foundVariant.quantity < quantity) {
                return res.status(400).json({
                    error: `สินค้า ${product.title} sku: ${variant.sku} มีจำนวนไม่เพียงพอ`
                });
            }

            const lineTotal = quantity * foundVariant.price;
            totalPrice += lineTotal;

            itemData.push({
                creator: product.creator,
                productId: product._id,
                variant: { sku: foundVariant.sku },
                quantity,
                originalPrice: foundVariant.price,
                totalPrice: lineTotal
            });
        }

        // อัพเดต basket
        basket.items.push(...itemData);
        basket.totalPrice = basket.totalPrice + totalPrice;
        basket.updatedAt = new Date();
        await basket.save()

        res.status(200).json({
            message: `Basket ${basketId} add item successfully`,
            basket: basket
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}


exports.removeProductByIdInBasket = async (req, res) => {
    try {
        const { basketId } = req.params
        const {
            userId,
            productId
        } = req.body

        // ตรวจสอบว่ามี basketId หรือไม่
        if (!basketId) {
            return res.status(400).send({ error: "ต้องระบุ basketId" });
        }

        // ตรวจสอบว่า basketId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(basketId)) {
            return res.status(400).json({ message: "ไม่พบ basketId ที่ถูกต้อง" });
        }

        // ตรวจสอบว่ามี userId หรือไม่
        if (!userId) {
            return res.status(400).send({ error: "ต้องระบุ userId" });
        }

        // ตรวจสอบว่า userId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "ไม่พบ userId ที่ถูกต้อง" });
        }

        // ตรวจสอบว่ามี productId หรือไม่
        if (!productId) {
            return res.status(400).send({ error: "ต้องระบุ productId" });
        }

        // ตรวจสอบว่า productId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "ไม่พบ productId ที่ถูกต้อง" });
        }

        const existingBasket = await BasketShopping.findById(basketId);

        if (!existingBasket) {
            return res.status(404).send({ error: "basketId not found" });
        }

        if (existingBasket.userId.toString() !== userId) {
            return res
                .status(403)
                .send({ error: "You can only remove your own basket." });
        }

        // const product = await ProductShopping.findById(productId)
        // if (!product) {
        //     return res.status(404).send({ error: "productId not found" });
        // }

        const newItems = []

        for (const item of existingBasket.items) {
            if (item.productId.toString() !== productId) {
                console.log(`if productId is equal `)
                newItems.push(item)
            }
        }
        console.log(`newItems => ${newItems}`)


        res.status(200).json({
            message: `Product ${productId} removed successfully`,
            existingBasket: existingBasket
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}