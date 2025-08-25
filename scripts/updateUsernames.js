// อัพเดต username ให้ผู้ใช้ที่ยังไม่มี username
require('dotenv').config({ path: '.env-nl' });
const mongoose = require('mongoose');
const User = require('../schemas/v1/user.schema');

async function updateUsernames() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://root:4A1243s3Kp3PJMM@8.213.197.68:27018/hiddengem?replicaSet=rs0&authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('🔗 Connected to MongoDB');

    // หาผู้ใช้ที่ยังไม่มี username
    const usersWithoutUsername = await User.find({
      $or: [
        { 'user.username': { $exists: false } },
        { 'user.username': null },
        { 'user.username': '' }
      ]
    });

    console.log(`📊 Found ${usersWithoutUsername.length} users without username`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of usersWithoutUsername) {
      if (user.user && user.user.email) {
        try {
          // สร้าง username จาก email
          const emailPart = user.user.email.split('@')[0];
          let username = emailPart.replace(/[.]/g, ''); // เอา . ออก
          
          // ตรวจสอบว่า username ซ้ำไหม
          let counter = 1;
          let originalUsername = username;
          
          while (await User.findOne({ 'user.username': username })) {
            username = `${originalUsername}${counter}`;
            counter++;
          }

          // อัพเดต username
          await User.findByIdAndUpdate(user._id, {
            $set: { 'user.username': username }
          });

          console.log(`✅ Updated user ${user.user.email} -> username: ${username}`);
          updatedCount++;
        } catch (error) {
          console.log(`❌ Failed to update user ${user.user.email}:`, error.message);
          skippedCount++;
        }
      } else {
        console.log(`⚠️ Skipped user ${user._id} - no email`);
        skippedCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`✅ Updated: ${updatedCount} users`);
    console.log(`⚠️ Skipped: ${skippedCount} users`);
    
    // ตรวจสอบผลลัพธ์
    const totalUsers = await User.countDocuments();
    const usersWithUsername = await User.countDocuments({ 
      'user.username': { $exists: true, $ne: '', $ne: null } 
    });
    
    console.log(`\n📊 Final Status:`);
    console.log(`👥 Total users: ${totalUsers}`);
    console.log(`📝 Users with username: ${usersWithUsername}`);
    console.log(`❓ Users without username: ${totalUsers - usersWithUsername}`);

  } catch (error) {
    console.error('❌ Error updating usernames:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// รันเฉพาะเมื่อเรียกไฟล์นี้โดยตรง
if (require.main === module) {
  updateUsernames();
}

module.exports = updateUsernames;
