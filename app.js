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

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  socket.on("joinActivity", (chatRoomId) => {
    socket.join(chatRoomId);
    console.log(`${socket.id} joined activity ${chatRoomId}`);
  });

  socket.on("message", ({ activityId, message }) => {});

  socket.on("leaveActivity", (chatRoomId) => {
    socket.leave(chatRoomId);
    console.log(`${socket.id} left activity ${chatRoomId}`);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
  });

  socket.on("reaction", (data) => {
    io.to(data.chatRoomId).emit("reaction", data);
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
const { router: v1OrderRouter } = require("./routes/v1/activityOrderRoutes")(io);
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

//? Webhook
const v1WebhookRouter = require("./routes/v1/webhookRoutes");
app.use("/api/v1", v1WebhookRouter);

//? Post Endpoint
const activityRoutes = require("./routes/v1/activityRoutes");
const v1ActivityRouter = activityRoutes(io);
app.use("/api/v1/activity", v1ActivityRouter);

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
