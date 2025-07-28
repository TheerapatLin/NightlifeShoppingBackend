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


// --------------------------------------------- webhookHandler--------------------------------------------- //

exports.webhookHandlerService = async (event) => {
  const stripe = getStripeInstance();
  return "this is job webHandler"

}

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
        let discountCodeId = null;
        if (
          metadata.discountCodeId &&
          mongoose.Types.ObjectId.isValid(metadata.discountCodeId)
        ) {
          discountCodeId = new mongoose.Types.ObjectId(metadata.discountCodeId);
        }
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
            discountCodeUsed: metadata.appliedDiscountCode || "",
            discountCodeAmount: parseFloat(metadata.discountAmount || "0"),
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

    // สร้าง job และนำ job เข้าสู่ queue
    const job = await webhookHandlerQueue.add('webhookHandler-job', event, jobOptions)

    // รอผลลัพธ์จากการประมวลผลใน worker
    const response = await job.waitUntilFinished(webhookHandlerQueueEvent);
    console.log("response webhookHandler => ", response)

    // if error
    switch (response.status) {
      case "400":
        return res.status(400).json({ message: response.message });
      case "404":
        return res.status(404).json({ message: response.message });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("⚠️ Webhook verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

exports.createActivityPaymentIntent = async (req, res) => {
  const stripe = getStripeInstance();
  const { items, affiliateCode, appliedDiscountCode, previousPaymentIntentId } =
    req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing items in request body" });
  }

  console.log("\ud83d\udce6 CODE FROM CLIENT =", appliedDiscountCode);

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
    const activity = await Activity.findById(activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const slot = await ActivitySlot.findById(scheduleId);
    if (!slot)
      return res.status(404).json({ error: "Schedule (slot) not found" });

    if (slot.activityId.toString() !== activityId.toString()) {
      return res
        .status(400)
        .json({ error: "Schedule does not belong to the specified activity." });
    }

    const adultPrice = slot.priceAdult || activity.priceAdult || slot.cost || 0;
    const childPrice = slot.priceChild || activity.priceChild || slot.cost || 0;
    const originalPrice =
      adultPrice * amountAdults + childPrice * amountChildren;

    let discountAmount = 0;
    let discountCodeId = "";
    let discountDoc = null;
    let affiliateUserId = "";
    let affiliatorReward = 0;
    let affiliateDiscountAmount = 0;
    let affiliateBudgetApplyMode =
      activity.affiliate?.budgetApplyMode || "per_order";

    const totalValue = activity.affiliate?.totalValue || 0;
    const defaultRewardValue = activity.affiliate?.rewardValue || 0;

    let matchedAffiliateUser = null;
    const affiliateRoles = [
      "affiliator",
      "host_affiliator",
      "affiliator_host",
      "admin",
      "superadmin",
    ];

    if (appliedDiscountCode) {
      matchedAffiliateUser = await User.findOne({
        affiliateCode: appliedDiscountCode,
        role: { $in: affiliateRoles },
      });

      if (!matchedAffiliateUser) {
        discountDoc = await DiscountCode.findOne({
          code: new RegExp(`^${appliedDiscountCode}$`, "i"),
        });
        if (!discountDoc)
          return res
            .status(400)
            .json({ error: "Invalid discount code provided." });

        const now = new Date();
        if (
          !discountDoc.isActive ||
          now < discountDoc.validFrom ||
          now > discountDoc.validUntil
        ) {
          return res.status(400).json({ error: "Discount code is not valid." });
        }

        if (
          Array.isArray(discountDoc.eventIds) &&
          discountDoc.eventIdsInorExclude
        ) {
          const isMatch = discountDoc.eventIds.some(
            (id) => id.toString() === activityId.toString()
          );

          if (
            (discountDoc.eventIdsInorExclude === "include" && !isMatch) ||
            (discountDoc.eventIdsInorExclude === "exclude" && isMatch)
          ) {
            return res.status(400).json({
              error: "This code cannot be used with this activity.",
            });
          }
        }

        let calculatedDiscount = 0;
        const multiplier = discountDoc.isPerOrder
          ? 1
          : amountAdults + amountChildren;

        if (discountDoc.discountType === "amount") {
          calculatedDiscount = discountDoc.discountValue * multiplier;
        } else if (discountDoc.discountType === "percent") {
          const priceForCalc = discountDoc.isPerOrder
            ? originalPrice
            : adultPrice * amountAdults + childPrice * amountChildren;
          calculatedDiscount = (priceForCalc * discountDoc.discountValue) / 100;
        } else if (discountDoc.discountType === "fixed_price") {
          calculatedDiscount = originalPrice - discountDoc.discountValue;
        } else if (discountDoc.discountType === "free") {
          calculatedDiscount = originalPrice;
        }

        discountAmount = Math.min(calculatedDiscount, originalPrice);
        discountCodeId = discountDoc._id.toString();
      } else {
        affiliateUserId = matchedAffiliateUser._id.toString();
        const setting = matchedAffiliateUser.affiliateSettings.find(
          (s) => s.activityId.toString() === activityId.toString() && s.enabled
        );
        if (setting) {
          affiliatorReward = setting.affiliatorReward;
          affiliateDiscountAmount = setting.customerDiscount;
          affiliateBudgetApplyMode = setting.budgetApplyMode || "per_order";
        } else if (
          activity.affiliate?.enabled &&
          totalValue &&
          defaultRewardValue
        ) {
          affiliatorReward = defaultRewardValue;
          affiliateDiscountAmount = totalValue - defaultRewardValue;
          affiliateBudgetApplyMode =
            activity.affiliate?.budgetApplyMode || "per_order";
        }
      }
    }

    if (affiliateCode) {
      const affiliateUser = await User.findOne({ affiliateCode });
      if (affiliateUser) {
        affiliateUserId = affiliateUser._id.toString();
        const setting = affiliateUser.affiliateSettings.find(
          (s) => s.activityId.toString() === activityId.toString() && s.enabled
        );
        if (setting) {
          affiliatorReward = setting.affiliatorReward;
          affiliateDiscountAmount = setting.customerDiscount;
          affiliateBudgetApplyMode = setting.budgetApplyMode || "per_order";
        } else if (
          activity.affiliate?.enabled &&
          totalValue &&
          defaultRewardValue
        ) {
          affiliatorReward = defaultRewardValue;
          affiliateDiscountAmount = totalValue - defaultRewardValue;
          affiliateBudgetApplyMode =
            activity.affiliate?.budgetApplyMode || "per_order";
        }
      }
    }

    const totalDiscount = discountAmount + affiliateDiscountAmount;
    const paidAmount = Math.max(originalPrice - totalDiscount, 0);
    const amountInSatang = Math.round(paidAmount * 100);

    if (amountInSatang < 1000) {
      return res.status(400).json({
        error: "Total payable amount must be at least 10 THB.",
      });
    }

    if (affiliateBudgetApplyMode === "per_person") {
      const multiplier = amountAdults + amountChildren;
      affiliatorReward *= multiplier;
      affiliateDiscountAmount *= multiplier;
    }

    if (previousPaymentIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(
          previousPaymentIntentId
        );
        if (
          ["requires_payment_method", "requires_confirmation"].includes(
            existingIntent.status
          )
        ) {
          if (existingIntent.amount !== amountInSatang) {
            await stripe.paymentIntents.update(previousPaymentIntentId, {
              amount: amountInSatang,
              metadata: {
                ...existingIntent.metadata,
                activityId,
                scheduleId,
                startDate,
                originalPrice,
                discountAmount,
                affiliateDiscountAmount,
                paidAmount,
                adults: amountAdults,
                children: amountChildren,
                discountCodeId,
                affiliateCode: matchedAffiliateUser
                  ? matchedAffiliateUser.affiliateCode
                  : affiliateCode || "",
                affiliateUserId: matchedAffiliateUser
                  ? matchedAffiliateUser._id.toString()
                  : affiliateUserId,
                affiliatorReward,
                affiliateBudgetApplyMode,
                appliedDiscountCode: appliedDiscountCode || "",
                discountCodeAmount: discountAmount,
                paymentMode:
                  process.env.STRIPE_MODE === "live" ? "live" : "test",
              },
            });
            console.log(
              `\u2705 Updated PaymentIntent amount: ${previousPaymentIntentId}`
            );
          }
          return res.send({
            clientSecret: existingIntent.client_secret,
            originalPrice,
            paidAmount,
            discountAmount,
            affiliateDiscountAmount,
            paymentIntentId: existingIntent.id,
            discountCodeUsed: discountDoc ? discountDoc.code : undefined,
            discountCodeIsPerOrder: discountDoc
              ? discountDoc.isPerOrder
              : undefined,
            discountCodeDescriptions: discountDoc
              ? discountDoc.description
              : undefined,
            discountCodeShortDescriptions: discountDoc
              ? discountDoc.shortDescription
              : undefined,
          });
        } else {
          console.log(
            `\u26a0\ufe0f PaymentIntent status ${existingIntent.status} cannot be reused, creating new.`
          );
        }
      } catch (err) {
        console.warn(
          `\u26a0\ufe0f Could not retrieve previous PaymentIntent: ${err.message}`
        );
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSatang,
      currency: "thb",
      automatic_payment_methods: { enabled: true },
      metadata: {
        activityId,
        scheduleId,
        startDate,
        originalPrice,
        discountAmount,
        affiliateDiscountAmount,
        paidAmount,
        adults: amountAdults,
        children: amountChildren,
        discountCodeId,
        affiliateCode: matchedAffiliateUser
          ? matchedAffiliateUser.affiliateCode
          : affiliateCode || "",
        affiliateUserId: matchedAffiliateUser
          ? matchedAffiliateUser._id.toString()
          : affiliateUserId,
        affiliatorReward,
        affiliateBudgetApplyMode,
        appliedDiscountCode: appliedDiscountCode || "",
        discountCodeAmount: discountAmount,
        paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
      },
    });

    return res.send({
      clientSecret: paymentIntent.client_secret,
      originalPrice,
      paidAmount,
      discountAmount,
      affiliateDiscountAmount,
      paymentIntentId: paymentIntent.id,
      discountCodeUsed: discountDoc ? discountDoc.code : undefined,
      discountCodeIsPerOrder: discountDoc ? discountDoc.isPerOrder : undefined,
      discountCodeDescriptions: discountDoc
        ? discountDoc.description
        : undefined,
      discountCodeShortDescriptions: discountDoc
        ? discountDoc.shortDescription
        : undefined,
    });
  } catch (error) {
    console.error("\u274c Error creating payment intent:", error);
    return res.status(500).json({ error: "Internal server error" });
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