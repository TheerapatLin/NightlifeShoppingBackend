const jwt = require("jsonwebtoken");
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const JWT_REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_TOKEN_SECRET;
const SUPER_ADMIN_API_KEY = process.env.SUPER_ADMIN_API_KEY;
const redis = require("../app");

const { TokenExpiredError } = jwt;

const accessTokenCatchError = (err, res) => {
  if (err instanceof TokenExpiredError) {
    return res
      .status(401)
      .send({ message: "UNAUTHORIZED! Access Token was expired!" });
  }
  return res.status(401).send({ message: "UNAUTHORIZED!" });
};

const refreshTokenCatchError = (err, res) => {
  if (err instanceof TokenExpiredError) {
    return res
      .status(401)
      .send({ message: "UNAUTHORIZED! Refresh Token was expired!" });
  }
  return res.status(401).send({ message: "UNAUTHORIZED!" });
};

const verifyAccessToken = async (req, res, next) => {
  const role = req.headers["role"];

  if (role != "superadmin") {
    let macAddressRegex = new RegExp(
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})|([0-9a-fA-F]{4}.[0-9a-fA-F]{4}.[0-9a-fA-F]{4})$/
    );

    //console.log("verifyAccessToken");
    if (!req.headers["device-fingerprint"]) {
      //console.log("Device-fingerprint is required!");
      return res
        .status(401)
        .send({ status: "error", message: "Device-fingerprint is required!" });
    } else {
      //console.log(req.headers["device-fingerprint"]);
    }

    if (!req.headers["authorization"]) {
      //console.log("TOKEN is required for authentication");
      return res.status(401).send({
        status: "error",
        message: "TOKEN is required for authentication",
      });
    }
    const accessToken = req.headers["authorization"].replace("Bearer ", "");

    jwt.verify(accessToken, JWT_ACCESS_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        return accessTokenCatchError(err, res);
      } else {
        // let hardwareIdIsMember = await redis.sIsMember(
        //   `Hardware_ID_${decoded.userId}`,
        //   req.headers["device-fingerprint"]
        // );

        // if (!MacAddressIsMember && !hardwareIdIsMember) {
        //   return res.status(401).send({
        //     status: "error",
        //     message: "Both Mac Address AND Hardware ID does not exist!",
        //   });
        // } else if (!MacAddressIsMember) {
        //   return res
        //     .status(401)
        //     .send({ status: "error", message: "Mac Address does not exist!" });
        // } else if (!hardwareIdIsMember) {
        //   return res
        //     .status(401)
        //     .send({ status: "error", message: "Hardware ID does not exist!" });
        // }
        const lastAccessToken = await redis.get(
          `Last_Access_Token_${decoded.userId}_${req.headers["device-fingerprint"]}`
        );
        if (lastAccessToken !== accessToken) {
          return res
            .status(401)
            .send({ status: "error", message: `Incorrect Access Token!` });
        }
      }
      req.user = decoded;
      return next();
    });
  } else {
    const superAdminApiKey = req.headers["x-super-admin-api-key"];
    if (
      superAdminApiKey &&
      superAdminApiKey === process.env.SUPER_ADMIN_API_KEY
    ) {
      //console.log("you are in super admin mode : (from verifyAccessToken)");
      return next();
    } else {
      return res
        .status(403)
        .json({ message: "Unauthorized: Invalid API key for super admin" });
    }
  }
};

const verifyAccessTokenWeb = async (req, res, next) => {
  // Try to get access token from cookie first, then from Authorization header
  const cookieAccessToken = req.cookies.accessToken;
  const authHeader = req.headers.authorization;
  const headerAccessToken = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  // Use cookie token if available, otherwise use header token
  const accessToken = cookieAccessToken || headerAccessToken;
  
  const cookieRefreshToken = req.cookies.refreshToken;
  const role = req.headers["role"];

  if (role != "superadmin") {
    let macAddressRegex = new RegExp(
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})|([0-9a-fA-F]{4}.[0-9a-fA-F]{4}.[0-9a-fA-F]{4})$/
    );
    console.log("----- verifyAccessTokenWeb ");
    console.log(`----- cookieAccessToken = ${cookieAccessToken}`);
    console.log(`----- headerAccessToken = ${headerAccessToken}`);
    console.log(`----- accessToken = ${accessToken}`);
    
    if (!req.headers["device-fingerprint"]) {
      //console.log("Device-fingerprint is required!");
      return res
        .status(401)
        .send({ status: "error", message: "Device-fingerprint is required!" });
    } else {
      console.log(`----- device-fingerprint = ${req.headers["device-fingerprint"]}`);
    }

    if (!accessToken) {
      //console.log("AccessToken is required for authentication (from cookie or Authorization header)");
      return res.status(401).send({
        status: "error",
        message: "AccessToken is required for authentication (from cookie or Authorization header)",
      });
    }

    jwt.verify(
      accessToken,
      JWT_ACCESS_TOKEN_SECRET,
      async (err, decoded) => {
        if (err) {
          return accessTokenCatchError(err, res);
        } else {

          console.log(`----- decoded.userId = ${decoded.userId}`);
          const redisKey = `Last_Access_Token_${decoded.userId}_${req.headers["device-fingerprint"]}`;
          console.log(`----- Redis Key = ${redisKey}`);
          const lastAccessToken = await redis.get(redisKey);
          console.log(`----- lastAccessToken from Redis = ${lastAccessToken}`);
          console.log(`----- Current accessToken = ${accessToken}`);
          console.log(`----- Tokens match? = ${lastAccessToken === accessToken}`);
          
          if (lastAccessToken !== accessToken) {
            console.log(`❌ Token mismatch! Returning 401`);
            return res.status(401).send({
              status: "error",
              message: `Incorrect Access Token! lastAccessToken = ${lastAccessToken}`,
            });
          } else {
            console.log(`✅ Tokens match! Proceeding...`);
          }
        }
        //console.log(`decode = ${JSON.stringify(decoded)}`);
        req.user = decoded;
        return next();
      }
    );
  } else {
    const superAdminApiKey = req.headers["x-super-admin-api-key"];
    if (
      superAdminApiKey &&
      superAdminApiKey === process.env.SUPER_ADMIN_API_KEY
    ) {
      //console.log("you are in super admin mode : (from verifyAccessToken)");
      return next();
    } else {
      return res
        .status(403)
        .json({ message: "Unauthorized: Invalid API key for super admin" });
    }
  }
};

