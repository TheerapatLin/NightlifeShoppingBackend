const { ChatRoom, Message, StickerSet, Sticker, UserStickerCollection } = require("../schemas/v1/chat.schema");
const { User } = require("../schemas/v1/user.schema");
const mongoose = require("mongoose");

// ================= CHAT ROOM CONTROLLERS =================

// สร้างห้องแชทใหม่
exports.createChatRoom = async (req, res) => {
  try {
    const { name, type, participants, activityId, description, avatar } = req.body;
    const userId = req.user._id;

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!name || !type || !participants || participants.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "กรุณาระบุชื่อห้อง, ประเภท และสมาชิก" 
      });
    }

    // สำหรับห้องส่วนตัว ต้องมีสมาชิกแค่ 2 คน
    if (type === "private" && participants.length !== 2) {
      return res.status(400).json({ 
        success: false, 
        message: "ห้องส่วนตัวต้องมีสมาชิก 2 คนเท่านั้น" 
      });
    }

    // ตรวจสอบ privacy และ block สำหรับห้องส่วนตัว
    if (type === "private") {
      const otherUserId = participants.find(id => id !== userId.toString());
      
      // ดึงข้อมูลผู้ใช้ทั้งสองคน
      const [currentUser, otherUser] = await Promise.all([
        User.findById(userId),
        User.findById(otherUserId)
      ]);

      if (!currentUser || !otherUser) {
        return res.status(404).json({ 
          success: false, 
          message: "ไม่พบผู้ใช้ที่ระบุ" 
        });
      }

      // ตรวจสอบการบล็อก
      if (currentUser.isBlocked(otherUserId) || currentUser.isBlockedBy(otherUserId)) {
        return res.status(403).json({ 
          success: false, 
          message: "ไม่สามารถสร้างห้องแชทได้เนื่องจากมีการบล็อกกัน" 
        });
      }

      // ตรวจสอบการตั้งค่าความเป็นส่วนตัว
      if (!otherUser.canReceiveMessageFrom(userId)) {
        return res.status(403).json({ 
          success: false, 
          message: "ผู้ใช้นี้ไม่อนุญาตให้รับข้อความจากคุณ" 
        });
      }
    }

    // ตรวจสอบว่าห้องส่วนตัวมีอยู่แล้วหรือไม่
    if (type === "private") {
      const existingRoom = await ChatRoom.findOne({
        type: "private",
        "participants.userId": { $all: participants }
      });
      
      if (existingRoom) {
        return res.status(200).json({
          success: true,
          message: "ห้องแชทมีอยู่แล้ว",
          chatRoom: existingRoom
        });
      }
    }

    // สร้างข้อมูลสมาชิก
    const participantData = participants.map((participantId, index) => ({
      userId: participantId,
      role: participantId === userId ? "admin" : "member",
      joinedAt: new Date(),
      isActive: true
    }));

    // สร้างห้องแชทใหม่
    const newChatRoom = new ChatRoom({
      name,
      type,
      participants: participantData,
      activityId: type === "group" ? activityId : undefined,
      description,
      avatar,
      status: "active",
      messageCount: 0
    });

    await newChatRoom.save();

    // Populate ข้อมูลสมาชิก
    await newChatRoom.populate('participants.userId', 'name avatar email');

    res.status(201).json({
      success: true,
      message: "สร้างห้องแชทสำเร็จ",
      chatRoom: newChatRoom
    });

  } catch (error) {
    console.error("Error creating chat room:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการสร้างห้องแชท", 
      error: error.message 
    });
  }
};

