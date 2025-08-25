const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth');
const multer = require('multer');
const { uploadToOSS } = require('../../modules/storage/oss');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio files
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'application/pdf', 'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// ================= CHAT ROOM ROUTES =================

// สร้างห้องแชทใหม่
router.post('/rooms', verifyToken, async (req, res) => {
  const { createChatRoom } = require('../../controllers/chatControllers');
  await createChatRoom(req, res);
});

// ดึงรายการห้องแชทของ user
router.get('/rooms', verifyToken, async (req, res) => {
  const { getUserChatRooms } = require('../../controllers/chatControllers');
  await getUserChatRooms(req, res);
});

// ดูรายละเอียดห้องแชท
router.get('/rooms/:chatRoomId', verifyToken, async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user._id;
    const { ChatRoom } = require('../../schemas/v1/chat.schema');

    const chatRoom = await ChatRoom.findById(chatRoomId)
      .populate('participants.userId', 'name avatar email')
      .populate('lastMessage')
      .populate('activityId', 'name images');

    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบห้องแชท" 
      });
    }

    // ตรวจสอบสิทธิ์
    const isParticipant = chatRoom.participants.some(
      p => p.userId._id.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: "คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้" 
      });
    }

    res.status(200).json({
      success: true,
      chatRoom
    });

  } catch (error) {
    console.error("Error fetching chat room details:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลห้องแชท", 
      error: error.message 
    });
  }
});

// เข้าร่วมห้องแชท
router.post('/rooms/:chatRoomId/join', verifyToken, async (req, res) => {
  const { joinChatRoom } = require('../../controllers/chatControllers');
  await joinChatRoom(req, res);
});

// ออกจากห้องแชท
router.post('/rooms/:chatRoomId/leave', verifyToken, async (req, res) => {
  const { leaveChatRoom } = require('../../controllers/chatControllers');
  await leaveChatRoom(req, res);
});

// ================= MESSAGE ROUTES =================

// ดึงข้อความในห้องแชท
router.get('/rooms/:chatRoomId/messages', verifyToken, async (req, res) => {
  const { getChatMessages } = require('../../controllers/chatControllers');
  await getChatMessages(req, res);
});

// ส่งข้อความธรรมดา
router.post('/rooms/:chatRoomId/messages', verifyToken, async (req, res) => {
  const { sendMessage } = require('../../controllers/chatControllers');
  await sendMessage(req, res);
});

