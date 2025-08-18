const express = require('express');
const router = express.Router();

// Import controllers
const tableController = require('../../controllers/simpleTableController');
const tableLayoutController = require('../../controllers/simpleTableLayoutController');
const tableReservationController = require('../../controllers/simpleTableReservationController');

// Import middleware
const auth = require('../../middlewares/auth');

// ==================== TABLE ROUTES ====================

// สร้างโต๊ะใหม่
router.post('/', tableController.createTable);

// ดึงโต๊ะทั้งหมดของ venue
router.get('/venue/:venueId', tableController.getTablesByVenue);

// ดึงโต๊ะตาม ID
router.get('/:tableId', tableController.getTableById);

// อัปเดตโต๊ะ
router.put('/:tableId', tableController.updateTable);

// ลบโต๊ะ
router.delete('/:tableId', tableController.deleteTable);

// ดึงโต๊ะที่ว่างสำหรับการจอง
router.get('/venue/:venueId/available', tableController.getAvailableTables);

// อัปเดตสถานะโต๊ะ
router.patch('/:tableId/status', tableController.updateTableStatus);

// ดึงสถิติโต๊ะ
router.get('/venue/:venueId/stats', tableController.getTableStats);

// ==================== TABLE LAYOUT ROUTES ====================

// สร้าง layout ใหม่
router.post('/layout', tableLayoutController.createTableLayout);

// ดึง layouts ทั้งหมดของ venue
router.get('/layout/venue/:venueId', tableLayoutController.getLayoutsByVenue);

// ดึง default layout ของ venue
router.get('/layout/venue/:venueId/default', tableLayoutController.getDefaultLayout);

// ดึง layout ตาม ID
router.get('/layout/:layoutId', tableLayoutController.getLayoutById);

// ดึง layout พร้อมข้อมูลโต๊ะ
router.get('/layout/:layoutId/with-tables', tableLayoutController.getLayoutWithTables);

// อัปเดต layout
router.put('/layout/:layoutId', tableLayoutController.updateLayout);

// ลบ layout
router.delete('/layout/:layoutId', tableLayoutController.deleteLayout);

// เพิ่ม element ใน layout
router.post('/layout/:layoutId/elements', tableLayoutController.addElementToLayout);

// อัปเดต element ใน layout
router.put('/layout/:layoutId/elements/:elementId', tableLayoutController.updateElementInLayout);

// ลบ element จาก layout
router.delete('/layout/:layoutId/elements/:elementId', tableLayoutController.removeElementFromLayout);

// ทำสำเนา layout
router.post('/layout/:layoutId/duplicate', tableLayoutController.duplicateLayout);

// เปิดใช้งาน layout
router.patch('/layout/:layoutId/activate', tableLayoutController.activateLayout);

// เก็บ layout เข้าคลัง
router.patch('/layout/:layoutId/archive', tableLayoutController.archiveLayout);

// ==================== TABLE RESERVATION ROUTES ====================

// สร้างการจองใหม่
router.post('/reservation', tableReservationController.createReservation);

// ดึงการจองทั้งหมดของ venue
router.get('/reservation/venue/:venueId', tableReservationController.getReservationsByVenue);

// ดึงการจองทั้งหมดของโต๊ะ
router.get('/reservation/table/:tableId', tableReservationController.getReservationsByTable);

// ดึงการจองทั้งหมดของ user
router.get('/reservation/user/:userId', tableReservationController.getReservationsByUser);

// ดึงการจองตาม ID
router.get('/reservation/:reservationId', tableReservationController.getReservationById);

// อัปเดตการจอง
router.put('/reservation/:reservationId', tableReservationController.updateReservation);

// ยืนยันการจอง
router.patch('/reservation/:reservationId/confirm', tableReservationController.confirmReservation);

// นั่งแขก
router.patch('/reservation/:reservationId/seat', tableReservationController.seatGuests);

// จบการจอง
router.patch('/reservation/:reservationId/complete', tableReservationController.completeReservation);

// ยกเลิกการจอง
router.patch('/reservation/:reservationId/cancel', tableReservationController.cancelReservation);

// ย้ายโต๊ะ
router.patch('/reservation/:reservationId/move', tableReservationController.moveTable);

// ขยายเวลา
router.patch('/reservation/:reservationId/extend', tableReservationController.extendReservation);

// ดึงสถิติการจอง
router.get('/reservation/venue/:venueId/stats', tableReservationController.getReservationStats);

module.exports = router;
