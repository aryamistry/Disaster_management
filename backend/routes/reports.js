import { Router } from 'express';
import { getDB } from '../db/database.js';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { broadcast } from '../server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadDir = join(__dirname, '../../uploads/reports');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// GET /api/reports — list citizen reports
router.get('/', (req, res) => {
  const db = getDB();
  const { status, limit = 100 } = req.query;
  try {
    let query = 'SELECT * FROM citizen_reports';
    const params = [];
    if (status) { query += ' WHERE status=?'; params.push(status); }
    query += ' ORDER BY submitted_at DESC LIMIT ?';
    params.push(parseInt(limit));
    const reports = db.prepare(query).all(...params);
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reports — submit a new report (with optional photo)
router.post('/', upload.single('photo'), (req, res) => {
  const db = getDB();
  try {
    const { lat, lng, reporter_name, report_type, description, offline_queued } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'lat and lng required' });

    // Find nearest grid cell
    const grids = db.prepare('SELECT id, lat, lng FROM grid_cells').all();
    let nearestGrid = null, minDist = Infinity;
    for (const g of grids) {
      const d = Math.hypot(g.lat - parseFloat(lat), g.lng - parseFloat(lng));
      if (d < minDist) { minDist = d; nearestGrid = g.id; }
    }

    const id = randomUUID();
    const photoUrl = req.file ? `/uploads/reports/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO citizen_reports(id, grid_id, lat, lng, reporter_name, report_type, description, photo_url, status, submitted_at, synced_at, offline_queued)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Received', ?, ?, ?)
    `).run(id, nearestGrid, parseFloat(lat), parseFloat(lng), reporter_name || 'Anonymous',
           report_type || 'other', description || '', photoUrl,
           new Date().toISOString(), new Date().toISOString(), offline_queued ? 1 : 0);

    const report = db.prepare('SELECT * FROM citizen_reports WHERE id=?').get(id);
    broadcast('NEW_REPORT', report);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reports/sync-batch — sync offline-queued reports
router.post('/sync-batch', upload.none(), (req, res) => {
  const db = getDB();
  try {
    const { reports } = req.body;
    const parsed = typeof reports === 'string' ? JSON.parse(reports) : reports;
    const results = [];
    for (const r of parsed) {
      const id = r.id || randomUUID();
      const existing = db.prepare('SELECT id FROM citizen_reports WHERE id=?').get(id);
      if (!existing) {
        db.prepare(`
          INSERT INTO citizen_reports(id,grid_id,lat,lng,reporter_name,report_type,description,photo_url,status,submitted_at,synced_at,offline_queued)
          VALUES (?,?,?,?,?,?,?,?,'Received',?,?,1)
        `).run(id, r.grid_id || null, r.lat, r.lng, r.reporter_name || 'Anonymous', r.report_type || 'other',
               r.description || '', r.photo_url || null, r.submitted_at || new Date().toISOString(), new Date().toISOString());
        results.push({ id, status: 'synced' });
      } else {
        results.push({ id, status: 'already_exists' });
      }
    }
    res.json({ success: true, synced: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/:id — get a single report by ID (for PWA status tracking)
router.get('/:id', (req, res) => {
  const db = getDB();
  try {
    const report = db.prepare('SELECT * FROM citizen_reports WHERE id=?').get(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/reports/:id/status
router.patch('/:id/status', (req, res) => {
  const db = getDB();
  const { status } = req.body;
  const allowed = ['Received', 'Under Review', 'Verified', 'Dismissed'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
  try {
    db.prepare('UPDATE citizen_reports SET status=? WHERE id=?').run(status, req.params.id);
    const updated = db.prepare('SELECT * FROM citizen_reports WHERE id=?').get(req.params.id);
    broadcast('REPORT_UPDATE', updated);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