const verifyAccessTokenWebPass = async (req, res, next) => {
  const cookieAccessToken = req.cookies.accessToken;
  const cookieRefreshToken = req.cookies.refreshToken;

  const role = req.headers["role"];

  if (role != "superadmin") {
    let macAddressRegex = new RegExp(
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})|([0-9a-fA-F]{4}.[0-9a-fA-F]{4}.[0-9a-fA-F]{4})$/
    );
    if (!req.headers["device-fingerprint"]) {
      return res
        .status(401)
        .send({ status: "error", message: "Device-fingerprint is required!" });
    } else {
      //console.log(req.headers["device-fingerprint"]);
    }

    if (!cookieAccessToken) {
      return res.status(401).send({
        status: "error",
        message: "Cookie AccessToken is required for authentication",
      });
    }

    jwt.verify(
      cookieAccessToken,
      JWT_ACCESS_TOKEN_SECRET,
      async (err, decoded) => {
        req.user = decoded;
        if (err) {
          req.user = null;
          //return accessTokenCatchError(err, res);
        } else {
          const lastAccessToken = await redis.get(
            `Last_Access_Token_${decoded.userId}_${req.headers["device-fingerprint"]}`
          );
          if (lastAccessToken !== cookieAccessToken) {
            req.user = null;
            // return res.status(401).send({
            //   status: "error",
            //   message: `Incorrect Access Token! lastAccessToken = ${lastAccessToken}`,
            // });
          }
        }
        
        return next();
      }
    );
  } else {
    const superAdminApiKey = req.headers["x-super-admin-api-key"];
    if (
      superAdminApiKey &&
      superAdminApiKey === process.env.SUPER_ADMIN_API_KEY
    ) {
      return next();
    } else {
      return res
        .status(403)
        .json({ message: "Unauthorized: Invalid API key for super admin" });
    }
  }
};

const authRoles = (requiredRoles) => (req, res, next) => {
  const role = req.user.role; // ✅ ใช้ req.headers แทน req.header
  //console.log(`user role = ${role}`);
  if (!role || !requiredRoles.includes(role)) {
    // ✅ เช็ก role ให้ถูกต้อง
    return res.status(403).json({ message: "Access denied" });
  }

  next(); // ✅ ให้ผ่านต่อไปเมื่อ role ถูกต้อง
};

const verifyRefreshToken = (req, res, next) => {
  if (!req.headers["authorization"])
    return res.status(401).send({
      status: "error",
      message: "TOKEN is required for authentication",
    });

  const refreshToken = req.headers["authorization"].replace("Bearer ", "");
  const hardwareID = req.headers["hardware-id"];

  jwt.verify(refreshToken, JWT_REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      return refreshTokenCatchError(err, res);
    } else {
      let savedRefreshToken = await redis.get(
        `Last_Refresh_Token_${decoded.userId}_${hardwareID}`,
        refreshToken
      );

      if (savedRefreshToken !== refreshToken) {
        return res
          .status(401)
          .send({ status: "error", message: "Incorrect Refresh Token!" });
      }

      req.user = decoded;
      return next();
    }
  });
};

const verifyAPIKey = (req, res, next) => {
  const apiKey = req.headers["authorization"];
  if (!apiKey) {
    return res
      .status(401)
      .json({ success: false, error: "API Key is required" });
  }
  // ตรวจสอบ API Key (ในที่นี้ใช้ค่าตายตัว ควรเปลี่ยนเป็นการตรวจสอบจากฐานข้อมูลหรือ env ในการใช้งานจริง)
  if (apiKey !== SUPER_ADMIN_API_KEY) {
    return res.status(403).json({ success: false, error: "Invalid API Key" });
  }
  next();
};

// JWT middleware สำหรับ Chat/Privacy (ไม่ต้องใช้ device-fingerprint)
const verifyJWT = (req, res, next) => {
  if (!req.headers["authorization"]) {
    return res.status(401).send({
      status: "error",
      message: "TOKEN is required for authentication",
    });
  }

  const token = req.headers["authorization"].replace("Bearer ", "");

  jwt.verify(token, JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return accessTokenCatchError(err, res);
    } else {
      req.user = decoded;
      return next();
    }
  });
};

module.exports = {
  verifyAccessToken,
  verifyToken: verifyAccessToken, // Alias for backward compatibility
  verifyJWT, // สำหรับ Chat/Privacy routes
  verifyRefreshToken,
  verifyAPIKey,
  verifyAccessTokenWeb,
  verifyAccessTokenWebPass,
  authRoles,
};
