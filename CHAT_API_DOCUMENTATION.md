# Chat API Documentation

## Overview
ระบบ Chat แบบเต็มรูปแบบที่รองรับการแชทแบบ Real-time ผ่าน WebSocket และ REST API พร้อมฟีเจอร์ครบครัน

## Features
- ✅ **Real-time messaging** ผ่าน WebSocket
- ✅ **Media support** (รูป, วิดีโอ, เสียง, ไฟล์)
- ✅ **Sticker system** (ภาพนิ่ง, ภาพเคลื่อนไหว, Interactive)
- ✅ **Message reactions** (Emoji reactions)
- ✅ **Reply to messages** (ตอบกลับข้อความ)
- ✅ **Forward messages** (ส่งต่อข้อความ)
- ✅ **Edit messages** (แก้ไขข้อความ)
- ✅ **Soft delete messages** (ลบข้อความแบบ Soft Delete)
- ✅ **Typing indicators** (แสดงสถานะการพิมพ์)
- ✅ **Read receipts** (ติ๊กอ่านแล้ว)
- ✅ **Online status** (สถานะออนไลน์)
- ✅ **Group chat & Private chat**
- ✅ **Chat room management**

---

## Authentication
ทุก API endpoint ต้องใช้ Bearer Token ใน Authorization header
```
Authorization: Bearer <your_jwt_token>
```

---

## REST API Endpoints

### 🏠 Chat Rooms

#### 1. สร้างห้องแชทใหม่
```http
POST /api/v1/chat/rooms
```

**Request Body:**
```json
{
  "name": "ชื่อห้องแชท",
  "type": "private", // "private" หรือ "group"
  "participants": ["userId1", "userId2"], // Array ของ User IDs
  "activityId": "activityId", // จำเป็นสำหรับ type: "group"
  "description": "คำอธิบายห้อง",
  "avatar": "url_to_avatar"
}
```

**Response:**
```json
{
  "success": true,
  "message": "สร้างห้องแชทสำเร็จ",
  "chatRoom": {
    "_id": "chatRoomId",
    "name": "ชื่อห้องแชท",
    "type": "private",
    "participants": [...],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 2. ดึงรายการห้องแชทของ User
```http
GET /api/v1/chat/rooms?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "chatRooms": [
    {
      "_id": "chatRoomId",
      "name": "ชื่อห้องแชท",
      "type": "private",
      "participants": [...],
      "lastMessage": {...},
      "unreadCount": 5,
      "lastMessageTime": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3
  }
}
```

#### 3. ดูรายละเอียดห้องแชท
```http
GET /api/v1/chat/rooms/:chatRoomId
```

#### 4. เข้าร่วมห้องแชท
```http
POST /api/v1/chat/rooms/:chatRoomId/join
```

#### 5. ออกจากห้องแชท
```http
POST /api/v1/chat/rooms/:chatRoomId/leave
```

#### 6. อัพเดทการตั้งค่าห้องแชท
```http
PUT /api/v1/chat/rooms/:chatRoomId/settings
```

**Request Body:**
```json
{
  "name": "ชื่อใหม่",
  "description": "คำอธิบายใหม่",
  "avatar": "url_to_new_avatar",
  "settings": {
    "allowMediaUpload": true,
    "allowStickers": true,
    "allowReactions": true
  }
}
```

---

### 💬 Messages

#### 1. ดึงข้อความในห้องแชท
```http
GET /api/v1/chat/rooms/:chatRoomId/messages?page=1&limit=50&before=2024-01-01T00:00:00.000Z
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "messageId",
      "sender": {
        "_id": "userId",
        "name": "User Name",
        "avatar": "avatar_url"
      },
      "type": "text",
      "content": "Hello World!",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "reactions": [...],
      "isEdited": false,
      "replyTo": null
    }
  ]
}
```

#### 2. ส่งข้อความ Text
```http
POST /api/v1/chat/rooms/:chatRoomId/messages
```

**Request Body:**
```json
{
  "type": "text",
  "content": "Hello World!",
  "replyTo": "messageId" // Optional
}
```

#### 3. ส่งไฟล์สื่อ (รูป, วิดีโอ, เสียง)
```http
POST /api/v1/chat/rooms/:chatRoomId/messages/media
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: ไฟล์ที่จะส่ง
- `type`: "image", "video", "audio", "file"
- `content`: คำอธิบาย (Optional)
- `replyTo`: messageId ที่จะตอบกลับ (Optional)

