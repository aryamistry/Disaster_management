import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { simulateSensorFeed, computeRiskScores } from '../services/riskEngine.js';
import { checkAndFireAlerts } from '../services/alertService.js';
import { broadcast } from '../server.js';
import { getDB } from '../db/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();

// GET /api/ingest/sensor-readings — recent sensor data
router.get('/sensor-readings', (req, res) => {
  const db = getDB();
  const { grid_id, limit = 50 } = req.query;
  try {
    let query = 'SELECT * FROM sensor_readings';
    const params = [];
    if (grid_id) { query += ' WHERE grid_id=?'; params.push(grid_id); }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    const readings = db.prepare(query).all(...params);
    res.json({ success: true, data: readings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ingest/sensor — ingest a single sensor reading
router.post('/sensor', async (req, res) => {
  const db = getDB();
  try {
    const { grid_id, rainfall_1h_mm, rainfall_24h_mm, soil_moisture, temperature_c, humidity_pct } = req.body;
    if (!grid_id) return res.status(400).json({ success: false, error: 'grid_id required' });
    db.prepare(`
      INSERT INTO sensor_readings(grid_id, timestamp, rainfall_1h_mm, rainfall_24h_mm, soil_moisture, temperature_c, humidity_pct, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'external')
    `).run(grid_id, new Date().toISOString(),
           rainfall_1h_mm || 0, rainfall_24h_mm || 0, soil_moisture || 0.3,
           temperature_c || 20, humidity_pct || 70);
    const scores = await computeRiskScores();
    const alerts_fired = checkAndFireAlerts(scores);
    broadcast('RISK_UPDATE', { scores, alert_count: alerts_fired });
    res.status(201).json({ success: true, message: 'Reading ingested', scores_computed: scores.length, alerts_fired });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ingest/simulate — run simulation cycle
router.post('/simulate', async (req, res) => {
  try {
    const readings = simulateSensorFeed();
    const scores = await computeRiskScores();
    const alerts_fired = checkAndFireAlerts(scores);
    broadcast('RISK_UPDATE', { scores, alert_count: alerts_fired });
    res.json({ success: true, readings_generated: readings.length, scores_computed: scores.length, alerts_fired });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ingest/historical-landslides
router.get('/historical-landslides', (req, res) => {
  try {
    const data = JSON.parse(readFileSync(join(__dirname, '../data/historical_landslides.json'), 'utf8'));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ingest/forecast — 48-hour rainfall and risk projection (simulated)
router.get('/forecast', (req, res) => {
  try {
    const db = getDB();
    const now = new Date();
    const month = now.getMonth() + 1;
    const isMonsoon = month >= 6 && month <= 10;

    // Get latest sensor readings per district to baseline the forecast
    const latestEast = db.prepare(
      `SELECT AVG(rainfall_1h_mm) as avg_rain, AVG(soil_moisture) as avg_soil
       FROM sensor_readings sr JOIN grid_cells gc ON sr.grid_id=gc.id
       WHERE gc.district='D001' AND sr.timestamp > datetime('now','-2 hours')`
    ).get();
    const latestWest = db.prepare(
      `SELECT AVG(rainfall_1h_mm) as avg_rain, AVG(soil_moisture) as avg_soil
       FROM sensor_readings sr JOIN grid_cells gc ON sr.grid_id=gc.id
       WHERE gc.district='D002' AND sr.timestamp > datetime('now','-2 hours')`
    ).get();

    const baseRainEast = latestEast?.avg_rain || (isMonsoon ? 12 : 2);
    const baseRainWest = latestWest?.avg_rain || (isMonsoon ? 10 : 2);

    const generateForecast = (baseRain, district) => {
      const points = [];
      let rain = baseRain;
      // Monsoon pattern: rises mid-day, falls at night
      for (let h = 0; h < 48; h++) {
        const hourOfDay = (now.getHours() + h) % 24;
        const diurnalFactor = 0.6 + 0.8 * Math.sin((hourOfDay - 6) * Math.PI / 12);
        const randomVariance = 0.7 + Math.random() * 0.6;
        rain = Math.max(0, rain * 0.9 + baseRain * diurnalFactor * randomVariance * 0.1 + (Math.random() - 0.4) * 3);

        let riskLevel = 'Low';
        if (rain > 35) riskLevel = 'Critical';
        else if (rain > 20) riskLevel = 'High';
        else if (rain > 10) riskLevel = 'Medium';

        points.push({
          hour: h,
          time: new Date(now.getTime() + h * 3600000).toISOString(),
          rainfall_mm: parseFloat(rain.toFixed(2)),
          risk_level: riskLevel,
          district,
        });
      }
      return points;
    };

    const eastForecast = generateForecast(baseRainEast, 'East Sikkim');
    const westForecast = generateForecast(baseRainWest, 'West Sikkim');

    // Summary stats
    const summarize = (pts) => ({
      max_24h: Math.max(...pts.slice(0, 24).map(p => p.rainfall_mm)),
      max_48h: Math.max(...pts.map(p => p.rainfall_mm)),
      avg_24h: parseFloat((pts.slice(0, 24).reduce((s, p) => s + p.rainfall_mm, 0) / 24).toFixed(2)),
      peak_hour: pts.reduce((best, p) => p.rainfall_mm > best.rainfall_mm ? p : best, pts[0]),
      critical_hours_24h: pts.slice(0, 24).filter(p => p.risk_level === 'Critical').length,
      high_risk_hours_24h: pts.slice(0, 24).filter(p => p.risk_level === 'High' || p.risk_level === 'Critical').length,
    });

    res.json({
      success: true,
      data: {
        generated_at: now.toISOString(),
        districts: [
          { id: 'D001', name: 'East Sikkim', summary: summarize(eastForecast), hourly: eastForecast },
          { id: 'D002', name: 'West Sikkim', summary: summarize(westForecast), hourly: westForecast },
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