// ดึงรายการห้องแชทของ user
exports.getUserChatRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const chatRooms = await ChatRoom.find({
      "participants.userId": userId,
      "participants.isActive": true,
      status: "active"
    })
    .populate('participants.userId', 'name avatar email')
    .populate('lastMessage')
    .populate('activityId', 'name images')
    .sort({ lastMessageTime: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // ดึงจำนวน unread messages จาก chatRoom schema (เร็วกว่า)
    const chatRoomsWithUnread = chatRooms.map(room => {
      const unreadCount = room.getUnreadCount(userId);
      return {
        ...room.toObject(),
        unreadCount
      };
    });

    res.status(200).json({
      success: true,
      chatRooms: chatRoomsWithUnread,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(chatRooms.length / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching user chat rooms:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลห้องแชท", 
      error: error.message 
    });
  }
};

// เข้าร่วมห้องแชท
exports.joinChatRoom = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user._id;

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบห้องแชท" 
      });
    }

    // ตรวจสอบว่าเป็นสมาชิกแล้วหรือไม่
    const existingParticipant = chatRoom.participants.find(
      p => p.userId.toString() === userId.toString()
    );

    if (existingParticipant) {
      if (!existingParticipant.isActive) {
        // ตรวจสอบจำนวนสมาชิกก่อนเปิดใช้งานใหม่
        if (!chatRoom.canAddParticipant()) {
          return res.status(400).json({
            success: false,
            message: `ห้องแชทเต็มแล้ว (จำกัด ${chatRoom.settings.maxParticipants} คน)`
          });
        }
        existingParticipant.isActive = true;
        existingParticipant.joinedAt = new Date();
        await chatRoom.save();
      }
      return res.status(200).json({
        success: true,
        message: "คุณเป็นสมาชิกห้องนี้แล้ว",
        chatRoom
      });
    }

    // ตรวจสอบจำนวนสมาชิกก่อนเพิ่มใหม่
    if (!chatRoom.canAddParticipant()) {
      return res.status(400).json({
        success: false,
        message: `ห้องแชทเต็มแล้ว (จำกัด ${chatRoom.settings.maxParticipants} คน)`
      });
    }

    // เพิ่มสมาชิกใหม่
    chatRoom.participants.push({
      userId,
      role: "member",
      joinedAt: new Date(),
      isActive: true
    });

    // เริ่มต้น unread count สำหรับสมาชิกใหม่
    chatRoom.unreadCounts.push({
      userId,
      count: 0,
      lastUpdated: new Date()
    });

    await chatRoom.save();

    // ส่งข้อความระบบ
    const joinMessage = new Message({
      chatRoom: chatRoomId,
      sender: userId,
      type: "join",
      content: `เข้าร่วมห้องแชท`,
      order: Date.now()
    });

    await joinMessage.save();

    // อัพเดท lastMessage
    chatRoom.lastMessage = joinMessage._id;
    chatRoom.lastMessageTime = new Date();
    chatRoom.messageCount += 1;
    await chatRoom.save();

    res.status(200).json({
      success: true,
      message: "เข้าร่วมห้องแชทสำเร็จ",
      chatRoom
    });

  } catch (error) {
    console.error("Error joining chat room:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการเข้าร่วมห้องแชท", 
      error: error.message 
    });
  }
};

// ออกจากห้องแชท
exports.leaveChatRoom = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user._id;

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบห้องแชท" 
      });
    }

    const participant = chatRoom.participants.find(
      p => p.userId.toString() === userId.toString()
    );

    if (!participant) {
      return res.status(400).json({ 
        success: false, 
        message: "คุณไม่ได้เป็นสมาชิกห้องนี้" 
      });
    }

    // สำหรับห้องส่วนตัว เปลี่ยนสถานะเป็น inactive
    // สำหรับห้องกลุ่ม ลบออกจากรายชื่อ
    if (chatRoom.type === "private") {
      participant.isActive = false;
    } else {
      chatRoom.participants = chatRoom.participants.filter(
        p => p.userId.toString() !== userId.toString()
      );
    }

    await chatRoom.save();

    // ส่งข้อความระบบ
    const leaveMessage = new Message({
      chatRoom: chatRoomId,
      sender: userId,
      type: "leave",
      content: `ออกจากห้องแชท`,
      order: Date.now()
    });

    await leaveMessage.save();

    res.status(200).json({
      success: true,
      message: "ออกจากห้องแชทสำเร็จ"
    });

  } catch (error) {
    console.error("Error leaving chat room:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการออกจากห้องแชท", 
      error: error.message 
    });
  }
};