// ส่งข้อความพร้อมไฟล์ (รองรับหลายไฟล์)
router.post('/messages', verifyToken, upload.array('files', 10), async (req, res) => {
  try {
    const { chatRoomId } = req.body;
    
    if (!chatRoomId) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ chatRoomId"
      });
    }

    // ตรวจสอบสิทธิ์ในห้องแชท
    const { ChatRoom } = require('../../schemas/v1/chat.schema');
    const chatRoom = await ChatRoom.findById(chatRoomId);
    
    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบห้องแชท"
      });
    }

    const isParticipant = chatRoom.participants.some(
      p => p.userId.toString() === req.user._id.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "คุณไม่มีสิทธิ์ส่งข้อความในห้องนี้"
      });
    }

    // อัพโลดไฟล์ (ถ้ามี)
    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      console.log(`📤 Uploading ${req.files.length} files...`);
      
      const uploadPromises = req.files.map(async (file, index) => {
        // สร้างชื่อไฟล์ unique
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const extension = file.originalname.split('.').pop();
        const fileName = `chat-media/${chatRoomId}/${timestamp}-${randomId}-${index}.${extension}`;
        
        try {
          const fileUrl = await uploadToOSS(file.buffer, fileName, file.mimetype);
          
          // ดึงข้อมูลเพิ่มเติมสำหรับ image/video
          let dimensions = null;
          let duration = null;
          let thumbnail = null;
          
          if (file.mimetype.startsWith('image/')) {
            // TODO: ใช้ sharp หรือ library อื่นเพื่อดึงขนาดภาพ
            // const sharp = require('sharp');
            // const metadata = await sharp(file.buffer).metadata();
            // dimensions = { width: metadata.width, height: metadata.height };
          } else if (file.mimetype.startsWith('video/')) {
            // TODO: ใช้ ffprobe เพื่อดึงข้อมูล video
            // สร้าง thumbnail สำหรับ video
          }

          return {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: fileUrl,
            fileName: fileName,
            dimensions,
            duration,
            thumbnail,
            uploadedAt: new Date()
          };
        } catch (uploadError) {
          console.error(`❌ Failed to upload file ${file.originalname}:`, uploadError);
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`);
        }
      });

      try {
        uploadedFiles = await Promise.all(uploadPromises);
        console.log(`✅ Successfully uploaded ${uploadedFiles.length} files`);
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: "เกิดข้อผิดพลาดในการอัพโลดไฟล์",
          error: uploadError.message
        });
      }
    }

    // เตรียม request body สำหรับส่งข้อความ
    if (uploadedFiles.length > 0) {
      // ถ้ามีไฟล์เดียว
      if (uploadedFiles.length === 1) {
        const file = uploadedFiles[0];
        req.body.mediaInfo = file;
        
        // กำหนดประเภทข้อความตามไฟล์
        if (file.mimeType.startsWith('image/')) {
          req.body.type = 'image';
        } else if (file.mimeType.startsWith('video/')) {
          req.body.type = 'video';
        } else if (file.mimeType.startsWith('audio/')) {
          req.body.type = 'audio';
        } else {
          req.body.type = 'file';
        }
        
        // ใช้ชื่อไฟล์เป็น content ถ้าไม่มี text
        if (!req.body.content || req.body.content.trim() === '') {
          req.body.content = file.originalName;
        }
      } else {
        // ถ้ามีหลายไฟล์ ส่งเป็น array
        req.body.type = 'file';
        req.body.mediaInfo = uploadedFiles;
        
        if (!req.body.content || req.body.content.trim() === '') {
          req.body.content = `${uploadedFiles.length} files`;
        }
      }
    }

    // ส่งข้อความผ่าน controller
    const { sendMessage } = require('../../controllers/chatControllers');
    await sendMessage(req, res);

  } catch (error) {
    console.error("❌ Error in media upload:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการส่งข้อความ", 
      error: error.message 
    });
  }
});

// แก้ไขข้อความ
router.put('/messages/:messageId', verifyToken, async (req, res) => {
  const { editMessage } = require('../../controllers/chatControllers');
  await editMessage(req, res);
});

// ลบข้อความ
router.delete('/messages/:messageId', verifyToken, async (req, res) => {
  const { deleteMessage } = require('../../controllers/chatControllers');
  await deleteMessage(req, res);
});

// เพิ่ม reaction ให้ข้อความ
router.post('/messages/:messageId/reactions', verifyToken, async (req, res) => {
  const { addReaction } = require('../../controllers/chatControllers');
  await addReaction(req, res);
});

// ลบ reaction
router.delete('/messages/:messageId/reactions', verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const { Message } = require('../../schemas/v1/chat.schema');

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบข้อความ" 
      });
    }

    // ลบ reaction ของ user
    message.reactions = message.reactions.filter(
      r => r.userId.toString() !== userId.toString()
    );

    await message.save();

    res.status(200).json({
      success: true,
      message: "ลบ reaction สำเร็จ",
      reactions: message.reactions
    });

  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการลบ reaction", 
      error: error.message 
    });
  }
});

// อัพเดทสถานะการอ่าน
router.post('/rooms/:chatRoomId/read', verifyToken, async (req, res) => {
  const { markAsRead } = require('../../controllers/chatControllers');
  await markAsRead(req, res);
});

// ดึงจำนวน unread messages ทั้งหมด
router.get('/unread/total', verifyToken, async (req, res) => {
  const { getTotalUnreadCount } = require('../../controllers/chatControllers');
  await getTotalUnreadCount(req, res);
});

// ดึงสถิติการอ่านข้อความ
router.get('/messages/:messageId/read-stats', verifyToken, async (req, res) => {
  const { getMessageReadStats } = require('../../controllers/chatControllers');
  await getMessageReadStats(req, res);
});

// อัพเดทสถานะ delivery
router.post('/messages/:messageId/delivered', verifyToken, async (req, res) => {
  const { markAsDelivered } = require('../../controllers/chatControllers');
  await markAsDelivered(req, res);
});

// ================= STICKER ROUTES =================

// ดึงรายการ sticker sets
router.get('/stickers/sets', verifyToken, async (req, res) => {
  const { getStickerSets } = require('../../controllers/chatControllers');
  await getStickerSets(req, res);
});

// ดึงรายการ stickers ใน set
router.get('/stickers/sets/:setId/stickers', verifyToken, async (req, res) => {
  const { getStickersInSet } = require('../../controllers/chatControllers');
  await getStickersInSet(req, res);
});

// ดาวน์โหลด sticker set
router.post('/stickers/sets/:setId/download', verifyToken, async (req, res) => {
  const { downloadStickerSet } = require('../../controllers/chatControllers');
  await downloadStickerSet(req, res);
});

// ดึงรายการ sticker collections ของ user
router.get('/stickers/my-collections', verifyToken, async (req, res) => {
  const { getUserStickerSets } = require('../../controllers/chatControllers');
  await getUserStickerSets(req, res);
});

// ================= MEDIA MANAGEMENT ROUTES =================

// ดึงข้อมูล media ในห้องแชท
router.get('/rooms/:chatRoomId/media', verifyToken, async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { type, page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    // ตรวจสอบสิทธิ์
    const { ChatRoom, Message } = require('../../schemas/v1/chat.schema');
    const chatRoom = await ChatRoom.findById(chatRoomId);
    
    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบห้องแชท"
      });
    }

    const isParticipant = chatRoom.participants.some(
      p => p.userId.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้"
      });
    }

    // สร้าง query filter
    const filter = {
      chatRoom: chatRoomId,
      isDeleted: false,
      mediaInfo: { $exists: true, $ne: null }
    };

    if (type && ['image', 'video', 'audio', 'file'].includes(type)) {
      filter.type = type;
    }

    // ดึงข้อมูล media
    const mediaMessages = await Message.find(filter)
      .select('type content mediaInfo timestamp sender')
      .populate('sender', 'name avatar')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalCount = await Message.countDocuments(filter);

    res.status(200).json({
      success: true,
      media: mediaMessages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: page < Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching media:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล media",
      error: error.message
    });
  }
});

// ลบไฟล์ media
router.delete('/media/:messageId', verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const { Message } = require('../../schemas/v1/chat.schema');
    const { deleteFromOSS } = require('../../modules/storage/oss');

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อความ"
      });
    }

    // ตรวจสอบสิทธิ์ (เฉพาะผู้ส่งหรือ admin)
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "คุณไม่มีสิทธิ์ลบไฟล์นี้"
      });
    }

    // ลบไฟล์จาก OSS
    if (message.mediaInfo && message.mediaInfo.fileName) {
      try {
        await deleteFromOSS(message.mediaInfo.fileName);
        console.log(`🗑️ Deleted media file: ${message.mediaInfo.fileName}`);
      } catch (ossError) {
        console.error('❌ Failed to delete from OSS:', ossError);
        // ไม่ throw error เพราะอาจจะไฟล์ถูกลบไปแล้ว
      }
    }

    // ลบข้อมูล media ออกจากข้อความ
    message.mediaInfo = null;
    message.content = '[ไฟล์ถูกลบแล้ว]';
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    res.status(200).json({
      success: true,
      message: "ลบไฟล์สำเร็จ"
    });

  } catch (error) {
    console.error("Error deleting media:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการลบไฟล์",
      error: error.message
    });
  }
});

// ดึงสถิติการใช้งาน storage
router.get('/rooms/:chatRoomId/storage-stats', verifyToken, async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user._id;

    // ตรวจสอบสิทธิ์
    const { ChatRoom, Message } = require('../../schemas/v1/chat.schema');
    const chatRoom = await ChatRoom.findById(chatRoomId);
    
    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบห้องแชท"
      });
    }

    const isParticipant = chatRoom.participants.some(
      p => p.userId.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้"
      });
    }

    // คำนวณสถิติ storage
    const stats = await Message.aggregate([
      {
        $match: {
          chatRoom: new mongoose.Types.ObjectId(chatRoomId),
          isDeleted: false,
          mediaInfo: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalSize: { $sum: '$mediaInfo.size' }
        }
      }
    ]);

    const totalStats = await Message.aggregate([
      {
        $match: {
          chatRoom: new mongoose.Types.ObjectId(chatRoomId),
          isDeleted: false,
          mediaInfo: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$mediaInfo.size' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        byType: stats,
        total: totalStats[0] || { totalFiles: 0, totalSize: 0 }
      }
    });

  } catch (error) {
    console.error("Error getting storage stats:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงสถิติ storage",
      error: error.message
    });
  }
});

module.exports = router;