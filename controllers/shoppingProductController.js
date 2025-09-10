// controllers/shoppingProductController.js
const ProductShopping = require("../schemas/v1/shopping/shopping.products.schema")
const User = require("../schemas/v1/user.schema");

const mongoose = require("mongoose");
const { OSSStorage, deleteFolder } = require("../modules/storage/oss");

exports.createProductShopping = async (req, res) => {
    try {
        const {
            creatorId,
            title,
            description,
            originalPrice,
            currency,
            tags,
            status,
            variants
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
                .send({ error: "ไม่พบข้อมูล User" });
        }

        const creatorName = user.user.name

        if (!originalPrice) {
            return res.status(400).send({ error: "ต้องระบุ original Price" });
        }

        if (currency != null && currency != 'THB') {
            return res.status(400).send({ error: "ในขณะนี้ยังไม่มี logic สำหรับการแปลงสกุลเงินนี้" });
        }

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
            tags: tags,
            status: status,
            variants: variants || []
        })

        const savedProduct = await newProduct.save()

        res.status(201).send({
            message: `Create new product successful.`,
            newProduct: savedProduct
        })
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
        const { creatorId } = req.body

        const existingProduct = await ProductShopping.findById(productId);

        if (!existingProduct) {
            return res.status(404).send({ error: "productId not found" });
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

        try {
            const fieldsToUpdate = [
                "title",
                "description",
                "originalPrice",
                "currency",
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
                    }
                    existingProduct[field] = req.body[field];
                }
            }
        } catch (error) {
            console.error("Failed to update the product:", error);
            return res.status(500).send({
                message: "Error updating the product (mayby type of datas mismatched)",
                error: error.toString(),
            });
        }

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

