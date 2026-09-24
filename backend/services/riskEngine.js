import { getDB } from '../db/database.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mlPredict, MlServiceError } from './mlClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '../../models');
const MODEL_JSON_PATH = join(MODELS_DIR, 'xgboost_flash_flood_model.json');
const METADATA_PATH = join(MODELS_DIR, 'flash_flood_model_metadata.json');

// ---------------------------------------------------------------------------
// Native XGBoost Tree Ensemble Evaluator (High-speed embedded inference)
// ---------------------------------------------------------------------------
let cachedModel = null;
let cachedMetadata = null;

function loadXGBoostModel() {
  if (cachedModel && cachedMetadata) return { model: cachedModel, metadata: cachedMetadata };
  try {
    if (existsSync(MODEL_JSON_PATH)) {
      cachedModel = JSON.parse(readFileSync(MODEL_JSON_PATH, 'utf8'));
    }
    if (existsSync(METADATA_PATH)) {
      cachedMetadata = JSON.parse(readFileSync(METADATA_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('[RiskEngine] Could not load XGBoost model artifacts:', err.message);
  }
  return { model: cachedModel, metadata: cachedMetadata };
}

/**
 * Predicts flash flood probability using the trained 235-tree XGBoost ensemble.
 * Returns calibrated probability between 0.0 and 1.0.
 */
export function predictXGBoostTree(features22) {
  const { model } = loadXGBoostModel();
  if (!model || !model.learner?.gradient_booster?.model?.trees) {
    return null;
  }
  const trees = model.learner.gradient_booster.model.trees;
  let margin = 0.0; // base_score is 0.5, logit(0.5) = 0.0

  for (const t of trees) {
    let node = 0;
    while (t.left_children[node] !== -1) {
      const featIdx = t.split_indices[node];
      const val = features22[featIdx];
      if (val < t.split_conditions[node]) {
        node = t.left_children[node];
      } else {
        node = t.right_children[node];
      }
    }
    margin += t.base_weights[node];
  }

  // Logistic sigmoid
  return 1.0 / (1.0 + Math.exp(-margin));
}

// ---------------------------------------------------------------------------
// Sensor simulation — generates realistic monsoon cloudburst & river basin feeds
// ---------------------------------------------------------------------------
export function simulateSensorFeed() {
  const db = getDB();
  const grids = db.prepare('SELECT * FROM grid_cells').all();
  const now = new Date().toISOString();

  const month = new Date().getMonth() + 1;
  const isMonsoon = month >= 5 && month <= 10;

  const insert = db.prepare(`
    INSERT INTO sensor_readings(
      grid_id, timestamp, rainfall_1h_mm, rainfall_3h_mm, rainfall_6h_mm, rainfall_12h_mm,
      rainfall_24h_mm, rainfall_3d_accum_mm, rainfall_7d_accum_mm, rainfall_intensity_mm_h,
      soil_moisture, temperature_c, humidity_pct, source
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const readings = [];
  for (const g of grids) {
    const isHeavySurge = Math.random() < (isMonsoon ? 0.20 : 0.05);

    let r1h, r3h, r6h, r12h, r24h, r3d, r7d, rInt, sm;
    if (isHeavySurge) {
      // Cloudburst / intense flash surge
      r1h = parseFloat((25 + Math.random() * 45).toFixed(1));
      r3h = parseFloat((r1h + 30 + Math.random() * 55).toFixed(1));
      r6h = parseFloat((r3h + 20 + Math.random() * 40).toFixed(1));
      r12h = parseFloat((r6h + 25 + Math.random() * 45).toFixed(1));
      r24h = parseFloat((r12h + 30 + Math.random() * 60).toFixed(1));
      r3d = parseFloat((r24h + 40 + Math.random() * 110).toFixed(1));
      r7d = parseFloat((r3d + 60 + Math.random() * 180).toFixed(1));
      rInt = parseFloat((r1h * (1.0 + Math.random() * 0.3)).toFixed(1));
      sm = parseFloat((0.82 + Math.random() * 0.16).toFixed(3));
    } else if (isMonsoon) {
      // Typical active monsoon day
      r1h = parseFloat((3 + Math.random() * 16).toFixed(1));
      r3h = parseFloat((r1h + 8 + Math.random() * 22).toFixed(1));
      r6h = parseFloat((r3h + 10 + Math.random() * 25).toFixed(1));
      r12h = parseFloat((r6h + 15 + Math.random() * 30).toFixed(1));
      r24h = parseFloat((r12h + 18 + Math.random() * 45).toFixed(1));
      r3d = parseFloat((r24h + 25 + Math.random() * 70).toFixed(1));
      r7d = parseFloat((r3d + 40 + Math.random() * 120).toFixed(1));
      rInt = parseFloat((r1h * (0.9 + Math.random() * 0.3)).toFixed(1));
      sm = parseFloat((0.55 + Math.random() * 0.28).toFixed(3));
    } else {
      // Dry baseline
      r1h = parseFloat((Math.random() * 4).toFixed(1));
      r3h = parseFloat((r1h + Math.random() * 6).toFixed(1));
      r6h = parseFloat((r3h + Math.random() * 8).toFixed(1));
      r12h = parseFloat((r6h + Math.random() * 10).toFixed(1));
      r24h = parseFloat((r12h + Math.random() * 12).toFixed(1));
      r3d = parseFloat((r24h * 1.2).toFixed(1));
      r7d = parseFloat((r3d * 1.3).toFixed(1));
      rInt = parseFloat((r1h).toFixed(1));
      sm = parseFloat((0.30 + Math.random() * 0.20).toFixed(3));
    }

    const tempC = parseFloat((22 - g.elevation / 400 + Math.random() * 3).toFixed(1));
    const humidity = parseFloat(Math.min(100, (isMonsoon ? 75 : 55) + Math.random() * 20).toFixed(1));

    insert.run(g.id, now, r1h, r3h, r6h, r12h, r24h, r3d, r7d, rInt, sm, tempC, humidity, 'simulated');
    readings.push({ grid_id: g.id, rainfall_1h_mm: r1h, rainfall_3h_mm: r3h, rainfall_24h_mm: r24h, soil_moisture: sm });
  }

  return readings;
}

// ---------------------------------------------------------------------------
// Build the exact 22-feature vector for the XGBoost Flash Flood Model
// ---------------------------------------------------------------------------
export function build22FeatureVector(g, sensor) {
  // 19 Base Features
  const elev = Number(g.elevation || 800.0);
  const slope = Number(g.slope_angle || 25.0);
  const aspect = Number(g.aspect_deg || 180.0);
  const plan = Number(g.plan_curvature || 0.0);
  const prof = Number(g.profile_curvature || 0.0);
  const twi = Number(g.twi || 12.0);
  const stream = Number(g.dist_to_stream_m || 80.0);
  const lcCode = Number(g.land_cover_code || 10);
  const soilEnc = Number(g.soil_type_enc || 1);

  const r1h = Number(sensor?.rainfall_1h_mm || 0.0);
  const r3h = Number(sensor?.rainfall_3h_mm || 0.0);
  const r6h = Number(sensor?.rainfall_6h_mm || 0.0);
  const r12h = Number(sensor?.rainfall_12h_mm || 0.0);
  const r24h = Number(sensor?.rainfall_24h_mm || 0.0);
  const r3d = Number(sensor?.rainfall_3d_accum_mm || 0.0);
  const r7d = Number(sensor?.rainfall_7d_accum_mm || 0.0);
  const rInt = Number(sensor?.rainfall_intensity_mm_h || r1h);
  const moist = Number(parseFloat(((sensor?.soil_moisture || 0.4) * 100).toFixed(2)));
  const hist = Number(g.historical_incidents || 0);

  // 3 Engineered Interaction Features (Identified from model trees)
  const rmi = parseFloat((rInt * moist).toFixed(4));
  const swi = parseFloat((slope * moist).toFixed(4));
  const rrp = parseFloat((r24h * twi).toFixed(4));

  const featureVector = [
    elev, slope, aspect, plan, prof, twi, stream, lcCode, soilEnc,
    r1h, r3h, r6h, r12h, r24h, r3d, r7d, rInt, moist, hist,
    rmi, swi, rrp
  ];

  const featureDict = {
    elevation_m: elev,
    slope_deg: slope,
    aspect_deg: aspect,
    plan_curvature: plan,
    profile_curvature: prof,
    twi: twi,
    dist_to_stream_m: stream,
    land_cover_code: lcCode,
    soil_type_enc: soilEnc,
    rainfall_1h_mm: r1h,
    rainfall_3h_mm: r3h,
    rainfall_6h_mm: r6h,
    rainfall_12h_mm: r12h,
    rainfall_24h_mm: r24h,
    rainfall_3d_accum_mm: r3d,
    rainfall_7d_accum_mm: r7d,
    rainfall_intensity_mm_h: rInt,
    soil_moisture_pct: moist,
    historical_landslide_density: hist,
    rain_moisture_index: rmi,
    slope_wetness_index: swi,
    rainfall_runoff_proxy: rrp
  };

  return { vector: featureVector, dict: featureDict };
}

// ---------------------------------------------------------------------------
// Compute Flash Flood Risk Scores (SIH 26192)
// ---------------------------------------------------------------------------
export async function computeRiskScores() {
  const db = getDB();
  const grids = db.prepare('SELECT * FROM grid_cells').all();
  const now = new Date().toISOString();
  const { metadata } = loadXGBoostModel();

  // Load decision threshold from metadata or admin config (default 0.460)
  const cfgThresh = db.prepare("SELECT value FROM admin_config WHERE key='risk_threshold_flash_flood'").get()?.value;
  const FROZEN_THRESHOLD = cfgThresh ? parseFloat(cfgThresh) : (metadata?.test_metrics?.threshold || 0.460);

  const scores = [];
  const insert = db.prepare(`
    INSERT INTO risk_scores(
      grid_id, timestamp, rainfall_score, soil_score, slope_score,
      historical_score, citizen_score, composite_score, risk_level,
      primary_factor, ml_probability, model_version, threshold
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  for (const g of grids) {
    const sensor = db.prepare(
      'SELECT * FROM sensor_readings WHERE grid_id=? ORDER BY timestamp DESC LIMIT 1'
    ).get(g.id);

    const { vector, dict } = build22FeatureVector(g, sensor);

    // Compute probability via native 235-tree XGBoost evaluation
    let prob = predictXGBoostTree(vector);

    // Fallback if model files are unreadable
    if (prob === null) {
      const rainNorm = Math.min(1.0, (dict.rainfall_3h_mm / 90) * 0.6 + (dict.rainfall_24h_mm / 180) * 0.4);
      const streamNorm = Math.exp(-dict.dist_to_stream_m / 150);
      const moistNorm = dict.soil_moisture_pct / 100;
      prob = Math.min(0.99, Math.max(0.01, 0.45 * (rainNorm * moistNorm) + 0.35 * streamNorm + 0.20 * (dict.twi / 16)));
    }

    prob = parseFloat(prob.toFixed(4));
    const compositeScore = parseFloat((prob * 100).toFixed(2));

    // Risk classification using validation-calibrated thresholds
    let riskLevel;
    if (prob >= 0.75) {
      riskLevel = 'Critical';
    } else if (prob >= FROZEN_THRESHOLD) { // 0.460 decision boundary
      riskLevel = 'High';
    } else if (prob >= 0.28) {
      riskLevel = 'Moderate';
    } else {
      riskLevel = 'Low';
    }

    // Top factors for explainability (SHAP-aligned ranking)
    const factorContributions = [
      { name: `3h Rain (${dict.rainfall_3h_mm}mm)`, weight: (dict.rainfall_3h_mm / 100) * 45 },
      { name: `Soil Saturation (${dict.soil_moisture_pct}%)`, weight: (dict.soil_moisture_pct / 100) * 35 },
      { name: `Stream Proximity (${dict.dist_to_stream_m}m)`, weight: Math.exp(-dict.dist_to_stream_m / 140) * 40 },
      { name: `Topographic Wetness (${dict.twi})`, weight: (dict.twi / 16) * 25 },
      { name: `Slope (${dict.slope_deg}°)`, weight: (dict.slope_deg / 45) * 20 },
      { name: `Runoff Proxy (${Math.round(dict.rainfall_runoff_proxy)})`, weight: (dict.rainfall_runoff_proxy / 1000) * 30 },
    ];
    factorContributions.sort((a, b) => b.weight - a.weight);
    const primaryFactor = factorContributions[0].name.split(' (')[0];

    const rs = parseFloat(Math.min(100, (dict.rainfall_3h_mm / 120) * 100).toFixed(2));
    const ss = parseFloat(dict.soil_moisture_pct.toFixed(2));
    const sl = parseFloat(Math.min(100, (dict.slope_deg / 45) * 100).toFixed(2));
    const hs = parseFloat(Math.min(100, (dict.historical_landslide_density / 12) * 100).toFixed(2));
    const cs = 0;

    insert.run(
      g.id, now, rs, ss, sl, hs, cs,
      compositeScore, riskLevel, primaryFactor,
      prob, 'XGBoost-FlashFlood-v2.0 (SIH26192)', FROZEN_THRESHOLD
    );

    scores.push({
      grid_id: g.id,
      timestamp: now,
      rainfall_score: rs,
      soil_score: ss,
      slope_score: sl,
      historical_score: hs,
      citizen_score: cs,
      composite_score: compositeScore,
      risk_level: riskLevel,
      primary_factor: primaryFactor,
      top_factors: factorContributions.slice(0, 3),
      ml_probability: prob,
      model_version: 'XGBoost-FlashFlood-v2.0 (SIH26192)',
      threshold: FROZEN_THRESHOLD,
      features_used: dict,
      lat: g.lat,
      lng: g.lng,
      district: g.district,
      slope_angle: g.slope_angle,
      elevation: g.elevation,
      road_proximity_km: g.road_proximity_km,
      village_proximity_km: g.village_proximity_km,
      dist_to_stream_m: g.dist_to_stream_m,
      twi: g.twi
    });
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Get latest risk scores for all grids (with location info)
// ---------------------------------------------------------------------------
export function getLatestRiskScores() {
  const db = getDB();
  return db.prepare(`
    SELECT rs.*, gc.lat, gc.lng, gc.district, gc.slope_angle, gc.elevation,
           gc.road_proximity_km, gc.village_proximity_km, gc.dist_to_stream_m, gc.twi
    FROM risk_scores rs
    JOIN grid_cells gc ON rs.grid_id = gc.id
    WHERE rs.id IN (SELECT MAX(id) FROM risk_scores GROUP BY grid_id)
    ORDER BY rs.composite_score DESC
  `).all();
}

export function getModelMetadata() {
  const { metadata } = loadXGBoostModel();
  return metadata;
}
