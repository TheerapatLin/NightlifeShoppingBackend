const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../schemas/v1/user.schema');
const { RegularUserData } = require('../schemas/v1/userData/regularUserData.schema');
const { ChatRoom, Message, StickerSet, Sticker } = require('../schemas/v1/chat.schema');

// สร้าง affiliate code แบบสุ่ม
function generateAffiliateCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ข้อมูล test users
const testUsers = [
  {
    name: "Alice Johnson",
    email: "alice@example.com",
    username: "alice_j",
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
    email: "bob@example.com",
    username: "bob_smith",
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
    email: "charlie@example.com", 
    username: "charlie_b",
    privacySettings: {
      searchable: false, // ไม่อนุญาตให้ค้นหา
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: false,
      profileVisibility: "friends"
    }
  },
  {
    name: "Diana Prince",
    email: "diana@example.com",
    username: "wonder_diana",
    privacySettings: {
      searchable: true,
      allowDirectMessage: false, // ไม่อนุญาตให้ทักแชท
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "public"
    }
  },
  {
    name: "Eve Wilson",
    email: "eve@example.com",
    username: "eve_w",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "private" // โปรไฟล์ส่วนตัว
    }
  },
  {
    name: "Frank Miller",
    email: "frank@example.com",
    username: "frank_m",
    privacySettings: {
      searchable: true,
      allowDirectMessage: true,
      showOnlineStatus: true,
      allowGroupInvite: true,
      profileVisibility: "public"
    }
  }
];

// ข้อมูล sticker sets
const stickerSets = [
  {
    businessId: "1",
    setNumber: 1,
    nameTH: "หมีน้อยน่ารัก",
    nameEN: "Cute Bear",
    descriptionTH: "สติ๊กเกอร์หมีน้อยน่ารักสำหรับแชท",
    descriptionEN: "Cute bear stickers for chat",
    price: 0,
    starPoint: 0,
    tags: ["cute", "bear", "animal"],
    amount: 12,
    status: "normal",
    type: "static",
    category: "animals",
    author: "NightLife Team",
    thumbnail: "https://example.com/sticker-sets/bear/thumbnail.png"
  },
  {
    businessId: "1", 
    setNumber: 2,
    nameTH: "อิโมจิสนุก",
    nameEN: "Fun Emoji",
    descriptionTH: "อิโมจิสนุกๆ สำหรับการแชท",
    descriptionEN: "Fun emoji stickers for chatting",
    price: 50,
    starPoint: 100,
    tags: ["emoji", "fun", "expression"],
    amount: 20,
    status: "premium",
    type: "animated",
    category: "emoji",
    author: "NightLife Team",
    thumbnail: "https://example.com/sticker-sets/emoji/thumbnail.png"
  }
];

