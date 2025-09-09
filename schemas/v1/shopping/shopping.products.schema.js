const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({

    sku: { type: String, required: true },

    attributes: {
        size: { type: String },
        color: { type: String },
        material: { type: String }
    },

    price: { type: Number, required: true },

    quantity: { type: Number, required: true },

    soldQuantity: { type: Number, default: 0 },

    images: [{ order: Number, fileName: String }], // จำกัดที่ 3 รูป
});

const ProductShoppingSchema = new mongoose.Schema({

    creator: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: String,
    },

    title: {
        en: { type: String, required: true },
        th: { type: String, required: true }
    },

    description: {
        en: { type: String },
        th: { type: String }
    },

    // รูปหลัก
    image: [{ order: Number, fileName: String }],

    originalPrice: { type: Number, required: true },

    // discountedPrice: { type: Number, required: true },
    currency: { type: String, default: 'THB' },

    variants: [VariantSchema],

    // totalQuantity ให้ frontend คำนวณจาก Variants
    // remainingQuantity ให้ frontend คำนวณจาก Variants
    // soldQuantity ให้ frontend คำนวณจาก Variants

    isLimited: { type: Boolean, default: false },

    tags: [{ type: String }],

    status: { type: String, enum: ['active', 'inactive', 'sold_out','draft'], default: 'active' },

}, { timestamps: true });

// ProductShoppingSchema.index({ title: 1, status: 1 }); // Index for fast searching

const ProductShopping = mongoose.model('productshopping', ProductShoppingSchema);
module.exports = ProductShopping