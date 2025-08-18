const mongoose = require('mongoose');

// TableLayout Schema สำหรับผังโต๊ะของ venue
const tableLayoutSchema = new mongoose.Schema({
  // ข้อมูลพื้นฐาน
  name: {
    en: { type: String, required: true, trim: true },
    th: { type: String, required: true, trim: true }
  },
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
    index: true
  },
  floor: {
    type: Number,
    required: true,
    default: 1
  },

  // ประเภทและสถานะของ layout
  layoutType: {
    type: String,
    enum: ['floor-plan', 'seating-chart', 'zone-map', 'custom'],
    default: 'floor-plan'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'template'],
    default: 'draft'
  },
  isDefault: {
    type: Boolean,
    default: false
  },

  // ขนาดและมาตราส่วน
  dimensions: {
    width: { type: Number, required: true }, // ความกว้างในหน่วย pixel หรือ meter
    height: { type: Number, required: true }, // ความสูงในหน่วย pixel หรือ meter
    unit: { type: String, enum: ['pixel', 'meter', 'feet'], default: 'pixel' },
    scale: { type: Number, default: 1 } // มาตราส่วน 1:scale
  },

  // การตั้งค่าการแสดงผล
  viewSettings: {
    backgroundColor: { type: String, default: '#ffffff' },
    gridEnabled: { type: Boolean, default: true },
    gridSize: { type: Number, default: 20 },
    snapToGrid: { type: Boolean, default: true },
    showTableNumbers: { type: Boolean, default: true },
    showCapacity: { type: Boolean, default: true },
    zoom: { type: Number, default: 1, min: 0.1, max: 5 }
  },

  // องค์ประกอบในผัง
  elements: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['table', 'bar', 'stage', 'entrance', 'exit', 'restroom', 'kitchen', 'wall', 'window', 'decoration', 'text'],
      required: true
    },
    
    // ตำแหน่งและขนาด
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      z: { type: Number, default: 0 } // สำหรับ 3D
    },
    size: {
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    rotation: { type: Number, default: 0 }, // องศา

    // การแสดงผล
    style: {
      backgroundColor: { type: String },
      borderColor: { type: String },
      borderWidth: { type: Number, default: 1 },
      borderStyle: { type: String, enum: ['solid', 'dashed', 'dotted'], default: 'solid' },
      opacity: { type: Number, default: 1, min: 0, max: 1 },
      cornerRadius: { type: Number, default: 0 }
    },

    // ข้อมูลเฉพาะสำหรับโต๊ะ
    tableData: {
      tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
      tableNumber: { type: String },
      capacity: { type: Number },
      shape: { type: String, enum: ['round', 'square', 'rectangle', 'oval'] }
    },

    // ข้อมูลเฉพาะสำหรับข้อความ
    textData: {
      content: { type: String },
      fontSize: { type: Number, default: 14 },
      fontFamily: { type: String, default: 'Arial' },
      fontWeight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
      color: { type: String, default: '#000000' }
    },

    // การโต้ตอบ
    interactive: {
      clickable: { type: Boolean, default: false },
      draggable: { type: Boolean, default: false },
      resizable: { type: Boolean, default: false },
      selectable: { type: Boolean, default: true }
    },

    // ข้อมูลเพิ่มเติม
    metadata: {
      name: { type: String },
      description: { type: String },
      tags: [{ type: String }],
      customData: { type: mongoose.Schema.Types.Mixed }
    }
  }],

  // ข้อมูลสำหรับการจัดการ
  version: {
    type: Number,
    default: 1
  },
  publishedAt: { type: Date },
  archivedAt: { type: Date },
  
  // ข้อมูลการสร้างและแก้ไข
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ข้อมูลเพิ่มเติม
  description: {
    en: { type: String },
    th: { type: String }
  },
  notes: { type: String }
}, {
  timestamps: true,
  collection: 'tableLayouts'
});

// Indexes
tableLayoutSchema.index({ venueId: 1, floor: 1 });
tableLayoutSchema.index({ venueId: 1, status: 1 });
tableLayoutSchema.index({ venueId: 1, isDefault: 1 });
tableLayoutSchema.index({ 'elements.tableData.tableId': 1 });

