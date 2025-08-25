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

// ส่งข้อความพร้อมไฟล์
router.post('/messages', verifyToken, upload.single('file'), async (req, res) => {
  try {
    // ถ้ามีไฟล์ให้อัพโลดก่อน
    if (req.file) {
      const fileName = `chat-media/${Date.now()}-${req.file.originalname}`;
      const fileUrl = await uploadToOSS(req.file.buffer, fileName, req.file.mimetype);
      
      // เพิ่มข้อมูลไฟล์ใน request body
      req.body.mediaInfo = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
      };
      
      // กำหนดประเภทข้อความตามไฟล์
      if (req.file.mimetype.startsWith('image/')) {
        req.body.type = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        req.body.type = 'video';
      } else if (req.file.mimetype.startsWith('audio/')) {
        req.body.type = 'audio';
      } else {
        req.body.type = 'file';
      }
    }

    const { sendMessage } = require('../../controllers/chatControllers');
    await sendMessage(req, res);

  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการอัพโลดไฟล์", 
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

module.exports = router;