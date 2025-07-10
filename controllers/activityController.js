const Activity = require("../schemas/v1/activity.schema");
const User = require("../schemas/v1/user.schema");
const { OSSStorage, deleteFolder } = require("../modules/storage/oss");
const { ChatRoom, Message } = require("../schemas/v1/chat.schema");
const mongoose = require("mongoose");

const { queueGetAcivityById ,queueGetAcivityByIdEvent} = require('../queues/producer')

// ------------------------ สร้างกิจกรรม --------------------------
exports.createActivity = async (req, res, io) => {
  try {
    const {
      creatorId,
      creatorName,
      category,
      cost,
      name,
      description,
      points,
      participantLimit,
      requireRequestToJoin,
      schedule: scheduleData, // ข้อมูล schedule ที่ผู้ใช้ส่งมา
    } = req.body;

    const businessId = req.headers["businessid"];
    let locationData, activityTime;

    // ตรวจสอบว่ามี creatorId หรือไม่
    if (!creatorId) {
      return res.status(400).send({ error: "ต้องระบุ Creator ID" });
    }

    // ตรวจสอบและแปลงข้อมูล location
    try {
      locationData = JSON.parse(req.body.location);
    } catch (error) {
      return res
        .status(400)
        .send({ error: "รูปแบบ JSON สำหรับ location ไม่ถูกต้อง" });
    }

    const coordinates = Array.isArray(locationData.coordinates)
      ? locationData.coordinates.map(Number)
      : locationData.coordinates.split(",").map(Number);

    // ตรวจสอบรูปแบบพิกัด coordinates
    if (
      coordinates.length !== 2 ||
      isNaN(coordinates[0]) ||
      isNaN(coordinates[1])
    ) {
      return res
        .status(400)
        .send({ error: "รูปแบบพิกัด coordinates ไม่ถูกต้อง" });
    }

    // ตรวจสอบและแปลงข้อมูล activityTime
    try {
      activityTime = JSON.parse(req.body.activityTime);
    } catch (error) {
      return res.status(400).send({
        error: "รูปแบบ JSON สำหรับ activityTime ไม่ถูกต้องหรือไม่มีข้อมูล",
      });
    }

    // ตรวจสอบและแปลงข้อมูล schedule
    let schedule = [];
    if (scheduleData) {
      try {
        schedule = JSON.parse(scheduleData).map((entry) => ({
          dayString: entry.dayString,
          detail: entry.detail || "",
          cost: entry.cost || 0,
          startTime: new Date(entry.startTime),
          endTime: new Date(entry.endTime),
        }));
      } catch (error) {
        return res
          .status(400)
          .send({ error: "รูปแบบ JSON สำหรับ schedule ไม่ถูกต้อง" });
      }
    }

    // ค้นหาผู้สร้างกิจกรรม (creator)
    const user = await User.findById(creatorId).populate(
      "userData",
      "profileImage"
    );
    if (!user) {
      return res
        .status(404)
        .send({ error: "ไม่พบข้อมูลผู้สร้างกิจกรรม (Creator)" });
    }

    // สร้าง Activity ใหม่
    const newActivity = new Activity({
      creator: { id: creatorId, name: creatorName },
      location: {
        type: "Point",
        coordinates: [coordinates[0], coordinates[1]],
        name: locationData.name,
        description: locationData.description,
      },
      activityTime,
      category,
      cost,
      certificate: JSON.parse(req.body.certificate || "{}"),
      name,
      description,
      schedule, // เพิ่ม schedule ที่ตรวจสอบแล้ว
      image: [],
      points,
      participantLimit,
      requireRequestToJoin,
      privacy: JSON.parse(req.body.privacy || "{}"),
      tags: JSON.parse(req.body.tags || "[]"),
      businessId,
      participants: [
        {
          userId: user._id,
          name: user.user.name,
          profileImage: user.userData.profileImage,
          paymentStatus: "paid",
          attendanceStatus: "joined",
          joinRequestTime: new Date(),
          postEventStatus: "showed up",
        },
      ],
    });

    // บันทึกข้อมูล Activity
    const savedActivity = await newActivity.save();

    // อัปโหลดรูปภาพ
    let images = [];
    if (req.files && req.files.length) {
      const imageOrder = req.body.imageOrder
        ? JSON.parse(req.body.imageOrder)
        : {};
      const uploadPromises = req.files.map(async (file, index) => {
        const order = imageOrder[file.originalname] || index;
        const uniqueTimestamp = Date.now();
        return OSSStorage.put(
          `user/${creatorId}/activity/${savedActivity._id}/activity-${order}-${uniqueTimestamp}.jpg`,
          Buffer.from(file.buffer)
        ).then((image) => ({
          order,
          fileName: image.url,
        }));
      });

      try {
        images = await Promise.all(uploadPromises);
      } catch (uploadError) {
        return res
          .status(500)
          .send({ error: "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" });
      }
    }

    if (images.length > 0) {
      savedActivity.image = images;
      await savedActivity.save();
    }

    // สร้างห้องสนทนา (Chat Room)
    const chatRoom = new ChatRoom({
      businessId,
      name: `Chat for ${savedActivity.name}`,
      type: "group",
      participants: [user._id],
      activityId: savedActivity._id,
    });

    await chatRoom.save();
    savedActivity.chatRoomId = chatRoom._id;

    // สร้างข้อความแรกในห้องสนทนา
    const startMessage = new Message({
      businessId,
      chatRoom: chatRoom._id,
      sender: user._id,
      type: "system",
      content: "เริ่มต้นการสนทนา",
      status: "sent",
      timestamp: new Date(),
      order: Date.now(),
    });

    await startMessage.save();
    chatRoom.lastMessage = startMessage._id;
    chatRoom.updatedAt = new Date();
    await chatRoom.save();

    io.to(chatRoom._id.toString()).emit("message", startMessage);

    res.status(201).send(savedActivity);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// ------------------------ get กิจกรรม --------------------------
exports.getAllActivity = async (req, res) => {
  try {
    const { startTime, before, limit } = req.query;
    const finalLimit = limit && parseInt(limit) > 0 ? parseInt(limit) : 5;

    // สร้างเงื่อนไขสำหรับการกรองตามวันที่
    let dateMatch = {};
    if (startTime) {
      dateMatch = before
        ? { createdAt: { $lte: new Date(startTime) } } // ถ้ามี `before` ให้เลือกกิจกรรมที่ถูกสร้างก่อน `startTime`
        : { createdAt: { $gte: new Date(startTime) } }; // ถ้าไม่มี `before` ให้เลือกกิจกรรมที่ถูกสร้างตั้งแต่ `startTime`
    }

    // ใช้ Aggregation pipeline สำหรับจัดการข้อมูล
    const activities = await Activity.aggregate([
      // กรองข้อมูลตามวันที่ถ้ามีเงื่อนไขที่กำหนด
      ...(Object.keys(dateMatch).length > 0 ? [{ $match: dateMatch }] : []),

      // เรียงข้อมูลตามวันที่สร้าง
      { $sort: { createdAt: before ? -1 : 1 } },

      // จัดกลุ่มข้อมูลตาม `parentId` หรือ `_id` ถ้า `parentId` เป็น null
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$parentId", null] }, // ถ้า `parentId` เป็น null ให้ใช้ `_id`
              then: "$_id",
              else: "$parentId", // ถ้าไม่เป็น null ให้ใช้ `parentId`
            },
          },
          // ดึงข้อมูลล่าสุดในแต่ละกลุ่ม
          doc: {
            $first: "$$ROOT",
          },
        },
      },

      // แทนที่ root ของข้อมูลด้วยเอกสารที่จัดกลุ่ม
      { $replaceRoot: { newRoot: "$doc" } },

      // เรียงข้อมูลอีกครั้งตามวันที่สร้าง
      { $sort: { createdAt: -1 } },

      // จำกัดจำนวนข้อมูลที่ส่งกลับ
      { $limit: finalLimit },
    ]);

    if (!activities || activities.length === 0) {
      console.log("ไม่พบกิจกรรม");
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    // เติมข้อมูลเพิ่มเติมให้กิจกรรมที่ได้จากการ aggregate
    const populatedActivities = await Activity.populate(activities, {
      path: "participants.userId", // เติมข้อมูลเกี่ยวกับผู้เข้าร่วม
      select: "user.name userData", // เลือกฟิลด์ที่ต้องการ
      populate: {
        path: "userData", // เติมข้อมูลผู้ใช้งานเพิ่มเติม
        model: "RegularUserData",
        select: "profileImage", // เลือกรูปภาพโปรไฟล์
      },
    });

    const activitiesWithCreatorInfo = await Promise.all(
      populatedActivities.map(async (activity) => {
        const creator = activity.creator
          ? await User.findById(activity.creator.id)
              .populate({
                path: "userData",
                model: "RegularUserData",
                select: "profileImage", // ดึงข้อมูลรูปภาพโปรไฟล์ของผู้สร้าง
              })
              .select("user.name userData")
          : null;

        if (creator) {
          activity.creator = {
            id: creator._id,
            name: creator.user?.name || "",
            profileImage: creator.userData?.profileImage || "",
          };
        }

        // แปลงข้อมูลให้เป็น JSON Object เพราะผลลัพธ์จาก aggregation ไม่มี method `.toObject()`
        const plainActivity = JSON.parse(JSON.stringify(activity));
        return {
          ...plainActivity,
          creator: activity.creator,
          participants: activity.participants.map((participant) => {
            const plainParticipant = JSON.parse(JSON.stringify(participant));
            return {
              ...plainParticipant,
              userId: {
                ...plainParticipant.userId,
                profileImage: participant.userId?.userData?.profileImage || "", // เพิ่มรูปภาพของผู้เข้าร่วม
              },
            };
          }),
        };
      })
    );

    // นับจำนวนข้อมูลทั้งหมด
    const totalCount = await Activity.countDocuments(dateMatch);
    const hasMore =
      totalCount >
      activities.length +
        (startTime
          ? await Activity.countDocuments({
              ...dateMatch,
              createdAt: { $gt: new Date(startTime) },
            })
          : 0);

    console.log(totalCount);
    console.log(hasMore);

    res.status(200).json(activitiesWithCreatorInfo);
  } catch (error) {
    console.log("500 Error = ", error.message);
    res.status(500).json({ message: error.message });
  }
};