#### 4. ส่ง Sticker
```http
POST /api/v1/chat/rooms/:chatRoomId/messages/sticker
```

**Request Body:**
```json
{
  "setId": "stickerSetId",
  "stickerId": "sticker001",
  "stickerType": "static", // "static", "animated", "interactive"
  "metadata": {}, // สำหรับ interactive sticker
  "replyTo": "messageId" // Optional
}
```

#### 5. แก้ไขข้อความ
```http
PUT /api/v1/chat/messages/:messageId
```

**Request Body:**
```json
{
  "content": "ข้อความใหม่ที่แก้ไขแล้ว"
}
```

#### 6. ลบข้อความ
```http
DELETE /api/v1/chat/messages/:messageId
```

**Request Body:**
```json
{
  "deleteFor": "sender" // "sender" หรือ "everyone"
}
```

#### 7. เพิ่ม Reaction
```http
POST /api/v1/chat/messages/:messageId/reactions
```

**Request Body:**
```json
{
  "emoji": "👍",
  "reactionType": "like" // "like", "love", "haha", "wow", "sad", "angry"
}
```

#### 8. ลบ Reaction
```http
DELETE /api/v1/chat/messages/:messageId/reactions
```

#### 9. ส่งต่อข้อความ
```http
POST /api/v1/chat/messages/:messageId/forward
```

**Request Body:**
```json
{
  "chatRoomIds": ["chatRoomId1", "chatRoomId2"]
}
```

#### 10. อัพเดทสถานะการอ่าน
```http
POST /api/v1/chat/rooms/:chatRoomId/read
```

---

### 🎨 Stickers

#### 1. ดึงรายการ Sticker Sets
```http
GET /api/v1/chat/stickers/sets?page=1&limit=20&category=funny&search=cat
```

#### 2. ดึงรายละเอียด Sticker Set
```http
GET /api/v1/chat/stickers/sets/:setId
```

#### 3. ดึง Stickers ในชุด
```http
GET /api/v1/chat/stickers/sets/:setId/stickers
```

#### 4. ดาวน์โหลด Sticker Set
```http
POST /api/v1/chat/stickers/sets/:setId/download
```

#### 5. ดึงรายการ Sticker ที่ User มี
```http
GET /api/v1/chat/stickers/my-collections
```

#### 6. ค้นหา Sticker
```http
GET /api/v1/chat/stickers/search?q=cat&limit=20
```

---

### 📊 Utilities

#### 1. ดึงสถิติห้องแชท
```http
GET /api/v1/chat/rooms/:chatRoomId/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalMessages": 150,
    "messagesByType": [
      {"type": "text", "count": 100},
      {"type": "image", "count": 30},
      {"type": "sticker", "count": 20}
    ],
    "totalReactions": 45,
    "activeUsers": ["userId1", "userId2"]
  }
}
```

---

## WebSocket Events

### 🔌 Connection & Authentication

#### 1. เชื่อมต่อ WebSocket
```javascript
const socket = io('http://localhost:3101');
```

#### 2. Authentication
```javascript
socket.emit('authenticate', {
  token: 'your_jwt_token',
  userId: 'your_user_id'
});

// Listen for auth response
socket.on('authenticated', (data) => {
  console.log('Authenticated:', data);
});

socket.on('auth_error', (error) => {
  console.error('Auth error:', error);
});
```

### 🏠 Chat Room Events

#### 3. เข้าร่วมห้องแชท
```javascript
socket.emit('join_chat', {
  chatRoomId: 'chatRoomId'
});

socket.on('joined_chat', (data) => {
  console.log('Joined chat:', data);
});
```

#### 4. ออกจากห้องแชท
```javascript
socket.emit('leave_chat', {
  chatRoomId: 'chatRoomId'
});
```

### 💬 Message Events

