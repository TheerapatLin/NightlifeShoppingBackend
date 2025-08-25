# Unread Messages & Read Receipts API Documentation

## Overview
ระบบ Unread Messages และ Read Receipts ที่สมบูรณ์ รองรับการติดตามข้อความที่ยังไม่ได้อ่าน การแสดงสถานะการอ่าน และการจำกัดสมาชิกห้องแชท

## Features Added
- ✅ **Unread Message Counters**: นับข้อความที่ยังไม่ได้อ่านต่อห้อง
- ✅ **Read Receipts**: ติดตามว่าใครอ่านข้อความแล้ว
- ✅ **Delivery Status**: ติดตามว่าข้อความถูกส่งถึงแล้ว
- ✅ **Room Member Limit**: จำกัดสมาชิกห้องแชทไม่เกิน 100 คน
- ✅ **Real-time Updates**: อัพเดท unread count แบบ real-time
- ✅ **Performance Optimization**: ใช้ counter แทนการนับทุกครั้ง

---

## Database Schema Changes

### ChatRoom Schema Updates

#### Unread Counters
```javascript
unreadCounts: [{
  userId: ObjectId,           // ผู้ใช้
  count: Number,              // จำนวนข้อความที่ยังไม่ได้อ่าน (min: 0)
  lastUpdated: Date           // วันที่อัพเดทล่าสุด
}]
```

#### Room Settings
```javascript
settings: {
  allowMediaUpload: Boolean,
  allowStickers: Boolean,
  allowReactions: Boolean,
  maxParticipants: Number     // จำกัดไม่เกิน 100 คน (max: 100)
}
```

#### ChatRoom Methods
```javascript
// เพิ่ม unread count
chatRoom.incrementUnreadCount(userId)

// รีเซ็ต unread count
chatRoom.resetUnreadCount(userId)

// ดึง unread count
chatRoom.getUnreadCount(userId)

// ตรวจสอบว่าสามารถเพิ่มสมาชิกได้หรือไม่
chatRoom.canAddParticipant()

// นับสมาชิกที่ยังใช้งานอยู่
chatRoom.getActiveParticipantsCount()
```

### Message Schema Updates

#### Read Receipts
```javascript
readBy: [{
  userId: ObjectId,           // ผู้ที่อ่านข้อความ
  readAt: Date               // วันที่อ่าน
}]
```

#### Delivery Status
```javascript
deliveredTo: [{
  userId: ObjectId,           // ผู้ที่ได้รับข้อความ
  deliveredAt: Date          // วันที่ได้รับ
}]
```

---

## REST API Endpoints

### 📊 Unread Messages

#### 1. ดึงจำนวน Unread Messages ทั้งหมด
```http
GET /api/v1/chat/unread/total
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "totalUnreadCount": 15,
  "unreadRooms": 3,
  "roomDetails": [
    {
      "chatRoomId": "roomId1",
      "chatRoomName": "Friends Group",
      "unreadCount": 8
    },
    {
      "chatRoomId": "roomId2", 
      "chatRoomName": "Work Team",
      "unreadCount": 5
    },
    {
      "chatRoomId": "roomId3",
      "chatRoomName": "John & Me",
      "unreadCount": 2
    }
  ]
}
```

#### 2. ดึงรายการห้องแชทพร้อม Unread Count
```http
GET /api/v1/chat/rooms?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "chatRooms": [
    {
      "_id": "chatRoomId",
      "name": "Friends Group",
      "type": "group",
      "participants": [...],
      "lastMessage": {...},
      "lastMessageTime": "2024-01-01T12:00:00.000Z",
      "unreadCount": 5,
      "settings": {
        "maxParticipants": 100
      }
    }
  ]
}
```

### 📖 Read Receipts & Delivery

#### 3. อัพเดทสถานะการอ่าน
```http
POST /api/v1/chat/rooms/:chatRoomId/read
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "messageId": "messageId" // Optional: specific message to mark as read
}
```

**Response:**
```json
{
  "success": true,
  "message": "อัพเดทสถานะการอ่านสำเร็จ",
  "unreadCount": 0
}
```

#### 4. อัพเดทสถานะ Delivery
```http
POST /api/v1/chat/messages/:messageId/delivered
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "อัพเดทสถานะ delivery สำเร็จ"
}
```

