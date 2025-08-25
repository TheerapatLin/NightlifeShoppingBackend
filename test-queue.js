// โหลด environment variables
require('dotenv').config({ path: '.env-nl' });

const { mediaQueue, addImageProcessingJob } = require('./queues/mediaQueue');

async function testQueue() {
  try {
    console.log('🔄 Testing Queue System...');
    
    // ทดสอบการเชื่อมต่อ Redis
    console.log('📡 Testing Redis connection...');
    
    // สร้าง test job
    console.log('➕ Adding test image processing job...');
    
    const testBuffer = Buffer.from('test image data', 'utf-8');
    const job = await addImageProcessingJob(
      'test-message-123',
      'test-room-456', 
      'test-user-789',
      testBuffer,
      'test-image.jpg'
    );
    
    console.log(`✅ Job added successfully: ${job.id}`);
    console.log(`📋 Job data:`, job.data);
    
    // ตรวจสอบ queue status
    setTimeout(async () => {
      const waiting = await mediaQueue.getWaiting();
      const active = await mediaQueue.getActive();
      const completed = await mediaQueue.getCompleted();
      const failed = await mediaQueue.getFailed();
      
      console.log('\n📊 Queue Statistics:');
      console.log(`⏳ Waiting jobs: ${waiting.length}`);
      console.log(`🔄 Active jobs: ${active.length}`);
      console.log(`✅ Completed jobs: ${completed.length}`);
      console.log(`❌ Failed jobs: ${failed.length}`);
      
      if (waiting.length > 0) {
        console.log('\n⏳ Waiting jobs:');
        waiting.forEach(job => {
          console.log(`  - Job ${job.id}: ${job.name} (${job.data.messageId})`);
        });
      }
      
      if (failed.length > 0) {
        console.log('\n❌ Failed jobs:');
        failed.forEach(job => {
          console.log(`  - Job ${job.id}: ${job.failedReason}`);
        });
      }
      
      console.log('\n🎯 Queue Dashboard: http://localhost:3101/admin/queues');
      console.log('✅ Queue system test completed!');
      
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Queue test failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the test
testQueue();
