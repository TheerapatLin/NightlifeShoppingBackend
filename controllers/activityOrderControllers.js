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
const BasketShopping = require("../schemas/v1/shopping/shopping.baskets.schema")
const ProductShopping = require("../schemas/v1/shopping/shopping.products.schema")
const ProductShoppingOrder = require("../schemas/v1/shopping/shopping.productOrder.schema")
const crypto = require("crypto");
const redis = require("../modules/database/redis");
const { sendSetPasswordEmail } = require("../modules/email/email");
const sendEmail = require("../modules/email/sendVerifyEmail");
const sendOrderBookedEmail = require("../modules/email/sendOrderBookedEmail");
const sendOrderShoppingBillEmail = require("../modules/email/sendOrderShoppingBillEmail")
const {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  jobOptions,
} = require("../queues/queueInstances");

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

// --------------------------------------------- webhookHandler QM --------------------------------------------- //

//เมื่อสถานะการจ่ายถูกส่งกลับมาจาก Stripe
exports.webhookHandlerService = async (event) => {
  const stripe = getStripeInstance();
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      // console.log("🎯 this is payment_intent.succeeded event:", event);

      // ✅ ป้องกันซ้ำจาก Stripe Retry
      const lockKey = `stripe-webhook-lock:${paymentIntent.id}:${event.type}`;
      const locked = await redis.get(lockKey);
      if (locked) {
        console.log("⚠️ Duplicate processing blocked via Redis lock");
        return { status: "200", message: "Duplicate blocked" };
      }
      await redis.set(lockKey, "locked", "EX", 90);

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

      // console.log(`metadata => ${metadata.basketId}`)
      console.log("📦 Metadata received:", metadata);
      console.log("✅ Validating Activity & ActivitySlot");

      const activity = await Activity.findById(activityId);
      if (!activity) {
        console.error(`❌ Activity with ID ${activityId} not found.`);
        return {
          error: true,
          message: "Invalid activityId.",
          status: "400",
        };
      }

      const slot = await ActivitySlot.findById(activitySlotId);
      if (!slot) {
        console.error(`❌ ActivitySlot with ID ${activitySlotId} not found.`);
        return {
          error: true,
          message: "Invalid activitySlotId.",
          status: "400",
        };
      }

      if (slot.activityId.toString() !== activityId.toString()) {
        console.error(
          `❌ ActivitySlot ${activitySlotId} does not belong to Activity ${activityId}`
        );
        return {
          error: true,
          message: "ActivitySlot does not belong to this Activity.",
          status: "400",
        };
      }

      console.log(`✅ ActivitySlot found: ${slot._id}`);

      const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
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
      await sendOrderBookedEmailQueue.add(
        `sendOrder-email-${Date.now()}`,
        {
          order,
          user,
          activity,
          slot,
        },
        jobOptions
      );

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
      console.log("🎯 event:", event);
  }
};

exports.webhookHandlerShoppingService = async (event) => {
  const stripe = getStripeInstance();
  console.log(`event type => ${event.type}`)
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;

      // ✅ ป้องกันซ้ำจาก Stripe Retry
      const lockKey = `stripe-webhook-lock:${paymentIntent.id}:${event.type}`;
      const locked = await redis.get(lockKey);
      if (locked) {
        console.log("⚠️ Duplicate processing blocked via Redis lock");
        return { status: "200", message: "Duplicate blocked" };
      }
      await redis.set(lockKey, "locked", "EX", 90);

      const metadata = paymentIntent.metadata || {};
      const paymentMode = metadata.paymentMode || "test";

      const basketId = metadata.basketId
      const basket = await BasketShopping.findById(basketId)
      if (!basket) {
        console.error(`❌ Basket with ID ${basketId} not found.`);
        return {
          error: true,
          message: "Invalid basketId.",
          status: "400",
        };
      }

      const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
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

      const items = basket.items
      let adminNote = []

      for (const item of items) {
        const productId = item.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res.status(400).json({ message: "ไม่พบ productId" });
        }

        const product = await ProductShopping.findById(productId);

        if (!product) {
          return res.status(404).json({ message: "ไม่พบ product" });
        }

        const sku = item.variant.sku;

        for (let index = 0; index < product.variants.length; index++) {
          if (product._id.toString() === String(productId).trim() && product.variants[index].sku === sku) {
            if (product.variants[index].quantity < item.quantity) {
              console.error(`❌ จ่ายเงินแล้วแต่สินค้า ${product.variants[index].sku} มีไม่เพียงพอ`)
              adminNote.push({
                message: `จ่ายเงินแล้วแต่สินค้า ${product.variants[index].sku} มีไม่เพียงพอ`,
                createdAt: Date.now()
              });
              product.variants[index].quantity = 0
              product.variants[index].soldQuantity += item.quantity
              continue
            }
            product.variants[index].quantity -= item.quantity
            product.variants[index].soldQuantity += item.quantity
          } 
        }
        await product.save()
      }

      try {
        const orderShopping = await ProductShoppingOrder.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          {
            paymentIntentId: paymentIntent.id,
            items: [...basket.items],
            userId: user._id,
            status: "paid",
            originalPrice: basket.totalPrice,
            paymentMode: paymentMode,
            paymentGateway: "stripe",
            paidAt: new Date(),
            paymentMetadata: {
              chargeId: paymentIntent.latest_charge,
              method: charge.payment_method_details?.type,
              receiptUrl: charge.receipt_url,
              brand: charge.payment_method_details?.card?.brand,
              last4: charge.payment_method_details?.card?.last4,
            },
            $push: {
              adminNote: [...adminNote]
            }
          },
          { upsert: true, new: true, runValidators: true }
        )

        console.log(`✅ Order saved successfully: ${orderShopping._id}`);

        // clear items in basket
        basket.items = []
        basket.totalPrice = 0
        await basket.save()
        await sendOrderShoppingBillEmail(orderShopping,user)
      }
      catch (error) {
        console.error("❌ Error saving order:", error.message);
      }
      break;
    }
    case "payment_intent.payment_failed": {
      console.log("❌ Payment Failed");

      break;
    }
    default:
      console.log(`⚠️ Unhandled event type: ${event.type}`);
      console.log("🎯 event:", event);
  }
}

