# 🎯 Subscription System Documentation

ระบบ subscription สำหรับจัดการระดับสมาชิก (Premium/Platinum) ที่รองรับการต่อเวลาและหมดอายุอัตโนมัติ

## 📋 Overview

ระบบนี้ช่วยให้ผู้ใช้สามารถ:
- ซื้อ subscription แบบ Premium หรือ Platinum
- เลือกระยะเวลา Monthly (30 วัน) หรือ Yearly (365 วัน)  
- ต่อเวลา subscription ได้ (จะบวกเวลาให้)
- ระบบจะลดระดับกลับเป็น Regular อัตโนมัติเมื่อหมดอายุ

## 🏗️ Architecture

### 📁 Files Structure
```
backend/
├── schemas/v1/
│   └── userSubscription.schema.js      # Schema หลักสำหรับ subscription
├── controllers/
│   └── subscriptionControllers.js      # API controllers
├── routes/v1/
│   └── subscriptionRoutes.js           # API routes
├── utils/
│   └── subscriptionUtils.js            # Utility functions
├── jobs/
│   └── subscriptionJobs.js             # Cron jobs สำหรับ cleanup
└── SUBSCRIPTION_SYSTEM_README.md       # Documentation นี้
```

### 🗄️ Database Schema

#### UserSubscription Schema
```javascript
{
  userId: ObjectId,                    // ref to User
  subscriptionType: "premium|platinum",
  billingCycle: "monthly|yearly", 
  status: "active|expired|cancelled",
  startDate: Date,
  endDate: Date,                       // วันหมดอายุ
  originalEndDate: Date,               // วันหมดอายุเดิม (ก่อนต่อเวลา)
  totalExtensions: Number,             // จำนวนครั้งที่ต่อเวลา
  extensionHistory: [{                 // ประวัติการต่อเวลา
    purchaseDate: Date,
    extensionType: "monthly|yearly",
    previousEndDate: Date,
    newEndDate: Date,
    extensionDays: Number
  }],
  price: Number,                       // ราคาที่จ่าย
  currency: "THB",
  paymentInfo: {
    transactionId: String,
    paymentMethod: String,
    paymentDate: Date,
    amount: Number
  },
  expireAt: Date,                      // สำหรับ TTL index (หมดอายุ + 30 วัน)
  metadata: {
    purchaseSource: String,
    promotionCode: String,
    originalLevel: String
  }
}
```

## 🚀 API Endpoints

### 📊 Public Endpoints

#### GET `/api/v1/subscription/pricing`
ดูราคา subscription plans
```json
{
  "success": true,
  "data": {
    "pricing": {
      "premium": {
        "monthly": { "price": 299, "currency": "THB" },
        "yearly": { "price": 2990, "currency": "THB", "savings": 598 }
      },
      "platinum": {
        "monthly": { "price": 599, "currency": "THB" },
        "yearly": { "price": 5990, "currency": "THB", "savings": 1198 }
      }
    }
  }
}
```

### 🔐 User Endpoints (ต้อง login)

#### POST `/api/v1/subscription/purchase`
ซื้อ subscription ใหม่หรือต่อเวลา
```json
// Request
{
  "subscriptionType": "premium", // premium|platinum
  "billingCycle": "monthly",     // monthly|yearly
  "paymentInfo": {
    "transactionId": "TXN123456",
    "paymentMethod": "credit_card",
    "amount": 299
  }
}

// Response
{
  "success": true,
  "message": "premium subscription created successfully",
  "data": {
    "subscription": { /* subscription object */ },
    "daysRemaining": 30
  }
}
```

#### GET `/api/v1/subscription/current`
ดู subscription ปัจจุบัน
```json
{
  "success": true,
  "data": {
    "subscription": { /* subscription object */ },
    "currentLevel": "premium",
    "daysRemaining": 25,
    "isActive": true
  }
}
```

#### GET `/api/v1/subscription/history`
ดูประวัติ subscription (รองรับ pagination)
```json
{
  "success": true,
  "data": {
    "subscriptions": [/* array of subscriptions */],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

#### PATCH `/api/v1/subscription/cancel`
ยกเลิก subscription (ยังใช้ได้จนหมดอายุ)
```json
{
  "success": true,
  "message": "Subscription cancelled successfully. You can still use premium features until the expiration date.",
  "data": {
    "subscription": { /* subscription object */ },
    "daysRemaining": 15
  }
}
```

#### GET `/api/v1/subscription/level`
ดูระดับปัจจุบันของ user
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "currentLevel": "premium",
    "levelDetails": {
      "level": "premium",
      "source": "subscription",
      "expiresAt": "2024-02-15T00:00:00.000Z",
      "daysRemaining": 25,
      "subscriptionId": "sub123"
    }
  }
}
```

### 👨‍💼 Admin Endpoints

#### GET `/api/v1/subscription/admin/all`
ดู subscription ทั้งหมด (สำหรับ admin)
- รองรับ filter: `status`, `subscriptionType`, `billingCycle`
- รองรับ pagination: `page`, `limit`
- มีสถิติรวม

## 🛠️ Utility Functions

### subscriptionUtils.js

#### `getUserCurrentLevel(userId)`
```javascript
const level = await getUserCurrentLevel('user123');
// Returns: { level: 'premium', subscription: {...}, daysRemaining: 25, isActive: true }
```

#### `checkUserPermission(userId, feature)`
```javascript
const canAccess = await checkUserPermission('user123', 'premium_badge');
// Returns: true/false
```

