const mongoose = require('mongoose');

const WishlistItemSchema = new mongoose.Schema({
    title: {
        en: { type: String },
        th: { type: String }
    },
    description: {
        en: { type: String },
        th: { type: String }
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductShopping',
        required: true
    },
    image: {
        type: String,
    },
})

const WishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [WishlistItemSchema]
})

const Wishlist = mongoose.model('Wishlist', WishlistSchema);
module.exports = Wishlist;