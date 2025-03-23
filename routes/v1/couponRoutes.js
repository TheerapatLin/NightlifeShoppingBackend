const express = require('express');
const router = express.Router();
const Coupon = require("../../schemas/v1/coupon.schema");

// Create new coupon
router.post("/create", async (req, res) => {
    try {
        const {eventId, discount, detail, endAt , startAt , businessId} = req.body;

        if (!businessId) {
            return res
              .status(400)
              .json({ success: false, error: "businessId is required" });
        }

        if (!discount) {
            console.log(discount);
            return res.status(400).send("Discount are required");
        }

        const newCoupon = new Coupon({
            businessId,
            eventId: eventId ?? null,
            discount,
            detail: detail ?? "",
            startAt,
            endAt,
        });

        const savedCoupon = await newCoupon.save();
        res.status(201).json({
            message: "Coupon created successfully",
            coupon: savedCoupon,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all coupons
router.get("/", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }
        const allCoupons = await Coupon.find();
        res.status(200).json({ allCoupons });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get coupon by ID
router.get("/:couponId", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const coupon = await Coupon.findById(req.params.couponId);
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        res.status(200).json({ coupon });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update coupon by ID
router.put("/:couponId", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.couponId,
            req.body, 
            { new: true}
        );
        if (!updatedCoupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        res.status(200).json({ message: "Coupon updated successfully", coupon: updatedCoupon });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete coupon by ID
router.delete("/:couponId", async (req, res) => {
    try {
        const businessId = req.headers["businessid"];

        if (!businessId) {
            return res
            .status(400)
            .json({ success: false, error: "businessId is required" });
        }
        
        const deletedCoupon = await Coupon.findByIdAndDelete(req.params.couponId);
        if (!deletedCoupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        res.status(200).json({ message: "Coupon deleted successfully", coupon: deletedCoupon });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
