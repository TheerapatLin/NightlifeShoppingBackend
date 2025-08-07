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

module.exports = {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  jobOptions,
  connection, // ✅ << ใส่อันนี้เข้าไป
};
