const { Queue, QueueEvents } = require('bullmq')
const IORedis = require('ioredis')
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
const { REDISDATABASEURI } = process.env;

const connection = new IORedis(`${REDISDATABASEURI}`, {
  maxRetriesPerRequest: null
})

const queueGetAcivityById = new Queue('getAcivityByIdJob', { connection })

// ------------------------------- STATUS EVENT ------------------------------- //

const queueGetAcivityByIdEvent = new QueueEvents('getAcivityByIdJob', { connection })

queueGetAcivityByIdEvent.on('completed', (job) => {
  console.log(`Producer => Job ${job.jobId} completed!!`)
  // console.log(`job : ${JSON.stringify(job, null, 2)}`)
  // console.log(`job return : ${JSON.stringify(job.returnvalue, null, 2)}`)
})

queueGetAcivityByIdEvent.on('failed', ({ job, failedReason }) => {
  console.log(`Producer => Job ${job.jobId} failed: ${failedReason}`)
})

module.exports = {
  queueGetAcivityById,
  queueGetAcivityByIdEvent
}