//เมื่อสถานะการจ่ายถูกส่งกลับมาจาก Stripe
exports.webhookHandler = async (req, res) => {
  const stripe = getStripeInstance();
  const endpointSecret = getEndpointSecret();
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    let emailUser = "";

    const dataObject = event.data.object;

    switch (dataObject.object) {
      case "charge": {
        if (dataObject.billing_details.email) {
          emailUser = dataObject.billing_details.email;
        }
        break;
      }
      default:
        console.warn("⚠️ Cannot extract email: Unknown object type");
    }

    const metaData = dataObject.metadata

    if (metaData.activityId) {
      // สร้าง job และนำ job เข้าสู่ queue
      const job = await webhookHandlerQueue.add(
        `user-${emailUser || "unknown"}-ts-${Date.now()}`,
        event,
        jobOptions
      );

      // รอผลลัพธ์จากการประมวลผลใน worker
      const response = await job.waitUntilFinished(webhookHandlerQueueEvent);

      if (!response) {
        console.log("⚠️ No response returned from webhook worker.");
        return res.status(200).json({ message: "No response, event skipped" });
      }

      // if error
      switch (response.status) {
        case "400":
          return res.status(400).json({ message: response.message });
        case "404":
          return res.status(404).json({ message: response.message });
      }
    } else if (metaData.basketId) {
      await exports.webhookHandlerShoppingService(event)
    }

    res.json({ received: true });
  } catch (err) {
    console.error("⚠️ Webhook verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

// --------------------------------------------- createPaymentIntent QM --------------------------------------------- //
exports.createActivityPaymentIntent = async (req, res) => {
  const stripe = getStripeInstance();
  const {
    items,
    affiliateCode,
    appliedDiscountCode,
    previousPaymentIntentId,
    userEmail, // ✅ เพิ่มตรงนี้
  } = req.body;
  console.log("🎯 Incoming userEmail from frontend:", userEmail);
  console.log(
    "🎯 Incoming appliedDiscountCode from frontend:",
    appliedDiscountCode
  );

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
        console.log("🔍 Found discountDoc:", discountDoc);
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

        // ✅ ตรวจอีเมลตาม restriction type
        const lowerEmail = (userEmail || "").toLowerCase();
        console.log("🔒 userRestrictionMode:", discountDoc.userRestrictionMode);
        console.log("✅ Email to check:", lowerEmail);
        console.log("📛 Allowed emails:", discountDoc.allowedUserEmails);
        console.log("🚫 Blocked emails:", discountDoc.blockedUserEmails);
        if (discountDoc.userRestrictionMode === "include") {
          if (
            !Array.isArray(discountDoc.allowedUserEmails) ||
            !discountDoc.allowedUserEmails
              .map((e) => e.toLowerCase())
              .includes(lowerEmail)
          ) {
            return res.status(400).json({
              error:
                "This discount code is not available for your email. Please enter the correct emails before using code.",
            });
          }
        } else if (discountDoc.userRestrictionMode === "exclude") {
          if (
            Array.isArray(discountDoc.blockedUserEmails) &&
            discountDoc.blockedUserEmails
              .map((e) => e.toLowerCase())
              .includes(lowerEmail)
          ) {
            return res.status(400).json({
              error: "This discount code cannot be used with your email.",
            });
          }
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
        }
      } catch (err) {
        console.warn(
          `⚠️ Could not retrieve previous PaymentIntent: ${err.message}`
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

    console.log("🎯 paymentIntent:", paymentIntent);

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
    console.error("❌ Error creating payment intent:", error);
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

// ✅ Superadmin: Get all orders with activity, user, and slot populated
exports.getAllOrdersForSuperadmin = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 70;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({})
        .sort({ createdAt: -1 }) // 🕒 ล่าสุดก่อน
        .skip(skip)
        .limit(limit)
        .populate("activityId", "nameTh nameEn title")
        .populate("activitySlotId", "startTime endTime")
        .populate("userId", "user"),
      Order.countDocuments(),
    ]);

    res.json({
      total,
      page,
      pageSize: limit,
      orders,
    });
  } catch (err) {
    console.error("❌ Failed to fetch orders:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateOrderById = async (req, res) => {
  const { id } = req.params;
  const { adminNote, status, paidAmount, paidAt } = req.body;

  const updateFields = {};

  if (adminNote !== undefined) updateFields.adminNote = adminNote;
  if (status !== undefined) updateFields.status = status;
  if (paidAmount !== undefined) updateFields.paidAmount = paidAmount;
  if (paidAt !== undefined) updateFields.paidAt = new Date(paidAt);

  try {
    const order = await Order.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    })
      .populate("activityId", "nameTh nameEn title")
      .populate("activitySlotId", "startTime endTime")
      .populate("userId", "user");

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (err) {
    console.error("❌ Failed to update order:", err);
    res.status(500).json({ message: "Server error" });
  }
};
