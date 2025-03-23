const express = require('express');
const router = express.Router();
const Venue = require('../../schemas/v1/venue.schema');

// Create new venue (POST)
router.post('/create', async (req, res) => {
    try {
        const {name, location, image, type, eventListID, tableListID, reviewStar, reviewCount ,businessId} = req.body;

        if (!businessId) {
            return res
              .status(400)
              .json({ success: false, error: "businessId is required" });
        }

        if (!name) {
            console.log(name);
            return res.status(400).send("Name is required");
        }

         // Validate location and coordinates
        const { coordinates, name: locationName, description } = location;

         if (!Array.isArray(coordinates) || coordinates.length !== 2 || isNaN(coordinates[0]) || isNaN(coordinates[1])) {
             console.log("Invalid coordinates format");
             return res.status(400).send({ error: "Invalid coordinates format" });
         }
 
        const [longitude, latitude] = coordinates;

        const validTypes = ["Nightclub", "Bar", "Food", "Activity"];
        if (!type || !validTypes.includes(type)) {
             return res.status(400).send({ error: "Invalid venue type" });
        }

        const newVenue = new Venue({
            businessId,
            name,
            location: {
                type: "Point",
                coordinates: [longitude, latitude],
                name: locationName,
                description: description,
            },
            image,
            type,
            eventListID,
            tableListID,
            reviewStar,
            reviewCount
        });

        const savedVenue = await newVenue.save();
        res.status(201).json({
            message: "Venue created successfully",
            venue: savedVenue,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all venues (GET)
router.get('/', async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const allVenues = await Venue.find();
        res.status(200).json({ allVenues });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get venue by ID (GET)
router.get('/:venueId', async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const venue = await Venue.findById(req.params.venueId);
        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }
        res.status(200).json({ venue });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update venue by ID (PUT)
router.put('/:venueId', async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }
        
        const updatedVenue = await Venue.findByIdAndUpdate(
            req.params.venueId,
            req.body,
            { new: true, runValidators: true }  // Return the updated venue and validate input
        );
        if (!updatedVenue) {
            return res.status(404).json({ message: "Venue not found" });
        }
        res.status(200).json({ message: "Venue updated successfully", venue: updatedVenue });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete venue by ID (DELETE)
router.delete('/:venueId', async (req, res) => {
    try {
        const deletedVenue = await Venue.findByIdAndDelete(req.params.venueId);
        if (!deletedVenue) {
            return res.status(404).json({ message: "Venue not found" });
        }
        res.status(200).json({ message: "Venue deleted successfully", venue: deletedVenue });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