#### 5. ดึงสถิติการอ่านข้อความ
```http
GET /api/v1/chat/messages/:messageId/read-stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "messageStats": {
    "totalParticipants": 5,
    "deliveredCount": 4,
    "readCount": 3,
    "readPercentage": 60,
    "deliveredPercentage": 80,
    "readBy": [
      {
        "userId": {
          "_id": "userId1",
          "user": {
            "name": "John Doe"
          }
        },
        "readAt": "2024-01-01T12:05:00.000Z"
      }
    ],
    "deliveredTo": [
      {
        "userId": {
          "_id": "userId2", 
          "user": {
            "name": "Jane Smith"
          }
        },
        "deliveredAt": "2024-01-01T12:02:00.000Z"
      }
    ]
  }
}
```

### 👥 Room Management

#### 6. เข้าร่วมห้องแชท (พร้อมตรวจสอบ Limit)
```http
POST /api/v1/chat/rooms/:chatRoomId/join
Authorization: Bearer <token>
```

**Response (เมื่อห้องเต็ม):**
```json
{
  "success": false,
  "message": "ห้องแชทเต็มแล้ว (จำกัด 100 คน)"
}
```

**Response (สำเร็จ):**
```json
{
  "success": true,
  "message": "เข้าร่วมห้องแชทสำเร็จ",
  "chatRoom": {
    "_id": "chatRoomId",
    "name": "Group Chat",
    "settings": {
      "maxParticipants": 100
    }
  }
}
```

---

## WebSocket Events

### 📨 Message Events

#### 1. ส่งข้อความ (อัพเดท Unread Count)
```javascript
// Client ส่ง
socket.emit('send_message', {
  chatRoomId: 'roomId',
  messageId: 'messageId', 
  type: 'text',
  content: 'Hello World!'
});

// Server ส่งกลับ
socket.on('new_message', (data) => {
  console.log('New message:', data.message);
});

// อัพเดท unread count สำหรับสมาชิกอื่น
socket.on('unread_count_updated', (data) => {
  console.log('Unread count updated:', data);
  /*
  {
    chatRoomId: 'roomId',
    chatRoomName: 'Friends Group',
    unreadCount: 5,
    lastMessage: {
      content: 'Hello World!',
      sender: 'John Doe',
      timestamp: '2024-01-01T12:00:00.000Z'
    }
  }
  */
});
```

### 📖 Read Receipt Events

#### 2. อัพเดทสถานะการอ่าน
```javascript
// Client ส่ง
socket.emit('mark_as_read', {
  chatRoomId: 'roomId',
  messageId: 'messageId' // Optional
});

// Server แจ้งสมาชิกอื่น
socket.on('message_read', (data) => {
  console.log('Message read by:', data.userId);
  /*
  {
    userId: 'userId',
    chatRoomId: 'roomId', 
    readAt: '2024-01-01T12:05:00.000Z'
  }
  */
});

// Client รับ unread count ที่รีเซ็ตแล้ว
socket.on('unread_count_reset', (data) => {
  console.log('Unread count reset:', data);
  /*
  {
    chatRoomId: 'roomId',
    unreadCount: 0
  }
  */
});
```

### 🚚 Delivery Status Events

#### 3. อัพเดทสถานะ Delivery
```javascript
// Client ส่ง
socket.emit('mark_as_delivered', {
  messageId: 'messageId'
});

// ผู้ส่งได้รับแจ้งเตือน
socket.on('message_delivered', (data) => {
  console.log('Message delivered:', data);
  /*
  {
    messageId: 'messageId',
    deliveredTo: 'userId',
    deliveredAt: '2024-01-01T12:02:00.000Z'
  }
  */
});
```

### 📊 Unread Count Events

#### 4. ขอข้อมูล Unread Count ทั้งหมด
```javascript
// Client ส่ง
socket.emit('get_total_unread');

// Server ส่งกลับ
socket.on('total_unread_count', (data) => {
  console.log('Total unread:', data);
  /*
  {
    totalUnreadCount: 15,
    unreadRooms: 3,
    roomDetails: [
      {
        chatRoomId: 'roomId1',
        chatRoomName: 'Friends Group',
        unreadCount: 8
      }
    ]
  }
  */
});
```

---

## Implementation Logic

### 🔢 Unread Count Management

