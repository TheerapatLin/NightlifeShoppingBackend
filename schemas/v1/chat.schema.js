const mongoose = require("mongoose");
const { Schema } = mongoose;

// Chat Room Schema
const chatRoomSchema = new Schema({
  businessId: { type: String },
  name: { type: String, required: true }, // ชื่อห้องหรือชื่อระหว่างผู้ใช้
  type: { type: String, enum: ["private", "group"], required: true }, // ประเภทของห้องแชท ('private' สำหรับคนต่อคน, 'group' สำหรับกลุ่ม)
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    lastReadMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    lastReadTimestamp: { type: Date, default: Date.now },
    role: { type: String, enum: ["admin", "member"], default: "member" }, // บทบาทในกลุ่ม
    isActive: { type: Boolean, default: true } // สถานะการเข้าร่วม
  }],
  status: { type: String, enum: ["active", "inactive", "archived"], default: "active" }, // สถานะห้องแชท
  createdAt: { type: Date, default: Date.now }, // วันที่สร้างห้องแชท
  updatedAt: { type: Date, default: Date.now }, // วันที่แก้ไขล่าสุด
  lastMessage: { type: Schema.Types.ObjectId, ref: "Message" }, // ข้อความล่าสุดในห้องแชท
  lastMessageTime: { type: Date, default: Date.now },
  activityId: {
    type: Schema.Types.ObjectId,
    ref: "Activity",
    required: function () {
      return this.type === "group";
    },
  }, // อ้างอิงถึง activity สำหรับห้องกลุ่มเท่านั้น
  messageCount: { type: Number, default: 0 }, // จำนวนข้อความทั้งหมดในห้องแชท
  avatar: { type: String }, // รูปประจำห้อง (สำหรับกลุ่ม)
  description: { type: String }, // คำอธิบายห้อง (สำหรับกลุ่ม)
  settings: {
    allowMediaUpload: { type: Boolean, default: true },
    allowStickers: { type: Boolean, default: true },
    allowReactions: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 100, max: 100 } // จำกัดไม่เกิน 100 คน
  },
  
  // Unread Message Counters (เพื่อ performance)
  unreadCounts: [{
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    count: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }]
});

chatRoomSchema.index({ name: 1 });
chatRoomSchema.index({ type: 1 });
chatRoomSchema.index({ "participants.userId": 1 });
chatRoomSchema.index({ "unreadCounts.userId": 1 });

// ChatRoom Instance Methods
chatRoomSchema.methods.incrementUnreadCount = function(userId) {
  const unreadEntry = this.unreadCounts.find(uc => uc.userId.toString() === userId.toString());
  if (unreadEntry) {
    unreadEntry.count += 1;
    unreadEntry.lastUpdated = new Date();
  } else {
    this.unreadCounts.push({
      userId,
      count: 1,
      lastUpdated: new Date()
    });
  }
};

chatRoomSchema.methods.resetUnreadCount = function(userId) {
  const unreadEntry = this.unreadCounts.find(uc => uc.userId.toString() === userId.toString());
  if (unreadEntry) {
    unreadEntry.count = 0;
    unreadEntry.lastUpdated = new Date();
  }
};

chatRoomSchema.methods.getUnreadCount = function(userId) {
  const unreadEntry = this.unreadCounts.find(uc => uc.userId.toString() === userId.toString());
  return unreadEntry ? unreadEntry.count : 0;
};

chatRoomSchema.methods.canAddParticipant = function() {
  const activeParticipants = this.participants.filter(p => p.isActive).length;
  return activeParticipants < this.settings.maxParticipants;
};

chatRoomSchema.methods.getActiveParticipantsCount = function() {
  return this.participants.filter(p => p.isActive).length;
};

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

// Message Schema
const messageSchema = new Schema({
  businessId: { type: String },
  chatRoom: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true },
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["text", "image", "video", "file", "audio", "location", "contact", "sticker", "system", "join", "leave"],
    required: true,
  },
  content: { type: Schema.Types.Mixed, required: true },
  // สำหรับข้อความประเภทต่างๆ
  mediaInfo: {
    originalName: String, // ชื่อไฟล์ต้นฉบับ
    mimeType: String, // ประเภทไฟล์
    size: Number, // ขนาดไฟล์ (bytes)
    duration: Number, // ความยาว (สำหรับวิดีโอ/เสียง)
    dimensions: {
      width: Number,
      height: Number
    }, // ขนาดภาพ/วิดีโอ
    thumbnail: String, // รูปย่อ
    url: String, // URL ของไฟล์
    uploadedAt: { type: Date, default: Date.now }
  },
  // สำหรับ sticker
  stickerInfo: {
    setId: { type: Schema.Types.ObjectId, ref: "StickerSet" },
    stickerId: String,
    type: { type: String, enum: ["static", "animated", "interactive"], default: "static" },
    metadata: Schema.Types.Mixed // ข้อมูลเพิ่มเติมสำหรับ interactive sticker
  },
  // สถานะข้อความ
  status: { type: String, enum: ["sending", "sent", "delivered", "read", "failed"], default: "sent" },
  deliveredTo: [{ 
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    deliveredAt: { type: Date, default: Date.now }
  }],
  readBy: [{ 
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    readAt: { type: Date, default: Date.now }
  }],
  
  timestamp: { type: Date, default: Date.now },
  order: { type: Number, required: true },
  
  // Reactions
  reactions: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      emoji: { type: String, required: true }, // emoji unicode
      reactionType: { type: String, required: true }, // เช่น 'like', 'love', 'haha', 'wow', 'sad', 'angry'
      createdAt: { type: Date, default: Date.now }
    },
  ],
  
  // การลบข้อความ (Soft Delete)
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  deletedFor: { type: String, enum: ["sender", "everyone"], default: "sender" }, // ลบให้ตัวเองเห็น หรือทุกคน
  
  // การแก้ไขข้อความ
  isEdited: { type: Boolean, default: false },
  editHistory: [{
    content: Schema.Types.Mixed,
    editedAt: { type: Date, default: Date.now }
  }],
  
  // การตอบกลับข้อความ
  replyTo: { type: Schema.Types.ObjectId, ref: "Message" },
  
  // การส่งต่อข้อความ
  forwardedFrom: {
    originalMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    originalSender: { type: Schema.Types.ObjectId, ref: "User" },
    forwardedAt: { type: Date, default: Date.now }
  },
  
  extraStatus: {
    statusType: { type: String }, // เช่น 'premium', 'special', 'pinned'
    statusValue: { type: Schema.Types.Mixed }, // สามารถเป็น object หรือ string
  },
});

