# Privacy & Block System API Documentation

## Overview
ระบบ Privacy และ Block ที่ครอบคลุมการจัดการความเป็นส่วนตัวของผู้ใช้ การค้นหา และการบล็อกผู้ใช้

## Features Added
- ✅ **Privacy Settings**: การตั้งค่าความเป็นส่วนตัว
- ✅ **User Search**: ค้นหาผู้ใช้ (รองรับ privacy)
- ✅ **Block System**: บล็อก/ยกเลิกบล็อกผู้ใช้
- ✅ **Profile Visibility**: ควบคุมการมองเห็นโปรไฟล์
- ✅ **Chat Privacy**: ตรวจสอบ privacy ก่อนแชท
- ✅ **User Reporting**: รายงานผู้ใช้

---

## Privacy Settings

### User Schema Changes

#### Privacy Settings Object
```javascript
privacySettings: {
  searchable: Boolean,           // อนุญาตให้ค้นเจอแบบสาธารณะ (default: true)
  allowDirectMessage: Boolean,   // อนุญาตให้ทักแชทได้ (default: true)
  showOnlineStatus: Boolean,     // แสดงสถานะออนไลน์ (default: true)
  allowGroupInvite: Boolean,     // อนุญาตให้เชิญเข้ากลุ่ม (default: true)
  profileVisibility: String     // "public", "friends", "private" (default: "public")
}
```

#### Block Lists
```javascript
blockedUsers: [{
  userId: ObjectId,              // ผู้ใช้ที่ถูกบล็อก
  blockedAt: Date,              // วันที่บล็อก
  reason: String                // เหตุผล: "spam", "harassment", "inappropriate", "other"
}]

blockedBy: [{
  userId: ObjectId,              // ผู้ใช้ที่บล็อกเรา
  blockedAt: Date               // วันที่ถูกบล็อก
}]
```

---

## REST API Endpoints

### 🔒 Privacy Settings

#### 1. ดึงการตั้งค่าความเป็นส่วนตัว
```http
GET /api/v1/privacy/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "privacySettings": {
    "searchable": true,
    "allowDirectMessage": true,
    "showOnlineStatus": true,
    "allowGroupInvite": true,
    "profileVisibility": "public"
  }
}
```

#### 2. อัพเดทการตั้งค่าความเป็นส่วนตัว
```http
PUT /api/v1/privacy/settings
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "searchable": false,
  "allowDirectMessage": true,
  "showOnlineStatus": false,
  "allowGroupInvite": true,
  "profileVisibility": "friends"
}
```

**Response:**
```json
{
  "success": true,
  "message": "อัพเดทการตั้งค่าความเป็นส่วนตัวสำเร็จ",
  "privacySettings": {
    "searchable": false,
    "allowDirectMessage": true,
    "showOnlineStatus": false,
    "allowGroupInvite": true,
    "profileVisibility": "friends"
  }
}
```

---

### 🚫 Block Management

#### 3. ดึงรายการผู้ใช้ที่ถูกบล็อก
```http
GET /api/v1/privacy/blocked-users?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "blockedUsers": [
    {
      "userId": {
        "_id": "userId",
        "user": {
          "name": "John Doe",
          "email": "john@example.com"
        },
        "userData": {
          "profileImage": "https://example.com/avatar.jpg"
        }
      },
      "blockedAt": "2024-01-01T00:00:00.000Z",
      "reason": "spam"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalItems": 5,
    "totalPages": 1,
    "hasMore": false
  }
}
```

#### 4. บล็อกผู้ใช้
```http
POST /api/v1/privacy/block
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userIdToBlock": "userId",
  "reason": "spam"
}
```

**Response:**
```json
{
  "success": true,
  "message": "บล็อกผู้ใช้สำเร็จ"
}
```

#### 5. ยกเลิกการบล็อกผู้ใช้
```http
POST /api/v1/privacy/unblock
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userIdToUnblock": "userId"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ยกเลิกการบล็อกผู้ใช้สำเร็จ"
}
```

#### 6. ตรวจสอบสถานะการบล็อก
```http
GET /api/v1/privacy/block-status/:userId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "blockStatus": {
    "isBlocked": false,      // ฉันบล็อกเขา
    "isBlockedBy": false,    // เขาบล็อกฉัน
    "canMessage": true,      // ฉันส่งข้อความหาเขาได้หรือไม่
    "canSearch": true        // ฉันค้นหาเขาได้หรือไม่
  }
}
```

---

### 🔍 User Search & Profile

#### 7. ค้นหาผู้ใช้
```http
GET /api/v1/privacy/search/users?q=john&page=1&limit=20&userType=regular
Authorization: Bearer <token>
```

