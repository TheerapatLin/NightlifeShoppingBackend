const { Queue, QueueEvents, Worker } = require('bullmq')
const IORedis = require('ioredis')
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
const { REDISDATABASEURI } = process.env;
const connection = new IORedis(`${REDISDATABASEURI}`, {
  maxRetriesPerRequest: null
})

const workerOptions = {
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

// ------------------------------- getActivityById Queue ------------------------------- //
const queueGetAcivityById = new Queue('getAcivityById-queue', { connection })
const queueGetAcivityByIdEvent = new QueueEvents('getAcivityById-queue', { connection })


// --------------------------------------------- STATUS QUEUE EVENT --------------------------------------------- //
// queueGetAcivityByIdEvent.on('completed', (job) => {
//   console.log(`✅ Producer : get-activity-by -id => Job ${job.jobId} completed!!`)
//   // console.log(`job : ${JSON.stringify(job, null, 2)}`)
//   // console.log(`job return : ${JSON.stringify(job.returnvalue, null, 2)}`)
// })

// queueGetAcivityByIdEvent.on('failed', ({ job, failedReason }) => {
//   console.log(`❌ Producer : get-activity-by -id => Job ${job.jobId} failed: ${failedReason}`)
// })


// --------------------------------------------- getAcivityById Worker --------------------------------------------- //
const getAcivityByIdWorker = new Worker('getAcivityById-queue', async job => {  // สร้าง worker ของ getAcivityById
  const {
    getActivityByIdService
  } = require("../controllers/activityController");

  const { activityId } = job.data;
  // console.log(`Worker => Processing job ${job.id} with data : ${job.name}`) // ดู status ของ worker
  const result = await getActivityByIdService(activityId) // ส่งคิวไปประมวลผล
  return result
}, {
  connection,             // เชื่อมต่อ ioredis
  workerOptions
})


// --------------------------------------------- STATUS WORKER EVENT --------------------------------------------- //
// getAcivityByIdWorker.on('completed', job => {
//   console.log(`✅ Worker : get-activity-by -id => Job ${job.id} complete!!`)
// })

// getAcivityByIdWorker.on('failed', (job, err) => {
//   console.log(`❌ Worker : get-activity-by -id => Job ${job.id} failed... : ${err.message}`)
// })

// if (getAcivityByIdWorker.isRunning()) {
//   console.log('getAcivityById Worker is running...')
// }




// ------------------------------- createPaymentIntent Queue ------------------------------- //
const createPaymentIntentQueue = new Queue('createPaymentIntent-queue', { connection })
const createPaymentIntentQueueEvent = new QueueEvents('createPaymentIntent-queue', { connection })


// --------------------------------------------- STATUS QUEUE EVENT --------------------------------------------- //
// createPaymentIntentQueueEvent.on('completed', (job) => {
//   console.log(`✅ Producer : create-payment-intent => Job ${job} completed!!`)
//   // console.log(`job : ${JSON.stringify(job, null, 2)}`)
//   // console.log(`job return : ${JSON.stringify(job.returnvalue, null, 2)}`)
// })

// createPaymentIntentQueueEvent.on('failed', ({ job, failedReason }) => {
//   console.log(`❌ Producer : create-payment-intent => Job ${job} failed: ${failedReason}`)
// })

// --------------------------------------------- createPaymentIntent Worker --------------------------------------------- //
const createPaymentIntentWorker = new Worker('createPaymentIntent-queue', async job => {
  const {createPaymentIntentService} = require('../controllers/activityOrderControllers')
  const result = await createPaymentIntentService(job.data);
  return result
}, {
  connection,             // เชื่อมต่อ ioredis
  workerOptions
})


// --------------------------------------------- STATUS Worker EVENT --------------------------------------------- //
// createPaymentIntentWorker.on('completed', job => {
//   console.log(`✅ Worker : create-payment-intent => Job ${job.id} complete!!`)
// })

// createPaymentIntentWorker.on('failed', (job, err) => {
//   console.log(`❌ Worker : create-payment-intent => Job ${job.id} failed... : ${err.message}`)
// })

// if (createPaymentIntentWorker.isRunning()) {
//   console.log('createActivityPaymentIntentWorker is running...')
// }



// ------------------------------- webhookHandler Queue ------------------------------- //
const webhookHandlerQueue = new Queue('webhookHandler-queue', { connection })
const webhookHandlerQueueEvent = new QueueEvents('webhookHandler-queue', { connection })

// --------------------------------------------- STATUS QUEUE EVENT --------------------------------------------- //
webhookHandlerQueueEvent.on('completed', (job) => {
  console.log(`✅ Producer : webhookHandler => Job ${job} completed!!`)
})

webhookHandlerQueueEvent.on('failed', ({ job, failedReason }) => {
  console.log(`❌ Producer : webhookHandler => Job ${job} failed: ${failedReason}`)
})

// --------------------------------------------- createPaymentIntent Worker --------------------------------------------- //
const webhookHandlerWorker = new Worker('webhookHandler-queue', async job => {
  const {webhookHandlerService} = require('../controllers/activityOrderControllers')
  const result = webhookHandlerService(job.data)
  // console.log(`job.data => ${JSON.stringify(job, null, 2)}`)
  return result
}, {
  connection,             // เชื่อมต่อ ioredis
  workerOptions
})


// --------------------------------------------- STATUS Worker EVENT --------------------------------------------- //
webhookHandlerWorker.on('completed', job => {
  console.log(`✅ Worker : webhookHandler => Job ${job.id} complete!!`)
})

webhookHandlerWorker.on('failed', (job, err) => {
  console.log(`❌ Worker : webhookHandler => Job ${job.id} failed... : ${err.message}`)
})

if (webhookHandlerWorker.isRunning()) {
  console.log('webhookHandlerWorker is running...')
}


module.exports = {
  queueGetAcivityById,
  queueGetAcivityByIdEvent,
  createPaymentIntentQueue,
  createPaymentIntentQueueEvent,
  webhookHandlerQueue,
  webhookHandlerQueueEvent
}