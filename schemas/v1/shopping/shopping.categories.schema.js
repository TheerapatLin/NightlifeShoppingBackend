const mongoose = require('mongoose');

const CategoryShoppingSchema = new mongoose.Schema({

  creator: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
  },

  name: {
    en: { type: String, required: true },
    th: { type: String, required: true }
  },

  slug: { type: String, required: true, unique: true }, // slug สำหรับ URL เช่น "tshirt", "shoes"

  description: {
    en: { type: String },
    th: { type: String }
  },

  imageUrl: { type: String },

  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

},{ timestamps: true });

const CategoryShopping = mongoose.model('categoryshopping', CategoryShoppingSchema);
module.exports = CategoryShopping