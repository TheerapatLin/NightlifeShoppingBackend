const OSS = require("ali-oss");

const OSSStorage = new OSS({
  endpoint: process.env.OSS_ENDPOINT,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET_NAME,
});

/**
 * อัพโลดไฟล์ไปยัง OSS
 * @param {Buffer} buffer - ไฟล์ buffer
 * @param {string} fileName - ชื่อไฟล์ในระบบ OSS
 * @param {string} mimeType - ประเภทไฟล์
 * @returns {Promise<string>} - URL ของไฟล์ที่อัพโลดแล้ว
 */
const uploadToOSS = async (buffer, fileName, mimeType) => {
  try {
    console.log(`📤 Uploading file: ${fileName}, type: ${mimeType}, size: ${buffer.length} bytes`);
    
    const result = await OSSStorage.put(fileName, buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
      },
    });

    console.log(`✅ File uploaded successfully: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('❌ OSS Upload Error:', error);
    throw new Error(`Failed to upload file to OSS: ${error.message}`);
  }
};

/**
 * ลบไฟล์จาก OSS
 * @param {string} fileName - ชื่อไฟล์ที่จะลบ
 * @returns {Promise<boolean>} - สถานะการลบ
 */
const deleteFromOSS = async (fileName) => {
  try {
    console.log(`🗑️ Deleting file: ${fileName}`);
    await OSSStorage.delete(fileName);
    console.log(`✅ File deleted successfully: ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ OSS Delete Error:', error);
    throw new Error(`Failed to delete file from OSS: ${error.message}`);
  }
};

/**
 * สร้าง signed URL สำหรับการดาวน์โหลดไฟล์
 * @param {string} fileName - ชื่อไฟล์
 * @param {number} expires - เวลาหมดอายุ (วินาที) default 3600 (1 ชั่วโมง)
 * @returns {string} - Signed URL
 */
const getSignedUrl = (fileName, expires = 3600) => {
  try {
    const url = OSSStorage.signatureUrl(fileName, { expires });
    console.log(`🔗 Generated signed URL for: ${fileName}`);
    return url;
  } catch (error) {
    console.error('❌ OSS Signed URL Error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * ตรวจสอบว่าไฟล์มีอยู่หรือไม่
 * @param {string} fileName - ชื่อไฟล์
 * @returns {Promise<boolean>} - true ถ้าไฟล์มีอยู่
 */
const fileExists = async (fileName) => {
  try {
    await OSSStorage.head(fileName);
    return true;
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
};

/**
 * ลบโฟลเดอร์และไฟล์ทั้งหมดข้างใน
 * @param {string} prefix - prefix ของโฟลเดอร์
 * @returns {Promise<number>} - จำนวนไฟล์ที่ลบ
 */
const deleteFolder = async (prefix) => {
  try {
    console.log(`🗑️ Deleting folder: ${prefix}`);
    
    const list = await OSSStorage.list({ prefix });
    if (!list.objects || list.objects.length === 0) {
      console.log(`📁 Folder ${prefix} is empty or doesn't exist`);
      return 0;
    }

    const deletePromises = list.objects.map(obj => OSSStorage.delete(obj.name));
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${list.objects.length} files from folder: ${prefix}`);
    return list.objects.length;
  } catch (error) {
    console.error('❌ OSS Delete Folder Error:', error);
    throw new Error(`Failed to delete folder from OSS: ${error.message}`);
  }
};

module.exports = { 
  OSSStorage,
  uploadToOSS,
  deleteFromOSS,
  getSignedUrl,
  fileExists,
  deleteFolder
};