const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true },
    th: { type: String, required: true }
  },
  description: {
    en: { type: String, required: true },
    th: { type: String, required: true }
  },
  type: { type: String, required: true },
  imageUrls: [{ type: String, required: true }],
  originalPrice: { type: Number, required: true },
  discountedPrice: { type: Number, required: true },
  currency: { type: String, default: 'THB' },
  venueId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Venue' },
  totalQuantity: { type: Number, required: true },
  remainingQuantity: { type: Number, required: true },
  soldQuantity: { type: Number, default: 0 },
  isLimited: { type: Boolean, default: false },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  hasEndDate: { type: Boolean, default: false },
  couponExpiryType: { type: String, enum: ['fixed_date', 'after_purchase', 'no_expiry'] },
  couponExpiryDate: { type: Date },
  couponExpiryDaysAfterPurchase: { type: Number },
  termsAndConditions: {
    en: { type: String, required: true },
    th: { type: String, required: true }
  },
  categories: [{ type: String, required: true }],
  tags: [{ type: String }],
  status: { type: String, enum: ['active', 'expired', 'sold_out'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ProductSchema.index({ title: 1, status: 1 }); // Index for fast searching

module.exports = mongoose.model('Product', ProductSchema);