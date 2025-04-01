const rateLimit = require("express-rate-limit");
const RedisStore = require('rate-limit-redis');


const redis = require('../database/redis');

const registerRateLimiter = rateLimit({
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 3 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many accounts created, please try again in 10 minutes",
});

const loginRateLimiter = rateLimit({
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 15, // limit each IP to 10 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many attempt to login, please try again in 10 minutes",
});

const logoutRateLimiter = rateLimit({
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 10 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many attempt to logout, please try again in 10 minutes"
});
module.exports = {
    registerRateLimiter, loginRateLimiter, logoutRateLimiter
}