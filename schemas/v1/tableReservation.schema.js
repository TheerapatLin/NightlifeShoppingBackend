const mongoose = require('mongoose');

// TableReservation Schema สำหรับระบบจองโต๊ะ
const tableReservationSchema = new mongoose.Schema({
  // ข้อมูลการจอง
  reservationNumber: {
    type: String,
    unique: true,
    required: true
  },
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
    index: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // ข้อมูลลูกค้า
  customerInfo: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    specialRequests: { type: String },
    allergies: [{ type: String }],
    occasions: {
      type: String,
      enum: ['birthday', 'anniversary', 'business', 'date', 'family', 'celebration', 'other']
    }
  },

  // ข้อมูลการจอง
  reservationDetails: {
    date: { type: Date, required: true, index: true },
    timeSlot: {
      start: { type: String, required: true }, // เช่น "19:00"
      end: { type: String, required: true },   // เช่น "21:00"
      duration: { type: Number, required: true } // นาที
    },
    guestCount: {
      adults: { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 1 }
    },
    seatingPreference: {
      type: String,
      enum: ['indoor', 'outdoor', 'window', 'quiet', 'near-bar', 'private', 'no-preference'],
      default: 'no-preference'
    }
  },

  // สถานะการจอง
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'],
    default: 'pending',
    index: true
  },
  
  // การยืนยัน
  confirmation: {
    method: {
      type: String,
      enum: ['phone', 'email', 'sms', 'app', 'walk-in'],
      default: 'phone'
    },
    confirmedAt: { type: Date },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmationCode: { type: String },
    requiresConfirmation: { type: Boolean, default: true },
    confirmationDeadline: { type: Date }
  },

  // การชำระเงิน
  payment: {
    depositRequired: { type: Boolean, default: false },
    depositAmount: { type: Number, default: 0 },
    depositPaid: { type: Boolean, default: false },
    depositPaidAt: { type: Date },
    minimumSpend: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 }
  },

  // เวลาสำคัญ
  timing: {
    arrivedAt: { type: Date },
    seatedAt: { type: Date },
    completedAt: { type: Date },
    leftAt: { type: Date },
    
    // การแจ้งเตือน
    reminderSentAt: { type: Date },
    followUpSentAt: { type: Date },
    
    // เวลาหมดอายุ
    expiresAt: { type: Date },
    
    // ความล่าช้า
    lateMinutes: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false }
  },

  // การจัดการโต๊ะ
  tableManagement: {
    originalTableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table'
    },
    tableChanges: [{
      fromTableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table'
      },
      toTableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table'
      },
      reason: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    
    // การขยายเวลา
    timeExtensions: [{
      originalEnd: { type: String },
      newEnd: { type: String },
      additionalMinutes: { type: Number },
      reason: { type: String },
      approvedAt: { type: Date, default: Date.now },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },

  // แหล่งที่มาของการจอง
  source: {
    type: String,
    enum: ['website', 'app', 'phone', 'walk-in', 'third-party', 'staff'],
    default: 'website'
  },
  sourceDetails: {
    platform: { type: String }, // เช่น 'iOS', 'Android', 'Web'
    referrer: { type: String },
    campaign: { type: String },
    agent: { type: String } // staff member ที่รับจอง
  },

  // การยกเลิก
  cancellation: {
    cancelledAt: { type: Date },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['customer-request', 'venue-closure', 'overbooking', 'emergency', 'no-show', 'other']
    },
    refundAmount: { type: Number, default: 0 },
    refundProcessed: { type: Boolean, default: false },
    notes: { type: String }
  },

  // การให้คะแนนและรีวิว
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    reviewedAt: { type: Date },
    serviceRating: { type: Number, min: 1, max: 5 },
    foodRating: { type: Number, min: 1, max: 5 },
    ambianceRating: { type: Number, min: 1, max: 5 }
  },

  // ข้อมูลเพิ่มเติม
  notes: { type: String }, // หมายเหตุภายใน
  publicNotes: { type: String }, // หมายเหตุที่ลูกค้าเห็นได้
  tags: [{ type: String }], // แท็กสำหรับจัดหมวดหมู่
  
  // การติดตาม
  notifications: [{
    type: {
      type: String,
      enum: ['confirmation', 'reminder', 'follow-up', 'cancellation', 'modification']
    },
    method: {
      type: String,
      enum: ['email', 'sms', 'push', 'call']
    },
    sentAt: { type: Date },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed', 'opened', 'clicked']
    },
    content: { type: String }
  }],

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
  collection: 'tableReservations'
});

