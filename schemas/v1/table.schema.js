const mongoose = require('mongoose');

// Table Schema สำหรับข้อมูลโต๊ะแต่ละตัว
const tableSchema = new mongoose.Schema({
  // ข้อมูลพื้นฐาน
  tableNumber: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    en: { type: String, trim: true },
    th: { type: String, trim: true }
  },
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
    index: true
  },

  // ประเภทและขนาดโต๊ะ
  tableType: {
    type: String,
    enum: ['dining', 'bar', 'booth', 'private', 'outdoor', 'counter'],
    required: true
  },
  capacity: {
    min: { type: Number, required: true, min: 1 },
    max: { type: Number, required: true, min: 1 },
    recommended: { type: Number, required: true, min: 1 }
  },
  shape: {
    type: String,
    enum: ['round', 'square', 'rectangle', 'oval', 'custom'],
    default: 'rectangle'
  },
  dimensions: {
    width: { type: Number }, // ซม.
    length: { type: Number }, // ซม.
    height: { type: Number } // ซม.
  },

  // ตำแหน่งในร้าน
  location: {
    floor: { type: Number, default: 1 },
    section: { type: String, trim: true }, // เช่น 'main-hall', 'terrace', 'vip'
    zone: { type: String, trim: true }, // เช่น 'smoking', 'non-smoking'
    coordinates: {
      x: { type: Number }, // พิกัด X ในผัง
      y: { type: Number }, // พิกัด Y ในผัง
      rotation: { type: Number, default: 0 } // องศาการหมุน
    }
  },

  // สถานะและการใช้งาน
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'reserved'],
    default: 'active'
  },
  isBookable: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },

  // คุณสมบัติพิเศษ
  features: [{
    type: String,
    enum: [
      'window-view', 'air-conditioning', 'fan', 'tv', 'music-system', 
      'charging-port', 'wifi', 'privacy-screen', 'wheelchair-accessible',
      'high-chair-available', 'pet-friendly', 'smoking-allowed'
    ]
  }],

  // ราคาและค่าบริการ
  pricing: {
    basePrice: { type: Number, default: 0 }, // ราคาขั้นต่ำ
    serviceCharge: { type: Number, default: 0 }, // ค่าบริการ %
    minimumSpend: { type: Number, default: 0 }, // ยอดขั้นต่ำ
    timeBasedPricing: [{
      timeSlot: { type: String }, // เช่น 'lunch', 'dinner', 'happy-hour'
      startTime: { type: String }, // เช่น '11:00'
      endTime: { type: String }, // เช่น '14:00'
      price: { type: Number }
    }]
  },

  // เวลาดำเนินการ
  operatingHours: {
    monday: { start: String, end: String, closed: { type: Boolean, default: false } },
    tuesday: { start: String, end: String, closed: { type: Boolean, default: false } },
    wednesday: { start: String, end: String, closed: { type: Boolean, default: false } },
    thursday: { start: String, end: String, closed: { type: Boolean, default: false } },
    friday: { start: String, end: String, closed: { type: Boolean, default: false } },
    saturday: { start: String, end: String, closed: { type: Boolean, default: false } },
    sunday: { start: String, end: String, closed: { type: Boolean, default: false } }
  },

  // ข้อมูลเพิ่มเติม
  description: {
    en: { type: String },
    th: { type: String }
  },
  images: [{ type: String }], // URLs ของรูปภาพ
  tags: [{ type: String }], // แท็กสำหรับค้นหา
  notes: { type: String }, // หมายเหตุภายใน

  // ข้อมูลการสร้างและแก้ไข
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'tables'
});

// Indexes สำหรับประสิทธิภาพ
tableSchema.index({ venueId: 1, tableNumber: 1 }, { unique: true });
tableSchema.index({ venueId: 1, status: 1 });
tableSchema.index({ venueId: 1, tableType: 1 });
tableSchema.index({ venueId: 1, isBookable: 1 });
tableSchema.index({ 'location.floor': 1, 'location.section': 1 });

// Virtual สำหรับคำนวณ
tableSchema.virtual('capacityStatus').get(function() {
  if (this.capacity.max <= 2) return 'small';
  if (this.capacity.max <= 4) return 'medium';
  if (this.capacity.max <= 8) return 'large';
  return 'extra-large';
});

tableSchema.virtual('isAvailable').get(function() {
  return this.status === 'active' && this.isBookable;
});

// Methods
tableSchema.methods.updateStatus = function(newStatus, reason) {
  this.status = newStatus;
  if (reason) {
    this.notes = `${this.notes || ''}\n${new Date().toISOString()}: Status changed to ${newStatus}. Reason: ${reason}`;
  }
  return this.save();
};

tableSchema.methods.canAccommodate = function(guestCount) {
  return guestCount >= this.capacity.min && guestCount <= this.capacity.max;
};

// Static methods
tableSchema.statics.findByVenue = function(venueId, options = {}) {
  const query = { venueId };
  
  if (options.status) query.status = options.status;
  if (options.tableType) query.tableType = options.tableType;
  if (options.isBookable !== undefined) query.isBookable = options.isBookable;
  if (options.minCapacity) query['capacity.max'] = { $gte: options.minCapacity };
  if (options.maxCapacity) query['capacity.min'] = { $lte: options.maxCapacity };
  
  return this.find(query).sort({ 'location.floor': 1, 'location.section': 1, tableNumber: 1 });
};

tableSchema.statics.findAvailableForBooking = function(venueId, guestCount) {
  return this.find({
    venueId,
    status: 'active',
    isBookable: true,
    'capacity.min': { $lte: guestCount },
    'capacity.max': { $gte: guestCount }
  }).sort({ 'capacity.recommended': 1 });
};

// Pre-save middleware
tableSchema.pre('save', function(next) {
  // ตรวจสอบ capacity
  if (this.capacity.min > this.capacity.max) {
    return next(new Error('Minimum capacity cannot be greater than maximum capacity'));
  }
  
  if (this.capacity.recommended < this.capacity.min || this.capacity.recommended > this.capacity.max) {
    this.capacity.recommended = Math.ceil((this.capacity.min + this.capacity.max) / 2);
  }
  
  next();
});

module.exports = mongoose.model('Table', tableSchema);

