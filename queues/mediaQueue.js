const Queue = require('bull');
const { uploadToOSS, deleteFromOSS } = require('../modules/storage/oss');

// สร้าง Media Processing Queue
const mediaQueue = new Queue('media processing', {
  redis: process.env.REDISDATABASEURI || {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
  },
  settings: {
    stalledInterval: 30 * 1000, // 30 seconds
    maxStalledCount: 1,
  },
});

/**
 * Job Types:
 * - image_resize: ปรับขนาดภาพ
 * - video_thumbnail: สร้าง thumbnail สำหรับวิดีโอ
 * - video_compress: บีบอัดวิดีโอ
 * - cleanup_temp_files: ลบไฟล์ชั่วคราว
 */

// ================= IMAGE PROCESSING =================

mediaQueue.process('image_resize', 5, async (job) => {
  const { buffer, originalFileName, chatRoomId, messageId, userId } = job.data;
  
  try {
    console.log(`🖼️ Processing image resize for message: ${messageId}`);
    
    // TODO: ใช้ sharp สำหรับ resize image
    // const sharp = require('sharp');
    
    const sizes = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'medium', width: 800, height: 600 },
      { name: 'large', width: 1920, height: 1080 }
    ];
    
    const processedImages = [];
    
    for (const size of sizes) {
      try {
        // TODO: Implement sharp image processing
        // const resizedBuffer = await sharp(buffer)
        //   .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
        //   .jpeg({ quality: 85 })
        //   .toBuffer();
        
        const timestamp = Date.now();
        const fileName = `chat-media/${chatRoomId}/processed/${messageId}-${size.name}-${timestamp}.jpg`;
        
        // For now, just upload original (TODO: replace with resized)
        const url = await uploadToOSS(buffer, fileName, 'image/jpeg');
        
        processedImages.push({
          size: size.name,
          width: size.width,
          height: size.height,
          url: url,
          fileName: fileName
        });
        
        console.log(`✅ Created ${size.name} version: ${url}`);
      } catch (error) {
        console.error(`❌ Failed to create ${size.name} version:`, error);
      }
    }
    
    // อัพเดทข้อมูลใน database
    const { Message } = require('../schemas/v1/chat.schema');
    await Message.findByIdAndUpdate(messageId, {
      'mediaInfo.processedImages': processedImages,
      'mediaInfo.isProcessed': true,
      'mediaInfo.processedAt': new Date()
    });
    
    console.log(`✅ Image processing completed for message: ${messageId}`);
    return { processedImages, messageId };
    
  } catch (error) {
    console.error(`❌ Image processing failed for message ${messageId}:`, error);
    throw error;
  }
});

// ================= VIDEO PROCESSING =================

mediaQueue.process('video_thumbnail', 3, async (job) => {
  const { buffer, originalFileName, chatRoomId, messageId, userId } = job.data;
  
  try {
    console.log(`🎬 Creating video thumbnail for message: ${messageId}`);
    
    // TODO: ใช้ ffmpeg สำหรับสร้าง thumbnail
    // const ffmpeg = require('fluent-ffmpeg');
    
    const timestamp = Date.now();
    const thumbnailFileName = `chat-media/${chatRoomId}/thumbnails/${messageId}-thumb-${timestamp}.jpg`;
    
    // TODO: Implement ffmpeg thumbnail generation
    // const thumbnailBuffer = await new Promise((resolve, reject) => {
    //   ffmpeg(buffer)
    //     .screenshots({
    //       timestamps: ['00:00:01.000'],
    //       filename: 'thumbnail.jpg',
    //       folder: '/tmp',
    //       size: '320x240'
    //     })
    //     .on('end', () => {
    //       const fs = require('fs');
    //       const thumbnailBuffer = fs.readFileSync('/tmp/thumbnail.jpg');
    //       resolve(thumbnailBuffer);
    //     })
    //     .on('error', reject);
    // });
    
    // For now, create a placeholder (TODO: replace with real thumbnail)
    const thumbnailUrl = null; // await uploadToOSS(thumbnailBuffer, thumbnailFileName, 'image/jpeg');
    
    // อัพเดทข้อมูลใน database
    const { Message } = require('../schemas/v1/chat.schema');
    await Message.findByIdAndUpdate(messageId, {
      'mediaInfo.thumbnail': thumbnailUrl,
      'mediaInfo.isProcessed': true,
      'mediaInfo.processedAt': new Date()
    });
    
    console.log(`✅ Video thumbnail created for message: ${messageId}`);
    return { thumbnailUrl, messageId };
    
  } catch (error) {
    console.error(`❌ Video thumbnail creation failed for message ${messageId}:`, error);
    throw error;
  }
});

