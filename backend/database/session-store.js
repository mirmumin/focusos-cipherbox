const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');

const sessDB = new Database(path.join(__dirname, '../sessions.db'));
sessDB.pragma('journal_mode = WAL');
sessDB.exec(`CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER NOT NULL
)`);

// Cleanup expired sessions every hour
setInterval(() => {
  sessDB.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now());
}, 3600000);

class BetterSQLiteStore extends session.Store {
  get(sid, cb) {
    const row = sessDB.prepare('SELECT sess, expired FROM sessions WHERE sid=?').get(sid);
    if (!row) return cb(null, null);
    if (row.expired < Date.now()) {
      this.destroy(sid, () => {});
      return cb(null, null);
    }
    try { cb(null, JSON.parse(row.sess)); } catch(e) { cb(e); }
  }

  set(sid, sess, cb) {
    const ttl = sess.cookie?.maxAge ? Date.now() + sess.cookie.maxAge : Date.now() + 86400000 * 30;
    sessDB.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?,?,?)').run(sid, JSON.stringify(sess), ttl);
    cb && cb(null);
  }

  destroy(sid, cb) {
    sessDB.prepare('DELETE FROM sessions WHERE sid=?').run(sid);
    cb && cb(null);
  }

  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

module.exports = BetterSQLiteStore;
