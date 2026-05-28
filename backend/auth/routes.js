const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const result = stmt.run(username.trim(), email?.trim() || null, hash);

    // seed default categories
    const cats = db.prepare('INSERT INTO categories (user_id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)');
    const defaults = [
      ['University', '#00ff88', '🎓', 0],
      ['Projects', '#00aaff', '💻', 1],
      ['Personal', '#ffaa00', '🌱', 2],
    ];
    for (const [name, color, icon, order] of defaults) {
      cats.run(result.lastInsertRowid, name, color, icon, order);
    }

    req.session.userId = result.lastInsertRowid;
    req.session.username = username.trim();
    req.session.role = 'user';
    res.json({ ok: true, username: username.trim() });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  db.prepare('UPDATE users SET last_login = unixepoch() WHERE id = ?').run(user.id);
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  res.json({ ok: true, username: user.username, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not logged in' });
  res.json({ userId: req.session.userId, username: req.session.username, role: req.session.role });
});

module.exports = router;
