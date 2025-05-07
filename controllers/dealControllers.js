const Deal = require("../schemas/v1/deal.schema");

exports.createDeal = async (req, res) => {
  try {
    const deal = new Deal(req.body);
    const saved = await deal.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Error creating deal:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllDeals = async (req, res) => {
  try {
    const deals = await Deal.find().populate("venueId").populate("productIds");
    res.status(200).json(deals);
  } catch (err) {
    console.error("Error fetching deals:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id).populate("venueId").populate("productIds");
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    res.status(200).json(deal);
  } catch (err) {
    console.error("Error fetching deal:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const updated = await Deal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Deal not found" });
    res.status(200).json({ message: "Deal updated successfully", deal: updated });
  } catch (err) {
    console.error("Error updating deal:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const deleted = await Deal.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Deal not found" });
    res.status(200).json({ message: "Deal deleted successfully" });
  } catch (err) {
    console.error("Error deleting deal:", err);
    res.status(500).json({ error: err.message });
  }
};