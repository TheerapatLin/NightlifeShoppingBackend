//app.js
require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const chalk = require("chalk");
const cors = require("cors");
const passport = require("passport");
const sessions = require("express-session");
const basicAuth = require('express-basic-auth');

//? Databases
const connectMongoDB = require("./modules/database/mongodb");
const redis = require("./modules/database/redis");

connectMongoDB();
(async () => {
  await redis.connect();
})();

redis.on("connect", () => console.log(chalk.green("Redis Connected")));
redis.on("ready", () => console.log(chalk.green("Redis Ready")));
redis.on("error", (err) => console.log("Redis Client Error", err));

module.exports = redis;

//? Modules
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.set("trust proxy", true);

//? Sessions

// app.use(
//   sessions({
//     secret: "secretkey",
//     saveUninitialized: true,
//     resave: false,
//   })
// );

app.use(
  sessions({
    secret: "secretkey",
    saveUninitialized: false,
    resave: false,
    cookie: {
      secure: true, // Ensure cookies are sent over HTTPS only
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "None", // Ensure cookies are sent with cross-site requests
      httpOnly: true, // Prevents client-side JS from reading the cookie
    },
  })
);

//? PassportJS
app.use(passport.initialize());
app.use(passport.session());

// Cross Origin Resource Sharing
const whitelist = [
  "https://healworld.me",
  "https://localhost-shopfront.ngrok.app",
  "https://www.healworld.me",
  "https://uat.healworld.me",
  "https://nightlife.run",
  "https://www.nightlife.run",
  "https://uat.nightlife.run",
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:5174",
  "https://localhost:5174",
  "https://localhost:3111",
  "https://api.healworld.me",
  "https://api.nightlife.run",
  // Flutter web development URLs
  "http://localhost:8080",
  "https://localhost:8080",
  "http://localhost:3000",
  "https://localhost:3000",
  "http://127.0.0.1:8080",
  "https://127.0.0.1:8080",
];
const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  optionsSuccessStatus: 200,
};
//app.use(cors("*"));
app.use(cors(corsOptions));

const server = require("http").createServer(app);
const io = require("socket.io")(server);

