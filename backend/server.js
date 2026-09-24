import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cron from 'node-cron';
import { initDB } from './db/database.js';
import { simulateSensorFeed, computeRiskScores } from './services/riskEngine.js';
import { checkAndFireAlerts } from './services/alertService.js';
import ingestRoutes from './routes/ingest.js';
import alertRoutes from './routes/alerts.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import riskRoutes from './routes/risk.js';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/pwa', express.static(join(__dirname, '../pwa')));

// WebSocket broadcast utility
export function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Routes
app.use('/api/ingest', ingestRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/risk', riskRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DHARA AI Flash Flood Early Warning System API (SIH 26192)',
    model: 'XGBoost 22-Feature Ensemble',
    threshold: 0.460,
    test_metrics: {
      accuracy: '95.87%',
      precision: '92.28%',
      recall: '97.17%',
      f1: '94.66%',
      roc_auc: '0.9941'
    },
    timestamp: new Date().toISOString()
  });
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.send(JSON.stringify({ type: 'CONNECTED', data: { message: 'Real-time updates active' } }));
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// Scheduled: every 15 minutes — simulate sensor data + recompute risk
cron.schedule('*/15 * * * *', async () => {
  console.log('[CRON] Running sensor simulation & risk recompute...');
  try {
    simulateSensorFeed();
    const scores = await computeRiskScores();
    const firedAlerts = checkAndFireAlerts(scores);
    broadcast('RISK_UPDATE', { scores, alert_count: firedAlerts });
    console.log(`[CRON] Risk recomputed. ${firedAlerts} alert(s) fired.`);
  } catch (err) {
    console.error('[CRON] Error:', err);
  }
});

// Initialize DB & start server
const PORT = process.env.PORT || 3001;
initDB();
// Run initial simulation on startup
setTimeout(async () => {
  simulateSensorFeed();
  const scores = await computeRiskScores();
  checkAndFireAlerts(scores);
  console.log('[INIT] Initial risk scores computed');
}, 1000);

server.listen(PORT, () => {
  console.log(`🚀 DHARA AI Flash Flood Early Warning API (SIH 26192) running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server active on ws://localhost:${PORT}`);
});
