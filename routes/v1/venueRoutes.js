const express = require("express");
const router = express.Router();
const {
    globalRateLimit,
} = require("../../modules/ratelimit/globalRatelimiter");

const {
    createVenue,
    getAllVenue,
    getVenueById,
    updateVenue,
    deleteVenue,
} = require("../../controllers/venueControllers");

const {
    verifyAccessToken,
    verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
} = require("../../middlewares/auth"); 

router.post("/createVenue", globalRateLimit, [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], createVenue);
router.get("/", globalRateLimit, getAllVenue);
router.get("/:id", globalRateLimit, getVenueById);
router.put("/:id", globalRateLimit, [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], updateVenue);
router.delete("/:id", globalRateLimit, [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], deleteVenue);

module.exports = router;
