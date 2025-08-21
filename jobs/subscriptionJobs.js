// jobs/subscriptionJobs.js
const cron = require('node-cron');
const { 
  queueCleanupExpiredSubscriptions, 
  notifyExpiringSubscriptions,
  getSubscriptionStats 
} = require('../utils/subscriptionUtils');

// ===============================
// CRON JOBS
// ===============================

/**
 * ทำความสะอาด subscription ที่หมดอายุ
 * ทำงานทุกวันเวลา 02:00 น.
 */
const startExpiredSubscriptionCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('🔄 Starting expired subscription cleanup...');
    try {
      await queueCleanupExpiredSubscriptions();
      console.log('✅ Expired subscription cleanup completed');
    } catch (error) {
      console.error('❌ Error in expired subscription cleanup:', error);
    }
  });
  
  console.log('📅 Expired subscription cleanup job scheduled (daily at 02:00)');
};

/**
 * แจ้งเตือน subscription ที่ใกล้หมดอายุ
 * ทำงานทุกวันเวลา 09:00 น.
 */
const startExpiryNotificationJob = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Starting expiry notification job...');
    try {
      // แจ้งเตือนก่อนหมดอายุ 7 วัน
      await notifyExpiringSubscriptions(7);
      
      // แจ้งเตือนก่อนหมดอายุ 1 วัน
      await notifyExpiringSubscriptions(1);
      
      console.log('✅ Expiry notification job completed');
    } catch (error) {
      console.error('❌ Error in expiry notification job:', error);
    }
  });
  
  console.log('📅 Expiry notification job scheduled (daily at 09:00)');
};

/**
 * สร้างรายงานสถิติ subscription
 * ทำงานทุกวันจันทร์เวลา 08:00 น.
 */
const startWeeklyStatsJob = () => {
  cron.schedule('0 8 * * 1', async () => {
    console.log('📊 Starting weekly subscription stats job...');
    try {
      const stats = await getSubscriptionStats();
      
      console.log('📈 Weekly Subscription Stats:', {
        totalActive: stats.totalActive,
        premiumActive: stats.premiumActive,
        platinumActive: stats.platinumActive,
        totalRevenue: stats.totalRevenue,
        monthlyRevenue: stats.monthlyRevenue,
        yearlyRevenue: stats.yearlyRevenue
      });
      
      // TODO: ส่งรายงานไปยัง admin email หรือ dashboard
      
      console.log('✅ Weekly subscription stats job completed');
    } catch (error) {
      console.error('❌ Error in weekly stats job:', error);
    }
  });
  
  console.log('📅 Weekly subscription stats job scheduled (Mondays at 08:00)');
};

/**
 * เริ่มต้น cron jobs ทั้งหมด
 */
const startAllSubscriptionJobs = () => {
  console.log('🚀 Starting all subscription cron jobs...');
  
  startExpiredSubscriptionCleanup();
  startExpiryNotificationJob();
  startWeeklyStatsJob();
  
  console.log('✅ All subscription cron jobs started successfully');
};

/**
 * ทำงาน cleanup ทันที (สำหรับ testing หรือ manual run)
 */
const runImmediateCleanup = async () => {
  console.log('🔄 Running immediate subscription cleanup...');
  try {
    await queueCleanupExpiredSubscriptions();
    console.log('✅ Immediate cleanup completed');
  } catch (error) {
    console.error('❌ Error in immediate cleanup:', error);
    throw error;
  }
};

/**
 * ทำงาน notification ทันที (สำหรับ testing หรือ manual run)
 */
const runImmediateNotification = async (days = 7) => {
  console.log(`🔔 Running immediate expiry notification (${days} days)...`);
  try {
    const expiring = await notifyExpiringSubscriptions(days);
    console.log(`✅ Immediate notification completed. Found ${expiring.length} expiring subscriptions`);
    return expiring;
  } catch (error) {
    console.error('❌ Error in immediate notification:', error);
    throw error;
  }
};

module.exports = {
  startAllSubscriptionJobs,
  startExpiredSubscriptionCleanup,
  startExpiryNotificationJob,
  startWeeklyStatsJob,
  runImmediateCleanup,
  runImmediateNotification
};
