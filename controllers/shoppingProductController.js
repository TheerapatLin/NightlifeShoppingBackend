const ProductShopping = require("../schemas/v1/shopping/shopping.products.schema")
const CategoryShopping = require('../schemas/v1/shopping/shopping.categories.schema')
const User = require("../schemas/v1/user.schema");
const mongoose = require("mongoose");

exports.createProductShopping = async (req, res) => {
    try {
        const {
            creatorId,
            creatorName,
            title,
            description,
            originalPrice,
            currency,
            variants,
            isLimited,
            hasEndDate,
            categoryId,
            tags,
            status
        } = req.body

        // ตรวจสอบว่ามี creatorId หรือไม่
        if (!creatorId) {
            return res.status(400).send({ error: "ต้องระบุ Creator ID" });
        }

        // ค้นหาผู้สร้างกิจกรรม (creator)
        const user = await User.findById(creatorId).populate(
            "userData",
            "profileImage"
        );
        if (!user) {
            return res
                .status(404)
                .send({ error: "ไม่พบข้อมูลผู้สร้างกิจกรรม (Creator)" });
        }

        if (!originalPrice) {
            return res.status(400).send({ error: "ต้องระบุ original Price" });
        }

        if (currency != null && currency != 'THB') {
            return res.status(400).send({ error: "ในขณะนี้ยังไม่มี logic สำหรับการแปลงสกุลเงินนี้" });
        }

        if (!categoryId) {
            return res.status(400).send({ error: "ต้องระบุ categoryId" });
        }

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: "ไม่พบ categoryId" });
        }

        const category = await CategoryShopping.findById(categoryId)

        if (!category) {
            return res.status(404).json({ message: "ไม่พบ category" });
        }

        let totalQuantity = 0
        let remainingQuantity = 0
        let soldQuantity = 0

        for (const variant of variants) {
            totalQuantity = totalQuantity + variant.quantity
            soldQuantity = soldQuantity + variant.soldQuantity
        }

        remainingQuantity = totalQuantity - soldQuantity

        const newProduct = new ProductShopping({
            creator: { id: creatorId, name: creatorName },
            title: {
                en: title.en,
                th: title.th
            },
            description: {
                en: description.en,
                th: description.th
            },
            originalPrice: originalPrice,
            currency: currency,
            variants: variants,
            totalQuantity: totalQuantity,
            remainingQuantity: remainingQuantity,
            soldQuantity: soldQuantity,
            isLimited: isLimited,
            hasEndDate: hasEndDate,
            categoryId: categoryId,
            tags: tags,
            status: status
        })

        await newProduct.save()

        res.status(200).send({ message: `Create new product successful.` })
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.getAllProductShopping = async (req, res) => {
    try {
        const products = await ProductShopping.find({})

        if (!products || products.length === 0) {
            return res.status(404).json({ message: "ไม่พบ Products" });
        }
        res.status(200).send(products)
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.getProductById = async (req, res) => {
    try {
        const productId = req.params.productId

        if (!productId) {
            return res.status(400).send({ error: "ต้องระบุ productId" });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "productId ไม่ถูกต้อง" });
        }

        const product = await ProductShopping.findById(productId)

        if (!product) {
            return res.status(404).json({ message: "ไม่พบ product" });
        }
        res.status(200).send(product)
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.getProductByCreatorId = async (req, res) => {
    try {
        const creatorId = req.params.creatorId;

        // ตรวจสอบว่ามี creatorId หรือไม่
        if (!creatorId) {
            return res.status(400).send({ error: "ต้องระบุ creatorId" });
        }

        // ตรวจสอบว่า creatorId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(creatorId)) {
            return res.status(400).json({ message: "ไม่พบ creatorId ที่ถูกต้อง" });
        }

        const limit = parseInt(req.query.limit) || 0; // ตั้งค่า limit ให้เป็น 0 ถ้าไม่ได้ระบุ เพื่อไม่จำกัดจำนวนข้อมูล

        // ค้นหากิจกรรมที่สร้างโดยผู้ใช้ที่มี id ตรงกับ creatorId
        const products = await ProductShopping.find({ "creator.id": creatorId })
            .sort({ createdAt: -1 }) // เรียงลำดับจากใหม่ไปเก่า
            .limit(limit)

        if (!products || products.length === 0) {
            return res.status(404).json({ message: "ไม่พบ products" });
        }

        // ดึงข้อมูลของผู้สร้างกิจกรรม
        const creator = await User.findById(creatorId)
            .populate({
                path: "userData", // เติมข้อมูล `userData` ของผู้สร้าง
                model: "RegularUserData",
                select: "profileImage", // เลือกรูปโปรไฟล์
            })
            .select("user.name userData"); // เลือกเฉพาะฟิลด์ชื่อผู้ใช้และ `userData`

        if (!creator) {
            return res.status(404).json({ message: "ไม่พบข้อมูลผู้สร้าง products" });
        }

        // จัดรูปแบบข้อมูลกิจกรรมพร้อมข้อมูลผู้สร้างและผู้เข้าร่วม
        const productsWithCreatorInfo = products.map((product) => {
            return {
                ...product.toObject(),
                creator: {
                    id: creator._id, // id ของผู้สร้าง
                    name: creator.user.name, // ชื่อผู้สร้าง
                    profileImage: creator.userData
                        ? creator.userData.profileImage || "" // รูปโปรไฟล์ของผู้สร้าง (ถ้าไม่มีให้ใช้ค่าว่าง)
                        : "",
                },
            };
        });

        res.status(200).send(productsWithCreatorInfo)

    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.editProduct = async (req, res) => {
    try {
        const { productId } = req.params
        const { creatorId, categoryId } = req.body

        const existingProduct = await ProductShopping.findById(productId);

        if (!existingProduct) {
            return res.status(404).send({ error: "productId not found" });
        }

        if (categoryId) {
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                return res.status(400).json({ message: "ไม่พบ categoryId" });
            }

            const category = await CategoryShopping.findById(categoryId)

            if (!category) {
                return res.status(404).json({ message: "ไม่พบ category" });
            }
        }

        // ตรวจสอบว่ามี creatorId หรือไม่
        if (!creatorId) {
            return res.status(400).send({ error: "ต้องระบุ creatorId" });
        }

        // ตรวจสอบว่า creatorId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(creatorId)) {
            return res.status(400).json({ message: "ไม่พบ creatorId ที่ถูกต้อง" });
        }

        if (existingProduct.creator.id.toString() !== creatorId) {
            return res
                .status(403)
                .send({ error: "You can only edit your own product." });
        }

        let totalQuantity = 0
        let remainingQuantity = 0
        let soldQuantity = 0

        try {


            const fieldsToUpdate = [
                "title",
                "description",
                "originalPrice",
                "currency",
                "variants",
                "isLimited",
                "hasEndDate",
                "categoryId",
                "tags",
                "status"
            ];
            for (const field of fieldsToUpdate) {
                if (req.body[field] !== undefined) {
                    switch (field) {
                        case "currency":
                            if (req.body[field] != null && req.body[field] != 'THB') {
                                return res.status(400).send({ error: "ในขณะนี้ยังไม่มี logic สำหรับการแปลงสกุลเงินนี้" });
                            }
                        case "variants":
                            for (const variant of req.body[field]) {
                                totalQuantity = totalQuantity + variant.quantity
                                soldQuantity = soldQuantity + variant.soldQuantity
                            }
                    }
                    existingProduct[field] = req.body[field];
                }
            }
        } catch (error) {
            console.error("Failed to update the product:", error);
            // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
            return res.status(500).send({
                message: "Error updating the product (mayby type of datas mismatched)",
                error: error.toString(),
            });
        }

        remainingQuantity = totalQuantity - soldQuantity
        existingProduct.totalQuantity = totalQuantity
        existingProduct.remainingQuantity = remainingQuantity
        existingProduct.soldQuantity = soldQuantity
        existingProduct.updatedAt = new Date()
        await existingProduct.save()

        res.status(200).json({
            message: "Product updated successfully",
            existingProduct: existingProduct
        });
    }
    catch (error) {
        return res.status(500).send({ error: error.message });
    }
}

exports.deleteProduct = async (req, res) => {
    try {
        const product = await ProductShopping.findByIdAndDelete(req.params.productId)

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product deleted successfully" });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.AddVariantProduct = async (req, res) => {
    try {
        const productId = req.params.productId
        const variants = req.body.variants

        if (!productId) {
            return res.status(400).send({ error: "ต้องระบุ productId" });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "productId ไม่ถูกต้อง" });
        }

        const product = await ProductShopping.findById(productId)

        if (!product) {
            return res.status(404).json({ message: "ไม่พบ product" });
        }

        // ✅ ตรวจสอบว่า variants ต้องเป็น array และไม่ว่าง
        if (!Array.isArray(variants) || variants.length === 0) {
            return res.status(400).json({ error: "variants ต้องเป็น array และต้องมีอย่างน้อย 1 รายการ" });
        }

        // ✅ ตรวจสอบว่าแต่ละ variant มี field ที่จำเป็น
        for (const variant of variants) {
            if (!variant.sku || typeof variant.sku !== "string") {
                return res.status(400).json({ error: "แต่ละ variant ต้องมี sku" });
            }
            if (variant.quantity == null || typeof variant.quantity !== "number") {
                return res.status(400).json({ error: "แต่ละ variant ต้องมี quantity เป็นตัวเลข" });
            }
            if (variant.soldQuantity == null || typeof variant.soldQuantity !== "number") {
                return res.status(400).json({ error: "แต่ละ variant ต้องมี soldQuantity เป็นตัวเลข" });
            }
        }

        // ตรวจสอบว่า sku ใน variants ที่จะเพิ่มใหม่ซ้ำกันเองหรือไม่
        const newSkus = variants.map(v => v.sku);
        const newSkusSet = new Set(newSkus);
        if (newSkus.length !== newSkusSet.size) {
            return res.status(400).json({ error: "sku ใน variants ที่จะเพิ่มใหม่ซ้ำกันเอง" });
        }

        // ตรวจสอบว่า sku ใน variants ที่จะเพิ่มใหม่ ซ้ำกับ sku ที่มีอยู่ใน product หรือไม่
        const existingSkus = product.variants.map(v => v.sku);
        const duplicateSkus = newSkus.filter(sku => existingSkus.includes(sku));
        if (duplicateSkus.length > 0) {
            return res.status(400).json({ error: `sku ต่อไปนี้มีอยู่แล้วใน product: ${duplicateSkus.join(", ")}` });
        }

        product.variants.push(...variants);
        await product.save();

        res.status(200).json({
            message: `Variant Product ${productId} added successfully`,
            variant: variants
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}