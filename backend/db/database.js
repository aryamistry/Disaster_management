import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'landslide.db');

let db;

export function getDB() {
  if (!db) db = new DatabaseSync(DB_PATH);
  return db;
}

export function initDB() {
  db = new DatabaseSync(DB_PATH);

  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA foreign_keys = ON;`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS grid_cells (
      id TEXT PRIMARY KEY,
      district TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      slope_angle REAL NOT NULL,
      elevation REAL NOT NULL,
      geology TEXT,
      land_use TEXT,
      historical_incidents INTEGER DEFAULT 0,
      road_proximity_km REAL,
      village_proximity_km REAL
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grid_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      rainfall_1h_mm REAL DEFAULT 0,
      rainfall_24h_mm REAL DEFAULT 0,
      soil_moisture REAL DEFAULT 0,
      temperature_c REAL,
      humidity_pct REAL,
      source TEXT DEFAULT 'simulated'
    );

    CREATE TABLE IF NOT EXISTS risk_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grid_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      rainfall_score REAL DEFAULT 0,
      soil_score REAL DEFAULT 0,
      slope_score REAL DEFAULT 0,
      historical_score REAL DEFAULT 0,
      citizen_score REAL DEFAULT 0,
      composite_score REAL NOT NULL,
      risk_level TEXT NOT NULL,
      primary_factor TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      grid_id TEXT NOT NULL,
      district TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      composite_score REAL NOT NULL,
      primary_factor TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      acknowledged_by TEXT,
      message_en TEXT,
      message_hi TEXT,
      message_mz TEXT,
      affected_roads TEXT,
      affected_villages TEXT,
      recommended_action TEXT
    );

    CREATE TABLE IF NOT EXISTS citizen_reports (
      id TEXT PRIMARY KEY,
      grid_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      reporter_name TEXT,
      report_type TEXT,
      description TEXT,
      photo_url TEXT,
      status TEXT DEFAULT 'Received',
      submitted_at TEXT NOT NULL,
      synced_at TEXT,
      offline_queued INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS alert_sms_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT NOT NULL,
      recipient_type TEXT,
      phone_number TEXT,
      language TEXT,
      message TEXT,
      status TEXT DEFAULT 'Simulated',
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      district TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed admin config
  const cfgItems = [
    ['risk_threshold_medium', '30'],
    ['risk_threshold_high', '55'],
    ['risk_threshold_critical', '75'],
    ['weight_rainfall', '0.35'],
    ['weight_soil', '0.25'],
    ['weight_slope', '0.20'],
    ['weight_historical', '0.12'],
    ['weight_citizen', '0.08'],
    ['alert_sms_enabled', 'false'],
    ['alert_push_enabled', 'true'],
  ];
  for (const [k, v] of cfgItems) {
    db.prepare('INSERT OR IGNORE INTO admin_config(key,value,updated_at) VALUES (?,?,?)').run(k, v, new Date().toISOString());
  }

  // Seed grid cells from JSON
  const gridData = JSON.parse(readFileSync(join(__dirname, '../data/districts.json'), 'utf8'));
  for (const c of gridData.grid_cells) {
    db.prepare(`
      INSERT OR IGNORE INTO grid_cells(id,district,lat,lng,slope_angle,elevation,geology,land_use,historical_incidents,road_proximity_km,village_proximity_km)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(c.id, c.district, c.lat, c.lng, c.slope_angle, c.elevation, c.geology, c.land_use, c.historical_incidents, c.road_proximity_km, c.village_proximity_km);
  }

  // Seed demo users
  const users = [
    ['U001', 'Anita Sharma', 'district_officer', 'East Sikkim', '+919800000001'],
    ['U002', 'Rahul Pradhan', 'field_officer', 'West Sikkim', '+919800000002'],
    ['U003', 'Nisha Dey', 'analyst', null, '+919800000003'],
    ['U004', 'Admin User', 'admin', null, '+919800000000'],
  ];
  for (const [id, name, role, district, phone] of users) {
    db.prepare('INSERT OR IGNORE INTO users(id,name,role,district,phone,created_at) VALUES (?,?,?,?,?,?)').run(id, name, role, district, phone, new Date().toISOString());
  }

  console.log('[DB] Database initialized successfully');
  return db;
}
