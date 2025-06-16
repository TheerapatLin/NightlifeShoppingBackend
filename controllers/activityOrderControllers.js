const {
  getStripeInstance,
  getEndpointSecret,
  calculateOrderAmount,
} = require("../utils/stripeUtils");

const Order = require("../schemas/v1/activityOrder.schema");
const User = require("../schemas/v1/user.schema");
const RegularUserData = require("../schemas/v1/userData/regularUserData.schema");
const Activity = require("../schemas/v1/activity.schema");
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
exports.createActivityPaymentIntent = async (req, res) => {
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
        const scheduleId = metadata.scheduleId;
        const startDate = metadata.startDate;

        const originalPrice = parseFloat(metadata.originalPrice || "0");
        const discountAmount = parseFloat(metadata.discountAmount || "0");
        const paidAmount = paymentIntent.amount_received / 100;

        const adults = parseInt(metadata.adults || "1");
        const children = parseInt(metadata.children || "0");
        const discountCodeId = metadata.discountCodeId || null;
        const affiliateUserId = metadata.affiliateUserId || null;

        const paymentMode = metadata.paymentMode || "test";

        console.log("📦 Metadata received:", metadata);
        console.log("✅ Validating Activity & Schedule");

        const activity = await Activity.findOne({ _id: activityId });
        if (!activity) {
          console.error(`Activity with ID ${activityId} not found.`);
          return res.status(400).send({ error: "Invalid activityId" });
        }

        const scheduleExists = activity.schedule.some(
          (schedule) => schedule._id.toString() === scheduleId
        );
        if (!scheduleExists) {
          console.error(`Schedule with ID ${scheduleId} not found.`);
          return res.status(400).send({ error: "Invalid scheduleId" });
        }

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
              email: email,
              activated: false,
              verified: { email: false, phone: false },
            },
            businessId: "1",
            userType: "regular",
            userData: regularUserData._id,
            userTypeData: "RegularUserData",
            affiliateCode: await generateAffiliateCode(), // ✅ เพิ่มตรงนี้
          });

          await user.save();

          const resetToken = crypto.randomBytes(32).toString("hex");
          redis.set(`${email}-setPasswordToken`, resetToken, "EX", 3600);

          const setPasswordLink = `${process.env.BASE_URL}/api/v1/accounts/set-password?token=${resetToken}&email=${email}`;
          await sendSetPasswordEmail(email, setPasswordLink);

          console.log(`✅ User created and email sent: ${email}`);
        }

        await Order.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          {
            paymentIntentId: paymentIntent.id,
            activityId,
            scheduleId,
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
          {
            upsert: true,
            new: true,
            runValidators: true,
          }
        );

        console.log("✅ Order saved successfully");
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
