const mongoose = require('mongoose');

const BasketItemShoppingSchema = new mongoose.Schema(
  {
    creator: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductShopping',
      required: true
    },

    variant: {
      sku: { type: String }, // รหัส variant ที่เลือก
    },

    quantity: { type: Number, required: true, min: 1 },

    originalPrice: { type: Number, required: true },

    totalPrice: { type: Number, required: true },

  });

const BasketShoppingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // อ้างอิง user ที่เป็นเจ้าของตะกร้า
      required: true,
      unique: true // 1 user มี 1 basket
    },

    items: [BasketItemShoppingSchema],

    totalPrice: { type: Number, required: true },

  }, { timestamps: true });

const BasketShopping = mongoose.model('Basket', BasketShoppingSchema);
module.exports = BasketShopping