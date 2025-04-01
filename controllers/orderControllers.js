const {
  getStripeInstance,
  getEndpointSecret,
  calculateOrderAmount,
} = require("../utils/stripeUtils");

const Order = require("../schemas/v1/order.schema");
const User = require("../schemas/v1/user.schema");
const RegularUserData = require("../schemas/v1/userData/regularUserData.schema");
const Activity = require("../schemas/v1/activity.schema");
const crypto = require("crypto");
const redis = require("../app");
const { sendSetPasswordEmail } = require("../modules/email/email");

//4242424242424242 (test code)
exports.createPaymentIntent = async (req, res) => {
  const stripe = getStripeInstance();
  // console.log("stripe :", stripe);
  const { items } = req.body;
  console.log("items :", items);

  const activityId = items[0]?.activityId;
  const scheduleId = items[0]?.scheduleId;
  const startDate = items[0]?.startDate;
  // console.log("✅ activityId :", activityId);
  // console.log("✅ scheduleId :", scheduleId);
  if (!activityId || !scheduleId) {
    console.log("❌ activityId and scheduleId are required");
    return res
      .status(400)
      .send({ error: "activityId and scheduleId are required" });
  } else {
    console.log("✅ activityId :", activityId);
    console.log("✅ scheduleId :", scheduleId);
  }

  try {
    const activity = await Activity.findOne({ _id: activityId });
    if (!activity) {
      return res.status(404).send({ error: "Activity not found" });
    }
    const schedule = activity.schedule.find(
      (schedule) => schedule._id.toString() === scheduleId
    );
    if (!schedule) {
      return res.status(404).send({ error: "Schedule not found" });
    }

    const cost = schedule.cost;
    console.log("---- Cost :", cost);
    console.log("---- Adults :", items[0].amountAdults);
    console.log("---- Children :", items[0].amountChildren);
    const paymentIntent = await stripe.paymentIntents.create({
      //amount: calculateOrderAmount(items),
      //amount: 7000,
      amount: cost * (items[0].amountAdults + items[0].amountChildren) * 100,
      currency: "thb",
      automatic_payment_methods: { enabled: true },
      metadata: {
        activityId, // ส่ง activityId ไปใน metadata
        scheduleId, // ส่ง scheduleId ไปใน metadata
        startDate, // ส่ง startDate ไปใน metadata
      },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(400).send({ error: error.message });
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
        const activityId = paymentIntent.metadata?.activityId;
        const scheduleId = paymentIntent.metadata?.scheduleId;
        const startDate = paymentIntent.metadata?.startDate;

        console.log("Start Date:", startDate);
        console.log("Activity ID:", activityId);
        console.log("Schedule ID:", scheduleId);

        // ตรวจสอบว่า activityId และ scheduleId มีอยู่ในฐานข้อมูล
        const activity = await Activity.findOne({ _id: activityId });

        if (!activity) {
          console.error(`Activity with ID ${activityId} not found.`);
          return res.status(400).send({ error: "Invalid activityId" });
        }

        const scheduleExists = activity.schedule.some(
          (schedule) => schedule._id.toString() === scheduleId
        );

        if (!scheduleExists) {
          console.error(
            `Schedule with ID ${scheduleId} not found in activity ${activityId}.`
          );
          return res.status(400).send({ error: "Invalid scheduleId" });
        }

        console.log("Activity and Schedule validated successfully.");

        // ดึงข้อมูล Charge ที่เกี่ยวข้อง
        const charge = await stripe.charges.retrieve(
          paymentIntent.latest_charge
        );
        const { name, email } = charge.billing_details;

        // ตรวจสอบ User
        let user = await User.findOne({ "user.email": email });

        if (!user) {
          // สร้าง RegularUserData ใหม่
          const regularUserData = new RegularUserData({});
          await regularUserData.save();

          // สร้าง User ใหม่
          user = new User({
            role: "user",
            user: {
              name: name || "Unknown User",
              email: email,
              activated: false, // ผู้ใช้ต้องยืนยันอีเมล
              verified: { email: false, phone: false },
            },
            businessId: "1",
            userType: "regular",
            userData: regularUserData._id,
            userTypeData: "RegularUserData",
          });

          await user.save();

          // สร้างโทเค็นตั้งรหัสผ่าน
          const resetToken = crypto.randomBytes(32).toString("hex");
          redis.set(`${email}-setPasswordToken`, resetToken, "EX", 3600); // มีอายุ 1 ชั่วโมง

          // ส่งอีเมลสำหรับตั้งรหัสผ่าน
          const setPasswordLink = `${process.env.BASE_URL}/api/v1/accounts/set-password?token=${resetToken}&email=${email}`;
          await sendSetPasswordEmail(email, setPasswordLink);

          console.log(
            `✅ User created and set password email sent to ${email}`
          );
        }

        // บันทึก Order
        await Order.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          {
            paymentIntentId: paymentIntent.id,
            activityId,
            scheduleId,
            userId: user._id,
            status: "paid",
            bookingDate: startDate,
          },
          {
            upsert: true, // สร้างเอกสารใหม่ถ้ายังไม่มี
            new: true, // คืนค่าข้อมูลล่าสุดที่อัปเดต
            runValidators: true, // ตรวจสอบข้อมูลตาม Schema
          }
        );

        console.log("✅ User and Order updated successfully");
        break;
      }
      case "payment_intent.payment_failed":
        console.log("❌ Payment Failed");
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("⚠️ Webhook verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

exports.getAllOrders = async (req, res) => {
  res.send("Hello get all orders");
};

exports.getOrdersByUserId = async (req, res) => {
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