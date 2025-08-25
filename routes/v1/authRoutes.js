const express = require("express");
const router = express.Router();
const passport = require("passport");

const {
  registerRateLimiter,
  logoutRateLimiter,
  loginRateLimiter,
} = require("../../modules/ratelimit/authRatelimiter");

const {
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

} = require("../../controllers/authControllers");

const {
  verifyAccessToken,
  verifyRefreshToken,
  verifyAccessTokenWeb,
} = require("../../middlewares/auth");

//? Register
router.post("/register", registerRateLimiter, register);


//? Dev:Oreq Forgot Password
router.post("/forgot-password", forgotPassword);
router.post('/reset-password', resetPassword);


//? Login
router.post("/login", loginRateLimiter, login);
router.post("/google-web-login", loginRateLimiter, googleWebLogin);

//? Logout
router.post("/logout", logoutRateLimiter, verifyAccessTokenWeb, logout);

router.post("/refresh", verifyRefreshToken, refresh);

router.post("/refresh-web", verifyAccessTokenWeb, refreshWeb);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

router.post("/google", loginRateLimiter, googleFlutterLogin);

router.get("/line", passport.authenticate("line", { session: false }));

router.get(
  "/line/callback",
  passport.authenticate("line", { session: false }),
  lineCallback
);

module.exports = router;
