const express = require("express");
const router = express.Router();

const {
    createActivitySlot,
    getActivitySlots,
    getActivitySlotByID,
    updateActivitySlot,
    deleteActivitySlot,
} = require("../../controllers/activitySlotController");

const {
    verifyAccessTokenWeb,
    authRoles,
} = require("../../middlewares/auth");

// ✅ สร้างรอบใหม่
router.post("/", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], createActivitySlot);

// ✅ ดึงรอบทั้งหมด (filter ได้ด้วย query ?activityId=)
router.get("/", getActivitySlots);

// ✅ ดึงรอบตาม ID
router.get("/:id", getActivitySlotByID);

// ✅ อัปเดตรอบ
router.patch("/:id", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], updateActivitySlot);

// ✅ ลบรอบ
router.delete("/:id", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], deleteActivitySlot);

module.exports = router;
