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
  removeOnComplete: true, // ลบทันทีเมื่อ completed
  removeOnFail: {
    age: 3600           // หาก fail ให้ลบ event นี้ภายใน 1 ชม.
  }
}

// ------------------------------- createPaymentIntent Queue ------------------------------- //
const createPaymentIntentQueue = new Queue('createPaymentIntent-queue', { connection })
const createPaymentIntentQueueEvent = new QueueEvents('createPaymentIntent-queue', { connection })

// // --------------------------------------------- STATUS QUEUE EVENT --------------------------------------------- //
// createPaymentIntentQueueEvent.on('completed', (job) => {
//   console.log(`✅ Producer : createPaymentIntent => Job ${job} completed!!`)
// })

// createPaymentIntentQueueEvent.on('failed', ({ job, failedReason }) => {
//   console.log(`❌ Producer : createPaymentIntent => Job ${job} failed: ${failedReason}`)
// })

// --------------------------------------------- createPaymentIntent Worker --------------------------------------------- //
const createPaymentIntentWorker = new Worker('createPaymentIntent-queue', async job => {
  const {createPaymentIntentService} = require('../controllers/activityOrderControllers')
  const result = await createPaymentIntentService(job.data);
  return result
}, {
  connection,             // เชื่อมต่อ ioredis
  jobOptions
})

// // --------------------------------------------- STATUS Worker EVENT --------------------------------------------- //
// createPaymentIntentWorker.on('completed', job => {
//   console.log(`✅ Worker : createPaymentIntent => Job ${job.id} complete!!`)
// })

// createPaymentIntentWorker.on('failed', (job, err) => {
//   console.log(`❌ Worker : createPaymentIntent => Job ${job.id} failed... : ${err.message}`)
// })

// // check worker running
// if (createPaymentIntentWorker.isRunning()) {
//   console.log('createPaymentIntentWorker is running...')
// }


// ------------------------------- webhookHandler Queue ------------------------------- //
const webhookHandlerQueue = new Queue('webhookHandler-queue', { connection })
const webhookHandlerQueueEvent = new QueueEvents('webhookHandler-queue', { connection })

// // --------------------------------------------- STATUS QUEUE EVENT --------------------------------------------- //
// webhookHandlerQueueEvent.on('completed', (job) => {
//   console.log(`✅ Producer : webhookHandler => Job ${job} completed!!`)
// })

// webhookHandlerQueueEvent.on('failed', ({ job, failedReason }) => {
//   console.log(`❌ Producer : webhookHandler => Job ${job} failed: ${failedReason}`)
// })

// --------------------------------------------- createPaymentIntent Worker --------------------------------------------- //
const webhookHandlerWorker = new Worker('webhookHandler-queue', async job => {
  const {webhookHandlerService} = require('../controllers/activityOrderControllers')
  const result = webhookHandlerService(job.data)
  // console.log(`job.data => ${JSON.stringify(job, null, 2)}`)
  return result
}, {
  connection,             // เชื่อมต่อ ioredis
  jobOptions
})

// // --------------------------------------------- STATUS Worker EVENT --------------------------------------------- //
// webhookHandlerWorker.on('completed', job => {
//   console.log(`✅ Worker : webhookHandler => Job ${job.id} complete!!`)
// })

// webhookHandlerWorker.on('failed', (job, err) => {
//   console.log(`❌ Worker : webhookHandler => Job ${job.id} failed... : ${err.message}`)
// })

// // check worker running
// if (webhookHandlerWorker.isRunning()) {
//   console.log('webhookHandlerWorker is running...')
// }


module.exports = {
  createPaymentIntentQueue,
  createPaymentIntentQueueEvent,
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  jobOptions
}