#### `requireSubscriptionLevel(levels)` - Middleware
```javascript
// ใช้เป็น middleware
router.get('/premium-feature', 
  requireSubscriptionLevel(['premium', 'platinum']), 
  (req, res) => {
    // เฉพาะ premium/platinum เข้าได้
  }
);
```

## ⚙️ Auto-Expire System

### 🔄 TTL Index
- MongoDB TTL index จะลบ subscription ที่หมดอายุแล้ว 30 วันอัตโนมัติ
- ช่วยประหยัด storage และรักษาประสิทธิภาพ

### 📅 Cron Jobs

#### Daily Cleanup (02:00 น.)
```javascript
// อัปเดตสถานะ subscription ที่หมดอายุเป็น 'expired'
cleanupExpiredSubscriptions();
```

#### Daily Notifications (09:00 น.)
```javascript
// แจ้งเตือน subscription ที่ใกล้หมดอายุ
notifyExpiringSubscriptions(7); // 7 วันก่อนหมดอายุ
notifyExpiringSubscriptions(1); // 1 วันก่อนหมดอายุ
```

#### Weekly Stats (จันทร์ 08:00 น.)
```javascript
// สร้างรายงานสถิติ subscription
getSubscriptionStats();
```

## 💰 Pricing Structure

| Plan | Monthly | Yearly | Savings |
|------|---------|--------|---------|
| Premium | ฿299 | ฿2,990 | ฿598 (17%) |
| Platinum | ฿599 | ฿5,990 | ฿1,198 (17%) |

## 🎨 Features by Level

### Regular (Free)
- ✅ Basic profile
- ✅ Basic activities
- ✅ Basic venues

### Premium (฿299/month)
- ✅ All Regular features
- ✅ Premium badge
- ✅ Priority customer support  
- ✅ Exclusive events access
- ✅ Advanced profile customization
- ✅ Premium filters

### Platinum (฿599/month)
- ✅ All Premium features
- ✅ Platinum badge
- ✅ VIP customer support
- ✅ Early access to new features
- ✅ Exclusive platinum events
- ✅ Personal account manager

## 🔧 How Extension Works

เมื่อผู้ใช้ซื้อ subscription เพิ่ม:

1. **Same Type Extension**: ถ้าซื้อ plan เดียวกัน จะต่อเวลาจากวันหมดอายุปัจจุบัน
   ```
   Current: Premium ถึง 2024-02-01
   Buy: Premium 1 month
   Result: Premium ถึง 2024-03-01
   ```

2. **Different Type**: ถ้าซื้อ plan ต่างกัน จะได้ error ให้รอหมดอายุก่อน

3. **Extension History**: บันทึกประวัติการต่อเวลาทุกครั้ง
   ```javascript
   extensionHistory: [{
     purchaseDate: "2024-01-15",
     extensionType: "monthly",
     previousEndDate: "2024-02-01", 
     newEndDate: "2024-03-01",
     extensionDays: 30
   }]
   ```

## 🚨 Error Handling

### Common Error Responses

#### 400 - Invalid Input
```json
{
  "success": false,
  "message": "Invalid subscription type. Must be 'premium' or 'platinum'"
}
```

#### 403 - Permission Denied  
```json
{
  "success": false,
  "message": "This feature requires premium or platinum subscription",
  "userCurrentLevel": "regular",
  "requiredLevels": ["premium", "platinum"]
}
```

#### 404 - Not Found
```json
{
  "success": false,
  "message": "No active subscription found"
}
```

## 🧪 Testing

### Manual Testing Commands
```javascript
// ทดสอบ cleanup ทันที
const { runImmediateCleanup } = require('./jobs/subscriptionJobs');
await runImmediateCleanup();

// ทดสอบ notification
const { runImmediateNotification } = require('./jobs/subscriptionJobs');
await runImmediateNotification(7);

// ดูสถิติ
const { getSubscriptionStats } = require('./utils/subscriptionUtils');
const stats = await getSubscriptionStats();
```

## 🔐 Security Considerations

1. **Authentication**: ทุก endpoint ต้องใช้ auth middleware (ยกเว้น pricing)
2. **Authorization**: ตรวจสอบสิทธิ์ระดับ subscription ด้วย middleware
3. **Input Validation**: ตรวจสอบ input ทุก field
4. **Rate Limiting**: ควรใส่ rate limiting สำหรับ purchase endpoint

## 📈 Monitoring & Analytics

### Key Metrics to Track
- Active subscriptions by type
- Monthly recurring revenue (MRR)
- Annual recurring revenue (ARR)
- Churn rate
- Extension rate
- Average subscription duration

### Log Events
- Subscription purchases
- Extensions
- Cancellations
- Expiry notifications
- Payment failures

## 🛠️ Future Enhancements

1. **Payment Integration**: Stripe, PayPal, PromptPay
2. **Promotional Codes**: Discount coupons
3. **Free Trials**: 7-day free trial
4. **Auto-Renewal**: ต่ออายุอัตโนมัติ
5. **Refund System**: การคืนเงิน
6. **Usage Analytics**: ติดตามการใช้งาน features
7. **Email Notifications**: แจ้งเตือนทาง email
8. **Mobile Push Notifications**: แจ้งเตือนผ่าน mobile app

---

## 📞 Support

หากมีปัญหาหรือคำถามเกี่ยวกับระบบ subscription กรุณาติดต่อ development team

**Last Updated**: January 2024