#### 5. ส่งข้อความ (Real-time)
```javascript
// หลังจากส่ง POST request สร้างข้อความแล้ว
socket.emit('send_message', {
  chatRoomId: 'chatRoomId',
  messageId: 'messageId', // จาก response ของ API
  type: 'text',
  content: 'Hello World!'
});
```

#### 6. รับข้อความใหม่
```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data.message);
  // อัพเดท UI แสดงข้อความใหม่
});
```

#### 7. Typing Indicators
```javascript
// เริ่มพิมพ์
socket.emit('typing_start', {
  chatRoomId: 'chatRoomId'
});

// หยุดพิมพ์
socket.emit('typing_stop', {
  chatRoomId: 'chatRoomId'
});

// รับแจ้งเตือนการพิมพ์
socket.on('user_typing', (data) => {
  console.log(`${data.userId} is typing...`);
});

socket.on('user_stop_typing', (data) => {
  console.log(`${data.userId} stopped typing`);
});
```

#### 8. Reactions
```javascript
// หลังจากส่ง POST request เพิ่ม reaction แล้ว
socket.emit('add_reaction', {
  messageId: 'messageId',
  emoji: '👍',
  reactionType: 'like',
  chatRoomId: 'chatRoomId'
});

// รับการอัพเดท reaction
socket.on('reaction_updated', (data) => {
  console.log('Reaction updated:', data);
});
```

#### 9. Message Actions
```javascript
// ลบข้อความ
socket.emit('delete_message', {
  messageId: 'messageId',
  chatRoomId: 'chatRoomId',
  deleteFor: 'everyone'
});

socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data);
});

// แก้ไขข้อความ
socket.emit('edit_message', {
  messageId: 'messageId',
  newContent: 'แก้ไขข้อความแล้ว',
  chatRoomId: 'chatRoomId'
});

socket.on('message_edited', (data) => {
  console.log('Message edited:', data);
});
```

#### 10. Read Receipts
```javascript
// อัพเดทสถานะการอ่าน
socket.emit('mark_as_read', {
  chatRoomId: 'chatRoomId'
});

// รับแจ้งเตือนการอ่านข้อความ
socket.on('message_read', (data) => {
  console.log(`${data.userId} read messages in ${data.chatRoomId}`);
});
```

### 👥 User Status Events

#### 11. Online Status
```javascript
// อัพเดทสถานะ
socket.emit('update_status', {
  status: 'online' // "online", "away", "busy", "invisible"
});

// รับการอัพเดทสถานะของผู้อื่น
socket.on('user_status_updated', (data) => {
  console.log(`${data.userId} is now ${data.status}`);
});

socket.on('user_online', (data) => {
  console.log(`${data.userId} came online`);
});

socket.on('user_offline', (data) => {
  console.log(`${data.userId} went offline`);
});
```

#### 12. ดึงรายชื่อ User Online
```javascript
socket.emit('get_online_users');

socket.on('online_users', (users) => {
  console.log('Online users:', users);
});
```

### 🏠 Room Events
```javascript
// User เข้าห้องแชท
socket.on('user_joined_chat', (data) => {
  console.log(`${data.userId} joined ${data.chatRoomId}`);
});

// User ออกจากห้องแชท
socket.on('user_left_chat', (data) => {
  console.log(`${data.userId} left ${data.chatRoomId}`);
});
```

### ❌ Error Handling
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

## Database Schema

### ChatRoom Schema
```javascript
{
  _id: ObjectId,
  name: String,
  type: "private" | "group",
  participants: [{
    userId: ObjectId,
    joinedAt: Date,
    lastReadMessage: ObjectId,
    lastReadTimestamp: Date,
    role: "admin" | "member",
    isActive: Boolean
  }],
  status: "active" | "inactive" | "archived",
  lastMessage: ObjectId,
  lastMessageTime: Date,
  activityId: ObjectId, // สำหรับ group chat
  messageCount: Number,
  avatar: String,
  description: String,
  settings: {
    allowMediaUpload: Boolean,
    allowStickers: Boolean,
    allowReactions: Boolean,
    maxParticipants: Number
  }
}
```

