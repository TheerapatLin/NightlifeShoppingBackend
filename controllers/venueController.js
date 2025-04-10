const Venue = require("../schemas/v1/venue.schema");

// Create venue (POST)
exports.createVenue = async (req, res) => {
    try {
      // รับข้อมูลจาก req.body
      const {
        businessId,
        name,
        nameTH,
        nameEN,
        descriptionTH,
        descriptionEN,
        location,
        type,
        image,
        featuredItems,  // Array ของ featuredItems
        eventListID,
        tableListID,
        reviewStar,
        reviewCount,
        contact,
        socialMedia,
        openingHours,
        tags,
        amenities
      } = req.body;
  
      // สร้าง venue ใหม่
      const newVenue = new Venue({
        businessId,
        name,
        nameTH,
        nameEN,
        descriptionTH,
        descriptionEN,
        location,
        type,
        image,
        featuredItems,  // featureItems จะเก็บเป็น array ของ featuredItemSchema
        eventListID,
        tableListID,
        reviewStar,
        reviewCount,
        contact,
        socialMedia,
        openingHours,
        tags,
        amenities
      });
  
      // บันทึกข้อมูลลงฐานข้อมูล
      const savedVenue = await newVenue.save();

      // ส่งข้อมูลที่บันทึกสำเร็จกลับไป
      res.status(201).json(savedVenue);
    } catch (err) {
      console.error("Error creating venue:", err.message);
      res.status(400).json({ error: err.message });
    }
};

// Get Allvenue (GET)
exports.getVenue = async (req, res) => {
    try {
      const venues = await Venue.find()
        .populate('featuredItems.productId');

      res.status(200).json(venues);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error retrieving venues" });
    }
};

// Get venueByID (GET)
exports.getVenueByID = async (req, res) => {
    try {
      const venue = await Venue.findById(req.params.id)
        .populate({
          path: 'featuredItems.productId',  // Populate productId inside featuredItems
        });
  
      if (!venue) {
        return res.status(404).json({ error: "Venue not found" });
      }
  
      res.status(200).json(venue);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error retrieving venue" });
    }
};

// Update Venue (PUT)
exports.updateVenue = async (req, res) => {
    try {
      const {
        businessId,
        name,
        nameTH,
        nameEN,
        descriptionTH,
        descriptionEN,
        location,
        type,
        image,
        featuredItems,  // Array of featuredItems
        eventListID,
        tableListID,
        contact,
        socialMedia,
        openingHours,
        tags,
        amenities
      } = req.body;
  
      const venue = await Venue.findByIdAndUpdate(
        req.params.id,
        {
          businessId,
          name,
          nameTH,
          nameEN,
          descriptionTH,
          descriptionEN,
          location,
          type,
          image,
          featuredItems,  // Directly update the array of featuredItems
          eventListID,
          tableListID,
          contact,
          socialMedia,
          openingHours,
          tags,
          amenities
        },
        { new: true } // Return the updated document
      );
  
      if (!venue) {
        return res.status(404).json({ error: "Venue not found" });
      }
  
      res.status(200).json({ message: "Venue updated successfully", venue });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error updating venue" });
    }
};

// Delete VenueByID (DELETE)
exports.deleteVenue = async (req, res) => {
    try {
      console.log(req.params.id);
      const venue = await Venue.findByIdAndDelete(req.params.id);
      console.log(venue);
      if (!venue) {
        return res.status(404).json({ error: "Venue not found" });
      }
  
      res.status(200).json({ message: "Venue deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error deleting venue" });
    }
};