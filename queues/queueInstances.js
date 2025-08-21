// queues/queueInstances.js
const { Queue, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const { REDISDATABASEURI } = process.env;
const connection = new IORedis(REDISDATABASEURI, {
  maxRetriesPerRequest: null,
});

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

module.exports = {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  subscriptionQueue,
  subscriptionQueueEvent,
  emailNotificationQueue,
  emailNotificationQueueEvent,
  jobOptions,
  connection,
};
