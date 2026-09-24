import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDB } from '../db/database.js';
import { mlHealth } from '../services/mlClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();

// GET /api/admin/config — get all config values
router.get('/config', (req, res) => {
  const db = getDB();
  try {
    const config = db.prepare('SELECT * FROM admin_config').all();
    const obj = {};
    for (const row of config) obj[row.key] = row.value;
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/config — update config keys
router.patch('/config', (req, res) => {
  const db = getDB();
  try {
    const updates = req.body; // { key: value, ... }
    const stmt = db.prepare('INSERT OR REPLACE INTO admin_config(key,value,updated_at) VALUES (?,?,?)');
    // node:sqlite DatabaseSync uses BEGIN/COMMIT — not .transaction() like better-sqlite3
    db.exec('BEGIN');
    try {
      for (const [k, v] of Object.entries(updates)) stmt.run(k, String(v), new Date().toISOString());
      db.exec('COMMIT');
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }
    res.json({ success: true, message: 'Config updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const db = getDB();
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY role').all();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/health — data source health
router.get('/health', async (req, res) => {
  const db = getDB();
  try {
    const lastSensor = db.prepare('SELECT MAX(timestamp) as ts FROM sensor_readings').get()?.ts;
    const lastScore = db.prepare('SELECT MAX(timestamp) as ts FROM risk_scores').get()?.ts;
    const totalReadings = db.prepare('SELECT COUNT(*) as c FROM sensor_readings').get()?.c;
    const totalReports = db.prepare('SELECT COUNT(*) as c FROM citizen_reports').get()?.c;
    const activeAlerts = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE status='Active'").get()?.c;

    // ML model health (from ml-service /health — best effort, non-blocking)
    const mlStatus = await mlHealth();

    const mlCard = mlStatus
      ? {
          name: 'ML Model (XGBoost v2)',
          status: 'Active',
          last_sync: lastScore,
          type: 'ml',
          model_version: 'v2',
          roc_auc: mlStatus.metrics?.roc_auc_final_test,
          accuracy: mlStatus.metrics?.accuracy_final_test,
          recall: mlStatus.metrics?.recall_final_test,
          loaded_at: mlStatus.loaded_at,
          caveats: mlStatus.caveats,
        }
      : {
          name: 'ML Model (XGBoost v2)',
          status: 'Unavailable',
          last_sync: null,
          type: 'ml',
          note: 'ml-service is not running. Risk scoring is using rule-based fallback.',
        };

    res.json({
      success: true,
      data: {
        sources: [
          { name: 'Sensor Feed (Simulated)', status: 'Active', last_sync: lastSensor, type: 'simulated' },
          { name: 'Weather API (OpenWeather)', status: 'Simulated', last_sync: null, type: 'simulated' },
          { name: 'DEM / Slope Data (SRTM)', status: 'Loaded', last_sync: null, type: 'static' },
          { name: 'Historical Landslide DB', status: 'Loaded', last_sync: null, type: 'static' },
          { name: 'Citizen Reports', status: 'Active', last_sync: new Date().toISOString(), type: 'live' },
          mlCard,
        ],
        stats: { total_readings: totalReadings, total_reports: totalReports, active_alerts: activeAlerts, last_risk_compute: lastScore },
        ml_mode: mlStatus ? 'ml-xgboost-v2' : 'rule-based-fallback',
        degraded_mode: !mlStatus,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/districts
router.get('/districts', (req, res) => {
  try {
    const data = JSON.parse(readFileSync(join(__dirname, '../data/districts.json'), 'utf8'));
    res.json({ success: true, data: data.districts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/geo-features — road corridors and village positions (FIX-5.2)
// Single source of truth: all lat/lng coordinates live in data/geo_features.json,
// not hardcoded in the frontend. Add new districts there to extend coverage.
router.get('/geo-features', (req, res) => {
  try {
    const data = JSON.parse(readFileSync(join(__dirname, '../data/geo_features.json'), 'utf8'));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