// --------------------------------------------- getActivityById --------------------------------------------- //

exports.getActivityByIdService = async (activityId) => { // สร้าง function ใหม่เพื่อนำไปใช้ใน worker (logic ยังเหมือนเดิม)

    if (!mongoose.Types.ObjectId.isValid(activityId)) {
        throw new Error("ไม่พบ activityId");
    }

    // ดึงข้อมูลกิจกรรมหลัก พร้อมกับข้อมูลที่เติมเต็ม (populate) ผู้เข้าร่วม
    const activity = await Activity.findById(activityId).populate({
        path: "participants.userId", // เติมข้อมูลผู้ใช้ใน `participants`
        select: "user.name userData", // เลือกเฉพาะฟิลด์ชื่อผู้ใช้และข้อมูลผู้ใช้เพิ่มเติม
        populate: {
            path: "userData", // ดึงข้อมูลโปรไฟล์เพิ่มเติมจาก `userData`
            model: "RegularUserData",
            select: "profileImage", // เลือกเฉพาะฟิลด์รูปภาพโปรไฟล์
        },
    });

    if (!activity) {
        throw new Error("ไม่พบกิจกรรม");
    }

    // ดึงข้อมูลของผู้สร้างกิจกรรม
    const creator =
        activity.creator && activity.creator.id
            ? await User.findById(activity.creator.id)
                .populate({
                    path: "userData", // เติมข้อมูลโปรไฟล์ของผู้สร้างกิจกรรม
                    model: "RegularUserData",
                    select: "profileImage", // เลือกรูปภาพโปรไฟล์ของผู้สร้าง
                })
                .select("user.name userData") // เลือกฟิลด์ชื่อผู้สร้างและข้อมูลเพิ่มเติม
            : null;

    if (creator) {
        activity.creator = {
            id: activity.creator.id,
            name: creator.user.name, // ชื่อผู้สร้าง
            profileImage: creator.userData
                ? creator.userData.profileImage || "" // รูปภาพโปรไฟล์ ถ้าไม่มีให้ใช้ค่าว่าง
                : "",
        };
    }

    // อัปเดตรูปโปรไฟล์ของผู้เข้าร่วมกิจกรรม
    // activity.participants = activity.participants.map((participant) => ({
    //   ...participant.toObject(),
    //   userId: {
    //     ...participant.userId.toObject(),
    //     profileImage: participant.userId.userData
    //       ? participant.userId.userData.profileImage || "" // รูปภาพโปรไฟล์ของผู้เข้าร่วมกิจกรรม
    //       : "",
    //   },
    // }));

    // ดึงข้อมูลกิจกรรมที่เกี่ยวข้องซึ่งมี parentId เดียวกัน
    let relatedActivities = [];
    if (activity.parentId) {
      relatedActivities = await Activity.find({
        parentId: activity.parentId, // ดึงกิจกรรมที่มี parentId เดียวกัน
        _id: { $ne: activityId }, // ไม่รวมกิจกรรมปัจจุบัน
      })
        .select("_id activityTime chatRoomId") // เลือกฟิลด์ `_id`, `activityTime` และ `chatRoomId`
        .sort({ "activityTime.start": 1 }); // เรียงข้อมูลตามเวลาเริ่มต้น
    }

    // จัดรูปแบบวันที่สำหรับกิจกรรมที่เกี่ยวข้อง
    const relatedDates = relatedActivities.map((related) => ({
      id: related._id,
      startDate: related.activityTime?.start || null, // วันที่เริ่มต้น
      endDate: related.activityTime?.end || null, // วันที่สิ้นสุด
      chatRoomId: related.chatRoomId || null, // เพิ่ม `chatRoomId` ลงในข้อมูลที่ส่งกลับ
    }));

    return {
        activity,
        relatedDates: relatedDates.filter(date => date.startDate && date.endDate),
        currentActivityId: activityId,
    };
};