// ================= MESSAGE CONTROLLERS =================

// ส่งข้อความ
exports.sendMessage = async (req, res) => {
  try {
    const { chatRoomId, type, content, mediaInfo, stickerInfo, replyTo } = req.body;
    const userId = req.user._id;

    // ตรวจสอบห้องแชท
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบห้องแชท" 
      });
    }

    // ตรวจสอบสมาชิก
    const isParticipant = chatRoom.participants.some(
      p => p.userId.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: "คุณไม่มีสิทธิ์ส่งข้อความในห้องนี้" 
      });
    }

    // ตรวจสอบ privacy และ block สำหรับห้องส่วนตัว
    if (chatRoom.type === "private") {
      const otherParticipant = chatRoom.participants.find(
        p => p.userId.toString() !== userId.toString()
      );

      if (otherParticipant) {
        const [currentUser, otherUser] = await Promise.all([
          User.findById(userId),
          User.findById(otherParticipant.userId)
        ]);

        // ตรวจสอบการบล็อก
        if (currentUser?.isBlocked(otherParticipant.userId) || 
            currentUser?.isBlockedBy(otherParticipant.userId)) {
          return res.status(403).json({ 
            success: false, 
            message: "ไม่สามารถส่งข้อความได้เนื่องจากมีการบล็อกกัน" 
          });
        }

        // ตรวจสอบการตั้งค่าความเป็นส่วนตัว
        if (otherUser && !otherUser.canReceiveMessageFrom(userId)) {
          return res.status(403).json({ 
            success: false, 
            message: "ผู้รับไม่อนุญาตให้รับข้อความจากคุณ" 
          });
        }
      }
    }

    // สร้างข้อความใหม่
    const newMessage = new Message({
      chatRoom: chatRoomId,
      sender: userId,
      type,
      content,
      mediaInfo,
      stickerInfo,
      replyTo,
      order: Date.now(),
      status: "sent"
    });

    await newMessage.save();

    // อัพเดทห้องแชท
    chatRoom.lastMessage = newMessage._id;
    chatRoom.lastMessageTime = new Date();
    chatRoom.messageCount += 1;

    // เพิ่ม unread count สำหรับสมาชิกอื่นๆ (ยกเว้นผู้ส่ง)
    chatRoom.participants.forEach(participant => {
      if (participant.userId.toString() !== userId.toString() && participant.isActive) {
        chatRoom.incrementUnreadCount(participant.userId);
      }
    });

    await chatRoom.save();

    // Populate ข้อมูลที่จำเป็น
    await newMessage.populate([
      { path: 'sender', select: 'name avatar' },
      { path: 'replyTo', select: 'content sender type', populate: { path: 'sender', select: 'name' } }
    ]);

    res.status(201).json({
      success: true,
      message: "ส่งข้อความสำเร็จ",
      data: newMessage
    });

  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการส่งข้อความ", 
      error: error.message 
    });
  }
};

// ดึงข้อความในห้องแชท
exports.getChatMessages = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const userId = req.user._id;

    // ตรวจสอบสิทธิ์
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
        message: "คุณไม่มีสิทธิ์เข้าถึงข้อความในห้องนี้" 
      });
    }

    // สร้าง query
    let query = { 
      chatRoom: chatRoomId,
      $or: [
        { isDeleted: false },
        { isDeleted: true, deletedFor: "sender", deletedBy: { $ne: userId } }
      ]
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // ดึงข้อความ
    const messages = await Message.find(query)
      .populate('sender', 'name avatar')
      .populate('replyTo', 'content sender type')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name' }
      })
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // กลับลำดับให้เป็น timestamp เก่าไปใหม่
    messages.reverse();

    res.status(200).json({
      success: true,
      messages,
      pagination: {
        currentPage: parseInt(page),
        hasMore: messages.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อความ", 
      error: error.message 
    });
  }
};

