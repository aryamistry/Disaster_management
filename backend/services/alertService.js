import { getDB } from '../db/database.js';
import { randomUUID } from 'crypto';
import { broadcast } from '../server.js';

const TEMPLATES = {
  en: (zone, level, road, action) =>
    `⚠️ LANDSLIDE ALERT — ${level} Risk at ${zone}. ${road ? `Avoid ${road}.` : ''} ${action}. Stay safe. — Sikkim DDMA`,
  hi: (zone, level, road, action) =>
    `⚠️ भूस्खलन चेतावनी — ${zone} में ${level === 'Critical' ? 'अति गंभीर' : level === 'High' ? 'उच्च' : 'मध्यम'} खतरा। ${road ? `${road} से बचें।` : ''} ${action}। सावधान रहें — सिक्किम DDMA`,
  mz: (zone, level, road, action) =>
    `⚠️ LUNGPHUM BEIDAWN — ${zone} ah ${level} lamzin. ${road ? `${road} zawn suh.` : ''} ${action}. Inzirtir rawh — Sikkim DDMA`,
};

const ACTIONS = {
  Critical: 'Evacuate immediately. Do not use mountain roads.',
  High: 'Avoid slope areas. Authorities have been notified.',
  Medium: 'Exercise caution. Monitor updates.',
};

export function checkAndFireAlerts(scores) {
  const db = getDB();
  const threshRow = db.prepare("SELECT value FROM admin_config WHERE key='risk_threshold_medium'").get();
  const thresh = parseFloat(threshRow?.value || 30);

  let fired = 0;

  for (const score of scores) {
    if (score.composite_score < thresh || score.risk_level === 'Low') continue;

    const existing = db.prepare(
      "SELECT id FROM alerts WHERE grid_id=? AND status='Active' ORDER BY created_at DESC LIMIT 1"
    ).get(score.grid_id);
    if (existing) continue;

    const grid = db.prepare('SELECT * FROM grid_cells WHERE id=?').get(score.grid_id);
    if (!grid) continue;

    const districtMap = {
      D001: { roads: 'NH10, SH1', villages: 'Rangpo, Singtam, Ranipool' },
      D002: { roads: 'NH510, SH3', villages: 'Gyalshing, Yuksom, Legship' },
    };
    const distInfo = districtMap[grid.district] || { roads: 'Local roads', villages: 'Nearby villages' };
    const action = ACTIONS[score.risk_level] || ACTIONS.Medium;
    const id = randomUUID();
    const now = new Date().toISOString();

    const msgEn = TEMPLATES.en(`Zone ${score.grid_id}`, score.risk_level, distInfo.roads, action);
    const msgHi = TEMPLATES.hi(`Zone ${score.grid_id}`, score.risk_level, distInfo.roads, action);
    const msgMz = TEMPLATES.mz(`Zone ${score.grid_id}`, score.risk_level, distInfo.roads, action);

    db.prepare(`
      INSERT INTO alerts(id,grid_id,district,risk_level,composite_score,primary_factor,status,created_at,
        acknowledged_at,acknowledged_by,message_en,message_hi,message_mz,affected_roads,affected_villages,recommended_action)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, score.grid_id, grid.district, score.risk_level, score.composite_score, score.primary_factor,
           'Active', now, null, null, msgEn, msgHi, msgMz, distInfo.roads, distInfo.villages, action);

    // Simulated SMS log
    const smsInsert = db.prepare(`
      INSERT INTO alert_sms_log(alert_id,recipient_type,phone_number,language,message,status,sent_at)
      VALUES (?,?,?,?,?,?,?)
    `);
    smsInsert.run(id, 'district_officer', '+919800000001', 'en', msgEn, 'Simulated', now);
    smsInsert.run(id, 'district_officer', '+919800000002', 'hi', msgHi, 'Simulated', now);
    smsInsert.run(id, 'community', '+919876543210', 'mz', msgMz, 'Simulated', now);

    fired++;
    console.log(`[ALERT] Fired ${score.risk_level} alert for grid ${score.grid_id} (score: ${score.composite_score})`);
  }

  return fired;
}