### Message Schema
```javascript
{
  _id: ObjectId,
  chatRoom: ObjectId,
  sender: ObjectId,
  type: "text" | "image" | "video" | "audio" | "file" | "sticker" | "system",
  content: Mixed,
  mediaInfo: {
    originalName: String,
    mimeType: String,
    size: Number,
    duration: Number,
    dimensions: { width: Number, height: Number },
    thumbnail: String,
    url: String
  },
  stickerInfo: {
    setId: ObjectId,
    stickerId: String,
    type: "static" | "animated" | "interactive",
    metadata: Mixed
  },
  status: "sending" | "sent" | "delivered" | "read" | "failed",
  timestamp: Date,
  reactions: [{
    userId: ObjectId,
    emoji: String,
    reactionType: String,
    createdAt: Date
  }],
  isDeleted: Boolean,
  deletedFor: "sender" | "everyone",
  isEdited: Boolean,
  editHistory: [{ content: Mixed, editedAt: Date }],
  replyTo: ObjectId,
  forwardedFrom: {
    originalMessageId: ObjectId,
    originalSender: ObjectId,
    forwardedAt: Date
  }
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | ข้อมูลที่ส่งมาไม่ถูกต้อง |
| 401 | Unauthorized | ไม่ได้ authenticate |
| 403 | Forbidden | ไม่มีสิทธิ์เข้าถึง |
| 404 | Not Found | ไม่พบข้อมูลที่ต้องการ |
| 500 | Internal Server Error | ข้อผิดพลาดของเซิร์ฟเวอร์ |

---

## Usage Examples

### สร้างห้องแชทและส่งข้อความ
```javascript
// 1. สร้างห้องแชท
const createRoom = async () => {
  const response = await fetch('/api/v1/chat/rooms', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Chat with John',
      type: 'private',
      participants: [currentUserId, johnUserId]
    })
  });
  
  const data = await response.json();
  return data.chatRoom._id;
};

// 2. เชื่อมต่อ WebSocket และเข้าห้อง
const socket = io('http://localhost:3101');

socket.emit('authenticate', {
  token: token,
  userId: currentUserId
});

socket.on('authenticated', () => {
  socket.emit('join_chat', { chatRoomId: roomId });
});

// 3. ส่งข้อความ
const sendMessage = async (message) => {
  // ส่ง API request ก่อน
  const response = await fetch(`/api/v1/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'text',
      content: message
    })
  });
  
  const data = await response.json();
  
  // แล้วส่ง WebSocket event
  socket.emit('send_message', {
    chatRoomId: roomId,
    messageId: data.data._id,
    type: 'text',
    content: message
  });
};

// 4. รับข้อความใหม่
socket.on('new_message', (data) => {
  displayMessage(data.message);
});
```

### ส่งรูปภาพ
```javascript
const sendImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'image');
  
  const response = await fetch(`/api/v1/chat/rooms/${roomId}/messages/media`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    body: formData
  });
  
  const data = await response.json();
  
  socket.emit('send_message', {
    chatRoomId: roomId,
    messageId: data.data._id,
    type: 'image'
  });
};
```

---

## Performance Tips

1. **Pagination**: ใช้ pagination สำหรับข้อความเพื่อลดการโหลด
2. **Image Optimization**: สร้าง thumbnail สำหรับรูปภาพ
3. **Caching**: Cache รายการห้องแชทและข้อความล่าสุด
4. **Connection Management**: จัดการการเชื่อมต่อ WebSocket ให้เหมาะสม
5. **File Size Limits**: จำกัดขนาดไฟล์ที่อัปโหลด

---

## Security Considerations

1. **Authentication**: ตรวจสอบ JWT token ทุก request
2. **Authorization**: ตรวจสอบสิทธิ์เข้าถึงห้องแชท
3. **File Upload**: ตรวจสอบประเภทและขนาดไฟล์
4. **Rate Limiting**: จำกัดจำนวน request ต่อนาที
5. **Input Validation**: ตรวจสอบข้อมูลที่ส่งเข้ามาทั้งหมด

ระบบ Chat นี้พร้อมใช้งานในระดับ Production และมีฟีเจอร์ครบครันสำหรับการสื่อสารแบบ Real-time! 🚀