#### การเพิ่ม Unread Count
```javascript
// เมื่อมีข้อความใหม่
chatRoom.participants.forEach(participant => {
  if (participant.userId.toString() !== senderId && participant.isActive) {
    chatRoom.incrementUnreadCount(participant.userId);
  }
});
```

#### การรีเซ็ต Unread Count
```javascript
// เมื่อผู้ใช้อ่านข้อความ
chatRoom.resetUnreadCount(userId);
participant.lastReadTimestamp = new Date();
```

#### การดึง Unread Count (Optimized)
```javascript
// ใช้ counter แทนการนับทุกครั้ง
const unreadCount = chatRoom.getUnreadCount(userId);

// แทนที่จะนับจาก Message collection (ช้า)
const unreadCount = await Message.countDocuments({
  chatRoom: roomId,
  timestamp: { $gt: lastReadTimestamp },
  sender: { $ne: userId },
  isDeleted: false
});
```

### 📖 Read Receipts Flow

#### 1. การส่งข้อความ
```
1. สร้างข้อความใหม่
2. เพิ่ม unread count สำหรับสมาชิกอื่น
3. ส่ง WebSocket event: new_message
4. ส่ง WebSocket event: unread_count_updated (ให้สมาชิกอื่น)
```

#### 2. การอ่านข้อความ
```
1. รีเซ็ต unread count ของผู้อ่าน
2. อัพเดท lastReadTimestamp
3. เพิ่มใน readBy array (ถ้าระบุ messageId)
4. ส่ง WebSocket event: message_read (แจ้งสมาชิกอื่น)
5. ส่ง WebSocket event: unread_count_reset (กลับไปยังผู้อ่าน)
```

#### 3. การส่งถึง (Delivery)
```
1. เพิ่มใน deliveredTo array
2. ส่ง WebSocket event: message_delivered (แจ้งผู้ส่ง)
```

### 👥 Room Limit Management

#### การตรวจสอบ Limit
```javascript
// ก่อนเพิ่มสมาชิก
if (!chatRoom.canAddParticipant()) {
  return res.status(400).json({
    success: false,
    message: `ห้องแชทเต็มแล้ว (จำกัด ${chatRoom.settings.maxParticipants} คน)`
  });
}

// Method implementation
chatRoomSchema.methods.canAddParticipant = function() {
  const activeParticipants = this.participants.filter(p => p.isActive).length;
  return activeParticipants < this.settings.maxParticipants;
};
```

---

## Performance Optimizations

### 1. Counter-based Approach
```javascript
// ❌ ช้า: นับจาก Message collection ทุกครั้ง
const unreadCount = await Message.countDocuments({
  chatRoom: roomId,
  timestamp: { $gt: lastReadTimestamp },
  sender: { $ne: userId },
  isDeleted: false
});

// ✅ เร็ว: ใช้ counter ที่เก็บไว้
const unreadCount = chatRoom.getUnreadCount(userId);
```

### 2. Bulk Operations
```javascript
// อัพเดท unread count สำหรับหลายคนพร้อมกัน
chatRoom.participants.forEach(participant => {
  if (participant.userId.toString() !== senderId && participant.isActive) {
    chatRoom.incrementUnreadCount(participant.userId);
  }
});
```

### 3. Efficient Indexing
```javascript
// Indexes สำหรับ performance
chatRoomSchema.index({ "unreadCounts.userId": 1 });
messageSchema.index({ "readBy.userId": 1 });
messageSchema.index({ "deliveredTo.userId": 1 });
```

---

## UI Integration Examples

