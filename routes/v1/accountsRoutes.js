const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const processFiles = require("../../modules/multer/multer");
const upload = multer({ processFiles });

//test update gitlab
const {
  getAccountRateLimiter,
  getAccountsRateLimiter,
  deleteAccountRateLimiter,
  deleteAccountsRateLimiter,
} = require("../../modules/ratelimit/accountRatelimiter");

const {
  changePassword,
  resetPassword,
  sendEmailVerification,
  sendPhoneVerification,
  verifyEmail,
  verifyPhone,
  verifyPhoneTemp,
  deactivateAccount,
  unverifyEmail,
  unverifyPhone,
  verifyRefreshTokenOTP,
  getOneAccount,
  checkAccount,
  getAllAccounts,
  deleteOneAccount,
  deleteAllAccounts,
  updateUserProfile,
  updateBusinessesByUserId,
  setPassword,
  setPasswordPage,
  uploadProfileImage
} = require("../../controllers/accountsControllers");

const {
  verifyAccessToken,
  verifyRefreshToken,
  verifyAccessTokenWeb,
} = require("../../middlewares/auth");

//? Set Password
router.get("/set-password", setPasswordPage);
router.post("/set-password", setPassword);

// ? check if have user
router.get("/check", checkAccount);

//? Change Password
router.patch("/password/change/:user", changePassword);

//? Reset Password
router.post("/password/reset/:email", resetPassword);

//? Send Email Verification
router.post(
  "/verification/email/:email",
  verifyAccessToken,
  sendEmailVerification
);

//? Send Phone Verification
router.post(
  "/verification/phone/:phone",
  verifyAccessToken,
  sendPhoneVerification
);

//? Verify Email
router.get("/verify/email", verifyEmail);

//? Verify Phone
router.post("/verify/phone", verifyAccessToken, verifyPhone);
router.post("/verify/phonetemp", verifyAccessToken, verifyPhoneTemp);

//? Deactivate Account
router.patch("/deactivate/:user", verifyAccessToken, deactivateAccount);

//? Unverify Email
router.patch("/unverify/email/:user", verifyAccessToken, unverifyEmail);

//? Unverify Phone
router.patch("/unverify/phone/:user", verifyAccessToken, unverifyPhone);

//? Verify Password
router.post(
  "/refreshtokenotp/verify",
  verifyRefreshToken,
  verifyRefreshTokenOTP
);

//? Get One Account
router.get("/me", verifyAccessTokenWeb, getOneAccount);
router.get(
  "/getuser/:user",
  [getAccountRateLimiter, verifyAccessToken],
  getOneAccount
);
router.get(
  "/getuserweb/:user",
  [getAccountRateLimiter, verifyAccessTokenWeb],
  getOneAccount
);

router.put("/update", verifyAccessTokenWeb, updateUserProfile);
router.put(
  "/upload-profile-image",
  [verifyAccessTokenWeb, upload.single("profileImage")],
  uploadProfileImage
);
router.get("/", [getAccountsRateLimiter, verifyAccessToken], getAllAccounts);

router.delete(
  "/:user",
  [deleteAccountRateLimiter, verifyAccessToken],
  deleteOneAccount
);

router.delete(
  "/",
  [deleteAccountsRateLimiter, verifyAccessToken],
  deleteAllAccounts
);

router.post(
  "/udb0",
  [deleteAccountsRateLimiter, verifyAccessToken],
  updateBusinessesByUserId
);

module.exports = router;
