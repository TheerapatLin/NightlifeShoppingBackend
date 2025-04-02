const rateLimit = require("express-rate-limit");
const RedisStore = require('rate-limit-redis');


const redis = require('../database/redis');

const globalRateLimit = rateLimit({
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] ||  req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // limit each IP to 50 requests per window Ms
    skipFailedRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
})

module.exports = {
    globalRateLimit
}