const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const passport = require("passport");
const bodyParser = require("body-parser");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");

require("../middlewares/passport/passport-local");
//require('../middlewares/passport/passport-jwt');
require("../middlewares/passport/passport-google");
require("../middlewares/passport/passport-line");

require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

const redis = require("../app");

const sendEmail = require("../modules/email/sendVerifyEmail");
const sendEmailForgot = require("../modules/email/sendEmailForgot");

const User = require("../schemas/v1/user.schema");
const user = require("../schemas/v1/user.schema");
const regularUserData = require("../schemas/v1/userData/regularUserData.schema");
const organizationUserData = require("../schemas/v1/userData/organizationUserData.schema");
const contactInfoSchema = require("../schemas/v1/contact.schema");
const addressSchema = require("../schemas/v1/address.schema");

const generateAffiliateCode = (length = 8) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const register = async (req, res) => {
  if (!req.body) {
    res
      .status(400)
      .send({ status: "error", message: "Body can not be empty!" });
    return;
  }

  if (!req.body.name) {
    res
      .status(400)
      .send({ status: "error", message: "Name can not be empty!" });
    return;
  }

  if (!req.body.email) {
    res
      .status(400)
      .send({ status: "error", message: "Email can not be empty!" });
    return;
  }

  if (!req.body.password) {
    res
      .status(400)
      .send({ status: "error", message: "Password can not be empty!" });
    return;
  }

  const businessId = req.headers["businessid"];
  if (!businessId) {
    res
      .status(400)
      .send({ status: "error", message: "Business ID can not be empty!" });
    return;
  }

  try {
    let findUser = await user.findOne({
      "user.email": req.body.email,
      businessId: businessId,
    });

    let rawPassword = req.body.password;
    let hashedPassword = await bcrypt.hash(rawPassword, 10);

    let generatedUserId = uuidv4();

    let email = req.body.email;

    let userType = req.body.userType ? req.body.userType : "regular";
    let userData = req.body.userData ? req.body.userData : {};

    if (!findUser) {
      let userDataDocument;
      let userTypeDataValue =
        userType === "regular" ? "RegularUserData" : "OrganizationUserData";

      if (userType === "regular") {
        userDataDocument = new regularUserData(userData);
      } else if (userType === "Organization") {
        userDataDocument = new organizationUserData(userData);
      }
      await userDataDocument.save(); // บันทึก userData

      new user({
        user: {
          name: req.body.name,
          email: req.body.email,
          password: hashedPassword,
        },
        userType: userType,
        userData: userDataDocument._id,
        userTypeData: userTypeDataValue,
        businessId: businessId,
        affiliateCode: generateAffiliateCode(), // 👈 เพิ่มตรงนี้
      })
        .save()
        .then(async (user) => {
          let activationToken = crypto.randomBytes(32).toString("hex");
          let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();

          await redis.hSet(
            email,
            {
              token: activationToken,
              ref: refKey,
            },
            { EX: 600 }
          );
          await redis.expire(email, 600);

          const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;
          //const link = `https://hiddengemtech.com/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;
          const capitalizedName =
            process.env.DATABASE_NAME.charAt(0).toUpperCase() +
            process.env.DATABASE_NAME.slice(1);
          await sendEmail(email, `Verify Email For ${capitalizedName}`, link);

          res.status(201).send({
            status: "success",
            message: "Successfully Registered! Please confirm email address.",
            data: {
              ...user.toObject(),
              userId: user._id,
            },
          });
        })
        .catch((err) =>
          res.status(500).send({
            status: "error",
            message:
              err.message || "Some error occurred while registering user.",
          })
        );
    } else {
      res.status(409).send({
        status: "error",
        message: "User already existed. Please Login instead",
      });
    }
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send({ status: "error", message: "Internal server error." });
  }
};

