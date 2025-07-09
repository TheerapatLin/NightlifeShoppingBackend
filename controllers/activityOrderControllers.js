// controllers/activityOrderControllers.js
const {
  getStripeInstance,
  getEndpointSecret,
  calculateOrderAmount,
} = require("../utils/stripeUtils");

const mongoose = require("mongoose");
const Order = require("../schemas/v1/activityOrder.schema");
const User = require("../schemas/v1/user.schema");
const RegularUserData = require("../schemas/v1/userData/regularUserData.schema");
const Activity = require("../schemas/v1/activity.schema");
const ActivitySlot = require("../schemas/v1/activitySlot.schema");
const crypto = require("crypto");
const redis = require("../app");
const { sendSetPasswordEmail } = require("../modules/email/email");

// generate affiliateCode แบบ 8 ตัว อังกฤษ+ตัวเลข
const generateAffiliateCode = async (length = 8) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code;
  do {
    code = Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (await User.findOne({ affiliateCode: code }));
  return code;
};

//4242424242424242 (test code)
const DiscountCode = require("../schemas/v1/discountCode.schema");

exports.webhookHandler = async (req, res) => {
  const stripe = getStripeInstance();
  const endpointSecret = getEndpointSecret();
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata || {};

        const activityId = metadata.activityId;
        const activitySlotId = metadata.scheduleId;
        const startDate = metadata.startDate;
        const originalPrice = parseFloat(metadata.originalPrice || "0");
        const discountAmount = parseFloat(metadata.discountAmount || "0");
        let paidAmount = paymentIntent.amount_received / 100;
        if (paidAmount < 15) paidAmount = 15;

        const adults = parseInt(metadata.adults || "1");
        const children = parseInt(metadata.children || "0");
        const discountCodeId = metadata.discountCodeId || null;
        const affiliateUserId = metadata.affiliateUserId || null;
        const paymentMode = metadata.paymentMode || "test";

        console.log("📦 Metadata received:", metadata);
        console.log("✅ Validating Activity & ActivitySlot");

        const activity = await Activity.findById(activityId);
        if (!activity) {
          console.error(`❌ Activity with ID ${activityId} not found.`);
          return res.status(400).send({ error: "Invalid activityId" });
        } 

        const slot = await ActivitySlot.findById(activitySlotId);
        if (!slot) {
          console.error(`❌ ActivitySlot with ID ${activitySlotId} not found.`);
          return res.status(400).send({ error: "Invalid activitySlotId" });
        }

        if (slot.activityId.toString() !== activityId.toString()) {
          console.error(
            `❌ ActivitySlot ${activitySlotId} does not belong to Activity ${activityId}`
          );
          return res
            .status(400)
            .send({ error: "ActivitySlot does not belong to this Activity" });
        }

        console.log(`✅ ActivitySlot found: ${slot._id}`);

        const charge = await stripe.charges.retrieve(
          paymentIntent.latest_charge
        );
        const { name, email } = charge.billing_details;

        let user = await User.findOne({ "user.email": email });
        if (!user) {
          const regularUserData = new RegularUserData({});
          await regularUserData.save();

          user = new User({
            role: "user",
            user: {
              name: name || "Unknown User",
              email,
              activated: false,
              verified: { email: false, phone: false },
            },
            businessId: "1",
            userType: "regular",
            userData: regularUserData._id,
            userTypeData: "RegularUserData",
            affiliateCode: await generateAffiliateCode(),
          });

          await user.save();
          const resetToken = crypto.randomBytes(32).toString("hex");
          redis.set(`${email}-setPasswordToken`, resetToken, "EX", 3600);
          const setPasswordLink = `${process.env.BASE_URL}/api/v1/accounts/set-password?token=${resetToken}&email=${email}`;
          await sendSetPasswordEmail(email, setPasswordLink);
          console.log(`✅ User created and set-password email sent: ${email}`);
        }

        // ✅ Calculate affiliateRewardAmount & affiliateDiscountAmount
        let affiliateRewardAmount = 0;
        let affiliateDiscountAmount = 0;

        if (affiliateUserId) {
          const affiliateUser = await User.findById(affiliateUserId);
          if (affiliateUser && affiliateUser.affiliateSettings) {
            const setting = affiliateUser.affiliateSettings.find(
              (s) =>
                s.activityId.toString() === activityId.toString() && s.enabled
            );
            if (setting) {
              affiliateRewardAmount = setting.affiliatorReward || 0;
              affiliateDiscountAmount = setting.customerDiscount || 0;
            } else if (activity.affiliate && activity.affiliate.enabled) {
              affiliateRewardAmount = activity.affiliate.rewardValue || 0;
              affiliateDiscountAmount =
                (activity.affiliate.totalValue || 0) - affiliateRewardAmount;
            }
          } else if (activity.affiliate && activity.affiliate.enabled) {
            affiliateRewardAmount = activity.affiliate.rewardValue || 0;
            affiliateDiscountAmount =
              (activity.affiliate.totalValue || 0) - affiliateRewardAmount;
          }
        }

        const order = await Order.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          {
            paymentIntentId: paymentIntent.id,
            activityId,
            activitySlotId: slot._id,
            userId: user._id,
            status: "paid",
            bookingDate: new Date(startDate),
            originalPrice,
            discountAmount,
            paidAmount,
            adults,
            children,
            discountCodeId,
            affiliateUserId,
            affiliateCode: metadata.affiliateCode || "",
            affiliateRewardAmount,
            affiliateDiscountAmount,
            paymentGateway: "stripe",
            paymentMode,
            paidAt: new Date(),
            paymentMetadata: {
              chargeId: paymentIntent.latest_charge,
              method: charge.payment_method_details?.type,
              receiptUrl: charge.receipt_url,
              brand: charge.payment_method_details?.card?.brand,
              last4: charge.payment_method_details?.card?.last4,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Order saved successfully: ${order._id}`);

        slot.participants.push({
          userId: user._id,
          name: user.user.name,
          profileImage: user.user.profileImage || "",
          paymentStatus: "paid",
          attendanceStatus: "joined",
          joinRequestTime: new Date(),
          adults,
          children,
        });
        await slot.save();

        console.log(
          `✅ Participant added for user ${user._id} with ${adults} adults and ${children} children.`
        );

        break;
      }

      case "payment_intent.payment_failed":
        console.log("❌ Payment Failed");
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("⚠️ Webhook verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

exports.createActivityPaymentIntent = async (req, res) => {
  const stripe = getStripeInstance();
  const { items, affiliateCode, appliedDiscountCode } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing items in request body" });
  }

  const {
    activityId,
    scheduleId,
    startDate,
    amountAdults = 1,
    amountChildren = 0,
  } = items[0];

  if (!activityId || !scheduleId || !startDate) {
    return res
      .status(400)
      .json({ error: "activityId, scheduleId, and startDate are required" });
  }

  try {
    // 1) ตรวจสอบ Activity
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // 2) ตรวจสอบ Slot จาก ActivitySlot แทน
    const slot = await ActivitySlot.findById(scheduleId);
    if (!slot) {
      return res.status(404).json({ error: "Schedule (slot) not found" });
    }
    if (
      slot.activityId.toString() !== activityId.toString() &&
      slot.activityId !== activityId
    ) {
      return res
        .status(400)
        .json({ error: "Schedule does not belong to the specified activity." });
    }

    // 3) ราคาผู้ใหญ่ / เด็ก
    const adultPrice = slot.priceAdult || activity.priceAdult || slot.cost || 0;
    const childPrice = slot.priceChild || activity.priceChild || slot.cost || 0;

    // 4) คำนวณราคาก่อนส่วนลด
    const originalPrice =
      adultPrice * amountAdults + childPrice * amountChildren;

    let discountAmount = 0;
    let discountCodeId = null;

    // 5) ตรวจสอบ DiscountCode
    if (appliedDiscountCode) {
      let discountQuery = { code: appliedDiscountCode };
      const caseInsensitiveQuery = {
        code: { $regex: `^${appliedDiscountCode}$`, $options: "i" },
      };

      let discountDoc =
        (await DiscountCode.findOne(discountQuery)) ||
        (await DiscountCode.findOne(caseInsensitiveQuery));

      if (!discountDoc) {
        return res
          .status(400)
          .json({ error: "Invalid discount code provided." });
      }

      const now = new Date();

      if (!discountDoc.isActive) {
        return res.status(400).json({ error: "Discount code is not active." });
      }
      if (now < new Date(discountDoc.validFrom)) {
        return res
          .status(400)
          .json({ error: "Discount code is not yet valid." });
      }
      if (now > new Date(discountDoc.validUntil)) {
        return res.status(400).json({ error: "Discount code has expired." });
      }
      if (
        discountDoc.usageLimit !== null &&
        discountDoc.usedCount >= discountDoc.usageLimit
      ) {
        return res
          .status(400)
          .json({ error: "Discount code usage limit reached." });
      }

      if (discountDoc.discountType === "amount") {
        discountAmount = discountDoc.discountValue;
      } else if (discountDoc.discountType === "percent") {
        discountAmount = (originalPrice * discountDoc.discountValue) / 100;
      } else if (discountDoc.discountType === "fixed_price") {
        discountAmount = originalPrice - discountDoc.discountValue;
      } else if (discountDoc.discountType === "free") {
        discountAmount = originalPrice;
      }

      if (discountAmount > originalPrice) {
        discountAmount = originalPrice;
      }

      discountCodeId = discountDoc._id.toString();
    }

    const paidAmount = Math.max(originalPrice - discountAmount, 0);

    // 6) ตรวจสอบ AffiliateCode
    let affiliateUserId = null;
    if (affiliateCode) {
      const affiliateUser = await User.findOne({ affiliateCode });
      if (affiliateUser) {
        affiliateUserId = affiliateUser._id.toString();
      }
    }

    console.log("🔢 originalPrice =", originalPrice);
    console.log("🔢 discountAmount =", discountAmount);
    console.log("🔢 paidAmount =", paidAmount);

    // 7) สร้าง Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paidAmount * 100),
      currency: "thb",
      automatic_payment_methods: { enabled: true },
      metadata: {
        activityId,
        scheduleId: slot._id.toString(),
        startDate,
        originalPrice,
        discountAmount,
        paidAmount,
        adults: amountAdults,
        children: amountChildren,
        discountCodeId: discountCodeId || "",
        affiliateCode: affiliateCode || "",
        affiliateUserId: affiliateUserId || "",
        appliedDiscountCode: appliedDiscountCode || "",
        paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
      },
    });

    return res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("❌ Error creating payment intent:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.createActivityPaymentIntentฺBackup = async (req, res) => {
  const stripe = getStripeInstance();
  const { items, affiliateCode } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing items in request body" });
  }

  const {
    activityId,
    scheduleId,
    startDate,
    amountAdults = 1,
    amountChildren = 0,
    discountCodeId = null,
    affiliateUserId = null,
    appliedDiscountCode = "",
  } = items[0];

  if (!activityId || !scheduleId || !startDate) {
    return res
      .status(400)
      .json({ error: "activityId, scheduleId, and startDate are required" });
  }

  try {
    // ตรวจสอบว่า activityId และ scheduleId มีอยู่
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    const schedule = activity.schedule.find(
      (s) => s._id.toString() === scheduleId
    );
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // ราคาผู้ใหญ่ / เด็ก
    const adultPrice =
      schedule.priceAdult || activity.priceAdult || schedule.cost || 0;
    console.log(`------------------- adultPrice = ${adultPrice}`);
    const childPrice =
      schedule.priceChild || activity.priceChild || schedule.cost || 0;
    console.log(`------------------- childPrice = ${childPrice}`);

    // คำนวณราคาจริง
    const originalPrice =
      adultPrice * amountAdults + childPrice * amountChildren;

    // จะใช้ระบบส่วนลดภายหลัง ตอนนี้ให้เป็น 0
    const discountAmount = 0;
    const paidAmount = originalPrice - discountAmount;

    // ✅ หาจาก affiliateCode
    let affiliateUserId = null;
    if (affiliateCode) {
      const affiliateUser = await User.findOne({ affiliateCode });
      if (affiliateUser) {
        affiliateUserId = affiliateUser._id.toString();
      }
    }

    // log ไว้เช็ก
    console.log("🔢 originalPrice =", originalPrice);
    console.log("🔢 discountAmount =", discountAmount);
    console.log("🔢 paidAmount =", paidAmount);

    // Validate affiliateUserId และ discountCodeId (optional)
    const validDiscountCodeId =
      discountCodeId && mongoose.Types.ObjectId.isValid(discountCodeId)
        ? discountCodeId
        : "";
    const validAffiliateUserId =
      affiliateUserId && mongoose.Types.ObjectId.isValid(affiliateUserId)
        ? affiliateUserId
        : "";

    // สร้าง PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paidAmount * 100), // Stripe ใช้หน่วยสตางค์
      currency: "thb",
      automatic_payment_methods: { enabled: true },
      metadata: {
        activityId,
        scheduleId,
        startDate,
        originalPrice,
        discountAmount,
        paidAmount,
        adults: amountAdults,
        children: amountChildren,
        discountCodeId: discountCodeId || "",
        affiliateCode: affiliateCode || "",
        affiliateUserId: affiliateUserId || "",
        paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
      },
    });

    return res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("❌ Error creating payment intent:", error.message);
    return res.status(400).json({ error: error.message });
  }
};

exports.getAllActivityOrders = async (req, res) => {
  res.send("Hello get all orders");
};

exports.getActivityOrdersByUserId = async (req, res) => {
  try {
    const userId = req.params.userId; // รับ userId จากพารามิเตอร์

    // ค้นหา orders ของ userId
    const orders = await Order.find({ userId: userId }).populate({
      path: "activityId",
    });

    // ตรวจสอบหากไม่พบข้อมูล
    if (orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    // ส่งข้อมูลที่ได้กลับไปยัง client
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders by userId:", error);
    res.status(500).json({ message: "Server error" });
  }
};