// เก็บข้อมูล user ที่ online
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Authentication - user ต้องส่ง token มาเพื่อ authenticate
  socket.on("authenticate", async (data) => {
    try {
      const { token, userId } = data;
      
      if (!token || !userId) {
        socket.emit("auth_error", { message: "Token and userId required" });
        return;
      }

      // TODO: Verify JWT token here
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      socket.userId = userId;
      socket.authenticated = true;
      
      // เก็บข้อมูล user online
      onlineUsers.set(userId, {
        socketId: socket.id,
        userId,
        connectedAt: new Date(),
        status: "online"
      });

      socket.emit("authenticated", { 
        message: "Authentication successful",
        userId 
      });

      // แจ้งเพื่อนว่า user online
      socket.broadcast.emit("user_online", { userId });

      console.log(`✅ User ${userId} authenticated with socket ${socket.id}`);

    } catch (error) {
      console.error("Authentication error:", error);
      socket.emit("auth_error", { message: "Authentication failed" });
    }
  });

  // เข้าร่วมห้องแชท
  socket.on("join_chat", async (data) => {
    try {
      if (!socket.authenticated) {
        socket.emit("error", { message: "Please authenticate first" });
        return;
      }

      const { chatRoomId } = data;
      const { ChatRoom } = require("./schemas/v1/chat.schema");

      // ตรวจสอบสิทธิ์เข้าห้อง
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        socket.emit("error", { message: "Chat room not found" });
        return;
      }

      const isParticipant = chatRoom.participants.some(
        p => p.userId.toString() === socket.userId && p.isActive
      );

      if (!isParticipant) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      socket.join(chatRoomId);
      socket.currentChatRoom = chatRoomId;

      console.log(`👥 User ${socket.userId} joined chat room ${chatRoomId}`);

      // แจ้งสมาชิกในห้องว่ามี user เข้ามา
      socket.to(chatRoomId).emit("user_joined_chat", {
        userId: socket.userId,
        chatRoomId,
        timestamp: new Date()
      });

      socket.emit("joined_chat", { 
        chatRoomId,
        message: "Successfully joined chat room" 
      });

    } catch (error) {
      console.error("Error joining chat:", error);
      socket.emit("error", { message: "Failed to join chat room" });
    }
  });

  // ออกจากห้องแชท
  socket.on("leave_chat", (data) => {
    try {
      const { chatRoomId } = data;
      
      socket.leave(chatRoomId);
      
      // แจ้งสมาชิกในห้องว่ามี user ออกไป
      socket.to(chatRoomId).emit("user_left_chat", {
        userId: socket.userId,
        chatRoomId,
        timestamp: new Date()
      });

      console.log(`👋 User ${socket.userId} left chat room ${chatRoomId}`);

    } catch (error) {
      console.error("Error leaving chat:", error);
    }
  });

  // ส่งข้อความ (Real-time)
  socket.on("send_message", async (data) => {
    try {
      if (!socket.authenticated) {
        socket.emit("error", { message: "Please authenticate first" });
        return;
      }

      const { chatRoomId, messageId, type, content, mediaInfo, stickerInfo, replyTo } = data;
      const { Message, ChatRoom } = require("./schemas/v1/chat.schema");

      // ดึงข้อความที่เพิ่งสร้าง
      const message = await Message.findById(messageId)
        .populate('sender', 'name avatar')
        .populate('replyTo', 'content sender type')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'name' }
        });

      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // ดึงข้อมูลห้องแชท
      const chatRoom = await ChatRoom.findById(chatRoomId);
      
      // ส่งข้อความไปยังสมาชิกในห้อง
      io.to(chatRoomId).emit("new_message", {
        message,
        chatRoomId,
        timestamp: new Date()
      });

      // ส่ง unread count update ให้สมาชิกอื่นๆ (ยกเว้นผู้ส่ง)
      if (chatRoom) {
        chatRoom.participants.forEach(participant => {
          if (participant.userId.toString() !== socket.userId && participant.isActive) {
            const participantUnreadCount = chatRoom.getUnreadCount(participant.userId);
            
            // ส่งไปยัง specific user
            const participantSocket = Array.from(io.sockets.sockets.values())
              .find(s => s.userId === participant.userId.toString());
            
            if (participantSocket) {
              participantSocket.emit("unread_count_updated", {
                chatRoomId,
                chatRoomName: chatRoom.name,
                unreadCount: participantUnreadCount,
                lastMessage: {
                  content: message.content,
                  sender: message.sender.name,
                  timestamp: message.timestamp
                }
              });
            }
          }
        });
      }

      console.log(`💬 Message sent in room ${chatRoomId} by user ${socket.userId}`);

    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // แจ้งว่ากำลังพิมพ์
  socket.on("typing_start", (data) => {
    try {
      const { chatRoomId } = data;
      
      socket.to(chatRoomId).emit("user_typing", {
        userId: socket.userId,
        chatRoomId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error handling typing:", error);
    }
  });

  // หยุดพิมพ์
  socket.on("typing_stop", (data) => {
    try {
      const { chatRoomId } = data;
      
      socket.to(chatRoomId).emit("user_stop_typing", {
        userId: socket.userId,
        chatRoomId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error handling stop typing:", error);
    }
  });

  // เพิ่ม reaction
  socket.on("add_reaction", async (data) => {
    try {
      const { messageId, emoji, reactionType, chatRoomId } = data;
      const { Message } = require("./schemas/v1/chat.schema");

      // ดึงข้อความที่อัพเดทแล้ว
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // ส่งการอัพเดท reaction ไปยังสมาชิกในห้อง
      io.to(chatRoomId).emit("reaction_updated", {
        messageId,
        reactions: message.reactions,
        updatedBy: socket.userId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error handling reaction:", error);
      socket.emit("error", { message: "Failed to add reaction" });
    }
  });

  // ลบข้อความ
  socket.on("delete_message", async (data) => {
    try {
      const { messageId, chatRoomId, deleteFor } = data;

      // ส่งการแจ้งเตือนไปยังสมาชิกในห้อง
      io.to(chatRoomId).emit("message_deleted", {
        messageId,
        deletedBy: socket.userId,
        deleteFor,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error handling message deletion:", error);
    }
  });

  // แก้ไขข้อความ
  socket.on("edit_message", async (data) => {
    try {
      const { messageId, newContent, chatRoomId } = data;
      const { Message } = require("./schemas/v1/chat.schema");

      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // ส่งการแจ้งเตือนไปยังสมาชิกในห้อง
      io.to(chatRoomId).emit("message_edited", {
        messageId,
        newContent,
        editedBy: socket.userId,
        isEdited: true,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error handling message edit:", error);
    }
  });

  // อัพเดทสถานะการอ่าน
  socket.on("mark_as_read", async (data) => {
    try {
      const { chatRoomId, messageId } = data;
      const { ChatRoom, Message } = require("./schemas/v1/chat.schema");

      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (chatRoom) {
        // รีเซ็ต unread count
        chatRoom.resetUnreadCount(socket.userId);
        await chatRoom.save();

        // ถ้าระบุ messageId ให้อัพเดท read status
        if (messageId) {
          const message = await Message.findById(messageId);
          if (message) {
            const existingRead = message.readBy.find(r => r.userId.toString() === socket.userId);
            if (!existingRead) {
              message.readBy.push({
                userId: socket.userId,
                readAt: new Date()
              });
              await message.save();
            }
          }
        }
      }

      // แจ้งสมาชิกในห้องว่ามีการอ่านข้อความ
      socket.to(chatRoomId).emit("message_read", {
        userId: socket.userId,
        chatRoomId,
        readAt: new Date()
      });

      // ส่ง unread count ที่อัพเดทแล้วกลับไปยังผู้ใช้
      socket.emit("unread_count_reset", {
        chatRoomId,
        unreadCount: 0
      });

    } catch (error) {
      console.error("Error handling read status:", error);
    }
  });

  // อัพเดทสถานะ online/offline
  socket.on("update_status", (data) => {
    try {
      const { status } = data; // "online", "away", "busy", "invisible"
      
      if (onlineUsers.has(socket.userId)) {
        const userInfo = onlineUsers.get(socket.userId);
        userInfo.status = status;
        userInfo.lastSeen = new Date();
        onlineUsers.set(socket.userId, userInfo);
      }

      // แจ้งเพื่อนเกี่ยวกับการเปลี่ยนสถานะ
      socket.broadcast.emit("user_status_updated", {
        userId: socket.userId,
        status,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Error updating status:", error);
    }
  });

  // อัพเดทสถานะ delivery
  socket.on("mark_as_delivered", async (data) => {
    try {
      const { messageId } = data;
      const { Message } = require("./schemas/v1/chat.schema");

      const message = await Message.findById(messageId);
      if (message) {
        const existingDelivered = message.deliveredTo.find(
          d => d.userId.toString() === socket.userId
        );

        if (!existingDelivered) {
          message.deliveredTo.push({
            userId: socket.userId,
            deliveredAt: new Date()
          });
          await message.save();

          // แจ้งผู้ส่งว่าข้อความถูกส่งถึงแล้ว
          const senderSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === message.sender.toString());
          
          if (senderSocket) {
            senderSocket.emit("message_delivered", {
              messageId,
              deliveredTo: socket.userId,
              deliveredAt: new Date()
            });
          }
        }
      }

    } catch (error) {
      console.error("Error handling delivery status:", error);
    }
  });

  // ขอข้อมูล unread count ทั้งหมด
  socket.on("get_total_unread", async () => {
    try {
      const { ChatRoom } = require("./schemas/v1/chat.schema");
      
      const chatRooms = await ChatRoom.find({
        "participants.userId": socket.userId,
        "participants.isActive": true,
        status: "active"
      });

      let totalUnread = 0;
      const roomUnreadCounts = [];

      chatRooms.forEach(room => {
        const unreadCount = room.getUnreadCount(socket.userId);
        totalUnread += unreadCount;
        
        if (unreadCount > 0) {
          roomUnreadCounts.push({
            chatRoomId: room._id,
            chatRoomName: room.name,
            unreadCount
          });
        }
      });

      socket.emit("total_unread_count", {
        totalUnreadCount: totalUnread,
        unreadRooms: roomUnreadCounts.length,
        roomDetails: roomUnreadCounts
      });

    } catch (error) {
      console.error("Error getting total unread:", error);
    }
  });

  // ขอข้อมูล user ที่ online
  socket.on("get_online_users", () => {
    try {
      const onlineUsersList = Array.from(onlineUsers.values());
      socket.emit("online_users", onlineUsersList);
    } catch (error) {
      console.error("Error getting online users:", error);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    if (socket.userId) {
      // ลบจากรายชื่อ online users
      onlineUsers.delete(socket.userId);
      
      // แจ้งเพื่อนว่า user offline
      socket.broadcast.emit("user_offline", {
        userId: socket.userId,
        lastSeen: new Date()
      });

      // แจ้งห้องแชทที่เข้าร่วมอยู่
      if (socket.currentChatRoom) {
        socket.to(socket.currentChatRoom).emit("user_left_chat", {
          userId: socket.userId,
          chatRoomId: socket.currentChatRoom,
          timestamp: new Date()
        });
      }
    }
  });

  // Error handling
  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

const { webhookHandler } = require("./controllers/activityOrderControllers");
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    console.log("📦 isBuffer?", Buffer.isBuffer(req.body));
    next();
  }, //t
  webhookHandler
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//! V1 Endpoints
//? Index Endpoints
const v1IndexRouter = require("./routes/v1/indexRoutes");
app.use("/api/v1", v1IndexRouter);

//? Auth Endpoints
const v1AuthRouter = require("./routes/v1/authRoutes");
app.use("/api/v1/auth", v1AuthRouter);

//? Order Endpoints
const { router: v1OrderRouter } = require("./routes/v1/activityOrderRoutes")(
  io
);
app.use("/api/v1/activity-order", v1OrderRouter);

//? Account Endpoints
const v1AccountRouter = require("./routes/v1/accountsRoutes");
app.use("/api/v1/accounts", v1AccountRouter);

//? OSS Endpoints
const v1FileUploadRouter = require("./routes/v1/fileUploadRoutes");
app.use("/api/v1/fileupload", v1FileUploadRouter);

//? Post Endpoint
const v1PostRouter = require("./routes/v1/postRoutes");
app.use("/api/v1/post", v1PostRouter);

const v1EventRouter = require("./routes/v1/eventRoutes");
app.use("/api/v1/event", v1EventRouter);

const v1CouponRouter = require("./routes/v1/couponRoutes");
app.use("/api/v1/coupon", v1CouponRouter);

const v1TableRouter = require("./routes/v1/tableRoutes");
app.use("/api/v1/table", v1TableRouter);

const v1VenueRouter = require("./routes/v1/venueRoutes");
app.use("/api/v1/venue", v1VenueRouter);

const v1productRoutes = require("./routes/v1/productRoutes");
app.use("/api/v1/product", v1productRoutes);

//? Deal Admin Endpoints
const v1DealRouter = require("./routes/v1/dealRoutes");
app.use("/api/v1/deal", v1DealRouter);

//? User-Claimed Deal Endpoints
const v1UserDealRouter = require("./routes/v1/userDealRoutes");
app.use("/api/v1/user-deal", v1UserDealRouter);

//? affiliateTracking
app.use("/api/v1/affiliate", require("./routes/v1/affiliateTrackingRoutes"));

//? discountCodeRoutes
const discountCodeRoutes = require("./routes/v1/discountCodeRoutes");
app.use("/api/v1/discount-code", discountCodeRoutes);

//? activitySlotRoutes
const activitySlotRoutes = require("./routes/v1/activitySlotRoutes");
app.use("/api/v1/activity-slot", activitySlotRoutes);

//? subscriptionRoutes
const subscriptionRoutes = require("./routes/v1/subscriptionRoutes");
app.use("/api/v1/subscription", subscriptionRoutes);

//? subscription cron jobs
const { startAllSubscriptionJobs } = require("./jobs/subscriptionJobs");
if (process.env.NODE_ENV !== 'test') {
  startAllSubscriptionJobs();
}

const { serverAdapter } = require("./queues/dashboard");
app.use(
  "/admin/queues",
  basicAuth({
    users: {
      [process.env.BULLBOARD_USER]: process.env.BULLBOARD_PASS,
    },
    challenge: true,
  }),
  serverAdapter.getRouter()
);

//? Webhook
const v1WebhookRouter = require("./routes/v1/webhookRoutes");
app.use("/api/v1", v1WebhookRouter);

//? Post Endpoint
const activityRoutes = require("./routes/v1/activityRoutes");
const v1ActivityRouter = activityRoutes(io);
app.use("/api/v1/activity", v1ActivityRouter);

//? Chat Endpoints
const v1ChatRouter = require("./routes/v1/chatRoutes");
app.use("/api/v1/chat", v1ChatRouter);

//? Privacy & Block Endpoints
const v1PrivacyRouter = require("./routes/v1/privacyRoutes");
app.use("/api/v1/privacy", v1PrivacyRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = { app, server, io };
