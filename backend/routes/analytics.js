const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);
const uid = req => req.session.userId;

router.get('/overview', (req, res) => {
  const u = uid(req);
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = Math.floor(Date.now() / 1000) - 604800;

  const totalTasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=?').get(u).n;
  const doneTasks = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status="done"').get(u).n;
  const todayDone = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status="done" AND date(completed_at,"unixepoch")=?').get(u, today).n;
  const overdue = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status="pending" AND due_date < unixepoch() AND due_date IS NOT NULL').get(u).n;
  const focusMinutes = db.prepare('SELECT COALESCE(SUM(duration_minutes),0) as m FROM focus_sessions WHERE user_id=? AND started_at > ?').get(u, weekAgo).m;
  const byCategory = db.prepare('SELECT c.name, c.color, COUNT(t.id) as total, SUM(CASE WHEN t.status="done" THEN 1 ELSE 0 END) as done FROM tasks t JOIN categories c ON t.category_id=c.id WHERE t.user_id=? GROUP BY c.id').all(u);

  const heatmap = db.prepare(`SELECT date(completed_at,'unixepoch') as day, COUNT(*) as count FROM tasks WHERE user_id=? AND status='done' AND completed_at > ? GROUP BY day`).all(u, weekAgo - 2160000);

  const streak = calcStreak(u);

  res.json({ totalTasks, doneTasks, todayDone, overdue, focusMinutes, byCategory, heatmap, streak, completionRate: totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0 });
});

function calcStreak(userId) {
  const rows = db.prepare(`SELECT DISTINCT date(completed_at,'unixepoch') as day FROM tasks WHERE user_id=? AND status='done' ORDER BY day DESC LIMIT 60`).all(userId);
  if (!rows.length) return 0;
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(rows[i].day);
    const diff = Math.round((today - d) / 86400000);
    if (diff === i || (i === 0 && diff === 1)) streak++;
    else break;
  }
  return streak;
}

router.get('/burnout', (req, res) => {
  const u = uid(req);
  const weekAgo = Math.floor(Date.now() / 1000) - 604800;
  const hardFails = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND difficulty>=4 AND status="pending" AND due_date < unixepoch() AND due_date IS NOT NULL').get(u).n;
  const avgMood = db.prepare('SELECT AVG(mood) as m FROM energy_logs WHERE user_id=? AND created_at > ?').get(u, weekAgo)?.m;
  const recentCompletion = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status="done" AND completed_at > ?').get(u, weekAgo).n;
  const recentCreated = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND created_at > ?').get(u, weekAgo).n;
  const rate = recentCreated ? recentCompletion / recentCreated : 1;

  let score = 0;
  if (hardFails > 3) score += 2;
  if (avgMood && avgMood < 3) score += 2;
  if (rate < 0.3) score += 2;

  res.json({ burnoutScore: score, hardFails, avgMood: avgMood ? Math.round(avgMood * 10) / 10 : null, weeklyCompletionRate: Math.round(rate * 100), risk: score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low' });
});

module.exports = router;