// Virtual properties
tableLayoutSchema.virtual('totalTables').get(function() {
  return this.elements.filter(el => el.type === 'table').length;
});

tableLayoutSchema.virtual('totalCapacity').get(function() {
  return this.elements
    .filter(el => el.type === 'table' && el.tableData.capacity)
    .reduce((sum, el) => sum + el.tableData.capacity, 0);
});

tableLayoutSchema.virtual('dimensionsString').get(function() {
  return `${this.dimensions.width}x${this.dimensions.height} ${this.dimensions.unit}`;
});

// Instance methods
tableLayoutSchema.methods.addElement = function(elementData) {
  // สร้าง unique ID สำหรับ element
  elementData.id = elementData.id || new mongoose.Types.ObjectId().toString();
  this.elements.push(elementData);
  return this.save();
};

tableLayoutSchema.methods.removeElement = function(elementId) {
  this.elements = this.elements.filter(el => el.id !== elementId);
  return this.save();
};

tableLayoutSchema.methods.updateElement = function(elementId, updateData) {
  const element = this.elements.find(el => el.id === elementId);
  if (element) {
    Object.assign(element, updateData);
    return this.save();
  }
  throw new Error('Element not found');
};

tableLayoutSchema.methods.duplicate = function(newName) {
  const duplicatedLayout = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    name: newName,
    status: 'draft',
    isDefault: false,
    version: 1,
    publishedAt: undefined,
    archivedAt: undefined,
    createdAt: undefined,
    updatedAt: undefined
  });
  
  // สร้าง ID ใหม่สำหรับ elements
  duplicatedLayout.elements.forEach(element => {
    element.id = new mongoose.Types.ObjectId().toString();
  });
  
  return duplicatedLayout.save();
};

tableLayoutSchema.methods.activate = function() {
  // ทำให้ layout อื่นๆ ในชั้นเดียวกันไม่เป็น default
  return this.constructor.updateMany(
    { venueId: this.venueId, floor: this.floor, _id: { $ne: this._id } },
    { isDefault: false }
  ).then(() => {
    this.status = 'active';
    this.isDefault = true;
    this.publishedAt = new Date();
    return this.save();
  });
};

tableLayoutSchema.methods.archive = function() {
  this.status = 'archived';
  this.isDefault = false;
  this.archivedAt = new Date();
  return this.save();
};

// Static methods
tableLayoutSchema.statics.findByVenue = function(venueId, options = {}) {
  const query = { venueId };
  
  if (options.floor !== undefined) query.floor = options.floor;
  if (options.status) query.status = options.status;
  if (options.isDefault !== undefined) query.isDefault = options.isDefault;
  
  return this.find(query).sort({ floor: 1, isDefault: -1, updatedAt: -1 });
};

tableLayoutSchema.statics.findDefaultByVenue = function(venueId, floor = 1) {
  return this.findOne({ venueId, floor, isDefault: true, status: 'active' });
};

tableLayoutSchema.statics.findActiveByVenue = function(venueId) {
  return this.find({ venueId, status: 'active' }).sort({ floor: 1, isDefault: -1 });
};

// Pre-save middleware
tableLayoutSchema.pre('save', function(next) {
  // อัปเดต version เมื่อมีการแก้ไข elements
  if (this.isModified('elements') && !this.isNew) {
    this.version += 1;
  }
  
  // ตั้งค่า publishedAt เมื่อ status เป็น active
  if (this.isModified('status') && this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Pre-save middleware สำหรับตรวจสอบ default layout
tableLayoutSchema.pre('save', async function(next) {
  if (this.isDefault && this.status === 'active') {
    // ทำให้ layout อื่นๆ ในชั้นเดียวกันไม่เป็น default
    await this.constructor.updateMany(
      { 
        venueId: this.venueId, 
        floor: this.floor, 
        _id: { $ne: this._id } 
      },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('TableLayout', tableLayoutSchema);

