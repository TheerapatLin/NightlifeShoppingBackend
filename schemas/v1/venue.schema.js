const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// สำหรับ Featured Items เช่น เมนูเด็ด
const featuredItemSchema = new Schema({
  nameTH: { type: String, required: true },
  nameEN: { type: String, required: true },
  descriptionTH: { type: String, default: "" },
  descriptionEN: { type: String, default: "" },
  category: {
    type: String,
    enum: ["Drink", "Food", "Other"],
    default: "Other",
  },
  images: [{ type: String }], // ไม่เกิน 3 รูป
  normalPrice: { type: Number },
  sellPrice: { type: Number },
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
      name: { type: String, default: "" },
      area: { type: String, default: "" },
      description: { type: String, default: "" },
    },

    // ประเภทของร้าน
    type: {
      type: String,
      required: true,
      enum: ["Nightclub", "Bar", "Restaurant", "Food", "Activity", "Roof Top"],
      index: true,
    },

    musicTypes: { type: String, default: "" },

    // รูปหลัก
    image: [{ type: String }],

    dressCode: { type: String, default: "" },
    vibes: { type: String, default: "" },
    special: { type: String, default: "" },

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
      monday: {
        open: { type: String, default: "18:00" }, // 6 โมงเย็น
        close: { type: String, default: "02:00" }, // ตี 2
      },
      tuesday: {
        open: { type: String, default: "18:00" },
        close: { type: String, default: "02:00" },
      },
      wednesday: {
        open: { type: String, default: "18:00" },
        close: { type: String, default: "02:00" },
      },
      thursday: {
        open: { type: String, default: "18:00" },
        close: { type: String, default: "02:00" },
      },
      friday: {
        open: { type: String, default: "18:00" },
        close: { type: String, default: "02:00" },
      },
      saturday: {
        open: { type: String, default: "18:00" },
        close: { type: String, default: "02:00" },
      },
      sunday: {
        open: { type: String, default: "18:00" },
        close: { type: String, default: "02:00" },
      },
    },
    
    longBannerImg:{ type: String, default: "" },
    shortBannerImg:{ type: String, default: "" },

    // แท็กและบริการเสริม
    isBookable: { type: Boolean, default: false },
    linkWhenUnbookable: { type: String, default: "" },
    
    // ระบบโต๊ะและการจอง
    tableManagement: {
      enabled: { type: Boolean, default: false },
      totalTables: { type: Number, default: 0 },
      totalCapacity: { type: Number, default: 0 },
      floors: { type: Number, default: 1 },
      sections: [{ type: String }], // เช่น ['main-hall', 'terrace', 'vip']
      defaultReservationDuration: { type: Number, default: 120 }, // นาที
      advanceBookingDays: { type: Number, default: 30 }, // วันล่วงหน้า
      requiresDeposit: { type: Boolean, default: false },
      depositPercentage: { type: Number, default: 0 }, // %
      cancellationPolicy: {
        allowCancellation: { type: Boolean, default: true },
        cancellationDeadlineHours: { type: Number, default: 24 },
        cancellationFeePercentage: { type: Number, default: 0 }
      },
      operatingHours: {
        monday: { start: String, end: String, closed: { type: Boolean, default: false } },
        tuesday: { start: String, end: String, closed: { type: Boolean, default: false } },
        wednesday: { start: String, end: String, closed: { type: Boolean, default: false } },
        thursday: { start: String, end: String, closed: { type: Boolean, default: false } },
        friday: { start: String, end: String, closed: { type: Boolean, default: false } },
        saturday: { start: String, end: String, closed: { type: Boolean, default: false } },
        sunday: { start: String, end: String, closed: { type: Boolean, default: false } }
      },
      timeSlots: [{
        name: { type: String }, // เช่น 'lunch', 'dinner', 'happy-hour'
        startTime: { type: String }, // เช่น '11:00'
        endTime: { type: String }, // เช่น '14:00'
        duration: { type: Number }, // นาที
        isActive: { type: Boolean, default: true }
      }]
    },

    // อ้างอิง event / โต๊ะ
    eventListID: [{ type: String }],
    tableListID: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Table' }],
    
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
