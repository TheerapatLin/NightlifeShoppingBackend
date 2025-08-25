const express = require('express');
const router = express.Router();

// Simple Queue Dashboard (Alternative to Bull Arena)
router.get('/', async (req, res) => {
  try {
    const { mediaQueue } = require('../queues/mediaQueue');
    
    // Get queue statistics
    const [waiting, active, completed, failed] = await Promise.all([
      mediaQueue.getWaiting(),
      mediaQueue.getActive(), 
      mediaQueue.getCompleted(),
      mediaQueue.getFailed()
    ]);

    const stats = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };

    // Simple HTML dashboard
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Media Processing Queue Dashboard</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5; 
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: white; padding: 20px; border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;
        }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { 
            background: white; padding: 20px; border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;
        }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .waiting { color: #f59e0b; }
        .active { color: #3b82f6; }
        .completed { color: #10b981; }
        .failed { color: #ef4444; }
        .jobs-section { 
            background: white; padding: 20px; border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px;
        }
        .job-item { 
            padding: 10px; border-bottom: 1px solid #e5e7eb; 
            display: flex; justify-content: space-between; align-items: center;
        }
        .job-item:last-child { border-bottom: none; }
        .refresh-btn { 
            background: #3b82f6; color: white; border: none; 
            padding: 10px 20px; border-radius: 6px; cursor: pointer;
        }
        .refresh-btn:hover { background: #2563eb; }
        .status-badge {
            padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;
        }
        .status-waiting { background: #fef3c7; color: #92400e; }
        .status-active { background: #dbeafe; color: #1e40af; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-failed { background: #fee2e2; color: #991b1b; }
    </style>
    <script>
        function refreshPage() { window.location.reload(); }
        setInterval(refreshPage, 30000); // Auto refresh every 30 seconds
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Media Processing Queue Dashboard</h1>
            <p>Real-time monitoring of media upload processing jobs</p>
            <button class="refresh-btn" onclick="refreshPage()">🔄 Refresh</button>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number waiting">${stats.waiting}</div>
                <div>⏳ Waiting</div>
            </div>
            <div class="stat-card">
                <div class="stat-number active">${stats.active}</div>
                <div>🔄 Active</div>
            </div>
            <div class="stat-card">
                <div class="stat-number completed">${stats.completed}</div>
                <div>✅ Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">${stats.failed}</div>
                <div>❌ Failed</div>
            </div>
        </div>

        ${waiting.length > 0 ? `
        <div class="jobs-section">
            <h3>⏳ Waiting Jobs (${waiting.length})</h3>
            ${waiting.slice(0, 10).map(job => `
                <div class="job-item">
                    <div>
                        <strong>${job.name}</strong><br>
                        <small>Message: ${job.data.messageId || 'N/A'}</small>
                    </div>
                    <span class="status-badge status-waiting">WAITING</span>
                </div>
            `).join('')}
            ${waiting.length > 10 ? `<p><em>... and ${waiting.length - 10} more</em></p>` : ''}
        </div>
        ` : ''}

        ${active.length > 0 ? `
        <div class="jobs-section">
            <h3>🔄 Active Jobs (${active.length})</h3>
            ${active.map(job => `
                <div class="job-item">
                    <div>
                        <strong>${job.name}</strong><br>
                        <small>Message: ${job.data.messageId || 'N/A'}</small><br>
                        <small>Progress: ${job.progress()}%</small>
                    </div>
                    <span class="status-badge status-active">PROCESSING</span>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${failed.length > 0 ? `
        <div class="jobs-section">
            <h3>❌ Failed Jobs (${failed.length})</h3>
            ${failed.slice(0, 5).map(job => `
                <div class="job-item">
                    <div>
                        <strong>${job.name}</strong><br>
                        <small>Message: ${job.data.messageId || 'N/A'}</small><br>
                        <small style="color: #ef4444;">Error: ${job.failedReason || 'Unknown error'}</small>
                    </div>
                    <span class="status-badge status-failed">FAILED</span>
                </div>
            `).join('')}
            ${failed.length > 5 ? `<p><em>... and ${failed.length - 5} more</em></p>` : ''}
        </div>
        ` : ''}

        <div class="jobs-section">
            <h3>📊 Queue Information</h3>
            <p><strong>Queue Name:</strong> ${mediaQueue.name}</p>
            <p><strong>Redis Connection:</strong> Connected ✅</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
            <p><small>Page auto-refreshes every 30 seconds</small></p>
        </div>
    </div>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Queue dashboard error:', error);
    res.status(500).json({ 
      error: 'Queue dashboard unavailable', 
      message: error.message 
    });
  }
});

// API endpoint for queue stats
router.get('/api/stats', async (req, res) => {
  try {
    console.log('📊 Queue stats API called');
    
    // Test if we can access the queue
    const { mediaQueue } = require('../queues/mediaQueue');
    console.log('✅ MediaQueue loaded:', mediaQueue ? 'success' : 'failed');
    
    const [waiting, active, completed, failed] = await Promise.all([
      mediaQueue.getWaiting(),
      mediaQueue.getActive(),
      mediaQueue.getCompleted(),
      mediaQueue.getFailed()
    ]);

    const stats = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };

    console.log('📊 Queue stats:', stats);

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Queue stats API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