async function seedChatPrivacyData() {
  try {
    console.log('🌱 Starting Chat Privacy Seed...');

    // ลบข้อมูลเก่า
    console.log('🗑️ Cleaning old data...');
    await Promise.all([
      User.deleteMany({ 'user.email': { $in: testUsers.map(u => u.email) } }),
      RegularUserData.deleteMany({}),
      ChatRoom.deleteMany({}),
      Message.deleteMany({}),
      StickerSet.deleteMany({ businessId: "1" }),
      Sticker.deleteMany({})
    ]);

    // สร้าง test users
    console.log('👥 Creating test users...');
    const createdUsers = [];
    
    for (const userData of testUsers) {
      // สร้าง RegularUserData
      const regularUserData = new RegularUserData({
        businessId: "1",
        profileImage: `https://example.com/avatars/${userData.username}.jpg`,
        gender: "unspecified"
      });
      await regularUserData.save();

      // สร้าง User
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = new User({
        role: "user",
        user: {
          name: userData.name,
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          activated: true,
          verified: {
            email: true,
            phone: false
          }
        },
        userType: "regular",
        userData: regularUserData._id,
        userTypeData: "RegularUserData",
        affiliateCode: generateAffiliateCode(),
        businessId: "1",
        privacySettings: userData.privacySettings,
        blockedUsers: [],
        blockedBy: []
      });
      
      await user.save();
      createdUsers.push(user);
      console.log(`✅ Created user: ${userData.name} (${userData.email})`);
    }

    // สร้างการบล็อกระหว่าง users (Frank blocks Charlie)
    console.log('🚫 Creating block relationships...');
    const frank = createdUsers.find(u => u.user.username === 'frank_m');
    const charlie = createdUsers.find(u => u.user.username === 'charlie_b');
    
    if (frank && charlie) {
      await frank.blockUser(charlie._id, 'spam');
      console.log(`✅ Frank blocked Charlie`);
    }

    // สร้าง chat rooms
    console.log('💬 Creating chat rooms...');
    const alice = createdUsers.find(u => u.user.username === 'alice_j');
    const bob = createdUsers.find(u => u.user.username === 'bob_smith');
    const diana = createdUsers.find(u => u.user.username === 'wonder_diana');
    
    // Private chat ระหว่าง Alice และ Bob
    if (alice && bob) {
      const privateChatRoom = new ChatRoom({
        name: `${alice.user.name} & ${bob.user.name}`,
        type: "private",
        participants: [
          {
            userId: alice._id,
            role: "member",
            joinedAt: new Date(),
            isActive: true
          },
          {
            userId: bob._id,
            role: "member", 
            joinedAt: new Date(),
            isActive: true
          }
        ],
        status: "active",
        messageCount: 0
      });
      await privateChatRoom.save();

      // สร้างข้อความตัวอย่าง
      const message1 = new Message({
        chatRoom: privateChatRoom._id,
        sender: alice._id,
        type: "text",
        content: "Hello Bob! How are you?",
        order: Date.now(),
        status: "sent"
      });
      await message1.save();

      const message2 = new Message({
        chatRoom: privateChatRoom._id,
        sender: bob._id,
        type: "text", 
        content: "Hi Alice! I'm doing great, thanks for asking!",
        order: Date.now() + 1000,
        status: "sent"
      });
      await message2.save();

      // อัพเดท lastMessage
      privateChatRoom.lastMessage = message2._id;
      privateChatRoom.lastMessageTime = new Date();
      privateChatRoom.messageCount = 2;
      await privateChatRoom.save();

      console.log(`✅ Created private chat between Alice and Bob`);
    }

    // Group chat
    if (alice && bob && diana) {
      const groupChatRoom = new ChatRoom({
        name: "Friends Group",
        type: "group",
        participants: [
          {
            userId: alice._id,
            role: "admin",
            joinedAt: new Date(),
            isActive: true
          },
          {
            userId: bob._id,
            role: "member",
            joinedAt: new Date(),
            isActive: true
          },
          {
            userId: diana._id,
            role: "member",
            joinedAt: new Date(),
            isActive: true
          }
        ],
        status: "active",
        messageCount: 0,
        description: "A group chat for friends",
        settings: {
          allowMediaUpload: true,
          allowStickers: true,
          allowReactions: true,
          maxParticipants: 50
        }
      });
      await groupChatRoom.save();

      // สร้างข้อความในกลุ่ม
      const groupMessage = new Message({
        chatRoom: groupChatRoom._id,
        sender: alice._id,
        type: "text",
        content: "Welcome to our group chat everyone! 🎉",
        order: Date.now(),
        status: "sent",
        reactions: [
          {
            userId: bob._id,
            emoji: "👍",
            reactionType: "like",
            createdAt: new Date()
          }
        ]
      });
      await groupMessage.save();

      groupChatRoom.lastMessage = groupMessage._id;
      groupChatRoom.lastMessageTime = new Date();
      groupChatRoom.messageCount = 1;
      await groupChatRoom.save();

      console.log(`✅ Created group chat: Friends Group`);
    }

    // สร้าง sticker sets
    console.log('🎨 Creating sticker sets...');
    for (const stickerSetData of stickerSets) {
      const stickerSet = new StickerSet(stickerSetData);
      await stickerSet.save();

      // สร้าง stickers ในแต่ละ set
      const stickers = [];
      for (let i = 1; i <= stickerSetData.amount; i++) {
        const sticker = new Sticker({
          setId: stickerSet._id,
          stickerId: `${stickerSetData.setNumber}_${i.toString().padStart(3, '0')}`,
          name: `${stickerSetData.nameEN} ${i}`,
          keywords: stickerSetData.tags,
          url: `https://example.com/stickers/${stickerSetData.setNumber}/${i}.${stickerSetData.type === 'animated' ? 'gif' : 'png'}`,
          thumbnailUrl: `https://example.com/stickers/${stickerSetData.setNumber}/${i}_thumb.png`,
          type: stickerSetData.type,
          fileSize: Math.floor(Math.random() * 50000) + 10000, // 10-60KB
          dimensions: {
            width: 512,
            height: 512
          },
          order: i
        });
        stickers.push(sticker);
      }
      
      await Sticker.insertMany(stickers);
      console.log(`✅ Created sticker set: ${stickerSetData.nameTH} (${stickerSetData.amount} stickers)`);
    }

    // สร้าง user sticker collections
    console.log('📦 Creating user sticker collections...');
    const { UserStickerCollection } = require('../schemas/v1/chat.schema');
    const createdStickerSets = await StickerSet.find({ businessId: "1" });
    
    // Alice ดาวน์โหลด sticker set ฟรี
    if (alice && createdStickerSets.length > 0) {
      const freeSet = createdStickerSets.find(set => set.price === 0);
      if (freeSet) {
        const collection = new UserStickerCollection({
          userId: alice._id,
          stickerSetId: freeSet._id,
          purchasePrice: 0,
          purchaseMethod: 'free'
        });
        await collection.save();
        console.log(`✅ Alice downloaded free sticker set`);
      }
    }

    console.log('🎉 Chat Privacy Seed completed successfully!');
    console.log('\n📋 Test Data Summary:');
    console.log(`👥 Users created: ${createdUsers.length}`);
    console.log(`💬 Chat rooms: ${await ChatRoom.countDocuments()}`);
    console.log(`📝 Messages: ${await Message.countDocuments()}`);
    console.log(`🎨 Sticker sets: ${await StickerSet.countDocuments()}`);
    console.log(`🏷️ Stickers: ${await Sticker.countDocuments()}`);
    
    console.log('\n🔐 Test Accounts:');
    for (const user of createdUsers) {
      console.log(`📧 ${user.user.email} | Password: password123`);
      console.log(`   Settings: Searchable=${user.privacySettings.searchable}, DM=${user.privacySettings.allowDirectMessage}, Profile=${user.privacySettings.profileVisibility}`);
    }

    console.log('\n🚫 Block Relationships:');
    console.log('   Frank blocked Charlie');

    console.log('\n🧪 Test Scenarios:');
    console.log('1. Alice & Bob: Normal chat (both searchable, allow DM)');
    console.log('2. Charlie: Not searchable (searchable=false)');
    console.log('3. Diana: Doesn\'t allow direct messages (allowDirectMessage=false)');
    console.log('4. Eve: Private profile (profileVisibility=private)');
    console.log('5. Frank & Charlie: Blocked relationship');

  } catch (error) {
    console.error('❌ Error seeding chat privacy data:', error);
    throw error;
  }
}

// ฟังก์ชันสำหรับรันแยก
async function runSeed() {
  try {
    // เชื่อมต่อ MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nightlife', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('📡 Connected to MongoDB');
    }

    await seedChatPrivacyData();
    
    console.log('✅ Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// ถ้ารันไฟล์นี้โดยตรง
if (require.main === module) {
  runSeed();
}

module.exports = { seedChatPrivacyData };
