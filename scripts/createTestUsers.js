// สร้างผู้ใช้ทดสอบสำหรับ Chat System
require('dotenv').config({ path: '.env-nl' });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../schemas/v1/user.schema');

// สร้าง affiliate code แบบสุ่ม
function generateAffiliateCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const testUsers = [
  {
    name: "Alice Johnson",
    username: "alice",
    email: "alice@example.com",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "public"
    }
  },
  {
    name: "Bob Smith", 
    username: "bob",
    email: "bob@example.com",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true,
      showOnlineStatus: false,
      allowGroupInvite: true,
      profileVisibility: "public"
    }
  },
  {
    name: "Charlie Brown",
    username: "charlie",
    email: "charlie@example.com", 
    privacySettings: {
      searchable: true, // เปลี่ยนเป็น true เพื่อให้ค้นหาได้
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: false,
      profileVisibility: "friends"
    }
  },
  {
    name: "Diana Prince",
    username: "diana",
    email: "diana@example.com",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true, // เปลี่ยนเป็น true เพื่อให้แชทได้
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "public"
    }
  },
  {
    name: "Eve Wilson",
    username: "eve",
    email: "eve@example.com",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "public" // เปลี่ยนเป็น public
    }
  },
  {
    name: "Frank Miller",
    username: "frank",
    email: "frank@example.com",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "public"
    }
  }
];

async function createTestUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:4A1243s3Kp3PJMM@8.213.197.68:27018/hiddengem?replicaSet=rs0&authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('🔗 Connected to MongoDB');

    // ลบผู้ใช้ทดสอบเก่า
    console.log('🗑️ Cleaning old test users...');
    await User.deleteMany({ 
      'user.email': { $in: testUsers.map(u => u.email) } 
    });

    console.log('👥 Creating test users...');
    const createdUsers = [];
    
    for (const userData of testUsers) {
      try {
        // สร้าง User document
        const user = new User({
          role: 'user',
          user: {
            name: userData.name,
            username: userData.username,
            email: userData.email,
            phone: `081234567${Math.floor(Math.random() * 10)}`,
            password: await bcrypt.hash('password123', 10),
            activated: true,
            verified: { email: true, phone: true }
          },
          userType: 'regular',
          userData: new mongoose.Types.ObjectId(), // Dummy ObjectId
          userTypeData: 'RegularUserData',
          affiliateCode: generateAffiliateCode(),
          privacySettings: userData.privacySettings,
          lang: 'TH'
        });

        const savedUser = await user.save();
        createdUsers.push(savedUser);
        console.log(`✅ Created user: ${userData.name} (@${userData.username})`);
      } catch (error) {
        console.log(`❌ Failed to create user ${userData.name}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Created: ${createdUsers.length} users`);
    console.log(`❌ Failed: ${testUsers.length - createdUsers.length} users`);

    // แสดงรายการผู้ใช้ที่สร้าง
    console.log(`\n👥 Created Users:`);
    createdUsers.forEach(user => {
      console.log(`  - ${user.user.name} (@${user.user.username}) - ${user.user.email}`);
    });

    console.log(`\n🔍 Test Search:`);
    console.log(`Try searching for: alice, bob, charlie, diana, eve, frank`);

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// รันเฉพาะเมื่อเรียกไฟล์นี้โดยตรง
if (require.main === module) {
  createTestUsers();
}

module.exports = createTestUsers;
