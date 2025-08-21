// utils/migrateActivitySubscriptionPricing.js
const mongoose = require('mongoose');
const Activity = require('../schemas/v1/activity.schema');
const ActivitySlot = require('../schemas/v1/activitySlot.schema');
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

/**
 * Migration script เพื่อเพิ่ม subscription pricing ให้กับ activities และ activity slots ที่มีอยู่แล้ว
 * - premium = 50% ของราคาเต็ม
 * - platinum = 50% ของราคาเต็ม
 */

const migrateActivitySubscriptionPricing = async () => {
  try {
    console.log('🔄 Starting migration for Activity subscription pricing...');
    
    // หา activities ที่ยังไม่มี subscriptionPricing
    const activitiesToUpdate = await Activity.find({
      $or: [
        { subscriptionPricing: { $exists: false } },
        { 'subscriptionPricing.enabled': { $exists: false } }
      ]
    });

    console.log(`Found ${activitiesToUpdate.length} activities to update`);

    let updatedCount = 0;
    
    for (const activity of activitiesToUpdate) {
      const regularPrice = activity.cost || 0;
      const premiumPrice = Math.floor(regularPrice * 0.5); // 50% ของราคาเต็ม
      const platinumPrice = Math.floor(regularPrice * 0.5); // 50% ของราคาเต็ม
      
      // อัปเดต activity
      await Activity.updateOne(
        { _id: activity._id },
        {
          $set: {
            'subscriptionPricing.regular': regularPrice,
            'subscriptionPricing.premium': premiumPrice,
            'subscriptionPricing.platinum': platinumPrice,
            'subscriptionPricing.enabled': regularPrice > 0, // เปิดถ้ามีราคา
          }
        }
      );

      // อัปเดต schedule ภายใน activity
      if (activity.schedule && activity.schedule.length > 0) {
        const scheduleUpdates = activity.schedule.map((schedule, index) => {
          const scheduleRegularPrice = schedule.cost || 0;
          const schedulePremiumPrice = Math.floor(scheduleRegularPrice * 0.5);
          const schedulePlatinumPrice = Math.floor(scheduleRegularPrice * 0.5);
          
          return {
            [`schedule.${index}.subscriptionPricing.regular`]: scheduleRegularPrice,
            [`schedule.${index}.subscriptionPricing.premium`]: schedulePremiumPrice,
            [`schedule.${index}.subscriptionPricing.platinum`]: schedulePlatinumPrice,
            [`schedule.${index}.subscriptionPricing.enabled`]: scheduleRegularPrice > 0,
          };
        });

        // Flatten the updates
        const flatUpdates = {};
        scheduleUpdates.forEach(update => {
          Object.assign(flatUpdates, update);
        });

        if (Object.keys(flatUpdates).length > 0) {
          await Activity.updateOne(
            { _id: activity._id },
            { $set: flatUpdates }
          );
        }
      }

      updatedCount++;
      
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount}/${activitiesToUpdate.length} activities`);
      }
    }

    console.log(`✅ Migration completed for Activities: ${updatedCount} updated`);
    
    // อัปเดต ActivitySlots
    console.log('🔄 Starting migration for ActivitySlot subscription pricing...');
    
    const slotsToUpdate = await ActivitySlot.find({
      $or: [
        { subscriptionPricing: { $exists: false } },
        { 'subscriptionPricing.enabled': { $exists: false } }
      ]
    });

    console.log(`Found ${slotsToUpdate.length} activity slots to update`);

    let slotUpdatedCount = 0;
    
    for (const slot of slotsToUpdate) {
      const regularPrice = slot.cost || 0;
      const premiumPrice = Math.floor(regularPrice * 0.5);
      const platinumPrice = Math.floor(regularPrice * 0.5);
      
      await ActivitySlot.updateOne(
        { _id: slot._id },
        {
          $set: {
            'subscriptionPricing.regular': regularPrice,
            'subscriptionPricing.premium': premiumPrice,
            'subscriptionPricing.platinum': platinumPrice,
            'subscriptionPricing.enabled': regularPrice > 0,
          }
        }
      );

      slotUpdatedCount++;
      
      if (slotUpdatedCount % 100 === 0) {
        console.log(`Updated ${slotUpdatedCount}/${slotsToUpdate.length} activity slots`);
      }
    }

    console.log(`✅ Migration completed for ActivitySlots: ${slotUpdatedCount} updated`);
    
    return {
      activitiesUpdated: updatedCount,
      slotsUpdated: slotUpdatedCount,
      success: true
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * ฟังก์ชันสำหรับ rollback migration (กรณีต้องการยกเลิก)
 */
const rollbackActivitySubscriptionPricing = async () => {
  try {
    console.log('🔄 Rolling back Activity subscription pricing migration...');
    
    // ลบ subscriptionPricing field จาก activities
    const activityResult = await Activity.updateMany(
      { subscriptionPricing: { $exists: true } },
      { $unset: { subscriptionPricing: "" } }
    );

    // ลบ subscriptionPricing field จาก activity schedules
    const scheduleResult = await Activity.updateMany(
      { "schedule.subscriptionPricing": { $exists: true } },
      { $unset: { "schedule.$[].subscriptionPricing": "" } }
    );

    // ลบ subscriptionPricing field จาก activity slots
    const slotResult = await ActivitySlot.updateMany(
      { subscriptionPricing: { $exists: true } },
      { $unset: { subscriptionPricing: "" } }
    );

    console.log(`✅ Rollback completed:`);
    console.log(`- Activities: ${activityResult.modifiedCount} updated`);
    console.log(`- Activity Slots: ${slotResult.modifiedCount} updated`);
    
    return {
      activitiesRolledBack: activityResult.modifiedCount,
      slotsRolledBack: slotResult.modifiedCount,
      success: true
    };

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
};

/**
 * ดูสถิติราคา subscription
 */
const getSubscriptionPricingStats = async () => {
  try {
    console.log('📊 Getting subscription pricing statistics...');
    
    const activityStats = await Activity.aggregate([
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          withSubscriptionPricing: {
            $sum: { $cond: [{ $ifNull: ["$subscriptionPricing", false] }, 1, 0] }
          },
          enabledSubscriptionPricing: {
            $sum: { $cond: ["$subscriptionPricing.enabled", 1, 0] }
          },
          avgRegularPrice: { $avg: "$subscriptionPricing.regular" },
          avgPremiumPrice: { $avg: "$subscriptionPricing.premium" },
          avgPlatinumPrice: { $avg: "$subscriptionPricing.platinum" },
        }
      }
    ]);

    const slotStats = await ActivitySlot.aggregate([
      {
        $group: {
          _id: null,
          totalSlots: { $sum: 1 },
          withSubscriptionPricing: {
            $sum: { $cond: [{ $ifNull: ["$subscriptionPricing", false] }, 1, 0] }
          },
          enabledSubscriptionPricing: {
            $sum: { $cond: ["$subscriptionPricing.enabled", 1, 0] }
          },
          avgRegularPrice: { $avg: "$subscriptionPricing.regular" },
          avgPremiumPrice: { $avg: "$subscriptionPricing.premium" },
          avgPlatinumPrice: { $avg: "$subscriptionPricing.platinum" },
        }
      }
    ]);

    const stats = {
      activities: activityStats[0] || {},
      slots: slotStats[0] || {},
    };

    console.log('📈 Subscription Pricing Statistics:');
    console.log('Activities:', stats.activities);
    console.log('Slots:', stats.slots);
    
    return stats;

  } catch (error) {
    console.error('❌ Error getting stats:', error);
    throw error;
  }
};

// Export functions
module.exports = {
  migrateActivitySubscriptionPricing,
  rollbackActivitySubscriptionPricing,
  getSubscriptionPricingStats
};

// ถ้ารันไฟล์นี้โดยตรง
if (require.main === module) {
  const connectMongoDB = require("../modules/database/mongodb");
  
  (async () => {
    try {
      await connectMongoDB();
      
      const command = process.argv[2];
      
      switch (command) {
        case 'migrate':
          await migrateActivitySubscriptionPricing();
          break;
        case 'rollback':
          await rollbackActivitySubscriptionPricing();
          break;
        case 'stats':
          await getSubscriptionPricingStats();
          break;
        default:
          console.log('Usage:');
          console.log('  node migrateActivitySubscriptionPricing.js migrate   # Run migration');
          console.log('  node migrateActivitySubscriptionPricing.js rollback  # Rollback migration');
          console.log('  node migrateActivitySubscriptionPricing.js stats     # Show statistics');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Script failed:', error);
      process.exit(1);
    }
  })();
}
