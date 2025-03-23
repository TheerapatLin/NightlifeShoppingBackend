const express = require("express");
const multer = require("multer");
const processFiles = require("../../modules/multer/multer");
const upload = multer({ processFiles });
const app = express();
app.use(express.json());

const {
  createActivity,
  getAllActivity,
  getAcivityById,
  getAcivityByCreatorId,
  getAcivityByParticipantId,
  editActivity,
  deleteActivity,
  interestedActivity,
  joinActivity,
  cancelJoinActivity,
  acceptJoin,
  declineJoin,
  banJoin,
} = require("../../controllers/activityController");

module.exports = function (io) {
  const router = express.Router();
  // ------------------------ สร้างกิจกรรม --------------------------
  router.post("/", upload.array("image", 6), (req, res) =>
    createActivity(req, res, io)
  );
  router.post("/create-web", upload.array("image", 6), (req, res) =>
    createActivity(req, res, io)
  );

  // ------------------------ get กิจกรรม --------------------------
  // Get All Activities
  router.get("/", getAllActivity);

  // Get an Activity by ActivityId
  router.get("/:activityId", getAcivityById);

  // Get Activities by UserId
  router.get("/creator/:userId", getAcivityByCreatorId);

  // Get Activities by UserId (Participants)
  router.get("/participant/:userId", getAcivityByParticipantId);

  // ------------------------ edit กิจกรรม --------------------------
  router.patch("/:activityId", upload.array("image", 6), editActivity);

  // Delete an Activity by ActivityId
  router.delete("/:activityId", deleteActivity);

  //------------------------------ activity : For Participant ----------------------------

  // interested in Activities
  router.post("/:activityId/interested", interestedActivity);

  // Request to join an activity
  router.post("/:activityId/request", joinActivity);

  // Cancel join request
  router.post("/:activityId/cancel", cancelJoinActivity);

  //------------------------------ activity : for Creator ----------------------------
  // Accept join request
  router.post("/:activityId/accept", acceptJoin);

  // Decline join request
  router.post("/:activityId/decline", declineJoin);

  // Ban participant
  router.post("/:activityId/ban", banJoin);

  module.exports = router;
  return router;
};
