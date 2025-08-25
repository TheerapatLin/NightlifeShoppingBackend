require('dotenv').config({ path: '.env-nl' });
const mongoose = require('mongoose');

const updateAllUsersSearchable = async () => {
  try {
    console.log('🚀 Starting to update all users to be searchable...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODBDATABASEURI, {
      dbName: process.env.DATABASE_NAME,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Count total users
    const totalUsers = await usersCollection.countDocuments();
    console.log(`📊 Found ${totalUsers} users to update`);

    // Update all users to be searchable
    const updateResult = await usersCollection.updateMany(
      {}, // Update all users
      {
        $set: {
          'privacySettings.searchable': true,
          'privacySettings.allowDirectMessage': true,
          'privacySettings.showOnlineStatus': true,
          'privacySettings.allowGroupInvite': true,
          'privacySettings.profileVisibility': 'public'
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} users`);
    console.log(`📋 Matched ${updateResult.matchedCount} users`);

    // Verify the update
    const searchableUsers = await usersCollection.countDocuments({
      'privacySettings.searchable': true
    });
    
    console.log(`🔍 Verified: ${searchableUsers} users are now searchable`);

    // Show sample of updated users
    const sampleUsers = await usersCollection.find({})
      .limit(5)
      .toArray();

    console.log('\n📋 Sample updated users:');
    sampleUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.user?.name || 'N/A'} - Searchable: ${user.privacySettings?.searchable}`);
    });

    console.log('\n🎉 All users are now searchable!');
    
  } catch (error) {
    console.error('❌ Error updating users:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the update if this file is executed directly
if (require.main === module) {
  updateAllUsersSearchable()
    .then(() => {
      console.log('✅ Update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
}

module.exports = updateAllUsersSearchable;
