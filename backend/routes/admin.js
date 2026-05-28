const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireOwner } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.use(requireOwner);

router.get('/users', (req, res) => {
  res.json(db.prepare('SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC').all());
});

router.put('/users/:id', (req, res) => {
  const { is_active, role } = req.body;
  db.prepare('UPDATE users SET is_active=COALESCE(?,is_active), role=COALESCE(?,role) WHERE id=?').run(is_active, role, req.params.id);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id == req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/users/:id/reset-password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });
  const hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id);
  res.json({ ok: true });
});

router.get('/stats', (req, res) => {
  const dbPath = path.join(__dirname, '../planner.db');
  const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  res.json({
    users: db.prepare('SELECT COUNT(*) as n FROM users').get().n,
    tasks: db.prepare('SELECT COUNT(*) as n FROM tasks').get().n,
    sessions: db.prepare('SELECT COUNT(*) as n FROM focus_sessions').get().n,
    notes: db.prepare('SELECT COUNT(*) as n FROM notes').get().n,
    db_size_kb: Math.round(size / 1024),
    uptime_hours: Math.round(process.uptime() / 3600 * 10) / 10,
  });
});

router.get('/settings', (req, res) => {
  res.json(db.prepare('SELECT key, value FROM global_settings').all());
});

router.put('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  db.prepare('INSERT OR REPLACE INTO global_settings (key, value) VALUES (?,?)').run(key, value);
  res.json({ ok: true });
});

module.exports = router;
