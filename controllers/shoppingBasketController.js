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
        const basket = await BasketShopping.findByIdAndDelete(req.params.basketId)

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
            // res.status(200).send(existingBasket)
        }
        catch (error) {
            console.error("Failed to clear the basket:", error);
            // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
            res.status(500).send({
                message: "Error claering items in the basket (mayby type of datas mismatched)",
                error: error.toString(),
            });
        }

        existingBasket.updatedAt = new Date()
        await existingBasket.save()

        res.status(200).json({ message: "Basket cleared successfully" });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.AddProductInBasket = async (req, res) => {
    try {
        const { basketId } = req.params
        const {
            userId,
            items
        } = req.body

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

        if (existingBasket.userId.toString() !== userId) {
            return res
                .status(403)
                .send({ error: "You can only edit your own basket." });
        }

        let itemData = [];
        for (const item of items) {
            const productId = item.productId;

            if (item.quantity === 0) {
                continue
            }

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ message: "ไม่พบ productId" });
            }

            const product = await ProductShopping.findById(productId);

            if (!product) {
                return res.status(404).json({ message: "ไม่พบ product" });
            }

            const sku = item.variant.sku;
            let foundVariant = false;
            for (const variant of product.variants) {
                if (variant.sku === sku) {
                    itemData.push({
                        creator: {
                            id: product.creator.id,
                            name: product.creator.name
                        },
                        productId: product._id, // หรือจะเก็บ product object ก็ได้
                        variant: {
                            sku: variant.sku
                        },
                        quantity: item.quantity,
                        originalPrice: variant.price,
                        totalPrice: item.quantity * variant.price
                    });
                    foundVariant = true;
                    break; // ถ้าเจอแล้วไม่ต้องเช็คต่อ
                }
            }
            if (!foundVariant) {
                return res.status(404).json({ message: `ไม่พบ variant ที่มี sku: ${sku} ใน productId: ${productId}` });
            }
        }

        let totalPrice = 0
        for (const item of itemData) {
            totalPrice = totalPrice + item.totalPrice
        }

        try {
            existingBasket.items.push(...itemData)
            existingBasket.totalPrice = totalPrice
        }
        catch (error) {
            console.error("Failed to add item in the basket:", error);

            // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
            res.status(500).send({
                message: "Error addinging items in the basket (mayby type of datas mismatched)",
                error: error.toString(),
            });
        }

        existingBasket.updatedAt = new Date()
        await existingBasket.save()

        res.status(200).json({ 
            message: `Basket ${basketId} add item successfully`,
            existingBasket: existingBasket
         });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}