// ลบข้อความ (Soft Delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteFor = "sender" } = req.body; // "sender" หรือ "everyone"
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบข้อความ" 
      });
    }

    // ตรวจสอบสิทธิ์
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "คุณไม่มีสิทธิ์ลบข้อความนี้" 
      });
    }

    // ตรวจสอบเวลา (ลบได้แค่ข้อความที่ส่งไปไม่เกิน 24 ชั่วโมง)
    const timeDiff = new Date() - message.timestamp;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 24 && deleteFor === "everyone") {
      return res.status(400).json({ 
        success: false, 
        message: "ไม่สามารถลบข้อความสำหรับทุกคนได้ หลังจากผ่านไป 24 ชั่วโมง" 
      });
    }

    // อัพเดทสถานะการลบ
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    message.deletedFor = deleteFor;

    if (deleteFor === "everyone") {
      message.content = "ข้อความนี้ถูกลบแล้ว";
    }

    await message.save();

    res.status(200).json({
      success: true,
      message: "ลบข้อความสำเร็จ"
    });

  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการลบข้อความ", 
      error: error.message 
    });
  }
};

// แก้ไขข้อความ
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบข้อความ" 
      });
    }

    // ตรวจสอบสิทธิ์
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "คุณไม่มีสิทธิ์แก้ไขข้อความนี้" 
      });
    }

    // ตรวจสอบประเภทข้อความ (แก้ไขได้เฉพาะ text)
    if (message.type !== "text") {
      return res.status(400).json({ 
        success: false, 
        message: "สามารถแก้ไขได้เฉพาะข้อความตัวหนังสือเท่านั้น" 
      });
    }

    // บันทึกประวัติการแก้ไข
    if (!message.editHistory) {
      message.editHistory = [];
    }
    message.editHistory.push({
      content: message.content,
      editedAt: new Date()
    });

    // อัพเดทข้อความ
    message.content = content;
    message.isEdited = true;

    await message.save();

    res.status(200).json({
      success: true,
      message: "แก้ไขข้อความสำเร็จ",
      data: message
    });

  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการแก้ไขข้อความ", 
      error: error.message 
    });
  }
};

// เพิ่ม reaction ให้ข้อความ
exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji, reactionType } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบข้อความ" 
      });
    }

    // ตรวจสอบว่า user react แล้วหรือไม่
    const existingReaction = message.reactions.find(
      r => r.userId.toString() === userId.toString()
    );

    if (existingReaction) {
      // ถ้า reaction เหมือนเดิม ให้ลบออก
      if (existingReaction.emoji === emoji && existingReaction.reactionType === reactionType) {
        message.reactions = message.reactions.filter(
          r => r.userId.toString() !== userId.toString()
        );
      } else {
        // ถ้าต่างกัน ให้อัพเดท
        existingReaction.emoji = emoji;
        existingReaction.reactionType = reactionType;
        existingReaction.createdAt = new Date();
      }
    } else {
      // เพิ่ม reaction ใหม่
      message.reactions.push({
        userId,
        emoji,
        reactionType,
        createdAt: new Date()
      });
    }

    await message.save();

    res.status(200).json({
      success: true,
      message: "เพิ่ม reaction สำเร็จ",
      reactions: message.reactions
    });

  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการเพิ่ม reaction", 
      error: error.message 
    });
  }
};

