const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);
const uid = req => req.session.userId;

// ── Focus Sessions ───────────────────────────────────────────
router.get('/sessions', (req, res) => {
  res.json(db.prepare('SELECT * FROM focus_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 50').all(uid(req)));
});
router.post('/sessions', (req, res) => {
  const { task_id, category_id, duration_minutes, interruptions, notes } = req.body;
  const now = Math.floor(Date.now() / 1000);
  const r = db.prepare('INSERT INTO focus_sessions (user_id, task_id, category_id, duration_minutes, interruptions, started_at, ended_at, notes) VALUES (?,?,?,?,?,?,?,?)').run(uid(req), task_id || null, category_id || null, duration_minutes, interruptions || 0, now - (duration_minutes * 60), now, notes || null);
  res.json({ id: r.lastInsertRowid });
});

// ── Reflections ──────────────────────────────────────────────
router.get('/reflections', (req, res) => {
  res.json(db.prepare('SELECT * FROM reflections WHERE user_id=? ORDER BY date DESC LIMIT 30').all(uid(req)));
});
router.post('/reflections', (req, res) => {
  const { date, mood, energy, productivity, content } = req.body;
  const today = date || new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT id FROM reflections WHERE user_id=? AND date=?').get(uid(req), today);
  if (existing) {
    db.prepare('UPDATE reflections SET mood=?, energy=?, productivity=?, content=? WHERE id=?').run(mood, energy, productivity, content, existing.id);
    return res.json({ id: existing.id });
  }
  const r = db.prepare('INSERT INTO reflections (user_id, date, mood, energy, productivity, content) VALUES (?,?,?,?,?,?)').run(uid(req), today, mood, energy, productivity, content);
  res.json({ id: r.lastInsertRowid });
});

// ── Energy Logs ──────────────────────────────────────────────
router.get('/energy', (req, res) => {
  res.json(db.prepare('SELECT * FROM energy_logs WHERE user_id=? ORDER BY date DESC LIMIT 14').all(uid(req)));
});
router.post('/energy', (req, res) => {
  const { date, sleep_hours, energy, mood, stress, notes } = req.body;
  const today = date || new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT id FROM energy_logs WHERE user_id=? AND date=?').get(uid(req), today);
  if (existing) {
    db.prepare('UPDATE energy_logs SET sleep_hours=?, energy=?, mood=?, stress=?, notes=? WHERE id=?').run(sleep_hours, energy, mood, stress, notes, existing.id);
    return res.json({ id: existing.id });
  }
  const r = db.prepare('INSERT INTO energy_logs (user_id, date, sleep_hours, energy, mood, stress, notes) VALUES (?,?,?,?,?,?,?)').run(uid(req), today, sleep_hours, energy, mood, stress, notes);
  res.json({ id: r.lastInsertRowid });
});

// ── Notes ────────────────────────────────────────────────────
router.get('/notes', (req, res) => {
  const { category_id } = req.query;
  let q = 'SELECT n.*, c.name as category_name FROM notes n LEFT JOIN categories c ON n.category_id=c.id WHERE n.user_id=?';
  const params = [uid(req)];
  if (category_id) { q += ' AND n.category_id=?'; params.push(category_id); }
  q += ' ORDER BY n.updated_at DESC';
  res.json(db.prepare(q).all(...params));
});
router.post('/notes', (req, res) => {
  const { title, content, category_id, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const r = db.prepare('INSERT INTO notes (user_id, title, content, category_id, tags) VALUES (?,?,?,?,?)').run(uid(req), title, content || '', category_id || null, tags || null);
  res.json({ id: r.lastInsertRowid });
});
router.put('/notes/:id', (req, res) => {
  const { title, content, category_id, tags } = req.body;
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE notes SET title=COALESCE(?,title), content=COALESCE(?,content), category_id=COALESCE(?,category_id), tags=COALESCE(?,tags), updated_at=? WHERE id=? AND user_id=?').run(title, content, category_id, tags, now, req.params.id, uid(req));
  res.json({ ok: true });
});
router.delete('/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

module.exports = router;
