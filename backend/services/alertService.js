import { getDB } from '../db/database.js';
import { randomUUID } from 'crypto';
import { broadcast } from '../server.js';

const TEMPLATES = {
  en: (zone, level, stream, road, action) =>
    `⚠️ FLASH FLOOD ALERT — ${level} Risk at ${zone}. Rapid water level surge in ${stream}. ${road ? `Avoid ${road}.` : ''} ${action}. — DHARA AI Early Warning (SIH26192)`,
  hi: (zone, level, stream, road, action) =>
    `⚠️ फ्लैश फ्लड चेतावनी — ${zone} में ${level === 'Critical' ? 'अति गंभीर' : level === 'High' ? 'उच्च' : 'मध्यम'} खतरा। ${stream} में जलस्तर तेजी से बढ़ रहा है। ${road ? `${road} से बचें।` : ''} ${action}। — DHARA AI`,
  mz: (zone, level, stream, road, action) =>
    `⚠️ TUI LIAN FLASH FLOOD VAUNA — ${zone} ah ${level} lamzin. ${stream} ah tui a lian chak hle. ${road ? `${road} zawn suh.` : ''} ${action}. — DHARA AI`,
};

const ACTIONS = {
  Critical: 'Immediate evacuation of riverbank terraces and low-lying zones. Deploy SDRF/NDRF.',
  High: 'Avoid river crossings and bridges. Evacuate livestock. DDMA on high alert.',
  Moderate: 'Exercise caution near stream beds. Monitor hourly water levels.',
  Low: 'Normal monitoring. Catchment within safe retention capacity.'
};

export function checkAndFireAlerts(scores) {
  const db = getDB();
  const threshRow = db.prepare("SELECT value FROM admin_config WHERE key='risk_threshold_flash_flood'").get();
  const thresh = parseFloat(threshRow?.value || 0.460); // 0.460 decision boundary

  let fired = 0;

  for (const score of scores) {
    // Only fire alerts if probability >= threshold (0.460) or High/Critical
    if ((score.ml_probability !== null && score.ml_probability < thresh) || score.risk_level === 'Low' || score.risk_level === 'Moderate') {
      continue;
    }

    const existing = db.prepare(
      "SELECT id FROM alerts WHERE grid_id=? AND status='Active' ORDER BY created_at DESC LIMIT 1"
    ).get(score.grid_id);
    if (existing) continue;

    const grid = db.prepare('SELECT * FROM grid_cells WHERE id=?').get(score.grid_id);
    if (!grid) continue;

    const districtMap = {
      D001: {
        roads: 'NH10, SH1',
        villages: 'Rangpo, Singtam, Ranipool',
        stream: 'Teesta River Basin'
      },
      D002: {
        roads: 'NH510, SH3',
        villages: 'Gyalshing, Yuksom, Legship',
        stream: 'Rangit River Valley'
      },
    };
    const distInfo = districtMap[grid.district] || {
      roads: 'Local river road',
      villages: 'Nearby riverine village',
      stream: 'Local stream'
    };

    const action = ACTIONS[score.risk_level] || ACTIONS.High;
    const id = randomUUID();
    const now = new Date().toISOString();

    const msgEn = TEMPLATES.en(`Zone ${score.grid_id}`, score.risk_level, distInfo.stream, distInfo.roads, action);
    const msgHi = TEMPLATES.hi(`Zone ${score.grid_id}`, score.risk_level, distInfo.stream, distInfo.roads, action);
    const msgMz = TEMPLATES.mz(`Zone ${score.grid_id}`, score.risk_level, distInfo.stream, distInfo.roads, action);

    db.prepare(`
      INSERT INTO alerts(
        id, grid_id, district, risk_level, composite_score, primary_factor, status,
        created_at, acknowledged_at, acknowledged_by, message_en, message_hi, message_mz,
        affected_roads, affected_villages, recommended_action
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, score.grid_id, grid.district, score.risk_level, score.composite_score, score.primary_factor,
      'Active', now, null, null, msgEn, msgHi, msgMz, distInfo.roads, distInfo.villages, action
    );

    // Simulated SMS log (EN, HI, MZ)
    const smsInsert = db.prepare(`
      INSERT INTO alert_sms_log(alert_id, recipient_type, phone_number, language, message, status, sent_at)
      VALUES (?,?,?,?,?,?,?)
    `);
    smsInsert.run(id, 'district_officer', '+919800000001', 'en', msgEn, 'Simulated', now);
    smsInsert.run(id, 'field_team', '+919800000002', 'hi', msgHi, 'Simulated', now);
    smsInsert.run(id, 'community_alert', '+919876543210', 'mz', msgMz, 'Simulated', now);

    fired++;
    console.log(`[ALERT] Fired ${score.risk_level} Flash Flood alert for grid ${score.grid_id} (P: ${score.ml_probability}, Thresh: ${thresh})`);
  }

  return fired;
}
