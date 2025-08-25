// โหลด environment variables
require('dotenv').config({ path: '.env-nl' });

const express = require('express');
const app = express();

// Simple test route
app.get('/test', (req, res) => {
  res.json({ message: 'Test route works!', timestamp: new Date() });
});

// Queue test route  
app.get('/queue-test', async (req, res) => {
  try {
    const { mediaQueue } = require('./queues/mediaQueue');
    
    const stats = {
      queueName: mediaQueue.name,
      status: 'connected'
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

const PORT = 3102;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on http://localhost:${PORT}`);
  console.log(`Test routes:`);
  console.log(`- http://localhost:${PORT}/test`);
  console.log(`- http://localhost:${PORT}/queue-test`);
});
