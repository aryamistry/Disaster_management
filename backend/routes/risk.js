import { Router } from 'express';
import { getLatestRiskScores, computeRiskScores, simulateSensorFeed, getModelMetadata } from '../services/riskEngine.js';
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

// GET /api/risk/model-info — model metadata, test metrics, 22 feature list & threshold
router.get('/model-info', (req, res) => {
  try {
    const metadata = getModelMetadata();
    res.json({
      success: true,
      problem_statement: 'SIH26192',
      model_type: 'XGBoost (xgb.XGBClassifier)',
      threshold: metadata?.test_metrics?.threshold || 0.460,
      test_metrics: metadata?.test_metrics || {
        accuracy: 0.9587,
        precision: 0.9228,
        recall: 0.9717,
        f1: 0.9466,
        roc_auc: 0.9941,
        pr_auc: 0.9902
      },
      features: metadata?.features || [
        "elevation_m", "slope_deg", "aspect_deg", "plan_curvature", "profile_curvature", "twi",
        "dist_to_stream_m", "land_cover_code", "soil_type_enc", "rainfall_1h_mm", "rainfall_3h_mm",
        "rainfall_6h_mm", "rainfall_12h_mm", "rainfall_24h_mm", "rainfall_3d_accum_mm", "rainfall_7d_accum_mm",
        "rainfall_intensity_mm_h", "soil_moisture_pct", "historical_landslide_density",
        "rain_moisture_index", "slope_wetness_index", "rainfall_runoff_proxy"
      ],
      features_count: 22,
      split_rows: metadata?.split_rows || { train: 3500, validation: 750, test: 750 }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/risk/scores/district/:districtId
router.get('/scores/district/:districtId', (req, res) => {
  const db = getDB();
  try {
    const scores = db.prepare(`
      SELECT rs.*, gc.lat, gc.lng, gc.district, gc.slope_angle, gc.elevation,
             gc.dist_to_stream_m, gc.twi
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

// POST /api/risk/trigger — manually trigger cloudburst spike / recompute (for SIH demo)
router.post('/trigger', async (req, res) => {
  try {
    const { spike } = req.body;
    if (spike) {
      const db = getDB();
      const grids = db.prepare('SELECT id FROM grid_cells WHERE dist_to_stream_m < 100').all();
      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO sensor_readings(
          grid_id, timestamp, rainfall_1h_mm, rainfall_3h_mm, rainfall_6h_mm, rainfall_12h_mm,
          rainfall_24h_mm, rainfall_3d_accum_mm, rainfall_7d_accum_mm, rainfall_intensity_mm_h,
          soil_moisture, temperature_c, humidity_pct, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.exec('BEGIN');
      try {
        for (const g of grids) {
          const r1h = 58 + Math.random() * 25;
          const r3h = r1h + 45 + Math.random() * 30;
          const r6h = r3h + 30;
          const r12h = r6h + 25;
          const r24h = r12h + 35;
          const r3d = r24h + 60;
          const r7d = r3d + 100;
          insert.run(g.id, now, r1h, r3h, r6h, r12h, r24h, r3d, r7d, r1h * 1.15, 0.94, 16, 98, 'demo_cloudburst_spike');
        }
        db.exec('COMMIT');
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } else {
      simulateSensorFeed();
    }
    const scores = await computeRiskScores();
    const fired = checkAndFireAlerts(scores);
    broadcast('RISK_UPDATE', { scores, alert_count: fired });
    res.json({ success: true, message: 'Flash flood risk recomputed', scores, alerts_fired: fired });
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
    const moderate = latest.filter(s => s.risk_level === 'Moderate' || s.risk_level === 'Medium').length;
    const low = latest.filter(s => s.risk_level === 'Low').length;
    const activeAlerts = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE status='Active'").get()?.c || 0;
    const affectedRoads = db.prepare("SELECT COUNT(DISTINCT affected_roads) as c FROM alerts WHERE status='Active'").get()?.c || 0;
    const recentReports = db.prepare("SELECT COUNT(*) as c FROM citizen_reports WHERE submitted_at > datetime('now','-24 hours')").get()?.c || 0;
    res.json({
      success: true,
      data: {
        risk_distribution: { critical, high, moderate, medium: moderate, low, total: latest.length },
        active_alerts: activeAlerts,
        affected_roads: affectedRoads,
        recent_citizen_reports: recentReports,
        highest_risk_zone: latest[0] || null,
        decision_threshold: 0.460,
        model_accuracy: '95.87%',
        model_precision: '92.28%',
        model_recall: '97.17%',
        model_f1: '94.66%',
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
        const streamFactor = (s.dist_to_stream_m && s.dist_to_stream_m < 60) ? 3.0 : (s.dist_to_stream_m < 150) ? 2.0 : 1.2;
        const roadFactor = s.road_proximity_km < 0.5 ? 2.5 : s.road_proximity_km < 1.5 ? 1.8 : 1.0;
        const villageFactor = s.village_proximity_km < 1.0 ? 2.5 : s.village_proximity_km < 2.0 ? 1.5 : 1.0;
        const priorityScore = parseFloat((s.composite_score * streamFactor * villageFactor / 100).toFixed(3));

        let action = 'Continuous river gauge monitoring';
        if (s.risk_level === 'Critical' && s.dist_to_stream_m < 60) action = 'URGENT: RIVERBANK EVACUATION + CLOSE LOW-LYING BRIDGES';
        else if (s.risk_level === 'Critical') action = 'Evacuate river terrace villages, deploy SDRF boats/teams';
        else if (s.risk_level === 'High' && s.road_proximity_km < 1.0) action = 'Issue flash flood advisory + divert highway traffic';
        else if (s.risk_level === 'High') action = 'Alert village heads, prepare relief shelters';

        return {
          ...s,
          priority_score: priorityScore,
          priority_tier: priorityScore >= 2.0 ? 'P1' : priorityScore >= 1.0 ? 'P2' : 'P3',
          district_name: dist?.name || s.district,
          river_basin: dist?.river_basin || 'Local Catchment',
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
