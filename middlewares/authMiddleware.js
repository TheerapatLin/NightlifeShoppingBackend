const jwt = require('jsonwebtoken');
const User = require('../schemas/v1/user.schema');

const isAdmin = async (req, res, next) => {
  try {
    // Token จาก Header
    const tokenHeader = req.header('Authorization');
    const token = tokenHeader?.startsWith('Bearer ') ? tokenHeader.split(' ')[1] : tokenHeader;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    // ตรวจสอบความถูกต้องของ Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // เก็บ user ที่ decode ได้ใน req.user

    // ดึงข้อมูล User จาก Database
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ตรวจสอบว่า User เป็น Admin หรือไม่
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }

    // ถ้าผ่านทุกอย่าง → ให้ไปที่ middleware ถัดไป
    next();
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid token.', error: error.message });
  }
};

module.exports = isAdmin;
