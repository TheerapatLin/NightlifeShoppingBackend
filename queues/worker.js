const { Worker } = require('bullmq')
const IORedis = require('ioredis')
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
const { REDISDATABASEURI } = process.env;



const connection = new IORedis(`${REDISDATABASEURI}`, {
    maxRetriesPerRequest: null
})

const worker = new Worker('getAcivityByIdJob', async job => {  // สร้าง worker ของ getAcivityById
    const {
        getActivityByIdService
    } = require("../controllers/activityController");

    const { activityId } = job.data;
    console.log(`Worker => Processing job ${job.id} with data : ${job.name}`) // ดู status ของ worker
    const result = await getActivityByIdService(activityId) // ส่งคิวไปประมวลผล
    return result
}, {
    connection,             // เชื่อมต่อ ioredis
    attempts: 3,            // จำนวนครั้งที่ retry ถ้า failed
    backoff: {
        type: 'exponential',// 3s => 6s => 12s
        delay: 3000         // หน่วงเวลา 3 วินาทีก่อน retry
    },
    removeOnComplete: true, // ลบทันทีเมื่อ completed
    removeOnFail: {
        age: 3600           // หาก fail ให้ลบ event นี้ภายใน 1 ชม.
    }
})

// ------------------------------- STATUS EVENT ------------------------------- //
worker.on('completed', job => {
    console.log(`Worker => Job ${job.id} complete!!`)
})

worker.on('failed', (job, err) => {
    console.log(`Worker => Job ${job.id} failed... : ${err.message}`)
})

if (worker.isRunning()) {
    console.log('Worker is running...')

}