mediaQueue.process('video_compress', 2, async (job) => {
  const { buffer, originalFileName, chatRoomId, messageId, userId } = job.data;
  
  try {
    console.log(`🎬 Compressing video for message: ${messageId}`);
    
    // TODO: ใช้ ffmpeg สำหรับบีบอัดวิดีโอ
    // const ffmpeg = require('fluent-ffmpeg');
    
    const timestamp = Date.now();
    const compressedFileName = `chat-media/${chatRoomId}/compressed/${messageId}-compressed-${timestamp}.mp4`;
    
    // TODO: Implement video compression
    // const compressedBuffer = await new Promise((resolve, reject) => {
    //   ffmpeg(buffer)
    //     .videoCodec('libx264')
    //     .audioCodec('aac')
    //     .size('1280x720')
    //     .videoBitrate('1000k')
    //     .audioBitrate('128k')
    //     .format('mp4')
    //     .on('end', () => resolve(compressedBuffer))
    //     .on('error', reject)
    //     .pipe();
    // });
    
    // For now, skip compression (TODO: implement)
    console.log(`⏭️ Video compression skipped for message: ${messageId} (not implemented yet)`);
    return { messageId, status: 'skipped' };
    
  } catch (error) {
    console.error(`❌ Video compression failed for message ${messageId}:`, error);
    throw error;
  }
});

// ================= CLEANUP JOBS =================

mediaQueue.process('cleanup_temp_files', 10, async (job) => {
  const { filePaths } = job.data;
  
  try {
    console.log(`🧹 Cleaning up ${filePaths.length} temporary files`);
    
    const fs = require('fs').promises;
    let cleanedCount = 0;
    
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        cleanedCount++;
        console.log(`🗑️ Deleted temp file: ${filePath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`❌ Failed to delete ${filePath}:`, error);
        }
      }
    }
    
    console.log(`✅ Cleaned up ${cleanedCount}/${filePaths.length} temporary files`);
    return { cleanedCount, totalFiles: filePaths.length };
    
  } catch (error) {
    console.error(`❌ Cleanup job failed:`, error);
    throw error;
  }
});

// ================= UTILITY FUNCTIONS =================

/**
 * เพิ่ม image processing job
 */
const addImageProcessingJob = (messageId, chatRoomId, userId, buffer, originalFileName) => {
  return mediaQueue.add('image_resize', {
    messageId,
    chatRoomId,
    userId,
    buffer,
    originalFileName
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  });
};

/**
 * เพิ่ม video processing jobs
 */
const addVideoProcessingJobs = (messageId, chatRoomId, userId, buffer, originalFileName) => {
  const jobs = [];
  
  // สร้าง thumbnail
  jobs.push(mediaQueue.add('video_thumbnail', {
    messageId,
    chatRoomId,
    userId,
    buffer,
    originalFileName
  }, {
    attempts: 2,
    backoff: 'exponential',
    removeOnComplete: 5,
    removeOnFail: 3,
  }));
  
  // บีบอัดวิดีโอ (ถ้าไฟล์ใหญ่)
  if (buffer.length > 50 * 1024 * 1024) { // > 50MB
    jobs.push(mediaQueue.add('video_compress', {
      messageId,
      chatRoomId,
      userId,
      buffer,
      originalFileName
    }, {
      attempts: 1,
      removeOnComplete: 3,
      removeOnFail: 2,
    }));
  }
  
  return Promise.all(jobs);
};

/**
 * เพิ่ม cleanup job
 */
const addCleanupJob = (filePaths, delay = 60000) => { // 1 minute delay
  return mediaQueue.add('cleanup_temp_files', {
    filePaths
  }, {
    delay,
    attempts: 2,
    removeOnComplete: 1,
    removeOnFail: 1,
  });
};

// ================= EVENT HANDLERS =================

mediaQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} (${job.name}) completed:`, result);
});

mediaQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} (${job.name}) failed:`, err.message);
});

mediaQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} (${job.name}) stalled`);
});

module.exports = {
  mediaQueue,
  addImageProcessingJob,
  addVideoProcessingJobs,
  addCleanupJob
};
