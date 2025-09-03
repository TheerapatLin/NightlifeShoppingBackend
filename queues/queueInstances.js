// queues/queueInstances.js
const { Queue, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const { REDISDATABASEURI } = process.env;
const connection = new IORedis(REDISDATABASEURI, {
  maxRetriesPerRequest: null,
});

const {} = require("./producer")

const jobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 3000 },
  removeOnComplete: { age: 3600, count: 500 },
  removeOnFail: { age: 3600 },
};

const webhookHandlerQueue = new Queue("webhookHandler-queue", { connection });
const webhookHandlerQueueEvent = new QueueEvents("webhookHandler-queue", {
  connection,
});

const sendOrderBookedEmailQueue = new Queue("sendOrder-Email-queue", {
  connection,
});
const sendOrderBookedEmailQueueEvent = new QueueEvents(
  "sendOrder-Email-queue",
  { connection }
);

// ✅ Subscription Queue - สำหรับจัดการ subscription lifecycle
const subscriptionQueue = new Queue("subscription-queue", {
  connection,
});
const subscriptionQueueEvent = new QueueEvents("subscription-queue", {
  connection,
});

// ✅ Email Notification Queue - สำหรับส่ง email notifications ทุกประเภท
const emailNotificationQueue = new Queue("email-notification-queue", {
  connection,
});
const emailNotificationQueueEvent = new QueueEvents("email-notification-queue", {
  connection,
});


// ✅ webhookHandlerShopping
const webhookHandlerShoppingQueue = new Queue("webhookHandlerShopping-queue", {
  connection
})
const webhookHandlerShoppingQueueEvent = new QueueEvents("webhookHandlerShopping-queue", {
  connection
})

// webhookHandlerShoppingQueueEvent.on('waiting', ({ jobId }) => {
//   console.log(`A job with ID ${jobId} is waiting`);
// });

// webhookHandlerShoppingQueueEvent.on('active', ({ jobId, prev }) => {
//   console.log(`Job ${jobId} is now active; previous status was ${prev}`);
// });

// webhookHandlerShoppingQueueEvent.on('completed', ({ jobId, returnvalue }) => {
//   console.log(`${jobId} has completed and returned ${returnvalue}`);
// });

// webhookHandlerShoppingQueueEvent.on('failed', ({ jobId, failedReason }) => {
//   console.log(`${jobId} has failed with reason ${failedReason}`);
// });

// ✅ Email OrderShopping Queue - สำหรับส่ง email หลังจ่ายเงินซื้อสินค้าเสร็จแล้ว
const sendOrderShoppingEmailQueue = new Queue("sendOrderShopping-Email-queue", {
  connection
})
const sendOrderShoppingEmailQueueEvent = new QueueEvents("sendOrderShopping-Email-queue", {
  connection
})

module.exports = {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  subscriptionQueue,
  subscriptionQueueEvent,
  emailNotificationQueue,
  emailNotificationQueueEvent,
  webhookHandlerShoppingQueue,
  webhookHandlerShoppingQueueEvent,
  sendOrderShoppingEmailQueue,
  sendOrderShoppingEmailQueueEvent,
  jobOptions,
  connection,
};
