const { User } = require("../schemas/v1/user.schema");
const { ChatRoom, Message } = require("../schemas/v1/chat.schema");
const mongoose = require("mongoose");

// ================= PRIVACY SETTINGS CONTROLLERS =================

// ดึงการตั้งค่าความเป็นส่วนตัว
exports.getPrivacySettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('privacySettings');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้"
      });
    }

    res.status(200).json({
      success: true,
      privacySettings: user.privacySettings
    });

  } catch (error) {
    console.error("Error fetching privacy settings:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงการตั้งค่าความเป็นส่วนตัว",
      error: error.message
    });
  }
};

// อัพเดทการตั้งค่าความเป็นส่วนตัว
exports.updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      searchable, 
      allowDirectMessage, 
      showOnlineStatus, 
      allowGroupInvite, 
      profileVisibility 
    } = req.body;

    const updateData = {};
    
    if (typeof searchable === 'boolean') {
      updateData['privacySettings.searchable'] = searchable;
    }
    if (typeof allowDirectMessage === 'boolean') {
      updateData['privacySettings.allowDirectMessage'] = allowDirectMessage;
    }
    if (typeof showOnlineStatus === 'boolean') {
      updateData['privacySettings.showOnlineStatus'] = showOnlineStatus;
    }
    if (typeof allowGroupInvite === 'boolean') {
      updateData['privacySettings.allowGroupInvite'] = allowGroupInvite;
    }
    if (profileVisibility && ['public', 'friends', 'private'].includes(profileVisibility)) {
      updateData['privacySettings.profileVisibility'] = profileVisibility;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('privacySettings');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้"
      });
    }

    res.status(200).json({
      success: true,
      message: "อัพเดทการตั้งค่าความเป็นส่วนตัวสำเร็จ",
      privacySettings: user.privacySettings
    });

  } catch (error) {
    console.error("Error updating privacy settings:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอัพเดทการตั้งค่าความเป็นส่วนตัว",
      error: error.message
    });
  }
};

// ================= BLOCK MANAGEMENT CONTROLLERS =================

// ดึงรายการผู้ใช้ที่ถูกบล็อก
exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId)
      .populate('blockedUsers.userId', 'user.name user.email userData')
      .populate({
        path: 'blockedUsers.userId',
        populate: {
          path: 'userData',
          select: 'profileImage'
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้"
      });
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedBlocked = user.blockedUsers.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      blockedUsers: paginatedBlocked,
      pagination: {
        currentPage: parseInt(page),
        totalItems: user.blockedUsers.length,
        totalPages: Math.ceil(user.blockedUsers.length / limit),
        hasMore: endIndex < user.blockedUsers.length
      }
    });

  } catch (error) {
    console.error("Error fetching blocked users:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงรายการผู้ใช้ที่ถูกบล็อก",
      error: error.message
    });
  }
};

// บล็อกผู้ใช้
exports.blockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userIdToBlock, reason = "other" } = req.body;

    // ตรวจสอบข้อมูล
    if (!userIdToBlock) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุผู้ใช้ที่ต้องการบล็อก"
      });
    }

    if (userId.toString() === userIdToBlock.toString()) {
      return res.status(400).json({
        success: false,
        message: "ไม่สามารถบล็อกตนเองได้"
      });
    }

    // ตรวจสอบว่าผู้ใช้ที่จะบล็อกมีอยู่จริง
    const targetUser = await User.findById(userIdToBlock);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้ที่ต้องการบล็อก"
      });
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้"
      });
    }

    // บล็อกผู้ใช้
    const success = await currentUser.blockUser(userIdToBlock, reason);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: "ผู้ใช้นี้ถูกบล็อกอยู่แล้ว"
      });
    }

    // ลบห้องแชทส่วนตัวที่มีอยู่ (ถ้ามี)
    await ChatRoom.updateMany(
      {
        type: "private",
        "participants.userId": { $all: [userId, userIdToBlock] }
      },
      {
        $set: {
          status: "inactive",
          "participants.$[elem].isActive": false
        }
      },
      {
        arrayFilters: [{ "elem.userId": { $in: [userId, userIdToBlock] } }]
      }
    );

    res.status(200).json({
      success: true,
      message: "บล็อกผู้ใช้สำเร็จ"
    });

  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการบล็อกผู้ใช้",
      error: error.message
    });
  }
};

// ยกเลิกการบล็อกผู้ใช้
exports.unblockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userIdToUnblock } = req.body;

    // ตรวจสอบข้อมูล
    if (!userIdToUnblock) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุผู้ใช้ที่ต้องการยกเลิกการบล็อก"
      });
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้"
      });
    }

    // ยกเลิกการบล็อก
    await currentUser.unblockUser(userIdToUnblock);

    res.status(200).json({
      success: true,
      message: "ยกเลิกการบล็อกผู้ใช้สำเร็จ"
    });

  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการยกเลิกการบล็อกผู้ใช้",
      error: error.message
    });
  }
};

