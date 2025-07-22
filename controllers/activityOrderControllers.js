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

const {
  createPaymentIntentQueue,
  createPaymentIntentQueueEvent,
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  jobOptions 
} = require('../queues/producer')

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
        return {
          error: true,
          message: "Invalid activityId",
          status: "400"
        };
      }

      const slot = await ActivitySlot.findById(activitySlotId);
      if (!slot) {
        console.error(`❌ ActivitySlot with ID ${activitySlotId} not found.`);
        return {
          error: true,
          message: "Invalid activitySlotId",
          status: "400"
        };
      }

      if (slot.activityId.toString() !== activityId.toString()) {
        console.error(
          `❌ ActivitySlot ${activitySlotId} does not belong to Activity ${activityId}`
        );
        return {
          error: true,
          message: "ActivitySlot does not belong to this Activity",
          status: "400"
        };
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
  return `Payment Successful`
}

exports.webhookHandler = async (req, res) => {
  const stripe = getStripeInstance();
  const endpointSecret = getEndpointSecret();
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

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

// exports.createActivityPaymentIntent = async (req, res) => {
//   const stripe = getStripeInstance();
//   const { items, affiliateCode, appliedDiscountCode } = req.body;

//   if (!Array.isArray(items) || items.length === 0) {
//     return res.status(400).json({ error: "Missing items in request body" });
//   }

//   const {
//     activityId,
//     scheduleId,
//     startDate,
//     amountAdults = 1,
//     amountChildren = 0,
//   } = items[0];

//   if (!activityId || !scheduleId || !startDate) {
//     return res
//       .status(400)
//       .json({ error: "activityId, scheduleId, and startDate are required" });
//   }

//   try {
//     // 1) ตรวจสอบ Activity
//     const activity = await Activity.findById(activityId);
//     if (!activity) {
//       return res.status(404).json({ error: "Activity not found" });
//     }

//     // 2) ตรวจสอบ Slot จาก ActivitySlot แทน
//     const slot = await ActivitySlot.findById(scheduleId);
//     if (!slot) {
//       return res.status(404).json({ error: "Schedule (slot) not found" });
//     }
//     if (slot.activityId.toString() !== activityId.toString()) {
//       return res
//         .status(400)
//         .json({ error: "Schedule does not belong to the specified activity." });
//     }

//     // 3) ราคาผู้ใหญ่ / เด็ก
//     const adultPrice = slot.priceAdult || activity.priceAdult || slot.cost || 0;
//     const childPrice = slot.priceChild || activity.priceChild || slot.cost || 0;

//     // 4) คำนวณราคาก่อนส่วนลด
//     const originalPrice =
//       adultPrice * amountAdults + childPrice * amountChildren;

//     let discountAmount = 0;
//     let discountCodeId = null;

//     // 5) ตรวจสอบ DiscountCode
//     if (appliedDiscountCode) {
//       const discountDoc = await DiscountCode.findOne({
//         code: new RegExp(`^${appliedDiscountCode}$`, "i"),
//       });

//       if (!discountDoc) {
//         return res
//           .status(400)
//           .json({ error: "Invalid discount code provided." });
//       }

//       const now = new Date();

//       if (!discountDoc.isActive) {
//         return res.status(400).json({ error: "Discount code is not active." });
//       }
//       if (now < new Date(discountDoc.validFrom)) {
//         return res
//           .status(400)
//           .json({ error: "Discount code is not yet valid." });
//       }
//       if (now > new Date(discountDoc.validUntil)) {
//         return res.status(400).json({ error: "Discount code has expired." });
//       }
//       if (
//         discountDoc.usageLimit !== null &&
//         discountDoc.usedCount >= discountDoc.usageLimit
//       ) {
//         return res
//           .status(400)
//           .json({ error: "Discount code usage limit reached." });
//       }

//       if (discountDoc.discountType === "amount") {
//         discountAmount = discountDoc.discountValue;
//       } else if (discountDoc.discountType === "percent") {
//         discountAmount = (originalPrice * discountDoc.discountValue) / 100;
//       } else if (discountDoc.discountType === "fixed_price") {
//         discountAmount = originalPrice - discountDoc.discountValue;
//       } else if (discountDoc.discountType === "free") {
//         discountAmount = originalPrice;
//       }

//       if (discountAmount > originalPrice) {
//         discountAmount = originalPrice;
//       }

//       discountCodeId = discountDoc._id.toString();
//     }

//     // 6) ตรวจสอบ AffiliateCode และคำนวณส่วนลด affiliate
//     let affiliateUserId = null;
//     let affiliatorReward = 0;
//     let affiliateDiscountAmount = 0;

//     const totalValue = activity.affiliate?.totalValue || 0;
//     const defaultRewardValue = activity.affiliate?.rewardValue || 0;

//     if (affiliateCode) {
//       const affiliateUser = await User.findOne({ affiliateCode });
//       if (affiliateUser) {
//         affiliateUserId = affiliateUser._id.toString();

//         const setting = await AffiliateSetting.findOne({
//           userId: affiliateUserId,
//           activityId,
//           enabled: true,
//         });

//         if (setting) {
//           affiliatorReward = setting.affiliatorReward;
//           affiliateDiscountAmount = setting.customerDiscount;
//         } else {
//           affiliatorReward = defaultRewardValue;
//           affiliateDiscountAmount = totalValue - defaultRewardValue;
//         }
//       }
//     }

//     const totalDiscount = discountAmount + affiliateDiscountAmount;
//     const paidAmount = Math.max(originalPrice - totalDiscount, 0);

//     console.log("🔢 originalPrice =", originalPrice);
//     console.log("🔢 discountAmount =", discountAmount);
//     console.log("🔢 affiliateDiscountAmount =", affiliateDiscountAmount);
//     console.log("🔢 paidAmount =", paidAmount);

//     // 7) สร้าง Stripe PaymentIntent
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(paidAmount * 100),
//       currency: "thb",
//       automatic_payment_methods: { enabled: true },
//       metadata: {
//         activityId,
//         scheduleId: slot._id.toString(),
//         startDate,
//         originalPrice,
//         discountAmount,
//         affiliateDiscountAmount,
//         paidAmount,
//         adults: amountAdults,
//         children: amountChildren,
//         discountCodeId: discountCodeId || "",
//         affiliateCode: affiliateCode || "",
//         affiliateUserId: affiliateUserId || "",
//         affiliatorReward,
//         appliedDiscountCode: appliedDiscountCode || "",
//         paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
//       },
//     });

//     return res.send({ clientSecret: paymentIntent.client_secret });
//   } catch (error) {
//     console.error("❌ Error creating payment intent:", error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// };

// exports.createActivityPaymentIntent = async (req, res) => {
//   const stripe = getStripeInstance();
//   const { items, affiliateCode, appliedDiscountCode } = req.body;

//   if (!Array.isArray(items) || items.length === 0) {
//     return res.status(400).json({ error: "Missing items in request body" });
//   }

//   const {
//     activityId,
//     scheduleId,
//     startDate,
//     amountAdults = 1,
//     amountChildren = 0,
//   } = items[0];

//   if (!activityId || !scheduleId || !startDate) {
//     return res
//       .status(400)
//       .json({ error: "activityId, scheduleId, and startDate are required" });
//   }

//   try {
//     const activity = await Activity.findById(activityId);
//     if (!activity) {
//       return res.status(404).json({ error: "Activity not found" });
//     }

//     const slot = await ActivitySlot.findById(scheduleId);
//     if (!slot) {
//       return res.status(404).json({ error: "Schedule (slot) not found" });
//     }
//     if (slot.activityId.toString() !== activityId.toString()) {
//       return res
//         .status(400)
//         .json({ error: "Schedule does not belong to the specified activity." });
//     }

//     const adultPrice = slot.priceAdult || activity.priceAdult || slot.cost || 0;
//     const childPrice = slot.priceChild || activity.priceChild || slot.cost || 0;

//     const originalPrice =
//       adultPrice * amountAdults + childPrice * amountChildren;

//     let discountAmount = null; // ส่วนลดจากโค้ด
//     let discountCodeId = null;

//     if (appliedDiscountCode) {
//       const discountDoc = await DiscountCode.findOne({
//         code: new RegExp(`^${appliedDiscountCode}$`, "i"),
//       });

//       if (!discountDoc) {
//         return res
//           .status(400)
//           .json({ error: "Invalid discount code provided." });
//       }

//       const now = new Date();
//       if (!discountDoc.isActive) {
//         return res.status(400).json({ error: "Discount code is not active." });
//       }
//       if (now < new Date(discountDoc.validFrom)) {
//         return res
//           .status(400)
//           .json({ error: "Discount code is not yet valid." });
//       }
//       if (now > new Date(discountDoc.validUntil)) {
//         return res.status(400).json({ error: "Discount code has expired." });
//       }
//       if (
//         discountDoc.usageLimit !== null &&
//         discountDoc.usedCount >= discountDoc.usageLimit
//       ) {
//         return res
//           .status(400)
//           .json({ error: "Discount code usage limit reached." });
//       }

//       let calculatedDiscount = 0;
//       if (discountDoc.discountType === "amount") {
//         calculatedDiscount = discountDoc.discountValue;
//       } else if (discountDoc.discountType === "percent") {
//         calculatedDiscount = (originalPrice * discountDoc.discountValue) / 100;
//       } else if (discountDoc.discountType === "fixed_price") {
//         calculatedDiscount = originalPrice - discountDoc.discountValue;
//       } else if (discountDoc.discountType === "free") {
//         calculatedDiscount = originalPrice;
//       }
//       if (calculatedDiscount > originalPrice) {
//         calculatedDiscount = originalPrice;
//       }

//       discountAmount = calculatedDiscount;
//       discountCodeId = discountDoc._id.toString();
//     }

//     // ตรวจสอบ Affiliate Code
//     let affiliateUserId = null;
//     let affiliatorReward = 0;
//     let affiliateDiscountAmount = null; // ส่วนลดจาก affiliate

//     const totalValue = activity.affiliate?.totalValue || 0;
//     const defaultRewardValue = activity.affiliate?.rewardValue || 0;

//     if (affiliateCode) {
//       const affiliateUser = await User.findOne({ affiliateCode });
//       if (affiliateUser) {
//         affiliateUserId = affiliateUser._id.toString();

//         const setting = affiliateUser.affiliateSettings.find(
//           (s) => s.activityId.toString() === activityId.toString() && s.enabled
//         );

//         if (setting) {
//           affiliatorReward = setting.affiliatorReward;
//           affiliateDiscountAmount = setting.customerDiscount;
//         } else if (totalValue && defaultRewardValue) {
//           affiliatorReward = defaultRewardValue;
//           affiliateDiscountAmount = totalValue - defaultRewardValue;
//         }
//       }
//     }

//     const totalDiscount =
//       (discountAmount || 0) + (affiliateDiscountAmount || 0);
//     const paidAmount = Math.max(originalPrice - totalDiscount, 0);

//     console.log("✅ originalPrice =", originalPrice);
//     console.log("✅ discountAmount =", discountAmount);
//     console.log("✅ affiliateDiscountAmount =", affiliateDiscountAmount);
//     console.log("✅ paidAmount =", paidAmount);

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(paidAmount * 100),
//       currency: "thb",
//       automatic_payment_methods: { enabled: true },
//       metadata: {
//         activityId,
//         scheduleId: slot._id.toString(),
//         startDate,
//         originalPrice,
//         discountAmount: discountAmount || 0,
//         affiliateDiscountAmount: affiliateDiscountAmount || 0,
//         paidAmount,
//         adults: amountAdults,
//         children: amountChildren,
//         discountCodeId: discountCodeId || "",
//         affiliateCode: affiliateCode || "",
//         affiliateUserId: affiliateUserId || "",
//         affiliatorReward,
//         appliedDiscountCode: appliedDiscountCode || "",
//         paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
//       },
//     });

//     // ✅ ส่งกลับไป frontend พร้อมข้อมูลราคา
//     const responsePayload = {
//       clientSecret: paymentIntent.client_secret,
//       originalPrice,
//       paidAmount,
//     };

//     if (discountAmount !== null) {
//       responsePayload.discountAmount = discountAmount;
//     }
//     if (affiliateDiscountAmount !== null) {
//       responsePayload.affiliateDiscountAmount = affiliateDiscountAmount;
//     }

//     return res.send(responsePayload);
//   } catch (error) {
//     console.error("❌ Error creating payment intent:", error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// };

// --------------------------------------------- createPaymentIntent --------------------------------------------- //

exports.createPaymentIntentService = async (request) => {
  const stripe = getStripeInstance();
  const {
    items,
    affiliateCode,
    appliedDiscountCode,
    previousPaymentIntentId,
  } = request;

  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: true,
      message: "Missing items in request body",
      status: "400"
    };
  }

  const {
    activityId,
    scheduleId,
    startDate,
    amountAdults = 1,
    amountChildren = 0,
  } = items[0];

  if (!activityId || !scheduleId || !startDate) {
    return {
      error: true,
      message: "activityId, scheduleId, and startDate are required",
      status: "400"
    };
  }

  const activity = await Activity.findById(activityId);
  if (!activity) {
    return {
      error: true,
      message: "Activity not found",
      status: "404"
    };
  };

  const slot = await ActivitySlot.findById(scheduleId);
  if (!slot) {
    return {
      error: true,
      message: "Schedule (slot) not found",
      status: "404"
    };
  };

  if (slot.activityId.toString() !== activityId.toString()) {
    return {
      error: true,
      message: "Schedule does not belong to the specified activity.",
      status: "400"
    };
  }

  const adultPrice = slot.priceAdult || activity.priceAdult || slot.cost || 0;
  const childPrice = slot.priceChild || activity.priceChild || slot.cost || 0;
  const originalPrice =
    adultPrice * amountAdults + childPrice * amountChildren;

  let discountAmount = 0;
  let discountCodeId = "";

  if (appliedDiscountCode) {
    const discountDoc = await DiscountCode.findOne({
      code: new RegExp(`^${appliedDiscountCode}$`, "i"),
    });
    if (!discountDoc) {
      return {
        error: true,
        message: "Invalid discount code provided.",
        status: "400"
      };
    };

    const now = new Date();
    if (
      !discountDoc.isActive ||
      now < discountDoc.validFrom ||
      now > discountDoc.validUntil
    ) {
      return {
        error: true,
        message: "Discount code is not valid..",
        status: "400"
      };
    }

    let calculatedDiscount = 0;
    if (discountDoc.discountType === "amount")
      calculatedDiscount = discountDoc.discountValue;
    else if (discountDoc.discountType === "percent")
      calculatedDiscount = (originalPrice * discountDoc.discountValue) / 100;
    else if (discountDoc.discountType === "fixed_price")
      calculatedDiscount = originalPrice - discountDoc.discountValue;
    else if (discountDoc.discountType === "free")
      calculatedDiscount = originalPrice;

    discountAmount = Math.min(calculatedDiscount, originalPrice);
    discountCodeId = discountDoc._id.toString();
  }

  let affiliateUserId = "";
  let affiliatorReward = 0;
  let affiliateDiscountAmount = 0;
  let affiliateBudgetApplyMode =
    activity.affiliate?.budgetApplyMode || "per_order";

  const totalValue = activity.affiliate?.totalValue || 0;
  const defaultRewardValue = activity.affiliate?.rewardValue || 0;

  if (affiliateCode) {
    const affiliateUser = await User.findOne({ affiliateCode });
    if (affiliateUser) {
      affiliateUserId = affiliateUser._id.toString();
      const setting = affiliateUser.affiliateSettings.find(
        (s) =>
          s.activityId.toString() === activityId.toString() && s.enabled
      );
      if (setting) {
        affiliatorReward = setting.affiliatorReward;
        affiliateDiscountAmount = setting.customerDiscount;
        affiliateBudgetApplyMode = setting.budgetApplyMode || "per_order";
      } else if (totalValue && defaultRewardValue) {
        affiliatorReward = defaultRewardValue;
        affiliateDiscountAmount = totalValue - defaultRewardValue;
      }
    }
  }

  if (affiliateBudgetApplyMode === "per_person") {
    const multiplier = amountAdults + amountChildren;
    affiliatorReward *= multiplier;
    affiliateDiscountAmount *= multiplier;
  }

  const totalDiscount = discountAmount + affiliateDiscountAmount;
  const paidAmount = Math.max(originalPrice - totalDiscount, 0);
  const amountInSatang = Math.round(paidAmount * 100);

  // ---- REUSE PAYMENT INTENT ----
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
          });
          console.log(
            `✅ Updated PaymentIntent amount: ${previousPaymentIntentId}`
          );
        }
        return {
          clientSecret: existingIntent.client_secret,
          originalPrice,
          paidAmount,
          discountAmount,
          affiliateDiscountAmount,
          paymentIntentId: existingIntent.id,
        };
      } else {
        console.log(
          `⚠️ PaymentIntent status ${existingIntent.status} cannot be reused, creating new.`
        );
      }
    } catch (err) {
      console.warn("⚠️ Failed to reuse PaymentIntent:", err.message);
    }
  }

  // ---- CREATE PAYMENT INTENT ----
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
      affiliateCode: affiliateCode || "",
      affiliateUserId,
      affiliatorReward,
      affiliateBudgetApplyMode,
      appliedDiscountCode: appliedDiscountCode || "",
      paymentMode: process.env.STRIPE_MODE === "live" ? "live" : "test",
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    originalPrice,
    paidAmount,
    discountAmount,
    affiliateDiscountAmount,
    paymentIntentId: paymentIntent.id,
  };

}

exports.createActivityPaymentIntent = async (req, res) => {

  try {

    // สร้าง job และนำ job เข้าสู่ queue
    const job = await createPaymentIntentQueue.add('createPaymentIntent-job', req.body, jobOptions)

    // รอผลลัพธ์จากการประมวลผลใน worker
    const response = await job.waitUntilFinished(createPaymentIntentQueueEvent);

    // if error
    switch (response.status) {
      case "400":
        return res.status(400).json({ message: response.message });
      case "404":
        return res.status(404).json({ message: response.message });
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error("❌ Error in controller:", error);
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