// อัพเดทสถานะการอ่านข้อความ
exports.markAsRead = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { messageId } = req.body; // Optional: specific message to mark as read
    const userId = req.user._id;

    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบห้องแชท" 
      });
    }

    // ตรวจสอบสมาชิก
    const participant = chatRoom.participants.find(
      p => p.userId.toString() === userId.toString() && p.isActive
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: "คุณไม่ได้เป็นสมาชิกห้องนี้"
      });
    }

    // อัพเดท lastReadTimestamp
    participant.lastReadTimestamp = new Date();
    
    // รีเซ็ต unread count
    chatRoom.resetUnreadCount(userId);

    // ถ้าระบุ messageId ให้อัพเดท lastReadMessage
    if (messageId) {
      const message = await Message.findById(messageId);
      if (message && message.chatRoom.toString() === chatRoomId) {
        participant.lastReadMessage = messageId;
        
        // เพิ่มผู้ใช้ใน readBy array ของข้อความ
        const existingRead = message.readBy.find(r => r.userId.toString() === userId.toString());
        if (!existingRead) {
          message.readBy.push({
            userId,
            readAt: new Date()
          });
          await message.save();
        }
      }
    }

    await chatRoom.save();

    res.status(200).json({
      success: true,
      message: "อัพเดทสถานะการอ่านสำเร็จ",
      unreadCount: 0
    });

  } catch (error) {
    console.error("Error marking as read:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการอัพเดทสถานะการอ่าน", 
      error: error.message 
    });
  }
};

// ================= STICKER CONTROLLERS =================

// ดึงรายการ sticker sets
exports.getStickerSets = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    let query = { isPublic: true, status: { $ne: 'disabled' } };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { nameTH: { $regex: search, $options: 'i' } },
        { nameEN: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const stickerSets = await StickerSet.find(query)
      .sort({ downloadCount: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StickerSet.countDocuments(query);

    res.status(200).json({
      success: true,
      stickerSets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error("Error fetching sticker sets:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล sticker sets", 
      error: error.message 
    });
  }
};

// ดึง stickers ในชุด
exports.getStickersInSet = async (req, res) => {
  try {
    const { setId } = req.params;

    const stickers = await Sticker.find({ 
      setId, 
      isActive: true 
    }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      stickers
    });

  } catch (error) {
    console.error("Error fetching stickers:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล stickers", 
      error: error.message 
    });
  }
};

// ดาวน์โหลด sticker set
exports.downloadStickerSet = async (req, res) => {
  try {
    const { setId } = req.params;
    const userId = req.user._id;

    const stickerSet = await StickerSet.findById(setId);
    if (!stickerSet) {
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบชุด sticker" 
      });
    }

    // ตรวจสอบว่าดาวน์โหลดแล้วหรือไม่
    const existingCollection = await UserStickerCollection.findOne({
      userId,
      stickerSetId: setId
    });

    if (existingCollection) {
      return res.status(200).json({
        success: true,
        message: "คุณมีชุด sticker นี้แล้ว",
        collection: existingCollection
      });
    }

    // สร้างรายการใหม่
    const newCollection = new UserStickerCollection({
      userId,
      stickerSetId: setId,
      purchasePrice: stickerSet.price,
      purchaseMethod: stickerSet.price === 0 ? 'free' : 'coins'
    });

    await newCollection.save();

    // อัพเดทจำนวนดาวน์โหลด
    stickerSet.downloadCount += 1;
    await stickerSet.save();

    res.status(201).json({
      success: true,
      message: "ดาวน์โหลด sticker set สำเร็จ",
      collection: newCollection
    });

  } catch (error) {
    console.error("Error downloading sticker set:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดาวน์โหลด sticker set", 
      error: error.message 
    });
  }
};

// ดึงรายการ sticker ที่ user มี
exports.getUserStickerSets = async (req, res) => {
  try {
    const userId = req.user._id;

    const userCollections = await UserStickerCollection.find({
      userId,
      isActive: true
    })
    .populate('stickerSetId')
    .sort({ purchasedAt: -1 });

    res.status(200).json({
      success: true,
      collections: userCollections
    });

  } catch (error) {
    console.error("Error fetching user sticker sets:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล sticker ของผู้ใช้", 
      error: error.message 
    });
  }
};