// Dev:Oreq
const forgotPassword = async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();

  if (!email) {
    return res.status(400).send({
      status: "error",
      message: "Email is required",
    });
  }

  try {
    const userData = await user.findOne({ "user.email": email });

    if (!userData) {
      return res.status(404).send({
        status: "error",
        message: "Email not found in the system",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetRef = crypto.randomBytes(2).toString("hex").toUpperCase();

    await redis.hSet(email, {
      resetToken: resetToken,
      resetRef: resetRef,
    }, { EX: 600 }); // TTL 10 นาที
    await redis.expire(email, 600); // backup ซ้ำอีกชั้น

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?email=${email}&ref=${resetRef}&token=${resetToken}`;


    const capitalizedAppName =
      process.env.DATABASE_NAME.charAt(0).toUpperCase() +
      process.env.DATABASE_NAME.slice(1);

    await sendEmailForgot(
      email,
      `Reset Password for ${capitalizedAppName}`,
      resetLink
    );

    return res.status(200).send({
      status: "success",
      message: "Password reset link has been sent to your email.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send({
      status: "error",
      message: "Something went wrong. Please try again.",
    });
  }
};

const resetPassword = async (req, res) => {
  const { email, token, ref, password } = req.body;
  console.log("📩 Incoming reset password request:", { email, token, ref });

  if (!email || !token || !ref || !password) {
    console.log("❌ Missing required fields");
    return res.status(400).send({
      status: "error",
      message: "Missing required fields.",
    });
  }

  try {
    const storedData = await redis.hGetAll(email);
    console.log("🧠 Redis stored data for email:", email, storedData);

    if (!storedData || !storedData.resetToken || !storedData.resetRef) {
      console.log("⛔ Reset token not found or expired");
      return res.status(400).send({
        status: "error",
        message: "Reset token expired or invalid.",
      });
    }

    if (storedData.resetToken !== token || storedData.resetRef !== ref) {
      console.log("⚠️ Token or ref mismatch", {
        received: { token, ref },
        stored: storedData,
      });
      return res.status(400).send({
        status: "error",
        message: "Invalid reset token or reference.",
      });
    }

    const userDoc = await user.findOne({ "user.email": email });
    console.log("🔍 Found user:", userDoc?.user?.email);

    if (!userDoc) {
      console.log("❌ User not found in DB");
      return res.status(404).send({
        status: "error",
        message: "User not found.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    userDoc.user.password = hashedPassword;
    await userDoc.save();
    console.log("✅ Password updated successfully for:", email);

    await redis.del(email);
    console.log("🧹 Redis token deleted for email:", email);

    return res.status(200).send({
      status: "success",
      message: "Password has been reset successfully.",
    });
  } catch (error) {
    console.error("💥 Internal error in resetPassword:", error);
    return res.status(500).send({
      status: "error",
      message: "Internal server error.",
    });
  }
};

//-----
const login = async (req, res, next) => {
  // ตรวจสอบว่า device fingerprint ถูกส่งมาหรือไม่
  if (!req.headers["device-fingerprint"]) {
    return res
      .status(401)
      .send({ status: "error", message: "Device fingerprint is required!" });
  }

  // ตรวจสอบว่า username หรือ password ถูกส่งมาหรือไม่
  if (!req.body.email || !req.body.password) {
    return res.status(400).send({
      status: "error",
      message: "Email and password are required!",
    });
  }

  const deviceFingerprint = req.headers["device-fingerprint"];
  const businessId = req.headers["businessid"];

  if (!businessId) {
    return res
      .status(400)
      .send({ status: "error", message: "Business ID is required!" });
  }

  passport.authenticate(
    "local",
    { session: false },
    async (err, foundUser, info) => {
      if (err) return next(err);

      if (foundUser) {
        console.log("login : found user");

        const loggedInDevices = foundUser.loggedInDevices || [];
        if (loggedInDevices.length >= 50) {
          return res
            .status(403)
            .send({ status: "error", message: "Login limit exceeded." });
        }

        const foundUserEmail = foundUser.user.email;
        const foundUserId = foundUser.id;
        const foundUserAffiliateCode = foundUser.affiliateCode || "";
        const accessToken = jwt.sign(
          {
            userId: foundUserId,
            name: foundUser.user.name,
            email: foundUserEmail,
            businessId: businessId,
            affiliateCode: foundUserAffiliateCode,
            role: foundUser.role ?? "user",
          },
          process.env.JWT_ACCESS_TOKEN_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
        );
        const refreshToken = jwt.sign(
          {
            userId: foundUserId,
            name: foundUser.user.name,
            email: foundUserEmail,
            businessId: businessId,
            role: foundUser.role,
            userData: foundUser.userData?.toString(), // ✅ เพิ่มตรงนี้
          },
          process.env.JWT_REFRESH_TOKEN_SECRET,
          { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
        );

        await redis.sAdd(
          `Device_Fingerprint_${foundUserId}`,
          deviceFingerprint
        );

        redis.set(`Last_Login_${foundUserId}_${deviceFingerprint}`, Date.now());

        let length = 6,
          charset = "0123456789",
          refreshTokenOTP = "";
        for (let i = 0, n = charset.length; i < length; ++i) {
          refreshTokenOTP += charset.charAt(Math.floor(Math.random() * n));
        }

        redis.set(
          `Last_Refresh_Token_OTP_${foundUserId}_${deviceFingerprint}`,
          refreshTokenOTP
        );
        redis.set(
          `Last_Refresh_Token_${foundUserId}_${deviceFingerprint}`,
          refreshToken
        );
        
        // Log การบันทึก Access Token ลง Redis
        const redisKey = `Last_Access_Token_${foundUserId}_${deviceFingerprint}`;
        console.log(`📝 LOGIN: Saving Access Token to Redis with key: ${redisKey}`);
        console.log(`📝 LOGIN: Access Token: ${accessToken}`);
        
        redis.set(redisKey, accessToken);
        
        console.log(`✅ LOGIN: Access Token saved to Redis successfully`);

        res.cookie("accessToken", accessToken, {
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.cookie("refreshToken", refreshToken, {
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const deviceIndex = loggedInDevices.findIndex(
          (device) => device.deviceFingerprint === deviceFingerprint
        );

        if (deviceIndex === -1) {
          await User.updateOne(
            { _id: foundUser._id },
            {
              $push: {
                loggedInDevices: {
                  deviceFingerprint: deviceFingerprint,
                  lastLogin: Date.now(),
                },
              },
            }
          );
        } else {
          loggedInDevices[deviceIndex].lastLogin = Date.now();
          await User.updateOne(
            { _id: foundUser._id },
            { $set: { loggedInDevices: loggedInDevices } }
          );
        }

        res.status(200).send({
          status: "success",
          message: "Successfully Login",
          data: {
            userId: foundUser._id,
            user: {
              name: foundUser.user.name,
              role: foundUser.role ?? "user",
              email: foundUserEmail,
              phone: foundUser.user.phone,
              activated: foundUser.user.activated,
              verified: {
                email: foundUser.user.verified.email,
                phone: foundUser.user.verified.phone,
              },
            },
            imageURL: foundUser.user.imageURL,
            tokens: {
              accessToken: accessToken,
              refreshToken: refreshToken,
              refreshTokenOTP: refreshTokenOTP,
            },
          },
        });
      } else {
        return res
          .status(info.statusCode)
          .send({ status: "error", message: info.message });
      }
    }
  )(req, res, next);
};

const googleWebLogin = async (req, res) => {
  const { token } = req.body;
  const deviceFingerprint = req.headers["device-fingerprint"];
  const businessId = req.headers["businessid"];

  if (!token || !deviceFingerprint || !businessId) {
    return res.status(400).json({
      status: "error",
      message: "Missing token, fingerprint, or business ID",
    });
  }

  try {
    const userInfoRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { email, name, picture } = userInfoRes.data;

    let user = await User.findOne({ "user.email": email });

    if (!user) {
      const userDataDoc = await regularUserData.create({
        businessId,
        profileImage: picture,
        contactSocial: [],
        imageUrl: [],
        education: [],
        workPlace: [],
        address: [],
        status: [],
        level: [],
        prefs: [],
        badges: [],
        monthlyRank: [],
        numPost: 0,
        numFollower: 0,
        numFollowing: 0,
        numNotification: 0,
        numUnread: 0,
        numCoin: 0,
      });

      user = await User.create({
        user: {
          name,
          email,
          imageURL: picture,
          activated: true,
          verified: { email: true, phone: false },
        },
        role: "user",
        userType: "regular",
        userTypeData: "RegularUserData",
        userData: userDataDoc._id,
        affiliateCode: generateAffiliateCode(),
        provider: "google",
        businessId,
        loggedInDevices: [],
      });
    }

    const userId = user._id;

    const accessToken = jwt.sign(
      {
        userId,
        name: user.user.name,
        email: user.user.email,
        businessId,
        role: user.role ?? "user",
        affiliateCode: user.affiliateCode,
        userData: user.userData?.toString(),
      },
      process.env.JWT_ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        name: user.user.name,
        email: user.user.email,
        businessId,
        role: user.role ?? "user",
      },
      process.env.JWT_REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
    );

    await redis.sAdd(`Device_Fingerprint_${userId}`, deviceFingerprint);
    await redis.set(`Last_Login_${userId}_${deviceFingerprint}`, Date.now());

    const refreshTokenOTP = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    await redis.set(
      `Last_Refresh_Token_OTP_${userId}_${deviceFingerprint}`,
      refreshTokenOTP
    );
    await redis.set(
      `Last_Refresh_Token_${userId}_${deviceFingerprint}`,
      refreshToken
    );
    // Log การบันทึก Access Token ลง Redis สำหรับ Google Login
    const googleRedisKey = `Last_Access_Token_${userId}_${deviceFingerprint}`;
    console.log(`📝 GOOGLE LOGIN: Saving Access Token to Redis with key: ${googleRedisKey}`);
    console.log(`📝 GOOGLE LOGIN: Access Token: ${accessToken}`);
    
    await redis.set(googleRedisKey, accessToken);
    
    console.log(`✅ GOOGLE LOGIN: Access Token saved to Redis successfully`);

    res.cookie("accessToken", accessToken, {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const deviceIndex = user.loggedInDevices.findIndex(
      (d) => d.deviceFingerprint === deviceFingerprint
    );

    if (deviceIndex === -1) {
      user.loggedInDevices.push({
        deviceFingerprint,
        lastLogin: Date.now(),
      });
    } else {
      user.loggedInDevices[deviceIndex].lastLogin = Date.now();
    }

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Google Login Success",
      data: {
        userId: user._id,
        user: {
          name: user.user.name,
          role: user.role ?? "user",
          email: user.user.email,
          phone: user.user.phone,
          activated: user.user.activated,
          verified: user.user.verified,
        },
        imageURL: user.user.imageURL,
        tokens: {
          accessToken,
          refreshToken,
          refreshTokenOTP,
        },
      },
    });
  } catch (error) {
    console.error(
      "Google login error:",
      error?.response?.data || error.message
    );
    return res.status(401).json({
      status: "error",
      message: "Invalid Google token or user creation failed",
    });
  }
};

const logout = async (req, res, next) => {
  console.log("logout function started");

  if (!req.headers["device-fingerprint"]) {
    console.log("Missing device-fingerprint");
    return res
      .status(401)
      .send({ status: "error", message: "Device fingerprint is required!" });
  }

  const deviceFingerprint = req.headers["device-fingerprint"];
  const businessId = req.headers["businessid"];

  if (!businessId) {
    console.log("Missing businessId");
    return res
      .status(400)
      .send({ status: "error", message: "Business ID is required!" });
  }

  const userId = req.user.userId;

  try {
    // Find user by userId
    const foundUser = await User.findById(userId);

    if (!foundUser) {
      return res
        .status(404)
        .send({ status: "error", message: "User not found" });
    }

    // Remove device from loggedInDevices
    const updatedDevices = foundUser.loggedInDevices.filter(
      (device) => device.deviceFingerprint !== deviceFingerprint
    );

    // Update user with filtered devices
    await User.updateOne(
      { _id: foundUser._id },
      { $set: { loggedInDevices: updatedDevices } }
    );

    // Remove related data from Redis
    await redis.sRem(`Device_Fingerprint_${userId}`, deviceFingerprint);
    await redis.del(`Last_Login_${userId}_${deviceFingerprint}`);
    await redis.del(`Last_Refresh_Token_OTP_${userId}_${deviceFingerprint}`);
    await redis.del(`Last_Refresh_Token_${userId}_${deviceFingerprint}`);
    await redis.del(`Last_Access_Token_${userId}_${deviceFingerprint}`);

    res.status(200).send({
      status: "success",
      message: "Successfully Logged Out",
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  //console.log('req.user', req.user);

  const accessToken = jwt.sign(
    {
      userId: req.user.userId,
      name: req.user.name,
      email: req.user.email,
      businessId: req.user.businessId,
      role: req.role ?? "user",
      affiliateCode: req.user.affiliateCode,
      userData: req.user.userData?.toString(), // ✅ เพิ่มตรงนี้เช่นกัน
    },
    process.env.JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
  );
  redis.set(
    `Last_Access_Token_${req.user.userId}_${req.headers["hardware-id"]}`,
    accessToken
  );

  //const foundUser = await user.findOneAndUpdate({ userId: req.user.userId }, { 'user.token': accessToken }, { useFindAndModify: false, new: true });

  return res.status(200).send({
    status: "success",
    message: "New access token has been generated",
    data: {
      user: {
        userId: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        businessId: req.user.businessId,
        role: req.role ?? "user",
      },
      tokens: {
        accessToken: accessToken,
        //refreshToken: foundUser.user.token
      },
    },
  });
};

const refreshWeb = async (req, res, next) => {
  const cookieAccessToken = req.cookies.accessToken;
  const cookieRefreshToken = req.cookies.refreshToken;

  const accessToken = jwt.sign(
    {
      userId: req.user.userId,
      name: req.user.name,
      email: req.user.email,
      businessId: req.user.businessId,
      role: req.user.role,
      affiliateCode: req.user.affiliateCode,
      userData: req.user.userData?.toString(), // ✅ เพิ่มตรงนี้เช่นกัน
    },
    process.env.JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
  );
  // console.log("new accessToken =", accessToken);
  redis.set(
    `Last_Access_Token_${req.user.userId}_${req.headers["device-fingerprint"]}`,
    accessToken
  );
  res.cookie("accessToken", accessToken, {
    path: "/",
    httpOnly: true,
    secure: false, // ใช้ true สำหรับ HTTPS
    sameSite: "lax", // None เพื่อให้สามารถใช้งานข้ามโดเมนได้หากจำเป็น
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  //const foundUser = await user.findOneAndUpdate({ userId: req.user.userId }, { 'user.token': accessToken }, { useFindAndModify: false, new: true });

  return res.status(200).send({
    status: "success",
    message: "New Cookie accessToken has been generated",
    data: {
      user: {
        test: "333",
        userId: req.user.userId,
        role: req.user.role ?? "user",
        name: req.user.name,
        email: req.user.email,
        businessId: req.user.businessId,
        affiliateCode: req.user.affiliateCode,
      },
      tokens: {
        accessToken: accessToken,
        //refreshToken: foundUser.user.token
      },
    },
  });
};

const googleCallback = async (req, res, next) => {
  res
    .status(200)
    .send({ status: "success", message: req.authInfo, user: req.user });
};

/*User.findOne({ 'socials.google.userId': profile.id }).then(existingUser => {

    if (existingUser) {
        return cb(null, existingUser, { status: 'success', message: 'Existing user authenticated via Google.'});
    } else {
        
        new User({
            userId: uuidv4(),
            user: {
                name: profile.displayName,
                email: profile._json.email,
                verified: {
                    email: profile._json.email_verified
                },
                activated: true
            },
            socials: {
                google: {
                    userId: profile.id,
                    name: profile.displayName,
                    email: profile._json.email,
                    imageUrl: profile._json.picture
                }
            } 
        }).save().then(async newUser => {

            return cb(null, newUser, { message: 'New user authenticated via Google.'});
        })
    }
    
})  */

const googleFlutterLogin = async (req, res) => {
  //return res.status(200).send({ status: 'success', message: 'Line Authenticated', user: req.user })
  let macAddressRegex = new RegExp(
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})|([0-9a-fA-F]{4}.[0-9a-fA-F]{4}.[0-9a-fA-F]{4})$/
  );

  if (!req.headers["mac-address"])
    return res
      .status(401)
      .send({ status: "error", message: "MAC address is required!" });

  if (!req.headers["hardware-id"])
    return res
      .status(401)
      .send({ status: "error", message: "Hardware ID is required!" });

  if (macAddressRegex.test(req.headers["mac-address"]) === false)
    return res
      .status(401)
      .send({ status: "error", message: "MAC address is invalid!" });

  const hardwareId = req.headers["hardware-id"];

  const { token } = req.body;
  console.log("token = " + token);
  console.log("CLIENT_ID = " + CLIENT_ID);
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    console.log("....... about to payload");
    const payload = ticket.getPayload();

    console.log("payload = " + JSON.stringify(payload, null, 2));

    let newUserId = uuidv4();
    let foundUser;
    let email = payload["email"];

    user.findOne({ "user.email": email }).then((existingUser) => {
      if (existingUser) {
        console.log(existingUser);
        if (existingUser.user.activated === false) {
          let activationToken = crypto.randomBytes(32).toString("hex");
          let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();
          redis.hSet(
            email,
            {
              token: activationToken,
              ref: refKey,
            },
            { EX: 600 }
          );
          redis.expire(email, 600);

          const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;

          sendEmail(email, "Verify Email For Healworld.me", link);

          //return res.status(406).send(null, false, { statusCode: 406, message: 'Email has not been activated. Email activation has been sent to your email. Please activate your email first.' })

          return res.status(406).send({
            message:
              "Email has not been activated. Email activation has been sent to your email. Please activate your email first.",
          });
        } else {
          const foundUser = existingUser;
          const foundUserEmail = foundUser.user.email;
          const foundUserId = foundUser.userId;

          //? JWT
          const accessToken = jwt.sign(
            {
              userId: foundUserId,
              name: foundUser.user.name,
              email: foundUserEmail,
            },
            process.env.JWT_ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
          );
          const refreshToken = jwt.sign(
            {
              userId: foundUserId,
              name: foundUser.user.name,
              email: foundUserEmail,
            },
            process.env.JWT_REFRESH_TOKEN_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
          );
          redis.sAdd(`Mac_Address_${foundUserId}`, req.headers["mac-address"]);
          redis.sAdd(`Hardware_ID_${foundUserId}`, req.headers["hardware-id"]);

          //? Add Last Login Date to Redis
          redis.set(`Last_Login_${foundUserId}_${hardwareId}`, Date.now());

          //? Add Refresh Token OTP to Redis

          let length = 6,
            charset = "0123456789",
            refreshTokenOTP = "";
          for (let i = 0, n = charset.length; i < length; ++i) {
            refreshTokenOTP += charset.charAt(Math.floor(Math.random() * n));
          }

          redis.set(
            `Last_Refresh_Token_OTP_${foundUserId}_${hardwareId}`,
            refreshTokenOTP
          );
          redis.set(
            `Last_Refresh_Token_${foundUserId}_${hardwareId}`,
            refreshToken
          );
          redis.set(
            `Last_Access_Token_${foundUserId}_${hardwareId}`,
            accessToken
          );

          res.status(200).send({
            status: "success",
            message: "Successfully Login",
            data: {
              userId: foundUser._id,
              user: {
                name: foundUser.user.name,
                email: foundUserEmail,
                phone: foundUser.user.phone,
                activated: foundUser.user.activated,
                verified: {
                  email: foundUser.user.verified.email,
                  phone: foundUser.user.verified.phone,
                },
              },
              imageURL: foundUser.user.imageURL,
              tokens: {
                accessToken: accessToken,
                refreshToken: refreshToken,
                refreshTokenOTP: refreshTokenOTP,
              },
            },
          });
        }
      } else {
        let userType = req.body.userType ? req.body.userType : "regular";
        let userData = req.body.userData ? req.body.userData : {};

        let userDataDocument;
        let userTypeDataValue =
          userType === "regular" ? "RegularUserData" : "OrganizationUserData";

        if (userType === "regular") {
          userDataDocument = new regularUserData(userData);
        } else if (userType === "Organization") {
          userDataDocument = new organizationUserData(userData);
        }
        userDataDocument.save(); // บันทึก userData

        new user({
          user: {
            name: payload["name"],
            email: payload["email"],
            password: uuidv4(),
          },
          userType: "regular",
          userData: userDataDocument._id,
          userTypeData: userTypeDataValue,
          businessId: "1",
        })
          .save()
          .then(async (user) => {
            let activationToken = crypto.randomBytes(32).toString("hex");
            let refKey = crypto.randomBytes(2).toString("hex").toUpperCase();

            await redis.hSet(
              email,
              {
                token: activationToken,
                ref: refKey,
              },
              { EX: 600 }
            );
            await redis.expire(email, 600);

            const link = `${process.env.BASE_URL}/api/v1/accounts/verify/email?email=${email}&ref=${refKey}&token=${activationToken}`;

            await sendEmail(email, "Verify Email For Healworld.me", link);

            res.status(201).send({
              status: "success",
              message: "Successfully Registered! Please confirm email address.",
              data: {
                ...user.toObject(),
                userId: user._id,
              },
            });
          })
          .catch((err) =>
            res.status(500).send({
              status: "error",
              message:
                err.message || "Some error occurred while registering user.",
            })
          );
      }
    });
  } catch (error) {
    console.log(error);
    res.status(401).send("Invalid token");
  }
};

const lineCallback = async (req, res) => {
  //console.log('Request Profile',req.user)
  res
    .status(200)
    .send({ status: "success", message: "Line Authenticated", user: req.user });
};

module.exports = {
  register,
  forgotPassword,
  resetPassword,
  login,
  logout,
  refresh,
  refreshWeb,
  googleCallback,
  lineCallback,
  googleFlutterLogin,
  googleWebLogin,
};
