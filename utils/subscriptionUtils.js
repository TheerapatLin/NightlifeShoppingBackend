// utils/subscriptionUtils.js
const UserSubscription = require("../schemas/v1/userSubscription.schema");
const User = require("../schemas/v1/user.schema");

// ===============================
// SUBSCRIPTION UTILITIES
// ===============================

/**
 * ดูระดับปัจจุบันของ user
 * @param {string} userId - User ID
 * @returns {Object} - { level, subscription, daysRemaining }
 */
const getUserCurrentLevel = async (userId) => {
  try {
    const activeSubscription = await UserSubscription.findActiveSubscription(userId);
    
    if (!activeSubscription || !activeSubscription.isActive()) {
      return {
        level: 'regular',
        subscription: null,
        daysRemaining: 0,
        isActive: false
      };
    }

    return {
      level: activeSubscription.subscriptionType,
      subscription: activeSubscription,
      daysRemaining: activeSubscription.getDaysRemaining(),
      isActive: true,
      expiresAt: activeSubscription.endDate
    };
  } catch (error) {
    console.error('Error getting user current level:', error);
    return {
      level: 'regular',
      subscription: null,
      daysRemaining: 0,
      isActive: false,
      error: error.message
    };
  }
};

/**
 * ตรวจสอบว่า user มีสิทธิ์ใช้ feature นั้นๆ หรือไม่
 * @param {string} userId - User ID
 * @param {string} feature - Feature name
 * @returns {boolean}
 */
const checkUserPermission = async (userId, feature) => {
  try {
    const userLevel = await getUserCurrentLevel(userId);
    
    const permissions = {
      regular: [
        'basic_profile',
        'basic_activities',
        'basic_venues'
      ],
      premium: [
        'basic_profile',
        'basic_activities', 
        'basic_venues',
        'premium_badge',
        'priority_support',
        'exclusive_events',
        'advanced_profile',
        'premium_filters'
      ],
      platinum: [
        'basic_profile',
        'basic_activities',
        'basic_venues', 
        'premium_badge',
        'priority_support',
        'exclusive_events',
        'advanced_profile',
        'premium_filters',
        'platinum_badge',
        'vip_support',
        'early_access',
        'platinum_events',
        'account_manager'
      ]
    };

    const userPermissions = permissions[userLevel.level] || permissions.regular;
    return userPermissions.includes(feature);
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
};

/**
 * Middleware สำหรับตรวจสอบระดับ subscription
 * @param {string|Array} requiredLevels - Required level(s)
 * @returns {Function} - Express middleware
 */
const requireSubscriptionLevel = (requiredLevels) => {
  const levels = Array.isArray(requiredLevels) ? requiredLevels : [requiredLevels];
  
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      const userLevel = await getUserCurrentLevel(req.user.id);
      
      if (levels.includes(userLevel.level)) {
        req.userLevel = userLevel;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `This feature requires ${levels.join(' or ')} subscription`,
        userCurrentLevel: userLevel.level,
        requiredLevels: levels
      });
    } catch (error) {
      console.error('Error in requireSubscriptionLevel middleware:', error);
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };
};

/**
 * ทำความสะอาด subscription ที่หมดอายุแล้ว
 * (เป็นทางเลือกแทน TTL index)
 */
const cleanupExpiredSubscriptions = async () => {
  try {
    const result = await UserSubscription.updateMany(
      { 
        status: 'active', 
        endDate: { $lt: new Date() } 
      },
      { 
        $set: { status: 'expired' } 
      }
    );

    console.log(`Updated ${result.modifiedCount} expired subscriptions`);
    return result;
  } catch (error) {
    console.error('Error cleaning up expired subscriptions:', error);
    throw error;
  }
};

/**
 * ดูสถิติ subscription
 */
const getSubscriptionStats = async () => {
  try {
    const stats = await UserSubscription.aggregate([
      {
        $group: {
          _id: null,
          totalActive: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ["$status", "active"] },
                    { $gt: ["$endDate", new Date()] }
                  ]
                }, 
                1, 
                0
              ] 
            } 
          },
          totalExpired: { $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] } },
          totalCancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          totalRevenue: { $sum: "$price" },
          premiumActive: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ["$subscriptionType", "premium"] },
                    { $eq: ["$status", "active"] },
                    { $gt: ["$endDate", new Date()] }
                  ]
                }, 
                1, 
                0
              ] 
            } 
          },
          platinumActive: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ["$subscriptionType", "platinum"] },
                    { $eq: ["$status", "active"] },
                    { $gt: ["$endDate", new Date()] }
                  ]
                }, 
                1, 
                0
              ] 
            } 
          },
          monthlyRevenue: { 
            $sum: { 
              $cond: [
                { $eq: ["$billingCycle", "monthly"] }, 
                "$price", 
                0
              ] 
            } 
          },
          yearlyRevenue: { 
            $sum: { 
              $cond: [
                { $eq: ["$billingCycle", "yearly"] }, 
                "$price", 
                0
              ] 
            } 
          }
        }
      }
    ]);

    return stats[0] || {
      totalActive: 0,
      totalExpired: 0,
      totalCancelled: 0,
      totalRevenue: 0,
      premiumActive: 0,
      platinumActive: 0,
      monthlyRevenue: 0,
      yearlyRevenue: 0
    };
  } catch (error) {
    console.error('Error getting subscription stats:', error);
    throw error;
  }
};

/**
 * ส่ง notification เมื่อ subscription ใกล้หมดอายุ
 * @param {number} daysBeforeExpiry - จำนวนวันก่อนหมดอายุ
 */
const notifyExpiringSubscriptions = async (daysBeforeExpiry = 7) => {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

    const expiringSubscriptions = await UserSubscription.find({
      status: 'active',
      endDate: { 
        $gte: new Date(),
        $lte: expiryDate 
      }
    }).populate('userId', 'user.email user.name');

    console.log(`Found ${expiringSubscriptions.length} subscriptions expiring in ${daysBeforeExpiry} days`);

    // ส่ง email notification
    const { sendSubscriptionExpiryEmail } = require('../modules/email/sendSubscriptionExpiryEmail');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const subscription of expiringSubscriptions) {
      try {
        const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
        
        console.log(`Sending notification to ${subscription.userId.user.email} - ${daysRemaining} days remaining`);
        
        const emailSent = await sendSubscriptionExpiryEmail(subscription, daysRemaining);
        
        if (emailSent) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (emailError) {
        console.error(`Failed to send email to ${subscription.userId.user.email}:`, emailError);
        failCount++;
      }
    }
    
    console.log(`📧 Email notification summary: ${successCount} sent, ${failCount} failed`);

    return {
      subscriptions: expiringSubscriptions,
      emailStats: {
        total: expiringSubscriptions.length,
        success: successCount,
        failed: failCount
      }
    };
  } catch (error) {
    console.error('Error notifying expiring subscriptions:', error);
    throw error;
  }
};

module.exports = {
  getUserCurrentLevel,
  checkUserPermission,
  requireSubscriptionLevel,
  cleanupExpiredSubscriptions,
  getSubscriptionStats,
  notifyExpiringSubscriptions
};
