import { Router } from 'express';
import { getDB } from '../db/database.js';
import { broadcast } from '../server.js';

const router = Router();

// GET /api/alerts — list all alerts (filterable)
router.get('/', (req, res) => {
  const db = getDB();
  const { status, district, limit = 50 } = req.query;
  try {
    let query = 'SELECT * FROM alerts';
    const params = [];
    const conditions = [];
    if (status) { conditions.push('status=?'); params.push(status); }
    if (district) { conditions.push('district=?'); params.push(district); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    const alerts = db.prepare(query).all(...params);
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts/active
router.get('/active', (req, res) => {
  const db = getDB();
  try {
    const alerts = db.prepare("SELECT * FROM alerts WHERE status='Active' ORDER BY composite_score DESC").all();
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts/:id
router.get('/:id', (req, res) => {
  const db = getDB();
  try {
    const alert = db.prepare('SELECT * FROM alerts WHERE id=?').get(req.params.id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    const smsLog = db.prepare('SELECT * FROM alert_sms_log WHERE alert_id=?').all(req.params.id);
    res.json({ success: true, data: { ...alert, sms_log: smsLog } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/alerts/:id/status — acknowledge/escalate/close
router.patch('/:id/status', (req, res) => {
  const db = getDB();
  const { status, acknowledged_by } = req.body;
  const allowed = ['Acknowledged', 'Escalated', 'Closed'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
  try {
    const result = db.prepare(`
      UPDATE alerts SET status=?, acknowledged_at=?, acknowledged_by=? WHERE id=?
    `).run(status, new Date().toISOString(), acknowledged_by || 'System', req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Alert not found' });
    const updated = db.prepare('SELECT * FROM alerts WHERE id=?').get(req.params.id);
    broadcast('ALERT_UPDATE', updated);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts/sms-log
router.get('/logs/sms', (req, res) => {
  const db = getDB();
  try {
    const logs = db.prepare('SELECT * FROM alert_sms_log ORDER BY sent_at DESC LIMIT 100').all();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
