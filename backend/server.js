require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = require('./database/db');
const BetterSQLiteStore = require('./database/session-store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(session({
  store: new BetterSQLiteStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true }
}));

// seed owner account
(async () => {
  const ownerExists = db.prepare("SELECT id FROM users WHERE role='owner'").get();
  if (!ownerExists) {
    const username = process.env.OWNER_USERNAME || 'admin';
    const password = process.env.OWNER_PASSWORD || 'changeme123';
    const hash = await bcrypt.hash(password, 10);
    const r = db.prepare("INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?,?,'owner')").run(username, hash);
    if (r.lastInsertRowid) {
      const cats = db.prepare('INSERT INTO categories (user_id, name, color, icon, sort_order) VALUES (?,?,?,?,?)');
      [['University','#00ff88','🎓',0],['Projects','#00aaff','💻',1],['Personal','#ffaa00','🌱',2]].forEach(([n,c,i,o]) => cats.run(r.lastInsertRowid,n,c,i,o));
    }
  }
})();

app.use('/api/auth', require('./auth/routes'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api', require('./routes/entities'));
app.use('/api', require('./routes/journal'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/phase2')); // Phase 2 extensions

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`FocusOS running on :${PORT}`));
