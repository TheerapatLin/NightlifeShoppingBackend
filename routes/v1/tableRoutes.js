const express = require('express');
const router = express.Router();
const Table = require('../../schemas/v1/table.schema');

// Create new table
router.post("/create", async (req, res) => {
    try {
        const {venueId, capacity, detail, number, businessId} = req.body;

        if (!businessId) {
            return res
              .status(400)
              .json({ success: false, error: "businessId is required" });
        }

        if (!capacity) {
            return res.status(400).json({ success: false, error: "Capacity is required" });
        }
        if (!number) {
            return res.status(400).json({ success: false, error: "Number is required" });
        }

        const newTable = new Table({
            businessId,
            venueId,
            capacity,
            detail,
            number
        });

        const saveTable = await newTable.save();
        res.status(201).json({
            message: "Table created successfully",
            table: saveTable,
        });
    } catch (error) {
        res.status(400).json({ error: error.message, stack: error.stack });
    }
});

// Get all tables
router.get("/", async (req, res) => {
    try {

        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const allTables = await Table.find();
        res.status(200).json({ allTables });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get table by ID
router.get("/:tableId", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const table = await Table.findById(req.params.tableId);
        if (!table) {
            return res.status(404).json({ message: "Table not found" });
        }
        res.status(200).json({ table });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update table by ID
router.put("/:tableId", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }
        const updatedTable = await Table.findByIdAndUpdate(
            req.params.tableId,
            req.body, 
            { new: true }
        );
        if (!updatedTable) {
            return res.status(404).json({ message: "Table not found" });
        }
        res.status(200).json({ message: "Table updated successfully", table: updatedTable });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete table by ID
router.delete("/:tableId", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const deletedTable = await Table.findByIdAndDelete(req.params.tableId);
        if (!deletedTable) {
            return res.status(404).json({ message: "Table not found" });
        }
        res.status(200).json({ message: "Table deleted successfully", table: deletedTable });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