### 1. แสดง Unread Count ใน Chat List
```javascript
const ChatList = () => {
  const [chatRooms, setChatRooms] = useState([]);

  useEffect(() => {
    // ดึงรายการห้องแชทพร้อม unread count
    fetch('/api/v1/chat/rooms')
      .then(res => res.json())
      .then(data => setChatRooms(data.chatRooms));

    // Listen สำหรับ unread count updates
    socket.on('unread_count_updated', (data) => {
      setChatRooms(prev => prev.map(room => 
        room._id === data.chatRoomId 
          ? { ...room, unreadCount: data.unreadCount }
          : room
      ));
    });
  }, []);

  return (
    <div>
      {chatRooms.map(room => (
        <div key={room._id} className="chat-room-item">
          <span>{room.name}</span>
          {room.unreadCount > 0 && (
            <span className="unread-badge">{room.unreadCount}</span>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 2. แสดง Read Receipts ในข้อความ
```javascript
const Message = ({ message }) => {
  const [readStats, setReadStats] = useState(null);

  const fetchReadStats = async () => {
    const response = await fetch(`/api/v1/chat/messages/${message._id}/read-stats`);
    const data = await response.json();
    setReadStats(data.messageStats);
  };

  return (
    <div className="message">
      <div className="message-content">{message.content}</div>
      <div className="message-status">
        <span onClick={fetchReadStats}>
          {readStats ? `อ่านแล้ว ${readStats.readCount}/${readStats.totalParticipants}` : 'ดูสถานะ'}
        </span>
      </div>
    </div>
  );
};
```

### 3. Total Unread Badge
```javascript
const UnreadBadge = () => {
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    // ขอข้อมูล total unread
    socket.emit('get_total_unread');
    
    socket.on('total_unread_count', (data) => {
      setTotalUnread(data.totalUnreadCount);
    });

    // Listen สำหรับการเปลี่ยนแปลง
    socket.on('unread_count_updated', () => {
      socket.emit('get_total_unread'); // รีเฟรช
    });

    socket.on('unread_count_reset', () => {
      socket.emit('get_total_unread'); // รีเฟรช
    });
  }, []);

  return totalUnread > 0 ? (
    <div className="total-unread-badge">{totalUnread}</div>
  ) : null;
};
```

---

## Best Practices

### 1. Performance
- ✅ ใช้ counter แทนการนับทุกครั้ง
- ✅ Batch operations เมื่อทำได้
- ✅ ใช้ indexes ที่เหมาะสม
- ✅ Limit การ populate ข้อมูล

### 2. Real-time Updates
- ✅ ส่ง WebSocket events ทันที
- ✅ อัพเดท UI แบบ optimistic
- ✅ Handle reconnection gracefully
- ✅ Debounce frequent updates

### 3. Data Consistency
- ✅ ใช้ transactions เมื่อจำเป็น
- ✅ Validate ข้อมูลก่อนอัพเดท
- ✅ Handle race conditions
- ✅ Cleanup orphaned data

### 4. User Experience
- ✅ แสดง unread count ทันที
- ✅ Mark as read เมื่อเปิดห้องแชท
- ✅ แสดงสถานะ delivery/read
- ✅ Handle offline scenarios

---

## Error Handling

### Common Errors
| Code | Message | Solution |
|------|---------|----------|
| 400 | ห้องแชทเต็มแล้ว | ตรวจสอบ maxParticipants |
| 403 | ไม่มีสิทธิ์เข้าถึง | ตรวจสอบสมาชิกห้อง |
| 404 | ไม่พบข้อความ | ตรวจสอบ messageId |
| 500 | Database error | ตรวจสอบ connection |

### Graceful Degradation
```javascript
// ถ้า WebSocket ขาด ใช้ polling
const fallbackToPolling = () => {
  setInterval(() => {
    fetch('/api/v1/chat/unread/total')
      .then(res => res.json())
      .then(data => updateUnreadCount(data.totalUnreadCount));
  }, 30000); // ทุก 30 วินาที
};
```

---

## Testing Scenarios

### 1. Unread Count
- ✅ ส่งข้อความ → unread count เพิ่ม
- ✅ อ่านข้อความ → unread count รีเซ็ต
- ✅ ออกจากห้อง → unread count หยุดเพิ่ม
- ✅ เข้าห้องใหม่ → unread count เริ่มต้น 0

### 2. Read Receipts
- ✅ อ่านข้อความ → เพิ่มใน readBy
- ✅ แสดงสถิติการอ่าน
- ✅ Real-time updates

### 3. Room Limits
- ✅ เพิ่มสมาชิกจนเต็ม → error
- ✅ สมาชิกออก → สามารถเพิ่มใหม่ได้
- ✅ Admin เปลี่ยน limit

### 4. Performance
- ✅ Load test กับ 100 สมาชิก
- ✅ ส่งข้อความพร้อมกัน 1000 ข้อความ
- ✅ ตรวจสอบ memory usage

ระบบ Unread Messages และ Read Receipts นี้ให้ประสบการณ์การแชทที่สมบูรณ์และทันสมัย พร้อมใช้งานในระดับ Production! 📱✨