messageSchema.index({ chatRoom: 1, timestamp: 1 });
messageSchema.index({ chatRoom: 1, order: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ "readBy.userId": 1 });
messageSchema.index({ "deliveredTo.userId": 1 });

const Message = mongoose.model("Message", messageSchema);

// Sticker Set Schema
const stickerSetSchema = new Schema({
  businessId: { type: String, required: true, enum: ['1', '2'] },
  setNumber: { type: Number, required: true },
  nameTH: { type: String, required: true },
  nameEN: { type: String, required: true },
  descriptionTH: { type: String },
  descriptionEN: { type: String },
  price: { type: Number, required: true },
  starPoint: { type: Number, required: true },
  tags: [{ type: String }],
  amount: { type: Number, required: true }, // จำนวน sticker ในชุด
  status: { type: String, enum: ['normal', 'premium', 'limited', 'disabled'], default: 'normal' },
  type: { type: String, enum: ['static', 'animated', 'interactive'], default: 'static' },
  thumbnail: { type: String }, // รูปตัวอย่างชุด sticker
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  downloadCount: { type: Number, default: 0 },
  category: { type: String }, // หมวดหมู่ sticker
  author: { type: String }, // ผู้สร้าง sticker set
  isPublic: { type: Boolean, default: true }
});

// Individual Sticker Schema
const stickerSchema = new Schema({
  setId: { type: Schema.Types.ObjectId, ref: "StickerSet", required: true },
  stickerId: { type: String, required: true }, // ID เฉพาะของ sticker ในชุด
  name: { type: String },
  keywords: [{ type: String }], // คำค้นหา
  url: { type: String, required: true }, // URL ของไฟล์ sticker
  thumbnailUrl: { type: String }, // URL ของรูปย่อ
  type: { type: String, enum: ['static', 'animated', 'interactive'], default: 'static' },
  fileSize: { type: Number },
  dimensions: {
    width: { type: Number },
    height: { type: Number }
  },
  metadata: {
    duration: Number, // สำหรับ animated sticker
    fps: Number, // frame per second
    interactiveData: Schema.Types.Mixed // ข้อมูลสำหรับ interactive sticker
  },
  order: { type: Number, default: 0 }, // ลำดับใน set
  isActive: { type: Boolean, default: true }
});

// User Sticker Collection Schema (sticker ที่ user ดาวน์โหลดแล้ว)
const userStickerCollectionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  stickerSetId: { type: Schema.Types.ObjectId, ref: "StickerSet", required: true },
  purchasedAt: { type: Date, default: Date.now },
  purchasePrice: { type: Number, default: 0 },
  purchaseMethod: { type: String, enum: ['free', 'coins', 'money'], default: 'free' },
  isActive: { type: Boolean, default: true }
});

stickerSetSchema.index({ businessId: 1, setNumber: 1 });
stickerSetSchema.index({ nameTH: 'text', nameEN: 'text', tags: 'text' });

const StickerSet = mongoose.model("StickerSet", stickerSetSchema);

// const ChatLastSeenSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
//   lastSeenTimestamp: { type: Date, default: Date.now },
// });

// ChatLastSeenSchema.index({ userId: 1, chatRoomId: 1 });

// const ChatLastSeen = mongoose.model('ChatLastSeen', ChatLastSeenSchema);

// เพิ่ม indexes
stickerSchema.index({ setId: 1, stickerId: 1 });
stickerSchema.index({ keywords: 'text', name: 'text' });
userStickerCollectionSchema.index({ userId: 1 });
userStickerCollectionSchema.index({ userId: 1, stickerSetId: 1 });

// สร้าง models
const Sticker = mongoose.model("Sticker", stickerSchema);
const UserStickerCollection = mongoose.model("UserStickerCollection", userStickerCollectionSchema);

// Exporting the models
module.exports = {
  ChatRoom,
  Message,
  StickerSet,
  Sticker,
  UserStickerCollection,
};