exports.addVariantsProduct = async (req, res) => {
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
            return res.status(400).json({ error: "sku ใน variants ที่จะสร้างใหม่นั้นซ้ำกันเอง" });
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
            product: product
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.removeVariantInProduct = async (req, res) => {
    try {
        const productId = req.params.productId
        const skuVariant = req.body.skuVariant

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

        if (!skuVariant) {
            return res.status(400).send({ error: "กรุณาระบุ sku ของ Variant ที่ต้องการลบ" });
        }

        let newVariant = []
        let foundSku = false
        let totalDeleteQuantity = 0
        let totalDeleteSoldQuantity = 0
        for (const variant of product.variants) {
            if (variant.sku === skuVariant) {
                foundSku = true
                totalDeleteQuantity = totalDeleteQuantity + variant.quantity
                totalDeleteSoldQuantity = totalDeleteSoldQuantity + variant.soldQuantity
                continue
            }
            newVariant.push(variant)
        }
        if (!foundSku) {
            return res.status(404).json({ message: `ไม่พบ variant ที่มี sku: ${sku} ใน productId: ${productId}` });
        }

        product.variants = newVariant
        product.totalQuantity = product.totalQuantity - totalDeleteQuantity
        product.soldQuantity = product.soldQuantity - totalDeleteSoldQuantity
        product.remainingQuantity = product.totalQuantity - product.soldQuantity
        product.save()

        res.status(200).json({
            message: `Variant Product: ${productId}, sku:${skuVariant}  removed successfully`,
            newVariant: product
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.editVariantProduct = async (req, res) => {
    try {
        const productId = req.params.productId
        const {
            sku,
            newSku,
            attributes,
            price,
            quantity,
            soldQuantity,
            images
        } = req.body

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

        if (!sku) {
            return res.status(400).send({ error: "กรุณาระบุ sku ของ Variant ที่ต้องการแก้ไข" });
        }

        const existingSkus = product.variants.map(v => v.sku);
        for (const sku of existingSkus) {
            if (sku === newSku) {
                return res.status(400).send({ error: `sku ที่คุณต้องการเปลี่ยนซ้ำกับ sku เดิมที่มีอยู่แล้ว (${sku})` });
            }
        }

        let newVariant = {}
        let foundSku = false

        for (let i = 0; i < product.variants.length; i++) {
            if (sku === product.variants[i].sku) {
                newVariant = {
                    sku: newSku ?? product.variants[i].sku,
                    attributes: {
                        size: attributes?.size ?? product.variants[i].attributes?.size,
                        color: attributes?.color ?? product.variants[i].attributes?.color,
                        material: attributes?.material ?? product.variants[i].attributes?.material
                    },
                    price: price ?? product.variants[i].price,
                    quantity: quantity ?? product.variants[i].quantity,
                    soldQuantity: soldQuantity ?? product.variants[i].soldQuantity,
                    images: images
                        ? [...product.variants[i].images, ...images.map((img, idx) => ({
                            order: product.variants[i].images.length + idx,
                            fileName: img.previewUrl
                        }))]
                        : product.variants[i].images
                };
                product.variants[i] = newVariant;

                foundSku = true;
                break; // ไม่ต้อง loop ต่อแล้ว
            }
        }

        if (!foundSku) {
            return res.status(404).json({ message: `ไม่พบ variant ที่มี sku: ${sku} ใน productId: ${productId}` });
        }

        await product.save()

        res.status(200).json({
            message: `Variant Product: ${productId}, sku:${sku}  saved successfully`,
            product: product
        });
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.addImageIntoProduct = async (req, res) => {
    try {
        const productId = req.params.productId
        const userId = req.body.userId

        if (!userId) {
            return res.status(400).send({ error: "ต้องระบุ userId" });
        }

        const user = await User.findById(userId)
        if (!user) {
            return res
                .status(404)
                .send({ error: "ไม่พบข้อมูล User" });
        }

        if (!productId) {
            return res.status(400).send({ error: "ต้องระบุ productId" });
        }

        const product = await ProductShopping.findById(productId)

        if (!product) {
            return res
                .status(404)
                .send({ error: "ไม่พบข้อมูล Product" });
        }

        if (product.creator.id.toString() !== userId) {
            return res
                .status(403)
                .send({ error: "You can only edit your own product." });
        }

        // อัปโหลดรูปภาพ
        let images = [];
        if (req.files && req.files.length) {
            const imageOrder = req.body.imageOrder
                ? JSON.parse(req.body.imageOrder)
                : {};
            const uploadPromises = req.files.map(async (file, index) => {
                const order = imageOrder[file.originalname] || index;
                const uniqueTimestamp = Date.now();
                return OSSStorage.put(
                    `user/${userId}/shopping/${product._id}/product-${order}-${uniqueTimestamp}.jpg`,
                    Buffer.from(file.buffer)
                ).then((image) => ({
                    order,
                    fileName: image.url,
                }));
            });

            try {
                images = await Promise.all(uploadPromises);
            } catch (uploadError) {
                return res
                    .status(500)
                    .send({ error: `เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${uploadError}` });
            }
        }

        if (images.length > 0) {
            product.image = images;
            await product.save();
        }

        res.status(200).send({
            message: `Add image into product:${product.title.en} successful.`,
            product: product
        })

    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}

exports.addImagesIntoVariant = async (req, res) => {
    try {
        const productId = req.params.productId
        const { userId, sku, indexes } = req.body

        if (!userId) {
            return res.status(400).send({ error: "ต้องระบุ userId" });
        }
        const user = await User.findById(userId)
        if (!user) {
            return res
                .status(404)
                .send({ error: "ไม่พบข้อมูล User" });
        }

        if (!productId) {
            return res.status(400).send({ error: "ต้องระบุ productId" });
        }
        const product = await ProductShopping.findById(productId)
        if (!product) {
            return res
                .status(404)
                .send({ error: "ไม่พบข้อมูล Product" });
        }

        if (product.creator.id.toString() !== userId) {
            return res
                .status(403)
                .send({ error: "You can only edit your own product." });
        }
        console.log(`indexes => ${JSON.stringify(indexes, null, 2)}`)

        for (let index = 0; index < product.variants.length; index++) {
            if (sku === product.variants[index].sku) {
                // อัปโหลดรูปภาพ
                let images = [];
                if (req.files && req.files.length) {
                    const imageOrder = req.body.imageOrder
                        ? JSON.parse(req.body.imageOrder)
                        : {};
                    const uploadPromises = req.files.map(async (file, fileIndex) => {
                        const currentImagesLength = product.variants[index].images.length;
                        const order = imageOrder[file.originalname] || (currentImagesLength + fileIndex);
                        const uniqueTimestamp = Date.now();
                        const fileName = `products/${productId}/variants/${sku}/${uniqueTimestamp}-${fileIndex}-${file.originalname}`;
                        return OSSStorage.put(
                            fileName,
                            Buffer.from(file.buffer),
                            {
                                headers: {
                                    'Content-Type': file.mimetype,
                                    'Cache-Control': 'public, max-age=31536000',
                                },
                            }
                        ).then((image) => ({
                            order,
                            fileName: image.url,
                        }));
                    });

                    try {
                        images = await Promise.all(uploadPromises);
                    } catch (uploadError) {
                        return res
                            .status(500)
                            .send({ error: `เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${uploadError}` });
                    }
                }
                if (images.length > 0) {
                    product.variants[index].images.push(...images);
                }
                let newImages = [];
                
                if (indexes && indexes.length > 0) {
                    for (let i = 0; i < product.variants[index].images.length; i++) {
                        if (indexes.includes(i)) {
                            continue;
                        }
                        newImages.push({
                            ...product.variants[index].images[i].toObject(),
                            order: newImages.length // อัปเดต order ใหม่
                        });
                    }
                    product.variants[index].images = newImages;
                }                
                await product.save();
            }
        }
        res.status(200).send({
            message: `Add image into product: ${product.title.en} sku: ${sku} successful.`,
            product: product
        })
    }
    catch (error) {
        res.status(500).send({ error: error.message });
    }
}