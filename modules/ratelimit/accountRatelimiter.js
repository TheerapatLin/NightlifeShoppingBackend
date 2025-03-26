const rateLimit = require("express-rate-limit");
const RedisStore = require('rate-limit-redis');


const redis = require('../database/redis');


const abcRateLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});


const getAccountsRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});
const getAccountRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 5 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});


const deleteAccountsRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 3 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});
const deleteAccountRateLimiter = rateLimit({
    /*store: new RedisStore({
        sendCommand: (...args) => redis.sendCommand(args),
    }),
    */
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress; // รับค่า IP จาก User
        console.log("Request IP:", ip);  // ตรวจสอบว่าได้ค่า IP หรือไม่
        return ip;
    },
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 3 requests per window Ms
    standardHeaders: true,
    legacyHeaders: false,
    message: "Exceeded Rate Limit, please try again in 10 minutes"
});

module.exports = {
    abcRateLimiter, getAccountsRateLimiter, deleteAccountsRateLimiter, getAccountRateLimiter, deleteAccountRateLimiter
}