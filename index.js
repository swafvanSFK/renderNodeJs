const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3050;

// Multer memory storage - preserves raw files & handles multipart form data without needing disk
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory store for recent events (inspectable via web browser)
const eventLogs = [];
const MAX_LOGS = 50;

function recordEvent(source, req, parsedData = null) {
  const logEntry = {
    id: eventLogs.length + 1,
    timestamp: new Date().toISOString(),
    source,
    clientIp: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
    method: req.method,
    path: req.originalUrl || req.url,
    query: req.query,
    headers: req.headers,
    bodyKeys: Object.keys(req.body || {}),
    body: req.body,
    files: (req.files || []).map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    })),
    parsedData,
  };

  eventLogs.unshift(logEntry);
  if (eventLogs.length > MAX_LOGS) eventLogs.pop();

  return logEntry;
}

// ─── Main Hikvision Route: POST /api/hikEvents ───────────────────────────────
app.post('/api/hikEvents', upload.any(), (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  console.log('\n======================================================');
  console.log(`[HIKVISION EVENT RECEIVED] - ${new Date().toISOString()}`);
  console.log(`Client IP: ${clientIp}`);
  console.log(`Query Params:`, req.query);
  console.log(`Body Keys:`, Object.keys(req.body || {}));

  let extractedInfo = null;

  try {
    // 1. Check for standard Hikvision HTTP Listening payload ('event_log')
    // 2. Fallback to 'AccessControllerEvent' or 'event'
    let raw = req.body?.event_log || req.body?.AccessControllerEvent || req.body?.event;

    // If multer parsed the JSON part into memory buffer
    if (!raw && req.files && req.files.length > 0) {
      const jsonFile = req.files.find(f => f.fieldname === 'event_log' || f.mimetype?.includes('json'));
      if (jsonFile?.buffer) {
        raw = jsonFile.buffer.toString('utf8');
      }
    }

    if (!raw && req.body && Object.keys(req.body).length > 0) {
      raw = req.body;
    }

    if (raw) {
      const outer = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const inner = outer.AccessControllerEvent || outer;

      extractedInfo = {
        pin: inner.employeeNoString || inner.cardNo || inner.employeeNo || 'N/A',
        name: inner.name || 'N/A',
        majorEventType: inner.majorEventType,
        subEventType: inner.subEventType,
        verifyMode: inner.currentVerifyMode || 'unknown',
        attendanceStatus: inner.attendanceStatus || 'unknown',
        dateTime: outer.dateTime || inner.dateTime,
        deviceIp: outer.ipAddress,
        macAddress: outer.macAddress,
      };

      console.log('--- PARSED HIKVISION DETAILS ---');
      console.log(`Employee/PIN : ${extractedInfo.pin}`);
      console.log(`Name         : ${extractedInfo.name}`);
      console.log(`Major / Sub  : ${extractedInfo.majorEventType} / ${extractedInfo.subEventType}`);
      console.log(`Verify Mode  : ${extractedInfo.verifyMode}`);
      console.log(`Time         : ${extractedInfo.dateTime}`);
      console.log(`Device LAN IP: ${extractedInfo.deviceIp}`);
    } else {
      console.log('Raw Body:', req.body);
    }
  } catch (err) {
    console.error('Error parsing Hikvision payload:', err.message);
  }

  recordEvent('POST /api/hikEvents', req, extractedInfo);
  console.log('======================================================\n');

  // Hikvision requires a 200 OK response to acknowledge receipt
  return res.status(200).send('OK');
});

// ─── Catch-all for any other POST path (in case device uses a custom path) ─────
app.post('*', upload.any(), (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  console.log(`\n[CATCH-ALL POST: ${req.url}] from ${clientIp}`);
  console.log('Body:', req.body);
  recordEvent(`POST ${req.url}`, req);
  return res.status(200).send('OK');
});

// ─── Browser Dashboard to View Logs ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hikvision Event Listener</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
          .container { max-width: 1000px; margin: 0 auto; }
          h1 { color: #38bdf8; margin-bottom: 4px; }
          .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
          .badge { background: #0284c7; color: #fff; padding: 3px 10px; border-radius: 9999px; font-size: 12px; }
          .status { display: inline-flex; align-items: center; gap: 8px; color: #4ade80; font-weight: 500; font-size: 14px; }
          .status-dot { width: 10px; height: 10px; background: #4ade80; border-radius: 50%; box-shadow: 0 0 10px #4ade80; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 12px; }
          .pin { font-size: 18px; font-weight: bold; color: #f59e0b; }
          pre { background: #090d16; padding: 12px; border-radius: 6px; overflow-x: auto; color: #a5f3fc; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1>Hikvision Event Listener</h1>
              <div class="subtitle">Listening for HTTP Listening pushes on <code>/api/hikEvents</code></div>
            </div>
            <div class="status">
              <span class="status-dot"></span> Online & Listening (Auto-refresh: 5s)
            </div>
          </div>

          <div style="margin: 16px 0; background: #1e293b; border-left: 4px solid #38bdf8; padding: 12px; border-radius: 4px;">
            <strong>Device Configuration in Hikvision GUI:</strong><br>
            • <b>Event Alarm IP/Domain Name:</b> <code>${req.headers.host || 'your-render-app.onrender.com'}</code><br>
            • <b>URL:</b> <code>/api/hikEvents</code><br>
            • <b>Port:</b> <code>443</code> (Protocol: HTTPS) or <code>80</code> (Protocol: HTTP)
          </div>

          <h2>Recent Received Events (${eventLogs.length})</h2>
          ${
            eventLogs.length === 0
              ? '<div class="card" style="text-align: center; color: #64748b; padding: 40px;">No events received yet. Punch on the Hikvision terminal to see live data here.</div>'
              : eventLogs
                  .map(
                    l => `
            <div class="card">
              <div class="card-header">
                <div>
                  <span class="badge">${l.method} ${l.path}</span>
                  <span style="color: #94a3b8; font-size: 12px; margin-left: 10px;">From IP: ${l.clientIp}</span>
                </div>
                <span style="color: #64748b; font-size: 12px;">${l.timestamp}</span>
              </div>
              ${
                l.parsedData
                  ? `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; background: #0f172a; padding: 12px; border-radius: 6px;">
                  <div><span style="color: #64748b; font-size: 11px;">EMPLOYEE PIN</span><div class="pin">${l.parsedData.pin}</div></div>
                  <div><span style="color: #64748b; font-size: 11px;">VERIFY MODE</span><div style="color: #38bdf8; font-weight: 500;">${l.parsedData.verifyMode} (Sub: ${l.parsedData.subEventType})</div></div>
                  <div><span style="color: #64748b; font-size: 11px;">PUNCH TIME</span><div style="color: #f1f5f9;">${l.parsedData.dateTime || 'N/A'}</div></div>
                </div>
              `
                  : ''
              }
              <details>
                <summary style="cursor: pointer; color: #94a3b8; font-size: 12px; margin-bottom: 6px;">View Raw Payload Details</summary>
                <pre>${JSON.stringify(l, null, 2)}</pre>
              </details>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </body>
    </html>
  `);
});

// JSON endpoint to view logs programmatically
app.get('/logs', (req, res) => {
  res.json({ total: eventLogs.length, logs: eventLogs });
});

// Clear logs endpoint
app.get('/clear', (req, res) => {
  eventLogs.length = 0;
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`Hikvision Listener running on port ${port}`);
  console.log(`Endpoint: POST http://localhost:${port}/api/hikEvents`);
  console.log(`Web Dashboard: http://localhost:${port}/`);
  console.log(`======================================================\n`);
});
