const { Queue, QueueEvents, Worker } = require('bullmq')
const IORedis = require('ioredis')
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
const { REDISDATABASEURI } = process.env;
const connection = new IORedis(`${REDISDATABASEURI}`, {
  maxRetriesPerRequest: null
})

const jobOptions = {
  attempts: 3,            // จำนวนครั้งที่ retry ถ้า failed
  backoff: {
    type: 'exponential',// 3s => 6s => 12s
    delay: 3000         // หน่วงเวลา 3 วินาทีก่อน retry
  },
  removeOnComplete: {
    age: 3600,
    count: 500
  }, // เก็บ job ที่ complete ไว้ 1 ชม. เป็นจำนวน 500 job
  removeOnFail: {
    age: 3600           // หาก fail ให้ลบ event นี้ภายใน 1 ชม.
  }
}

// ------------------------------- createPaymentIntent QUEUE ------------------------------- //
const createPaymentIntentQueue = new Queue('createPaymentIntent-queue', { connection })
const createPaymentIntentQueueEvent = new QueueEvents('createPaymentIntent-queue', { connection })

// // --------------------------------------------- STATUS QUEUE --------------------------------------------- //
// createPaymentIntentQueueEvent.on('completed', (job) => {
//   console.log(`✅ Producer : createPaymentIntent => Job ${job} completed!!`)
// })

// createPaymentIntentQueueEvent.on('failed', ({ job, failedReason }) => {
//   console.log(`❌ Producer : createPaymentIntent => Job ${job} failed: ${failedReason}`)
// })

// --------------------------------------------- createPaymentIntent WORKER --------------------------------------------- //
const createPaymentIntentWorker = new Worker('createPaymentIntent-queue', async job => {
  try {
    const { createPaymentIntentService } = require('../controllers/activityOrderControllers');
    const result = await createPaymentIntentService(job.data)
    return result;
  } catch (error) {
    console.error(`[Worker Error] createPaymentIntent-queue => ${error}`);
    return {
      error: true,
      message: "Processing createPaymentIntentWorker failed.",
      status: "500"
    };
  }
}, {
  connection,             // เชื่อมต่อ ioredis
  jobOptions
})

// // --------------------------------------------- STATUS WORKER --------------------------------------------- //
// createPaymentIntentWorker.on('completed', job => {
//   console.log(`✅ Worker : createPaymentIntent => Job ${job.id} complete!!`)
//   console.log('job data => ', job.name)
// })

// createPaymentIntentWorker.on('failed', (job, err) => {
//   console.log(`❌ Worker : createPaymentIntent => Job ${job.id} failed... : ${err.message}`)
// })

// // check worker running
// if (createPaymentIntentWorker.isRunning()) {
//   console.log('createPaymentIntentWorker is running...')
// }


// ------------------------------- webhookHandler QUEUE ------------------------------- //
const webhookHandlerQueue = new Queue('webhookHandler-queue', { connection })
const webhookHandlerQueueEvent = new QueueEvents('webhookHandler-queue', { connection })

// // --------------------------------------------- STATUS QUEUE --------------------------------------------- //
// webhookHandlerQueueEvent.on('completed', (job) => {
//   console.log(`✅ Producer : webhookHandler => Job ${job} completed!!`)
// })

// webhookHandlerQueueEvent.on('failed', ({ job, failedReason }) => {
//   console.log(`❌ Producer : webhookHandler => Job ${job} failed: ${failedReason}`)
// })

// --------------------------------------------- webhookHandler WORKER --------------------------------------------- //
const webhookHandlerWorker = new Worker('webhookHandler-queue', async job => {
  try {
    const { webhookHandlerService } = require('../controllers/activityOrderControllers')
    const result = webhookHandlerService(job.data)
    // console.log(`job.data => ${JSON.stringify(job, null, 2)}`)
    return result
  } catch (error) {
    console.error(`[Worker Error] webhookHandler-queue => ${error}`);
    return {
      error: true,
      message: "Processing webhookHandlerWorker failed.",
      status: "500"
    };
  }

}, {
  connection,             // เชื่อมต่อ ioredis
  jobOptions
})

// // --------------------------------------------- STATUS WORKER --------------------------------------------- //
// webhookHandlerWorker.on('completed', job => {
//   console.log(`✅ Worker : webhookHandler => Job ${job.id} complete!!`)
//   console.log('job data => ',job.name)
// })

// webhookHandlerWorker.on('failed', (job, err) => {
//   console.log(`❌ Worker : webhookHandler => Job ${job.id} failed... : ${err.message}`)
// })

// // check worker running
// if (webhookHandlerWorker.isRunning()) {
//   console.log('webhookHandlerWorker is running...')
// }

// ------------------------------- webhookHandler QUEUE ------------------------------- //
const sendOrderBookedEmailQueue = new Queue('sendOrder-Email-queue', { connection })
const sendOrderBookedEmailQueueEvent = new QueueEvents('sendOrder-Email-queue', { connection })

// --------------------------------------------- webhookHandler WORKER --------------------------------------------- //
const sendOrderBookedEmailWorker = new Worker('sendOrder-Email-queue', async job => {
  try {
    const sendOrderBookedEmail = require("../modules/email/sendOrderBookedEmail");
    const {order,user,activity,slot} = job.data
    await sendOrderBookedEmail(order,user,activity,slot);
  } catch (error) {
    console.error(`[Worker Error] sendOrder-Email-queue => ${error}`);
    return {
      error: true,
      message: "Processing sendOrderBookedEmailWorker failed.",
      status: "500"
    };
  }

}, {
  connection,             // เชื่อมต่อ ioredis
  jobOptions
})

module.exports = {
  createPaymentIntentQueue,
  createPaymentIntentQueueEvent,
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  jobOptions
}