// Indexes สำหรับประสิทธิภาพ
tableReservationSchema.index({ venueId: 1, 'reservationDetails.date': 1 });
tableReservationSchema.index({ tableId: 1, 'reservationDetails.date': 1 });
tableReservationSchema.index({ userId: 1, 'reservationDetails.date': -1 });
tableReservationSchema.index({ status: 1, 'reservationDetails.date': 1 });
tableReservationSchema.index({ 'customerInfo.phone': 1 });
tableReservationSchema.index({ reservationNumber: 1 }, { unique: true });
tableReservationSchema.index({ 'timing.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Virtual properties
tableReservationSchema.virtual('isActive').get(function() {
  return ['pending', 'confirmed', 'seated'].includes(this.status);
});

tableReservationSchema.virtual('isConfirmed').get(function() {
  return this.status === 'confirmed' || this.status === 'seated' || this.status === 'completed';
});

tableReservationSchema.virtual('isToday').get(function() {
  const today = new Date();
  const reservationDate = new Date(this.reservationDetails.date);
  return today.toDateString() === reservationDate.toDateString();
});

tableReservationSchema.virtual('isPast').get(function() {
  return new Date() > this.reservationDetails.date;
});

tableReservationSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'pending' || !this.confirmation.confirmationDeadline) return false;
  return new Date() > this.confirmation.confirmationDeadline;
});

tableReservationSchema.virtual('timeUntilReservation').get(function() {
  const now = new Date();
  const reservationTime = new Date(this.reservationDetails.date);
  return Math.max(0, reservationTime - now);
});

// Instance methods
tableReservationSchema.methods.confirm = function(confirmedBy) {
  this.status = 'confirmed';
  this.confirmation.confirmedAt = new Date();
  this.confirmation.confirmedBy = confirmedBy;
  return this.save();
};

tableReservationSchema.methods.seat = function(seatedBy) {
  this.status = 'seated';
  this.timing.seatedAt = new Date();
  this.updatedBy = seatedBy;
  return this.save();
};

tableReservationSchema.methods.complete = function(completedBy) {
  this.status = 'completed';
  this.timing.completedAt = new Date();
  this.updatedBy = completedBy;
  return this.save();
};

tableReservationSchema.methods.cancel = function(reason, cancelledBy, refundAmount = 0) {
  this.status = 'cancelled';
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy,
    reason,
    refundAmount,
    refundProcessed: refundAmount === 0
  };
  return this.save();
};

tableReservationSchema.methods.moveTable = function(newTableId, reason, movedBy) {
  this.tableManagement.tableChanges.push({
    fromTableId: this.tableId,
    toTableId: newTableId,
    reason,
    changedBy: movedBy
  });
  
  if (!this.tableManagement.originalTableId) {
    this.tableManagement.originalTableId = this.tableId;
  }
  
  this.tableId = newTableId;
  this.updatedBy = movedBy;
  return this.save();
};