**Query Parameters:**
- `q`: คำค้นหา (ต้องมีอย่างน้อย 2 ตัวอักษร)
- `page`: หน้า (default: 1)
- `limit`: จำนวนต่อหน้า (default: 20)
- `userType`: ประเภทผู้ใช้ (optional)

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "userId",
      "user": {
        "name": "John Doe",
        "email": "john@example.com",
        "username": "john_doe"
      },
      "userType": "regular",
      "userData": {
        "profileImage": "https://example.com/avatar.jpg"
      },
      "privacySettings": {
        "profileVisibility": "public"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 50,
    "hasMore": true
  }
}
```

**Search Logic:**
- ไม่แสดงตนเอง
- เฉพาะผู้ใช้ที่ `searchable: true`
- ไม่แสดงผู้ใช้ที่บล็อกกัน
- ค้นหาจาก name, email, username
- กรองตาม profileVisibility

#### 8. ดึงข้อมูลผู้ใช้
```http
GET /api/v1/privacy/user/:userId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "userId",
    "user": {
      "name": "John Doe",
      "email": "john@example.com",
      "username": "john_doe"
    },
    "userType": "regular",
    "userData": {
      "profileImage": "https://example.com/avatar.jpg",
      "gender": "male",
      "birthday": "1990-01-01T00:00:00.000Z"
    },
    "privacySettings": {
      "profileVisibility": "public"
    }
  }
}
```

**Access Control:**
- ตรวจสอบการบล็อก
- ตรวจสอบ profileVisibility
- ไม่แสดงข้อมูลส่วนตัว (password, token, blockedUsers)

#### 9. รายงานผู้ใช้
```http
POST /api/v1/privacy/report
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userId": "userIdToReport",
  "reason": "harassment",
  "description": "This user is sending inappropriate messages"
}
```

**Response:**
```json
{
  "success": true,
  "message": "รายงานผู้ใช้สำเร็จ ทีมงานจะตรวจสอบและดำเนินการต่อไป"
}
```

---

## Chat Integration

### Privacy Checks in Chat

ระบบ Chat ได้รับการปรับปรุงให้ตรวจสอบ Privacy และ Block ก่อนการดำเนินการ:

#### สร้างห้องแชทส่วนตัว
```javascript
// ตรวจสอบก่อนสร้างห้องแชท
if (currentUser.isBlocked(otherUserId) || currentUser.isBlockedBy(otherUserId)) {
  return "ไม่สามารถสร้างห้องแชทได้เนื่องจากมีการบล็อกกัน";
}

if (!otherUser.canReceiveMessageFrom(userId)) {
  return "ผู้ใช้นี้ไม่อนุญาตให้รับข้อความจากคุณ";
}
```

#### ส่งข้อความ
```javascript
// ตรวจสอบก่อนส่งข้อความ
if (currentUser.isBlocked(otherUserId) || currentUser.isBlockedBy(otherUserId)) {
  return "ไม่สามารถส่งข้อความได้เนื่องจากมีการบล็อกกัน";
}
```

---

## User Schema Methods

### Instance Methods

#### Privacy Methods
```javascript
// ตรวจสอบว่าสามารถค้นหาได้หรือไม่
user.canBeSearchedBy(searcherId)

// ตรวจสอบว่าสามารถรับข้อความได้หรือไม่
user.canReceiveMessageFrom(senderId)
```

#### Block Methods
```javascript
// ตรวจสอบว่าบล็อกผู้ใช้หรือไม่
user.isBlocked(userId)

// ตรวจสอบว่าถูกบล็อกหรือไม่
user.isBlockedBy(userId)

// บล็อกผู้ใช้
await user.blockUser(userIdToBlock, reason)

// ยกเลิกการบล็อก
await user.unblockUser(userIdToUnblock)
```

---

## Test Data

### การรันข้อมูลทดสอบ
```bash
# รันข้อมูลทดสอบ
npm run seed:chat-privacy

# หรือ
node scripts/runSeed.js chat-privacy
```

### Test Accounts
| Email | Password | Privacy Settings | Notes |
|-------|----------|------------------|-------|
| alice@example.com | password123 | ปกติทั้งหมด | สามารถแชทได้ปกติ |
| bob@example.com | password123 | ไม่แสดงสถานะออนไลน์ | showOnlineStatus=false |
| charlie@example.com | password123 | ไม่อนุญาตให้ค้นหา | searchable=false |
| diana@example.com | password123 | ไม่อนุญาตให้ทักแชท | allowDirectMessage=false |
| eve@example.com | password123 | โปรไฟล์ส่วนตัว | profileVisibility=private |
| frank@example.com | password123 | ปกติ | บล็อก Charlie แล้ว |

### Test Scenarios

#### 1. การค้นหาผู้ใช้
```bash
# ค้นหา "charlie" - จะไม่เจอเพราะ searchable=false
GET /api/v1/privacy/search/users?q=charlie

