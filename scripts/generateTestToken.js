// สร้าง JWT token สำหรับทดสอบ
require('dotenv').config({ path: '.env-nl' });
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../schemas/v1/user.schema');

async function generateTestToken() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:4A1243s3Kp3PJMM@8.213.197.68:27018/hiddengem?replicaSet=rs0&authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('🔗 Connected to MongoDB');

    // หา user alice
    const user = await User.findOne({ 'user.email': 'alice@example.com' });
    
    if (!user) {
      console.log('❌ User alice not found');
      return;
    }

    console.log('👤 Found user:', user.user.name, '(@' + user.user.username + ')');

    // สร้าง JWT token
    const payload = {
      userId: user._id,
      _id: user._id,
      email: user.user.email,
      name: user.user.name,
      username: user.user.username,
      role: user.role,
      userType: user.userType
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('\n🔑 Generated Token:');
    console.log(token);
    
    console.log('\n📋 Test Commands:');
    console.log(`curl -s "http://localhost:3101/api/v1/privacy/search?q=bob" -H "Authorization: Bearer ${token}"`);
    
    console.log('\n💾 Save this token in your Flutter app for testing');

  } catch (error) {
    console.error('❌ Error generating token:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  generateTestToken();
}

module.exports = generateTestToken;
