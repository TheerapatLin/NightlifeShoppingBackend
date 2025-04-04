const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// สำหรับ Featured Items เช่น เมนูเด็ด
const featuredItemSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  category: {
    type: String,
    enum: ["Drink", "Food", "Other"],
    default: "Other",
  },
  images: [{ type: String }],
  price: { type: Number },
  isRecommended: { type: Boolean, default: false },
  availableTime: { type: String }, // เช่น "Happy Hour 18:00-20:00"

  // การอ้างอิงถึง product ถ้ามี
  productId: { type: Schema.Types.ObjectId, ref: "Product" },
});

const venueSchema = new Schema(
  {
    businessId: { type: String, index: true }, // อ้างอิงกับระบบ business

    // ชื่อ
    name: { type: String, required: true },
    nameTH: { type: String, required: true },
    nameEN: { type: String, required: true },

    // รายละเอียด
    descriptionTH: { type: String, required: true, default: "" },
    descriptionEN: { type: String, required: true, default: "" },

    // ตำแหน่งบนแผนที่
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true, // [longitude, latitude]
        index: "2dsphere", // สำหรับ geospatial query
      },
      name: String,
      description: String,
    },

    // ประเภทของร้าน
    type: {
      type: String,
      required: true,
      enum: ["Nightclub", "Bar", "Restaurant", "Food", "Activity"],
      index: true,
    },

    // รูปหลัก
    image: [{ type: String }],

    // เมนูเด่นหรือของแนะนำ
    featuredItems: [featuredItemSchema],

    // อ้างอิง event / โต๊ะ
    eventListID: [{ type: String }],
    tableListID: [{ type: String }],

    // Review
    reviewStar: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    // ช่องทางติดต่อ
    contact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      website: { type: String, default: "" },
    },

    // Social media
    socialMedia: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      line: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },

    // เวลาเปิดร้าน
    openingHours: {
      monday: { type: String, default: "" },
      tuesday: { type: String, default: "" },
      wednesday: { type: String, default: "" },
      thursday: { type: String, default: "" },
      friday: { type: String, default: "" },
      saturday: { type: String, default: "" },
      sunday: { type: String, default: "" },
    },

    // แท็กและบริการเสริม
    tags: [{ type: String, index: true }],
    amenities: [{ type: String }],
  },
  {
    timestamps: true, // เพิ่ม createdAt และ updatedAt
  }
);

// ดัชนี (Index) ที่สำคัญ
venueSchema.index({ type: 1, "location.coordinates": "2dsphere" });
venueSchema.index({ tags: 1 });
venueSchema.index({
  name: "text",
  nameTH: "text",
  nameEN: "text",
  descriptionTH: "text",
  descriptionEN: "text",
});

const Venue = mongoose.model("Venue", venueSchema);

module.exports = Venue;
