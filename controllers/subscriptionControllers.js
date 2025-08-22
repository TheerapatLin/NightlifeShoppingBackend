// controllers/subscriptionControllers.js
const UserSubscription = require("../schemas/v1/userSubscription.schema");
const User = require("../schemas/v1/user.schema");
const RegularUserData = require("../schemas/v1/userData/regularUserData.schema");
const { queueSubscriptionEvent } = require("../utils/subscriptionUtils");

// ===============================
// SUBSCRIPTION MANAGEMENT
// ===============================

// ซื้อ subscription ใหม่หรือต่อเวลา
const purchaseSubscription = async (req, res) => {
  try {
    const { subscriptionType, billingCycle, paymentInfo } = req.body;
    const userId = req.user.userId; // จาก auth middleware

    // ตรวจสอบ input
    if (!['premium', 'platinum'].includes(subscriptionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription type. Must be 'premium' or 'platinum'"
      });
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle. Must be 'monthly' or 'yearly'"
      });
    }

    // กำหนดราคา (สามารถปรับได้ตามต้องการ)
    const pricing = {
      premium: { monthly: 299, yearly: 2990 },
      platinum: { monthly: 599, yearly: 5990 }
    };

    const price = pricing[subscriptionType][billingCycle];

    // ตรวจสอบว่ามี subscription ที่ active อยู่หรือไม่
    const existingSubscription = await UserSubscription.findActiveSubscription(userId);

    if (existingSubscription) {
      // ถ้ามี subscription อยู่แล้ว ให้ต่อเวลา
      if (existingSubscription.subscriptionType !== subscriptionType) {
        return res.status(400).json({
          success: false,
          message: `You already have an active ${existingSubscription.subscriptionType} subscription. Please wait for it to expire before purchasing a different plan.`
        });
      }

      // ต่อเวลา subscription เดิม
      await existingSubscription.extend(billingCycle, price);

      // อัพเดท payment info
      if (paymentInfo) {
        existingSubscription.paymentInfo = {
          ...existingSubscription.paymentInfo,
          ...paymentInfo,
          paymentDate: new Date()
        };
        await existingSubscription.save();
      }

      // ✅ Queue subscription extended event
      const user = await User.findById(userId);
      await queueSubscriptionEvent('subscription-extended', {
        subscription: existingSubscription,
        user,
        previousEndDate: existingSubscription.originalEndDate,
        extensionDetails: { billingCycle, price }
      });

      return res.status(200).json({
        success: true,
        message: `${subscriptionType} subscription extended successfully`,
        data: {
          subscription: existingSubscription,
          daysRemaining: existingSubscription.getDaysRemaining()
        }
      });
    }

    // สร้าง subscription ใหม่
    const newSubscription = await UserSubscription.createSubscription({
      userId,
      subscriptionType,
      billingCycle,
      price,
      paymentInfo,
      metadata: {
        purchaseSource: req.headers['user-agent'] || 'unknown',
        originalLevel: 'regular'
      }
    });

    // ✅ Queue subscription purchased event
    const user = await User.findById(userId);
    await queueSubscriptionEvent('subscription-purchased', {
      subscription: newSubscription,
      user,
      purchaseDetails: { subscriptionType, billingCycle, price }
    });

    res.status(201).json({
      success: true,
      message: `${subscriptionType} subscription created successfully`,
      data: {
        subscription: newSubscription,
        daysRemaining: newSubscription.getDaysRemaining()
      }
    });

  } catch (error) {
    console.error('Error purchasing subscription:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ดู subscription ปัจจุบันของ user
const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;

    const activeSubscription = await UserSubscription.findActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(200).json({
        success: true,
        message: "No active subscription found",
        data: {
          subscription: null,
          currentLevel: 'regular',
          daysRemaining: 0
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Active subscription found",
      data: {
        subscription: activeSubscription,
        currentLevel: activeSubscription.subscriptionType,
        daysRemaining: activeSubscription.getDaysRemaining(),
        isActive: activeSubscription.isActive()
      }
    });

  } catch (error) {
    console.error('Error getting current subscription:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ดูประวัติ subscription ทั้งหมดของ user
const getSubscriptionHistory = async (req, res) => {
  try {
    // ถ้ามี userId ใน params แสดงว่าเป็น admin ดู history ของ user อื่น
    const targetUserId = req.params.userId || req.user?.userId;
    const { page = 1, limit = 10 } = req.query;

    // ค้นหาทั้ง string และ ObjectId
    const mongoose = require('mongoose');
    const query = { 
      $or: [
        { userId: targetUserId },
        ...(mongoose.Types.ObjectId.isValid(targetUserId) 
          ? [{ userId: new mongoose.Types.ObjectId(targetUserId) }] 
          : [])
      ]
    };
    
    const subscriptions = await UserSubscription.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await UserSubscription.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Subscription history retrieved successfully",
      data: {
        subscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting subscription history:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ยกเลิก subscription (แต่ยังใช้ได้จนหมดอายุ)
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;

    const activeSubscription = await UserSubscription.findActiveSubscription(userId);

    if (!activeSubscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found"
      });
    }

    // เปลี่ยนสถานะเป็น cancelled แต่ยังใช้ได้จนหมดอายุ
    activeSubscription.status = 'cancelled';
    activeSubscription.autoRenew = false;
    await activeSubscription.save();

    // ✅ Queue subscription cancelled event
    const user = await User.findById(userId);
    await queueSubscriptionEvent('subscription-cancelled', {
      subscription: activeSubscription,
      user,
      cancellationDate: new Date(),
      daysRemaining: activeSubscription.getDaysRemaining()
    });

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully. You can still use premium features until the expiration date.",
      data: {
        subscription: activeSubscription,
        daysRemaining: activeSubscription.getDaysRemaining()
      }
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ===============================
// USER LEVEL UTILITIES
// ===============================

// ดูระดับปัจจุบันของ user (รวมทั้ง subscription)
const getUserCurrentLevel = async (req, res) => {
  try {
    const userId = req.user.userId;

    // ดู subscription ที่ active
    const activeSubscription = await UserSubscription.findActiveSubscription(userId);

    let currentLevel = 'regular';
    let levelDetails = {
      level: 'regular',
      source: 'default',
      expiresAt: null,
      daysRemaining: null
    };

    if (activeSubscription && activeSubscription.isActive()) {
      currentLevel = activeSubscription.subscriptionType;
      levelDetails = {
        level: activeSubscription.subscriptionType,
        source: 'subscription',
        expiresAt: activeSubscription.endDate,
        daysRemaining: activeSubscription.getDaysRemaining(),
        subscriptionId: activeSubscription._id
      };
    }

    res.status(200).json({
      success: true,
      message: "User level retrieved successfully",
      data: {
        userId,
        currentLevel,
        levelDetails
      }
    });

  } catch (error) {
    console.error('Error getting user level:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ===============================
// ADMIN FUNCTIONS
// ===============================

// ดู subscription ทั้งหมด (สำหรับ admin)
const getAllSubscriptions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      subscriptionType,
      billingCycle 
    } = req.query;

    // สร้าง filter
    const filter = {};
    if (status) filter.status = status;
    if (subscriptionType) filter.subscriptionType = subscriptionType;
    if (billingCycle) filter.billingCycle = billingCycle;

    const subscriptions = await UserSubscription.find(filter)
      .populate('userId', 'user.name user.email userType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserSubscription.countDocuments(filter);

    // สถิติ
    const stats = await UserSubscription.aggregate([
      {
        $group: {
          _id: null,
          totalActive: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          totalExpired: { $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] } },
          totalCancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          totalRevenue: { $sum: "$price" },
          premiumCount: { $sum: { $cond: [{ $eq: ["$subscriptionType", "premium"] }, 1, 0] } },
          platinumCount: { $sum: { $cond: [{ $eq: ["$subscriptionType", "platinum"] }, 1, 0] } },
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: "All subscriptions retrieved successfully",
      data: {
        subscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        statistics: stats[0] || {}
      }
    });

  } catch (error) {
    console.error('Error getting all subscriptions:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ===============================
// PRICING
// ===============================

// ดูราคา subscription
const getSubscriptionPricing = async (req, res) => {
  try {
    const pricing = {
      premium: {
        monthly: {
          price: 299,
          currency: 'THB',
          features: [
            'Premium badge',
            'Priority customer support',
            'Exclusive events access',
            'Advanced profile customization'
          ]
        },
        yearly: {
          price: 2990,
          currency: 'THB',
          savings: 598, // 299 * 12 - 2990
          savingsPercentage: 17,
          features: [
            'Premium badge',
            'Priority customer support',
            'Exclusive events access',
            'Advanced profile customization'
          ]
        }
      },
      platinum: {
        monthly: {
          price: 599,
          currency: 'THB',
          features: [
            'Platinum badge',
            'VIP customer support',
            'All premium features',
            'Early access to new features',
            'Exclusive platinum events',
            'Personal account manager'
          ]
        },
        yearly: {
          price: 5990,
          currency: 'THB',
          savings: 1198, // 599 * 12 - 5990
          savingsPercentage: 17,
          features: [
            'Platinum badge',
            'VIP customer support',
            'All premium features',
            'Early access to new features',
            'Exclusive platinum events',
            'Personal account manager'
          ]
        }
      }
    };

    res.status(200).json({
      success: true,
      message: "Subscription pricing retrieved successfully",
      data: { pricing }
    });

  } catch (error) {
    console.error('Error getting subscription pricing:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ===============================
// SUPER ADMIN FUNCTIONS
// ===============================

// ✅ Superadmin: Create subscription for user
const adminCreateSubscription = async (req, res) => {
  try {
    const { userId, subscriptionType, billingCycle, price, startDate, endDate, notes } = req.body;

    // Validate required fields
    if (!userId || !subscriptionType || !billingCycle || !price || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create subscription using the static method
    const newSubscription = await UserSubscription.createSubscription({
      userId,
      subscriptionType,
      billingCycle,
      price,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      paymentInfo: {
        method: 'admin_created',
        transactionId: `ADMIN_${Date.now()}`,
        amount: price,
        currency: 'THB',
        status: 'completed',
        notes: notes || 'Created by Super Admin'
      },
      metadata: {
        createdBy: 'superadmin',
        notes: notes || 'Created by Super Admin'
      }
    });

    // Queue subscription event
    await queueSubscriptionEvent('subscription-purchased', { 
      subscription: newSubscription, 
      user, 
      purchaseDetails: { method: 'admin_created' } 
    });

    res.json({
      success: true,
      message: "Subscription created successfully",
      subscription: newSubscription
    });

  } catch (error) {
    console.error("❌ Failed to create subscription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Superadmin: Delete subscription
const adminDeleteSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    // Update status to cancelled instead of deleting
    subscription.status = 'cancelled';
    subscription.metadata = {
      ...subscription.metadata,
      cancelledBy: 'superadmin',
      cancelledAt: new Date(),
      notes: 'Cancelled by Super Admin'
    };

    await subscription.save();

    // Queue subscription event
    await queueSubscriptionEvent('subscription-cancelled', { 
      subscription, 
      user: await User.findById(subscription.userId),
      cancellationDate: new Date() 
    });

    res.json({
      success: true,
      message: "Subscription cancelled successfully"
    });

  } catch (error) {
    console.error("❌ Failed to cancel subscription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  purchaseSubscription,
  getCurrentSubscription,
  getSubscriptionHistory,
  cancelSubscription,
  getUserCurrentLevel,
  getAllSubscriptions,
  getSubscriptionPricing,
  // Super admin functions
  adminCreateSubscription,
  adminDeleteSubscription
};