exports.getAcivityById = async (req, res) => {
  try {
    const activityId = req.params.activityId;

    const job = await queueGetAcivityById.add('getAcivityById-job', {activityId}, // ส่ง Job ไปยัง 
      {
        attempts: 3,            // จำนวนครั้งที่ retry ถ้า failed
        backoff: {
          type: 'exponential',  // 3s => 6s => 12s
          delay: 3000           // หน่วงเวลา 3 วินาทีก่อน retry
        },
        removeOnComplete: true, // ลบทันทีเมื่อ completed
        removeOnFail: {         // หาก fail ให้ลบ event นี้ภายใน 1 ชม.
          age: 3600
        }
      }
    )

    const response = await job.waitUntilFinished(queueGetAcivityByIdEvent);

    res.status(200).json(response);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.getAcivityByCreatorId = async (req, res) => {
  try {
    const userId = req.params.userId;

    // ตรวจสอบว่า userId เป็น ObjectId ที่ถูกต้องหรือไม่
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "ไม่พบ userId ที่ถูกต้อง" });
    }

    const limit = parseInt(req.query.limit) || 0; // ตั้งค่า limit ให้เป็น 0 ถ้าไม่ได้ระบุ เพื่อไม่จำกัดจำนวนข้อมูล

    // ค้นหากิจกรรมที่สร้างโดยผู้ใช้ที่มี id ตรงกับ userId
    const activities = await Activity.find({ "creator.id": userId })
      .sort({ createdAt: -1 }) // เรียงลำดับจากใหม่ไปเก่า
      .limit(limit) // จำกัดจำนวนข้อมูลตาม limit
      .populate({
        path: "participants.userId", // เติมข้อมูลผู้เข้าร่วมกิจกรรม
        select: "user.name userData", // เลือกเฉพาะฟิลด์ชื่อผู้ใช้และข้อมูลเพิ่มเติมของผู้ใช้
        populate: {
          path: "userData", // ดึงข้อมูล `userData` ของผู้ใช้
          model: "RegularUserData",
          select: "profileImage", // เลือกเฉพาะรูปโปรไฟล์ของผู้ใช้
        },
      });

    // แสดงจำนวนกิจกรรมที่พบใน console
    console.log(`Find: ${activities.length} activities`);

    if (!activities || activities.length === 0) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    // ดึงข้อมูลของผู้สร้างกิจกรรม
    const creator = await User.findById(userId)
      .populate({
        path: "userData", // เติมข้อมูล `userData` ของผู้สร้าง
        model: "RegularUserData",
        select: "profileImage", // เลือกรูปโปรไฟล์
      })
      .select("user.name userData"); // เลือกเฉพาะฟิลด์ชื่อผู้ใช้และ `userData`

    if (!creator) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้สร้างกิจกรรม" });
    }

    // จัดรูปแบบข้อมูลกิจกรรมพร้อมข้อมูลผู้สร้างและผู้เข้าร่วม
    const activitiesWithCreatorInfo = activities.map((activity) => {
      return {
        ...activity.toObject(),
        creator: {
          id: creator._id, // id ของผู้สร้าง
          name: creator.user.name, // ชื่อผู้สร้าง
          profileImage: creator.userData
            ? creator.userData.profileImage || "" // รูปโปรไฟล์ของผู้สร้าง (ถ้าไม่มีให้ใช้ค่าว่าง)
            : "",
        },
        participants: activity.participants.map((participant) => ({
          ...participant.toObject(),
          userId: {
            ...participant.userId.toObject(),
            profileImage: participant.userId.userData
              ? participant.userId.userData.profileImage || "" // รูปโปรไฟล์ของผู้เข้าร่วมกิจกรรม
              : "",
          },
        })),
      };
    });

    res.status(200).json(activitiesWithCreatorInfo); // ส่งข้อมูลกิจกรรมทั้งหมดกลับไปให้ผู้ใช้
  } catch (error) {
    res.status(500).json({ message: error.message }); // ส่งข้อความแสดงข้อผิดพลาด
  }
};

