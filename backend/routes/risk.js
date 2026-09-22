import { Router } from 'express';
import { getLatestRiskScores, computeRiskScores, simulateSensorFeed } from '../services/riskEngine.js';
import { checkAndFireAlerts } from '../services/alertService.js';
import { getDB } from '../db/database.js';
import { broadcast } from '../server.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();

// GET /api/risk/scores — latest risk scores for all grid cells
router.get('/scores', (req, res) => {
  try {
    const scores = getLatestRiskScores();
    res.json({ success: true, data: scores, count: scores.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/scores/district/:districtId
router.get('/scores/district/:districtId', (req, res) => {
  const db = getDB();
  try {
    const scores = db.prepare(`
      SELECT rs.*, gc.lat, gc.lng, gc.district, gc.slope_angle, gc.elevation
      FROM risk_scores rs
      JOIN grid_cells gc ON rs.grid_id = gc.id
      WHERE gc.district = ? AND rs.id IN (SELECT MAX(id) FROM risk_scores GROUP BY grid_id)
      ORDER BY rs.composite_score DESC
    `).all(req.params.districtId);
    res.json({ success: true, data: scores });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/history/:gridId — historical scores for a grid
router.get('/history/:gridId', (req, res) => {
  const db = getDB();
  try {
    const history = db.prepare(
      'SELECT * FROM risk_scores WHERE grid_id=? ORDER BY timestamp DESC LIMIT 48'
    ).all(req.params.gridId);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/risk/trigger — manually trigger risk recompute (for demo)
router.post('/trigger', (req, res) => {
  try {
    const { spike } = req.body; // optional: { spike: true } for demo rainfall spike
    if (spike) {
      // Inject a spike reading directly for demo
      const db = getDB();
      const grids = db.prepare('SELECT id FROM grid_cells WHERE slope_angle > 35').all();
      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO sensor_readings(grid_id, timestamp, rainfall_1h_mm, rainfall_24h_mm, soil_moisture, temperature_c, humidity_pct, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.exec('BEGIN');
      try {
        for (const g of grids) insert.run(g.id, now, 55 + Math.random() * 30, 160 + Math.random() * 60, 0.88 + Math.random() * 0.10, 15, 95, 'demo_spike');
        db.exec('COMMIT');
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } else {
      simulateSensorFeed();
    }
    const scores = computeRiskScores();
    const fired = checkAndFireAlerts(scores);
    broadcast('RISK_UPDATE', { scores, alert_count: fired });
    res.json({ success: true, message: 'Risk recomputed', scores, alerts_fired: fired });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/summary — dashboard summary stats
router.get('/summary', (req, res) => {
  const db = getDB();
  try {
    const latest = getLatestRiskScores();
    const critical = latest.filter(s => s.risk_level === 'Critical').length;
    const high = latest.filter(s => s.risk_level === 'High').length;
    const medium = latest.filter(s => s.risk_level === 'Medium').length;
    const low = latest.filter(s => s.risk_level === 'Low').length;
    const activeAlerts = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE status='Active'").get()?.c || 0;
    const affectedRoads = db.prepare("SELECT COUNT(DISTINCT affected_roads) as c FROM alerts WHERE status='Active'").get()?.c || 0;
    const recentReports = db.prepare("SELECT COUNT(*) as c FROM citizen_reports WHERE submitted_at > datetime('now','-24 hours')").get()?.c || 0;
    res.json({
      success: true,
      data: {
        risk_distribution: { critical, high, medium, low, total: latest.length },
        active_alerts: activeAlerts,
        affected_roads: affectedRoads,
        recent_citizen_reports: recentReports,
        highest_risk_zone: latest[0] || null,
        last_updated: new Date().toISOString(),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/prioritization — emergency response prioritization list (FR3.6)
router.get('/prioritization', (req, res) => {
  try {
    const latest = getLatestRiskScores();
    const districtsData = JSON.parse(readFileSync(join(__dirname, '../data/districts.json'), 'utf8'));
    const districtMap = {};
    for (const d of districtsData.districts) districtMap[d.id] = d;

    const prioritized = latest
      .filter(s => s.risk_level === 'Critical' || s.risk_level === 'High')
      .map(s => {
        const dist = districtMap[s.district];
        const roadFactor = s.road_proximity_km < 0.5 ? 3.0 : s.road_proximity_km < 1.5 ? 2.0 : 1.0;
        const villageFactor = s.village_proximity_km < 1.0 ? 2.5 : s.village_proximity_km < 2.0 ? 1.5 : 1.0;
        const priorityScore = parseFloat((s.composite_score * roadFactor * villageFactor / 100).toFixed(3));

        let action = 'Monitor';
        if (s.risk_level === 'Critical' && s.road_proximity_km < 0.5) action = 'IMMEDIATE ROAD CLOSURE + EVACUATION';
        else if (s.risk_level === 'Critical') action = 'Evacuate nearby villages, alert DDMA';
        else if (s.risk_level === 'High' && s.road_proximity_km < 1.0) action = 'Road advisory + deploy inspection team';
        else if (s.risk_level === 'High') action = 'Alert field officers, increase monitoring';

        return {
          ...s,
          priority_score: priorityScore,
          priority_tier: priorityScore >= 2.0 ? 'P1' : priorityScore >= 1.0 ? 'P2' : 'P3',
          district_name: dist?.name || s.district,
          nearby_roads: dist?.roads?.slice(0, 2).join(', ') || 'N/A',
          nearby_villages: dist?.villages?.slice(0, 3).join(', ') || 'N/A',
          recommended_action: action,
        };
      })
      .sort((a, b) => b.priority_score - a.priority_score);

    res.json({ success: true, data: prioritized, count: prioritized.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
