const express = require('express');
const router = express.Router();
const Event = require("../../schemas/v1/event.schema");

//Get all event
router.get("/" , async (req , res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        let allEvents = await Event.find();
        // let allEventsCount = await event.count();
    
        await res.status(200).json({
             allEvents
        })
    } catch (error) {
        res.status(400).json({
            error: error.message
          });
    }
});

// Post request to create an event
router.post("/create", async (req, res) => {
    try {
        const { name, capacity, location, venueId, type, imageUrl, detail, startAt, endAt, listofTableId, listCouponId, tags ,businessId} = req.body;

        if (!name || !capacity) {
            console.log(`${name} , ${capacity}`);
            return res.status(400).send("Name and capacity are required");
        }

        if (!businessId) {
            return res
              .status(400)
              .json({ success: false, error: "businessId is required" });
        }

        // Validate location and coordinates
        const { coordinates, name: locationName, description } = location;

        if (!Array.isArray(coordinates) || coordinates.length !== 2 || isNaN(coordinates[0]) || isNaN(coordinates[1])) {
            console.log("Invalid coordinates format");
            return res.status(400).send({ error: "Invalid coordinates format" });
        }

        const [longitude, latitude] = coordinates;

        // Create a new event
        const newEvent = new Event({
            businessId: businessId,
            venueId: venueId ?? null,
            location: {
                type: "Point",
                coordinates: [longitude, latitude],
                name: locationName,
                description: description,
            },
            name: name,
            type: type ?? "",
            imageUrl: imageUrl ?? [],
            detail: detail ?? "",
            startAt: startAt,
            endAt: endAt,
            chatRoomId: [], // Empty by default
            capacity: capacity,
            listofTableId: listofTableId ?? [],
            listCouponId: listCouponId ?? [],
            tags: tags ?? []
        });

        // Save the event to the database
        await newEvent.save();

        res.status(201).json({
            message: "Event created successfully",
            event: newEvent
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: error.message });
    }
});

// Update request
router.put("/:eventId", async (req, res) => {
    try {
        const { name, capacity, location, venueId, type, imageUrl, detail, startAt, endAt, listofTableId, listCouponId, tags } = req.body;
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.eventId,
            {
                $set: {
                    name: name ?? undefined,
                    capacity: capacity ?? undefined,
                    venueId: venueId ?? undefined,
                    location: location ? {
                        type: "Point",
                        coordinates: location.coordinates ?? undefined,
                        name: location.name ?? undefined,
                        description: location.description ?? undefined,
                    } : undefined,
                    type: type ?? undefined,
                    imageUrl: imageUrl ?? undefined,
                    detail: detail ?? undefined,
                    startAt: startAt ?? undefined,
                    endAt: endAt ?? undefined,
                    listofTableId: listofTableId ?? undefined,
                    listCouponId: listCouponId ?? undefined,
                    tags: tags ?? undefined,
                }
            },
            { new: true} // Returns the updated document
        );

        if (!updatedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }

        res.status(200).json({
            message: "Event updated successfully",
            event: updatedEvent
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


//Delete request
router.delete("/:eventId" ,async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const event = await Event.findByIdAndDelete(req.params.eventId);

        if (!event) {
            return res.status(404).json({ message: "Activity not found" });
        }

        res.status(200).json({ message: "Activity deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