exports.getAcivityByParticipantId = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`userId = ${userId}`);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("userId not found");
      return res.status(400).json({ message: "userId not found" });
    }

    const limit = parseInt(req.query.limit) || 0; // Default to 0 for no limit

    const activities = await Activity.find({ "participants.userId": userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "participants.userId",
        select: "user.name userData",
        populate: {
          path: "userData",
          model: "RegularUserData",
          select: "profileImage",
        },
      });

    if (!activities) {
      console.log("Activities found error");
      return res.status(404).json({ message: "Activities found error" });
    }

    const participant = await User.findById(userId)
      .populate({
        path: "userData",
        model: "RegularUserData",
        select: "profileImage",
      })
      .select("user.name userData");

    if (!participant) {
      console.log("Participant not found");
      return res.status(404).json({ message: "Participant not found" });
    }

    const activitiesWithParticipantInfo = activities.map((activity) => {
      return {
        ...activity.toObject(),
        participants: activity.participants.map((participant) => ({
          ...participant.toObject(),
          userId: {
            ...participant.userId.toObject(),
            profileImage: participant.userId.userData
              ? participant.userId.userData.profileImage || ""
              : "",
          },
        })),
      };
    });

    res.status(200).json(activitiesWithParticipantInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ------------------------ edit กิจกรรม --------------------------
exports.editActivity = async (req, res) => {
  const { activityId } = req.params;
  const { creatorId } = req.body;

  try {
    const existingActivity = await Activity.findById(activityId);
    if (!existingActivity) {
      return res.status(404).send({ error: "ActivityId not found" });
    }

    if (existingActivity.creator.id.toString() !== creatorId) {
      return res
        .status(403)
        .send({ error: "You can only edit your own activity." });
    }

    try {
      const fieldsToUpdate = [
        "name",
        "description",
        "category",
        "locationName",
        "cost",
        "tags",
        "participantLimit",
        "requireRequestToJoin",
        "notes",
        "activityTime",
      ];
      fieldsToUpdate.forEach((field) => {
        if (req.body[field] !== undefined) {
          existingActivity[field] = req.body[field];
        }
      });
    } catch (error) {
      console.error("Failed to update the activity:", error);
      // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
      res.status(500).send({
        message: "Error updating the activity (mayby type of datas mismatched)",
        error: error.toString(),
      });
    }

    let images = existingActivity.image;
    const imageOrder = req.body.imageOrder
      ? JSON.parse(req.body.imageOrder)
      : {};

    if (req.body.schedule) {
      try {
        existingActivity.schedule = JSON.parse(req.body.schedule).map(
          (entry) => ({
            dayString: entry.dayString,
            detail: entry.detail || "",
            cost: entry.cost || 0,
            startTime: new Date(entry.startTime),
            endTime: new Date(entry.endTime),
          })
        );
      } catch (error) {
        return res
          .status(400)
          .send({ error: "รูปแบบ JSON สำหรับ schedule ไม่ถูกต้อง" });
      }
    }

    // Delete specified images
    if (req.body.deleteImages) {
      const imagesToDelete = JSON.parse(req.body.deleteImages);
      const filenamesToDelete = imagesToDelete.map((url) =>
        url.split("/").pop()
      );
      images = images.filter(
        (eachImage) =>
          !filenamesToDelete.includes(eachImage.fileName.split("/").pop())
      );

      // Delete images from OSS
      const deletePromises = filenamesToDelete.map((filename) => {
        return OSSStorage.delete(
          `user/${creatorId}/activity/${activityId}/${filename}`
        );
      });

      await Promise.all(deletePromises);
    }

    // Handle new images upload and order with unique filename
    if (req.files && req.files.length) {
      const uniqueTimestamp = Date.now(); // Generate a unique timestamp for each upload

      const uploadPromises = req.files.map(async (file, index) => {
        const filename = file.originalname;
        const order = imageOrder[filename] || images.length + index + 1;
        return OSSStorage.put(
          `user/${creatorId}/activity/${activityId}/activity-${order}-${uniqueTimestamp}.jpg`, // Append timestamp to ensure uniqueness
          Buffer.from(file.buffer)
        ).then((eachImage) => ({
          order,
          fileName: eachImage.url,
        }));
      });

      const newImages = await Promise.all(uploadPromises);
      images = [...images, ...newImages];
    }

    // Apply new order from imageOrder if provided
    images.forEach((image) => {
      const filename = image.fileName.split("/").pop();
      const newOrder = imageOrder[filename];
      if (newOrder !== undefined) {
        image.order = newOrder;
      }
    });

    // Normalize and reorder images to avoid duplicate orders
    images.sort((a, b) => a.order - b.order);
    images.forEach((image, index) => {
      // Reassign orders to maintain consistency
      image.order = index + 1;
    });
    existingActivity.updatedAt = new Date();
    existingActivity.image = images;
    await existingActivity.save();
    res.status(200).send(existingActivity);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    res.status(200).json({ message: "Activity deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//------------------------------ activity : For Participant ----------------------------
exports.interestedActivity = async (req, res) => {
  const { userId } = req.body;
  const { activityId } = req.params;

  try {
    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const participant = activity.participants.find(
      (p) => p.userId.toString() === userId
    );

    if (participant && participant.attendanceStatus === "banned") {
      return res
        .status(403)
        .json({ message: "You are banned from this activity" });
    }

    if (participant) {
      return res
        .status(400)
        .json({ message: "You are already a participant in this activity" });
    }

    const user = await User.findById(userId).populate(
      "userData",
      "profileImage"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newParticipant = {
      userId: user._id,
      name: user.user.name,
      profileImage: user.userData.profileImage,
      paymentStatus: "unpaid",
      attendanceStatus: "interested",
      joinRequestTime: new Date(),
      postEventStatus: "showed up",
    };

    activity.participants.push(newParticipant);

    await activity.save();

    const chatRoom = await ChatRoom.findOne({ activityId: activity._id });

    if (chatRoom) {
      // เพิ่มผู้ใช้เข้าไปใน participants ของ ChatRoom
      if (!chatRoom.participants.includes(user._id)) {
        chatRoom.participants.push(user._id);
        await chatRoom.save();
      }

      // สร้างและส่งข้อความระบบ
      const JoinedMessage = new Message({
        businessId: activity.businessId,
        chatRoom: chatRoom._id,
        sender: user._id,
        type: "join",
        content: `${user.user.name} \nJoined`,
        status: "sent",
        timestamp: new Date(),
        order: Date.now(),
      });

      await JoinedMessage.save();

      // อัพเดต lastMessage ของ ChatRoom
      chatRoom.lastMessage = JoinedMessage._id;
      // chatRoom.lastMessageTime = new Date();
      chatRoom.updatedAt = new Date();
      await chatRoom.save();

      io.to(chatRoom._id.toString()).emit("message", JoinedMessage);
    }

    res.status(200).json({
      message: "Joined as interested successfully",
      participant: newParticipant,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.joinActivity = async (req, res) => {
  const { userId } = req.body;
  const { activityId } = req.params;

  try {
    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const participant = activity.participants.find(
      (p) => p.userId.toString() === userId
    );

    if (participant && participant.attendanceStatus === "banned") {
      return res
        .status(403)
        .json({ message: "You are banned from joining this activity" });
    }

    if (participant) {
      return res.status(400).json({
        message: "You have already requested to join this activity",
      });
    }

    const user = await User.findById(userId).populate(
      "userData",
      "profileImage"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newParticipant = {
      userId: user._id,
      name: user.user.name,
      profileImage: user.userData.profileImage,
      paymentStatus: "unpaid",
      attendanceStatus: activity.requireRequestToJoin ? "requested" : "joined",
      joinRequestTime: new Date(),
      postEventStatus: "showed up",
    };

    activity.participants.push(newParticipant);

    await activity.save();

    res.status(200).json({
      message: "Request to join activity successful",
      participant: newParticipant,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.cancelJoinActivity = async (req, res) => {
  const { userId } = req.body;
  const { activityId } = req.params;

  try {
    console.log(
      `Cancelling participation for userId: ${userId} in activityId: ${activityId}`
    );
    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const participantIndex = activity.participants.findIndex(
      (p) => p.userId.toString() === userId
    );

    if (participantIndex === -1) {
      return res
        .status(400)
        .json({ message: "You are not a participant in this activity" });
    }

    activity.participants.splice(participantIndex, 1);

    await activity.save();

    res.status(200).json({
      message: "Canceled join request or participation successfully",
    });
  } catch (error) {
    console.error(`Error cancelling participation: ${error.message}`);
    res.status(500).json({ message: "Server error", error });
  }
};

//------------------------------ activity : for Creator ----------------------------
exports.acceptJoin = async (req, res) => {
  const { userId } = req.body;
  const { activityId } = req.params;

  try {
    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const participant = activity.participants.find(
      (p) => p.userId.toString() === userId
    );

    if (!participant || participant.attendanceStatus !== "requested") {
      return res.status(400).json({ message: "No such request to accept" });
    }

    participant.attendanceStatus = "joined";

    await activity.save();

    res
      .status(200)
      .json({ message: "Participant accepted successfully", participant });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.declineJoin = async (req, res) => {
  const { userId } = req.body;
  const { activityId } = req.params;

  try {
    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const participantIndex = activity.participants.findIndex(
      (p) =>
        p.userId.toString() === userId && p.attendanceStatus === "requested"
    );

    if (participantIndex === -1) {
      return res.status(400).json({ message: "No such request to decline" });
    }

    activity.participants.splice(participantIndex, 1);

    await activity.save();

    res.status(200).json({ message: "Participant declined successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.banJoin = async (req, res) => {
  const { userId } = req.body;
  const { activityId } = req.params;

  try {
    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const participant = activity.participants.find(
      (p) => p.userId.toString() === userId
    );

    if (!participant) {
      return res.status(400).json({ message: "User is not a participant" });
    }

    participant.attendanceStatus = "banned";

    await activity.save();

    res
      .status(200)
      .json({ message: "Participant banned successfully", participant });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getAffiliateEnabledActivities = async (req, res) => {
  try {
    const activities = await Activity.find({ "affiliate.enabled": true });
    res.status(200).json({ status: "success", data: activities });
  } catch (error) {
    console.error("Error fetching affiliate-enabled activities:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};