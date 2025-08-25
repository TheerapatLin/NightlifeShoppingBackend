const express = require('express');
const router = express.Router();
const privacyController = require('../../controllers/privacyControllers');
const { verifyToken } = require('../../middlewares/auth');

// ================= PRIVACY SETTINGS ROUTES =================

// ดึงการตั้งค่าความเป็นส่วนตัว
router.get('/settings', verifyToken, privacyController.getPrivacySettings);

// อัพเดทการตั้งค่าความเป็นส่วนตัว
router.put('/settings', verifyToken, privacyController.updatePrivacySettings);

// ================= BLOCK MANAGEMENT ROUTES =================

// ดึงรายการผู้ใช้ที่ถูกบล็อก
router.get('/blocked-users', verifyToken, privacyController.getBlockedUsers);

// บล็อกผู้ใช้
router.post('/block', verifyToken, privacyController.blockUser);

// ยกเลิกการบล็อกผู้ใช้
router.post('/unblock', verifyToken, privacyController.unblockUser);

// ตรวจสอบสถานะการบล็อก
router.get('/block-status/:userId', verifyToken, privacyController.checkBlockStatus);

// ================= USER SEARCH & PROFILE ROUTES =================

// ค้นหาผู้ใช้
router.get('/search/users', verifyToken, privacyController.searchUsers);

// ดึงข้อมูลผู้ใช้
router.get('/user/:userId', verifyToken, privacyController.getUserProfile);

// รายงานผู้ใช้
router.post('/report', verifyToken, privacyController.reportUser);

module.exports = router;