// ================= UNREAD MESSAGES CONTROLLERS =================

// ดึงจำนวน unread messages ทั้งหมด
exports.getTotalUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const chatRooms = await ChatRoom.find({
      "participants.userId": userId,
      "participants.isActive": true,
      status: "active"
    });

    let totalUnread = 0;
    const roomUnreadCounts = [];

    chatRooms.forEach(room => {
      const unreadCount = room.getUnreadCount(userId);
      totalUnread += unreadCount;
      
      if (unreadCount > 0) {
        roomUnreadCounts.push({
          chatRoomId: room._id,
          chatRoomName: room.name,
          unreadCount
        });
      }
    });

    res.status(200).json({
      success: true,
      totalUnreadCount: totalUnread,
      unreadRooms: roomUnreadCounts.length,
      roomDetails: roomUnreadCounts
    });

  } catch (error) {
    console.error("Error getting total unread count:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงจำนวนข้อความที่ยังไม่ได้อ่าน",
      error: error.message
    });
  }
};

// ดึงสถิติการอ่านข้อความในห้องแชท
exports.getMessageReadStats = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId)
      .populate('readBy.userId', 'user.name userData')
      .populate('deliveredTo.userId', 'user.name userData');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อความ"
      });
    }

    // ตรวจสอบสิทธิ์
    const chatRoom = await ChatRoom.findById(message.chatRoom);
    const isParticipant = chatRoom.participants.some(
      p => p.userId.toString() === userId.toString() && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้"
      });
    }

    // นับสมาชิกที่ยังใช้งานอยู่
    const activeParticipants = chatRoom.participants.filter(p => p.isActive).length;
    const readCount = message.readBy.length;
    const deliveredCount = message.deliveredTo.length;

    res.status(200).json({
      success: true,
      messageStats: {
        totalParticipants: activeParticipants,
        deliveredCount,
        readCount,
        readPercentage: activeParticipants > 0 ? Math.round((readCount / activeParticipants) * 100) : 0,
        deliveredPercentage: activeParticipants > 0 ? Math.round((deliveredCount / activeParticipants) * 100) : 0,
        readBy: message.readBy,
        deliveredTo: message.deliveredTo
      }
    });

  } catch (error) {
    console.error("Error getting message read stats:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงสถิติการอ่านข้อความ",
      error: error.message
    });
  }
};

// อัพเดทสถานะ delivery
exports.markAsDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อความ"
      });
    }

    // ตรวจสอบว่า delivered แล้วหรือยัง
    const existingDelivered = message.deliveredTo.find(
      d => d.userId.toString() === userId.toString()
    );

    if (!existingDelivered) {
      message.deliveredTo.push({
        userId,
        deliveredAt: new Date()
      });
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: "อัพเดทสถานะ delivery สำเร็จ"
    });

  } catch (error) {
    console.error("Error marking as delivered:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอัพเดทสถานะ delivery",
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  createChatRoom: exports.createChatRoom,
  getUserChatRooms: exports.getUserChatRooms,
  joinChatRoom: exports.joinChatRoom,
  leaveChatRoom: exports.leaveChatRoom,
  sendMessage: exports.sendMessage,
  getChatMessages: exports.getChatMessages,
  deleteMessage: exports.deleteMessage,
  editMessage: exports.editMessage,
  addReaction: exports.addReaction,
  markAsRead: exports.markAsRead,
  getStickerSets: exports.getStickerSets,
  getStickersInSet: exports.getStickersInSet,
  downloadStickerSet: exports.downloadStickerSet,
  getUserStickerSets: exports.getUserStickerSets,
  getTotalUnreadCount: exports.getTotalUnreadCount,
  getMessageReadStats: exports.getMessageReadStats,
  markAsDelivered: exports.markAsDelivered
};
