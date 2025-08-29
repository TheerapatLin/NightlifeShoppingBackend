const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({

    sku: { type: String, required: true, unique: true },

    attributes: {
        size: { type: String },
        color: { type: String },
        material: { type: String }
    },

    price: { type: Number, required: true },

    quantity: { type: Number, required: true },

    soldQuantity: { type: Number, default: 0 },

    imageUrls: [{ type: String }]
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
        en: { type: String, required: true },
        th: { type: String, required: true }
    },

    imageUrls: [{ type: String, required: false }],

    originalPrice: { type: Number, required: true },

    // discountedPrice: { type: Number, required: true },
    currency: { type: String, default: 'THB' },

    variants: [VariantSchema],

    totalQuantity: { type: Number, required: true },

    remainingQuantity: { type: Number, required: true },

    soldQuantity: { type: Number, default: 0 },

    isLimited: { type: Boolean, default: false },

    startDate: { type: Date, required: true, default: Date.now },

    endDate: { type: Date },

    hasEndDate: { type: Boolean, default: false },

    categoryId:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CategoryShopping',
        required: true
    },

    tags: [{ type: String }],

    status: { type: String, enum: ['active', 'expired', 'sold_out'], default: 'active' },

}, { timestamps: true });

// ProductShoppingSchema.index({ title: 1, status: 1 }); // Index for fast searching

const ProductShopping = mongoose.model('productshopping', ProductShoppingSchema);
module.exports = ProductShopping