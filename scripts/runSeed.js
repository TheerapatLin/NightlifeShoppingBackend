#!/usr/bin/env node

/**
 * Script สำหรับรัน Seed files
 * Usage: 
 *   npm run seed:chat-privacy
 *   node scripts/runSeed.js chat-privacy
 */

require('dotenv').config();
const mongoose = require('mongoose');

const seeders = {
  'chat-privacy': require('../seeders/chatPrivacySeed').seedChatPrivacyData,
  // เพิ่ม seeders อื่นๆ ได้ที่นี่
};

async function runSeed() {
  const seedName = process.argv[2];
  
  if (!seedName) {
    console.log('❌ กรุณาระบุชื่อ seed file');
    console.log('Available seeds:');
    Object.keys(seeders).forEach(name => {
      console.log(`  - ${name}`);
    });
    process.exit(1);
  }

  const seeder = seeders[seedName];
  if (!seeder) {
    console.log(`❌ ไม่พบ seed file: ${seedName}`);
    console.log('Available seeds:');
    Object.keys(seeders).forEach(name => {
      console.log(`  - ${name}`);
    });
    process.exit(1);
  }

  try {
    console.log(`🌱 Running seed: ${seedName}`);
    
    // เชื่อมต่อ MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nightlife';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('📡 Connected to MongoDB');

    // รัน seeder
    await seeder();
    
    console.log(`✅ Seed ${seedName} completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seed ${seedName} failed:`, error);
    process.exit(1);
  }
}

runSeed();
