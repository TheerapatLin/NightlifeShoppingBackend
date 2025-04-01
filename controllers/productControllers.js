const Product = require("../schemas/v1/product.schema");


// [POST] สร้างสินค้า
exports.createProduct = async (req, res) => {
    try {
        const { 
            title, description, type, imageUrls, originalPrice, discountedPrice, currency, venueId, 
            totalQuantity, remainingQuantity, startDate, endDate, categories, termsAndConditions 
        } = req.body;

        // ตรวจสอบค่าที่จำเป็น
        if (!title?.en || !title?.th || !originalPrice || !type || !totalQuantity || !remainingQuantity) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        // ตรวจสอบว่า imageUrls เป็น array
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
            return res.status(400).json({ success: false, message: "imageUrls must be an array with at least one URL." });
        }

        const newProduct = await Product.create({
            title,
            description,
            type,
            imageUrls, // ต้องแก้ Schema ให้รองรับ Array ด้วย
            originalPrice,
            discountedPrice,
            currency: currency || "THB",
            venueId,
            totalQuantity,
            remainingQuantity,
            startDate,
            endDate,
            categories,
            termsAndConditions
        });

        res.status(201).json({ success: true, message: "Product created successfully.", data: newProduct });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

// [GET] ดูสินค้าทั้งหมด
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json({ success: true, count: products.length, data: products });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

// [GET] ดูสินค้าตาม ID
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        res.status(200).json({ success: true, data: product });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

// [PUT] อัปเดตสินค้า
exports.updateProduct = async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { 
            new: true, 
            runValidators: true 
        });

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        res.status(200).json({ success: true, message: "Product updated successfully.", data: updatedProduct });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};

// [DELETE] ลบสินค้า
exports.deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }
        res.status(200).json({ success: true, message: "Product deleted successfully." });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};