// ================= USER SEARCH CONTROLLERS =================

// ค้นหาผู้ใช้ (รองรับ privacy settings)
exports.searchUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { q, page = 1, limit = 20, userType } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุคำค้นหาอย่างน้อย 2 ตัวอักษร"
      });
    }

    // สร้าง query สำหรับค้นหา
    let searchQuery = {
      $and: [
        {
          // ไม่ใช่ตัวเอง
          _id: { $ne: userId }
        },
        {
          // อนุญาตให้ค้นหาได้
          "privacySettings.searchable": true
        },
        {
          // ไม่ได้บล็อกกัน
          $and: [
            { "blockedUsers.userId": { $ne: userId } },
            { "blockedBy.userId": { $ne: userId } }
          ]
        },
        {
          // ค้นหาตามชื่อหรืออีเมล
          $or: [
            { "user.name": { $regex: q, $options: 'i' } },
            { "user.email": { $regex: q, $options: 'i' } },
            { "user.username": { $regex: q, $options: 'i' } }
          ]
        }
      ]
    };

    // กรองตาม userType ถ้าระบุ
    if (userType && ['regular', 'organization', 'sponsor'].includes(userType)) {
      searchQuery.$and.push({ userType });
    }

    const users = await User.find(searchQuery)
      .populate('userData', 'profileImage')
      .select('user.name user.email user.username userType userData privacySettings.profileVisibility')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ "user.name": 1 });

    // กรองตาม profileVisibility
    const filteredUsers = users.filter(user => {
      if (user.privacySettings?.profileVisibility === 'private') {
        return false;
      }
      // TODO: เพิ่มการตรวจสอบ friends ในอนาคต
      return true;
    });

    const total = await User.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      users: filteredUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasMore: (page * limit) < total
      }
    });

  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการค้นหาผู้ใช้",
      error: error.message
    });
  }
};

// ดึงข้อมูลผู้ใช้ (รองรับ privacy settings)
exports.getUserProfile = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;

    const targetUser = await User.findById(userId)
      .populate('userData')
      .select('-password -token -loggedInDevices -blockedUsers -blockedBy');

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้"
      });
    }

    // ตรวจสอบสิทธิ์การเข้าถึงโปรไฟล์
    if (userId !== currentUserId.toString()) {
      // ตรวจสอบว่าถูกบล็อกหรือไม่
      if (targetUser.isBlocked(currentUserId) || targetUser.isBlockedBy(currentUserId)) {
        return res.status(403).json({
          success: false,
          message: "ไม่สามารถเข้าถึงโปรไฟล์ได้"
        });
      }

      // ตรวจสอบการตั้งค่าความเป็นส่วนตัว
      if (targetUser.privacySettings?.profileVisibility === 'private') {
        return res.status(403).json({
          success: false,
          message: "โปรไฟล์นี้เป็นส่วนตัว"
        });
      }
    }

    res.status(200).json({
      success: true,
      user: targetUser
    });

  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้",
      error: error.message
    });
  }
};

// ตรวจสอบสถานะการบล็อก
exports.checkBlockStatus = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;

    if (currentUserId.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "ไม่สามารถตรวจสอบสถานะกับตนเองได้"
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้"
      });
    }

    const isBlocked = currentUser.isBlocked(userId);
    const isBlockedBy = currentUser.isBlockedBy(userId);
    const canMessage = targetUser.canReceiveMessageFrom(currentUserId);
    const canSearch = targetUser.canBeSearchedBy(currentUserId);

    res.status(200).json({
      success: true,
      blockStatus: {
        isBlocked,        // ฉันบล็อกเขา
        isBlockedBy,      // เขาบล็อกฉัน
        canMessage,       // ฉันส่งข้อความหาเขาได้หรือไม่
        canSearch         // ฉันค้นหาเขาได้หรือไม่
      }
    });

  } catch (error) {
    console.error("Error checking block status:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการตรวจสอบสถานะการบล็อก",
      error: error.message
    });
  }
};

// รายงานผู้ใช้
exports.reportUser = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { userId, reason, description } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุผู้ใช้และเหตุผลในการรายงาน"
      });
    }

    if (reporterId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "ไม่สามารถรายงานตนเองได้"
      });
    }

    // ตรวจสอบว่าผู้ใช้ที่จะรายงานมีอยู่จริง
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบผู้ใช้ที่ต้องการรายงาน"
      });
    }

    // TODO: สร้าง UserReport schema และบันทึกการรายงาน
    // ตอนนี้จะแสดงข้อความว่าได้รับการรายงานแล้ว
    console.log(`User ${reporterId} reported user ${userId} for ${reason}: ${description}`);

    res.status(200).json({
      success: true,
      message: "รายงานผู้ใช้สำเร็จ ทีมงานจะตรวจสอบและดำเนินการต่อไป"
    });

  } catch (error) {
    console.error("Error reporting user:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการรายงานผู้ใช้",
      error: error.message
    });
  }
};

module.exports = exports;