tableReservationSchema.methods.extend = function(additionalMinutes, reason, approvedBy) {
  const currentEnd = this.reservationDetails.timeSlot.end;
  const [hours, minutes] = currentEnd.split(':').map(Number);
  const endTime = new Date();
  endTime.setHours(hours, minutes + this.reservationDetails.timeSlot.duration + additionalMinutes);
  
  const newEnd = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
  
  this.tableManagement.timeExtensions.push({
    originalEnd: currentEnd,
    newEnd,
    additionalMinutes,
    reason,
    approvedBy
  });
  
  this.reservationDetails.timeSlot.end = newEnd;
  this.reservationDetails.timeSlot.duration += additionalMinutes;
  this.updatedBy = approvedBy;
  
  return this.save();
};

// Static methods
tableReservationSchema.statics.findByVenue = function(venueId, date) {
  const query = { venueId };
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    query['reservationDetails.date'] = {
      $gte: startOfDay,
      $lte: endOfDay
    };
  }
  
  return this.find(query)
    .populate('tableId', 'tableNumber name capacity location')
    .populate('userId', 'user.name user.email')
    .sort({ 'reservationDetails.date': 1, 'reservationDetails.timeSlot.start': 1 });
};

tableReservationSchema.statics.findByTable = function(tableId, date) {
  const query = { tableId };
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    query['reservationDetails.date'] = {
      $gte: startOfDay,
      $lte: endOfDay
    };
  }
  
  return this.find(query).sort({ 'reservationDetails.timeSlot.start': 1 });
};

tableReservationSchema.statics.findByUser = function(userId) {
  return this.find({ userId })
    .populate('venueId', 'name nameTH nameEN location')
    .populate('tableId', 'tableNumber capacity')
    .sort({ 'reservationDetails.date': -1 });
};

tableReservationSchema.statics.findConflicts = function(tableId, date, startTime, endTime) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    tableId,
    status: { $in: ['pending', 'confirmed', 'seated'] },
    'reservationDetails.date': {
      $gte: startOfDay,
      $lte: endOfDay
    },
    $or: [
      {
        'reservationDetails.timeSlot.start': { $lt: endTime },
        'reservationDetails.timeSlot.end': { $gt: startTime }
      }
    ]
  });
};

// Pre-save middleware
tableReservationSchema.pre('save', function(next) {
  // สร้าง reservation number ถ้ายังไม่มี
  if (!this.reservationNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.reservationNumber = `RES${dateStr}${randomStr}`;
  }
  
  // คำนวณ total guests
  if (this.reservationDetails.guestCount) {
    this.reservationDetails.guestCount.total = 
      this.reservationDetails.guestCount.adults + 
      this.reservationDetails.guestCount.children;
  }
  
  // ตั้งค่า expiration time สำหรับ pending reservations
  if (this.status === 'pending' && !this.timing.expiresAt) {
    this.timing.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ชั่วโมง
  }
  
  // ตั้งค่า confirmation deadline
  if (this.confirmation.requiresConfirmation && !this.confirmation.confirmationDeadline) {
    const reservationTime = new Date(this.reservationDetails.date);
    this.confirmation.confirmationDeadline = new Date(reservationTime.getTime() - 2 * 60 * 60 * 1000); // 2 ชั่วโมงก่อน
  }
  
  // อัปเดตสถานะตาม confirmation
  if (this.confirmation.confirmedAt && this.status === 'pending') {
    this.status = 'confirmed';
  }
  
  // คำนวณความล่าช้า
  if (this.timing.arrivedAt && this.status === 'seated') {
    const reservationTime = new Date(this.reservationDetails.date);
    const [hours, minutes] = this.reservationDetails.timeSlot.start.split(':').map(Number);
    reservationTime.setHours(hours, minutes);
    
    const lateMinutes = Math.max(0, Math.floor((this.timing.arrivedAt - reservationTime) / (1000 * 60)));
    this.timing.lateMinutes = lateMinutes;
    this.timing.isLate = lateMinutes > 15; // ถือว่าสายถ้ามากกว่า 15 นาที
  }
  
  next();
});

module.exports = mongoose.model('TableReservation', tableReservationSchema);

