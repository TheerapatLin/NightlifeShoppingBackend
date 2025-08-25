// โหลด environment variables
require('dotenv').config({ path: '.env-nl' });

const { uploadToOSS } = require('./modules/storage/oss');
const fs = require('fs');
const path = require('path');

async function testUpload() {
  try {
    console.log('🚀 Starting OSS upload test...');

    // สร้างภาพทดสอบ (ใช้ SVG เพื่อความง่าย)
    const testImageSVG = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#4F46E5"/>
  <text x="100" y="100" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">
    Test Image
  </text>
  <text x="100" y="130" font-family="Arial" font-size="14" fill="white" text-anchor="middle" dominant-baseline="middle">
    ${new Date().toISOString()}
  </text>
</svg>`;

    // แปลงเป็น buffer
    const imageBuffer = Buffer.from(testImageSVG, 'utf-8');
    console.log(`📦 Created test image buffer (${imageBuffer.length} bytes)`);

    // สร้างชื่อไฟล์
    const timestamp = Date.now();
    const fileName = `test1/test-image-${timestamp}.svg`;
    
    console.log(`📤 Uploading to: ${fileName}`);

    // อัพโลดไปยัง OSS
    const fileUrl = await uploadToOSS(imageBuffer, fileName, 'image/svg+xml');
    
    console.log('✅ Upload successful!');
    console.log('📍 File URL:', fileUrl);
    console.log('📁 Folder: test1');
    console.log('📄 Filename:', `test-image-${timestamp}.svg`);

    // ทดสอบอัพโลดภาพ PNG ด้วย (สร้าง simple PNG)
    console.log('\n🎨 Creating PNG test image...');
    
    // สร้าง PNG header สำหรับภาพ 1x1 pixel สีแดง
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
      0x90, 0x77, 0x53, 0xDE, // IHDR CRC
      0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
      0xE2, 0x21, 0xBC, 0x33, // IDAT CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // IEND CRC
    ]);

    const pngFileName = `test1/test-image-${timestamp}.png`;
    console.log(`📤 Uploading PNG to: ${pngFileName}`);
    
    const pngUrl = await uploadToOSS(pngData, pngFileName, 'image/png');
    
    console.log('✅ PNG Upload successful!');
    console.log('📍 PNG URL:', pngUrl);

    // ทดสอบอัพโลดไฟล์ text
    console.log('\n📝 Creating text file test...');
    const textContent = `
Test Upload Report
==================

Timestamp: ${new Date().toISOString()}
Test Type: OSS Upload Test
Folder: test1
Status: SUCCESS

Files uploaded:
1. test-image-${timestamp}.svg (SVG image)
2. test-image-${timestamp}.png (PNG image)
3. test-report-${timestamp}.txt (This file)

OSS Configuration:
- Endpoint: ${process.env.OSS_ENDPOINT}
- Bucket: ${process.env.OSS_BUCKET_NAME}
- Region: Southeast Asia

All uploads completed successfully! ✅
`;

    const textBuffer = Buffer.from(textContent, 'utf-8');
    const textFileName = `test1/test-report-${timestamp}.txt`;
    
    console.log(`📤 Uploading text file to: ${textFileName}`);
    const textUrl = await uploadToOSS(textBuffer, textFileName, 'text/plain');
    
    console.log('✅ Text file upload successful!');
    console.log('📍 Text URL:', textUrl);

    console.log('\n🎉 All uploads completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- SVG Image:', fileUrl);
    console.log('- PNG Image:', pngUrl);  
    console.log('- Text Report:', textUrl);
    console.log('\n✅ Check your OSS console in the "test1" folder!');

  } catch (error) {
    console.error('❌ Upload test failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the test
testUpload();