# ค้นหา "alice" - จะเจอปกติ
GET /api/v1/privacy/search/users?q=alice
```

#### 2. การสร้างห้องแชท
```bash
# Alice แชทกับ Bob - สำเร็จ
POST /api/v1/chat/rooms
{
  "name": "Alice & Bob",
  "type": "private", 
  "participants": ["aliceId", "bobId"]
}

# Alice แชทกับ Diana - ล้มเหลว (Diana ไม่อนุญาตให้ทักแชท)
POST /api/v1/chat/rooms
{
  "name": "Alice & Diana",
  "type": "private",
  "participants": ["aliceId", "dianaId"]
}

# Frank แชทกับ Charlie - ล้มเหลว (Frank บล็อก Charlie)
POST /api/v1/chat/rooms
{
  "name": "Frank & Charlie", 
  "type": "private",
  "participants": ["frankId", "charlieId"]
}
```

#### 3. การดูโปรไฟล์
```bash
# ดูโปรไฟล์ Eve - ล้มเหลว (โปรไฟล์ส่วนตัว)
GET /api/v1/privacy/user/eveId

# ดูโปรไฟล์ Alice - สำเร็จ (โปรไฟล์สาธารณะ)
GET /api/v1/privacy/user/aliceId
```

---

## Privacy Logic Flow

### User Search Flow
```
1. ตรวจสอบคำค้นหา (ต้อง >= 2 ตัวอักษร)
2. สร้าง query:
   - ไม่ใช่ตัวเอง
   - searchable = true
   - ไม่ได้บล็อกกัน
   - ตรงกับ name/email/username
3. กรองตาม profileVisibility
4. ส่งผลลัพธ์
```

### Chat Creation Flow
```
1. ตรวจสอบข้อมูลพื้นฐาน
2. สำหรับ private chat:
   - ตรวจสอบการบล็อก
   - ตรวจสอบ allowDirectMessage
   - ตรวจสอบห้องที่มีอยู่แล้ว
3. สร้างห้องแชท
```

### Message Sending Flow
```
1. ตรวจสอบสิทธิ์สมาชิก
2. สำหรับ private chat:
   - ตรวจสอบการบล็อก
   - ตรวจสอบ allowDirectMessage
3. ส่งข้อความ
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | กรุณาระบุคำค้นหาอย่างน้อย 2 ตัวอักษร | คำค้นหาสั้นเกินไป |
| 400 | ไม่สามารถบล็อกตนเองได้ | พยายามบล็อกตัวเอง |
| 403 | ไม่สามารถสร้างห้องแชทได้เนื่องจากมีการบล็อกกัน | ถูกบล็อกหรือบล็อกกัน |
| 403 | ผู้ใช้นี้ไม่อนุญาตให้รับข้อความจากคุณ | allowDirectMessage = false |
| 403 | โปรไฟล์นี้เป็นส่วนตัว | profileVisibility = private |
| 404 | ไม่พบผู้ใช้ | User ไม่มีอยู่ |

---

## Best Practices

### 1. Privacy by Design
- ตั้งค่า default ให้ปลอดภัย
- ให้ผู้ใช้ควบคุมได้ทุกการตั้งค่า
- ตรวจสอบสิทธิ์ทุก action

### 2. Performance Optimization
- ใช้ indexes สำหรับการค้นหา
- Cache ข้อมูลที่เข้าถึงบ่อย
- Pagination สำหรับรายการยาว

### 3. User Experience
- แจ้งเหตุผลเมื่อ action ล้มเหลว
- ให้ตัวเลือกการตั้งค่าที่ชัดเจน
- รองรับการยกเลิกการบล็อก

### 4. Security
- ไม่เปิดเผยข้อมูลส่วนตัว
- Log การกระทำที่สำคัญ
- Rate limiting สำหรับการค้นหา

---

## Future Enhancements

### 1. Friends System
- เพิ่มระบบเพื่อน
- กรอง profileVisibility = "friends"
- Friend requests

### 2. Advanced Reporting
- สร้าง UserReport schema
- Admin panel สำหรับจัดการรายงาน
- Automated moderation

### 3. Temporary Blocks
- Block ชั่วคราว (มีวันหมดอายุ)
- Auto-unblock หลังระยะเวลา

### 4. Group Privacy
- การตั้งค่า privacy ของกลุ่ม
- อนุมัติสมาชิกใหม่
- Admin controls

ระบบ Privacy และ Block นี้ให้ผู้ใช้ควบคุมการมองเห็นและการสื่อสารได้อย่างละเอียด พร้อมรองรับการใช้งานในระดับ Production! 🔒
