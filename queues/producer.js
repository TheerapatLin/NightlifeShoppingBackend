const {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  jobOptions,
  connection, // ✅ ต้อง import มาด้วย
} = require("./queueInstances");

const { Worker } = require("bullmq");
const sendOrderBookedEmail = require("../modules/email/sendOrderBookedEmail");

const webhookHandlerWorker = new Worker(
  "webhookHandler-queue",
  async (job) => {
    const {
      webhookHandlerService,
    } = require("../controllers/activityOrderControllers");
    return await webhookHandlerService(job.data);
  },
  { connection, jobOptions }
);

const sendOrderBookedEmailWorker = new Worker(
  "sendOrder-Email-queue",
  async (job) => {
    const { order, user, activity, slot } = job.data;
    return await sendOrderBookedEmail(order, user, activity, slot);
  },
  { connection, jobOptions }
);

module.exports = {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  jobOptions,
};
