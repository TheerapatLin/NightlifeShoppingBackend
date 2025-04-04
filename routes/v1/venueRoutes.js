const express = require("express");
const router = express.Router();
const {
    globalRateLimit,
} = require("../../modules/ratelimit/globalRatelimiter");

const {
    createVenue,
    getVenue,
    getVenueByID,
    updateVenue,
    deleteVenue,
} = require("../../controllers/venueController");

const {
    verifyAccessToken,
    verifyRefreshToken,
    verifyAccessTokenWeb,
    authRoles,
} = require("../../middlewares/auth"); 

router.post("/createVenue", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], createVenue);
router.get("/", getVenue);
router.get("/:id", getVenueByID);
router.put("/:id", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], updateVenue);
router.delete("/:id", [verifyAccessTokenWeb, authRoles(["admin", "superadmin"])], deleteVenue);

module.exports = router;
