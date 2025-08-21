// queues/producer.js
const {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  subscriptionQueue,
  subscriptionQueueEvent,
  emailNotificationQueue,
  emailNotificationQueueEvent,
  jobOptions,
  connection,
} = require("./queueInstances");

const { Worker } = require("bullmq");
const sendOrderBookedEmail = require("../modules/email/sendOrderBookedEmail");
const { sendSubscriptionExpiryEmail } = require("../modules/email/sendSubscriptionExpiryEmail");

const webhookHandlerWorker = new Worker(
  "webhookHandler-queue",
  async (job) => {
    const {
      webhookHandlerService,
    } = require("../controllers/activityOrderControllers");
    return await webhookHandlerService(job.data);
  },
  { connection, jobOptions }
);

const sendOrderBookedEmailWorker = new Worker(
  "sendOrder-Email-queue",
  async (job) => {
    const { order, user, activity, slot } = job.data;
    return await sendOrderBookedEmail(order, user, activity, slot);
  },
  { connection, jobOptions }
);

// ✅ Subscription Worker - จัดการ subscription lifecycle events
const subscriptionWorker = new Worker(
  "subscription-queue",
  async (job) => {
    const { type, data } = job.data;
    
    console.log(`🔄 Processing subscription job: ${type}`);
    
    try {
      switch (type) {
        case 'subscription-purchased':
          return await handleSubscriptionPurchased(data);
        
        case 'subscription-extended':
          return await handleSubscriptionExtended(data);
        
        case 'subscription-cancelled':
          return await handleSubscriptionCancelled(data);
        
        case 'subscription-expired':
          return await handleSubscriptionExpired(data);
        
        case 'cleanup-expired':
          return await handleCleanupExpired(data);
        
        default:
          throw new Error(`Unknown subscription job type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Error processing subscription job ${type}:`, error);
      throw error;
    }
  },
  { 
    connection, 
    ...jobOptions,
    concurrency: 5 // ประมวลผลพร้อมกันได้ 5 jobs
  }
);

// ✅ Email Notification Worker - ส่ง email notifications ทุกประเภท
const emailNotificationWorker = new Worker(
  "email-notification-queue",
  async (job) => {
    const { type, data } = job.data;
    
    console.log(`📧 Processing email notification: ${type}`);
    
    try {
      switch (type) {
        case 'subscription-expiry-warning':
          const { subscription, daysRemaining } = data;
          return await sendSubscriptionExpiryEmail(subscription, daysRemaining);
        
        case 'subscription-welcome':
          return await handleWelcomeEmail(data);
        
        case 'subscription-cancelled-confirmation':
          return await handleCancellationEmail(data);
        
        case 'subscription-expired-notification':
          return await handleExpiredNotificationEmail(data);
        
        default:
          throw new Error(`Unknown email notification type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Error sending email notification ${type}:`, error);
      throw error;
    }
  },
  { 
    connection, 
    ...jobOptions,
    concurrency: 10 // ส่ง email พร้อมกันได้ 10 jobs
  }
);

// ===============================
// SUBSCRIPTION EVENT HANDLERS
// ===============================

const handleSubscriptionPurchased = async (data) => {
  const { subscription, user } = data;
  console.log(`✅ Subscription purchased: ${subscription.subscriptionType} for user ${user.user.email}`);
  
  // ส่ง welcome email
  await emailNotificationQueue.add(
    'subscription-welcome',
    {
      type: 'subscription-welcome',
      data: { subscription, user }
    },
    { priority: 8 }
  );
  
  return { success: true, message: 'Subscription purchase processed' };
};

const handleSubscriptionExtended = async (data) => {
  const { subscription, user } = data;
  console.log(`🔄 Subscription extended: ${subscription.subscriptionType} for user ${user.user.email}`);
  
  return { success: true, message: 'Subscription extension processed' };
};

const handleSubscriptionCancelled = async (data) => {
  const { subscription, user } = data;
  console.log(`❌ Subscription cancelled: ${subscription.subscriptionType} for user ${user.user.email}`);
  
  // ส่ง cancellation confirmation email
  await emailNotificationQueue.add(
    'subscription-cancelled-confirmation',
    {
      type: 'subscription-cancelled-confirmation',
      data: { subscription, user }
    },
    { priority: 7 }
  );
  
  return { success: true, message: 'Subscription cancellation processed' };
};

const handleSubscriptionExpired = async (data) => {
  const { subscription, user } = data;
  console.log(`⏰ Subscription expired: ${subscription.subscriptionType} for user ${user.user.email}`);
  
  // ส่ง expired notification email
  await emailNotificationQueue.add(
    'subscription-expired-notification',
    {
      type: 'subscription-expired-notification',
      data: { subscription, user }
    },
    { priority: 6 }
  );
  
  return { success: true, message: 'Subscription expiry processed' };
};

const handleCleanupExpired = async (data) => {
  const { cleanupCount } = data;
  console.log(`🧹 Cleanup expired subscriptions: ${cleanupCount} updated`);
  
  return { success: true, message: `${cleanupCount} expired subscriptions cleaned up` };
};

// ===============================
// EMAIL HANDLERS
// ===============================

const handleWelcomeEmail = async (data) => {
  // TODO: สร้าง welcome email template
  console.log('📧 Sending welcome email (placeholder)');
  return { success: true, message: 'Welcome email sent' };
};

const handleCancellationEmail = async (data) => {
  // TODO: สร้าง cancellation email template
  console.log('📧 Sending cancellation email (placeholder)');
  return { success: true, message: 'Cancellation email sent' };
};

const handleExpiredNotificationEmail = async (data) => {
  // TODO: สร้าง expired notification email template
  console.log('📧 Sending expired notification email (placeholder)');
  return { success: true, message: 'Expired notification email sent' };
};

// ===============================
// ERROR HANDLERS
// ===============================

subscriptionWorker.on('completed', (job) => {
  console.log(`✅ Subscription job ${job.id} completed`);
});

subscriptionWorker.on('failed', (job, err) => {
  console.error(`❌ Subscription job ${job?.id} failed:`, err);
});

emailNotificationWorker.on('completed', (job) => {
  console.log(`📧 Email notification job ${job.id} completed`);
});

emailNotificationWorker.on('failed', (job, err) => {
  console.error(`❌ Email notification job ${job?.id} failed:`, err);
});

module.exports = {
  webhookHandlerQueue,
  webhookHandlerQueueEvent,
  sendOrderBookedEmailQueue,
  sendOrderBookedEmailQueueEvent,
  subscriptionQueue,
  subscriptionQueueEvent,
  emailNotificationQueue,
  emailNotificationQueueEvent,
  jobOptions,
};
