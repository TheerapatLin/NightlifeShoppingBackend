const ActivitySlot = require("../schemas/v1/activitySlot.schema");

// ✅ Create Activity Slot
exports.createActivitySlot = async (req, res) => {
  try {
    const data = req.body;

    // ✅ เพิ่มการใส่ userId ใน creator.id
    const slotData = {
      ...data,
      creator: {
        id: req.user.userId, // <-- ดึงจาก req.user ที่ middleware ใส่ให้หลัง verifyAccessTokenWeb
        name: req.user.name || "",
        profileImage: req.user.profileImage || "",
      },
    };

    const newSlot = new ActivitySlot(slotData);
    const savedSlot = await newSlot.save();
    res.status(201).json(savedSlot);
  } catch (err) {
    console.error("Error creating activity slot:", err.message);
    res.status(400).json({ error: err.message });
  }
};

// ✅ Get All Activity Slots (filter by ?activityId=...)
exports.getActivitySlots = async (req, res) => {
  try {
    const filter = {};
    if (req.query.activityId) {
      filter.activityId = req.query.activityId;
    }

    const slots = await ActivitySlot.find(filter)
      .populate("activityId")
      .populate("creator.id")
      .sort({ startTime: 1 }); // sort by time if needed

    res.status(200).json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error retrieving activity slots" });
  }
};

// ✅ Get Activity Slot By ID
exports.getActivitySlotByID = async (req, res) => {
  try {
    const slot = await ActivitySlot.findById(req.params.id)
      .populate("activityId")
      .populate("creator.id");

    if (!slot) {
      return res.status(404).json({ error: "Activity slot not found" });
    }

    res.status(200).json(slot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error retrieving activity slot" });
  }
};

// ✅ Update Activity Slot
exports.updateActivitySlot = async (req, res) => {
  try {
    const updatedSlot = await ActivitySlot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedSlot) {
      return res.status(404).json({ error: "Activity slot not found" });
    }

    res
      .status(200)
      .json({ message: "Activity slot updated successfully", updatedSlot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating activity slot" });
  }
};

// ✅ Delete Activity Slot
exports.deleteActivitySlot = async (req, res) => {
  try {
    const deletedSlot = await ActivitySlot.findByIdAndDelete(req.params.id);

    if (!deletedSlot) {
      return res.status(404).json({ error: "Activity slot not found" });
    }

    res.status(200).json({ message: "Activity slot deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting activity slot" });
  }
};
