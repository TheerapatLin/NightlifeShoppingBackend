
exports.handleDealUsedWebhook = async (req, res) => {
  try {
    // 🔐 ป้องกัน spoof ด้วย secret
    if (req.headers["x-webhook-secret"] !== process.env.WEBHOOK_SECRET) {
      console.warn("❌ Invalid webhook secret");
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { userDealId, userId, dealId, serialNumber, expiresAt, timestamp } =
      req.body;
    console.log("✅ Webhook: deal used", {
      userDealId,
      userId,
      dealId,
      serialNumber,
      expiresAt,
      timestamp,
    });

    // 👉 ตรงนี้สามารถ:
    // - บันทึกลง MongoDB
    // - แจ้ง admin ผ่าน LINE Notify
    // - ส่ง Analytics ไป GA / Mixpanel / Segment

    res.status(200).json({ message: "Webhook received" });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ error: "Internal webhook error" });
  }
};
