const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);
const uid = req => req.session.userId;

// ── Categories ──────────────────────────────────────────────
router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC').all(uid(req)));
});
router.post('/categories', (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO categories (user_id, name, color, icon) VALUES (?,?,?,?)').run(uid(req), name, color || '#00ff88', icon || '📁');
  res.json({ id: r.lastInsertRowid });
});
router.put('/categories/:id', (req, res) => {
  const { name, color, icon, sort_order } = req.body;
  db.prepare('UPDATE categories SET name=COALESCE(?,name), color=COALESCE(?,color), icon=COALESCE(?,icon), sort_order=COALESCE(?,sort_order) WHERE id=? AND user_id=?').run(name, color, icon, sort_order, req.params.id, uid(req));
  res.json({ ok: true });
});
router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=? AND user_id=?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

// ── Goals ───────────────────────────────────────────────────
router.get('/goals', (req, res) => {
  res.json(db.prepare('SELECT g.*, c.name as category_name FROM goals g LEFT JOIN categories c ON g.category_id=c.id WHERE g.user_id=? ORDER BY g.created_at DESC').all(uid(req)));
});
router.post('/goals', (req, res) => {
  const { title, description, category_id, target_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const r = db.prepare('INSERT INTO goals (user_id, title, description, category_id, target_date) VALUES (?,?,?,?,?)').run(uid(req), title, description || null, category_id || null, target_date || null);
  res.json({ id: r.lastInsertRowid });
});
router.put('/goals/:id', (req, res) => {
  const { title, description, category_id, target_date, status } = req.body;
  db.prepare('UPDATE goals SET title=COALESCE(?,title), description=COALESCE(?,description), category_id=COALESCE(?,category_id), target_date=COALESCE(?,target_date), status=COALESCE(?,status) WHERE id=? AND user_id=?').run(title, description, category_id, target_date, status, req.params.id, uid(req));
  res.json({ ok: true });
});
router.delete('/goals/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id=? AND user_id=?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

// ── Projects ─────────────────────────────────────────────────
router.get('/projects', (req, res) => {
  const { goal_id } = req.query;
  let q = 'SELECT p.*, g.title as goal_title, c.name as category_name FROM projects p LEFT JOIN goals g ON p.goal_id=g.id LEFT JOIN categories c ON p.category_id=c.id WHERE p.user_id=?';
  const params = [uid(req)];
  if (goal_id) { q += ' AND p.goal_id=?'; params.push(goal_id); }
  q += ' ORDER BY p.sort_order ASC';
  res.json(db.prepare(q).all(...params));
});
router.post('/projects', (req, res) => {
  const { title, description, goal_id, category_id, priority, target_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const r = db.prepare('INSERT INTO projects (user_id, title, description, goal_id, category_id, priority, target_date) VALUES (?,?,?,?,?,?,?)').run(uid(req), title, description || null, goal_id || null, category_id || null, priority || 2, target_date || null);
  res.json({ id: r.lastInsertRowid });
});
router.put('/projects/:id', (req, res) => {
  const { title, description, goal_id, category_id, priority, target_date, status, sort_order } = req.body;
  db.prepare('UPDATE projects SET title=COALESCE(?,title), description=COALESCE(?,description), goal_id=COALESCE(?,goal_id), category_id=COALESCE(?,category_id), priority=COALESCE(?,priority), target_date=COALESCE(?,target_date), status=COALESCE(?,status), sort_order=COALESCE(?,sort_order) WHERE id=? AND user_id=?').run(title, description, goal_id, category_id, priority, target_date, status, sort_order, req.params.id, uid(req));
  res.json({ ok: true });
});
router.delete('/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=? AND user_id=?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

module.exports = router;
