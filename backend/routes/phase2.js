// Phase 2 routes: subtasks, widgets, timer presets, tags, analytics extensions
const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);
const uid = req => req.session.userId;

// ── SUBTASKS ─────────────────────────────────────────────────
router.get('/tasks/:taskId/subtasks', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id=? AND user_id=?').get(req.params.taskId, uid(req));
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM subtasks WHERE task_id=? ORDER BY sort_order ASC, id ASC').all(req.params.taskId));
});

router.post('/tasks/:taskId/subtasks', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id=? AND user_id=?').get(req.params.taskId, uid(req));
  if (!task) return res.status(404).json({ error: 'Not found' });
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const r = db.prepare('INSERT INTO subtasks (task_id, user_id, title) VALUES (?,?,?)').run(req.params.taskId, uid(req), title.trim());
  res.json({ id: r.lastInsertRowid });
});

router.put('/subtasks/:id', (req, res) => {
  const { title, done, sort_order } = req.body;
  db.prepare('UPDATE subtasks SET title=COALESCE(?,title), done=COALESCE(?,done), sort_order=COALESCE(?,sort_order) WHERE id=? AND user_id=?')
    .run(title, done != null ? (done ? 1 : 0) : null, sort_order, req.params.id, uid(req));
  res.json({ ok: true });
});

router.delete('/subtasks/:id', (req, res) => {
  db.prepare('DELETE FROM subtasks WHERE id=? AND user_id=?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

// ── WIDGET LAYOUTS ─────────────────────────────────────────
router.get('/widgets/layout', (req, res) => {
  const row = db.prepare('SELECT layout_json FROM widget_layouts WHERE user_id=?').get(uid(req));
  if (!row) return res.json({ layout: defaultLayout() });
  try {
    res.json({ layout: JSON.parse(row.layout_json) });
  } catch {
    res.json({ layout: defaultLayout() });
  }
});

router.put('/widgets/layout', (req, res) => {
  const { layout } = req.body;
  if (!Array.isArray(layout)) return res.status(400).json({ error: 'layout must be array' });
  const json = JSON.stringify(layout);
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO widget_layouts (user_id, layout_json, updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET layout_json=excluded.layout_json, updated_at=excluded.updated_at')
    .run(uid(req), json, now);
  res.json({ ok: true });
});

function defaultLayout() {
  return [
    { id: 'stats', title: 'Stats', visible: true, order: 0 },
    { id: 'urgent', title: 'Urgent Tasks', visible: true, order: 1 },
    { id: 'pending', title: 'Pending Tasks', visible: true, order: 2 },
    { id: 'focus', title: 'Focus This Week', visible: true, order: 3 },
    { id: 'streak', title: 'Streak', visible: true, order: 4 },
    { id: 'insight', title: 'AI Insight', visible: true, order: 5 },
    { id: 'goals', title: 'Goals Progress', visible: false, order: 6 },
    { id: 'heatmap', title: 'Heatmap', visible: false, order: 7 },
  ];
}

// ── TIMER PRESETS ──────────────────────────────────────────
router.get('/timer/presets', (req, res) => {
  let rows = db.prepare('SELECT * FROM timer_presets WHERE user_id=? ORDER BY sort_order ASC, id ASC').all(uid(req));
  if (!rows.length) {
    // seed defaults for new users
    const defaults = [
      { name: 'Pomodoro', work: 25, brk: 5, long: 15, cycles: 4 },
      { name: 'Deep Work', work: 50, brk: 10, long: 30, cycles: 3 },
      { name: 'Quick Sprint', work: 15, brk: 3, long: 10, cycles: 4 },
    ];
    const stmt = db.prepare('INSERT INTO timer_presets (user_id,name,work_minutes,break_minutes,long_break_minutes,cycles_before_long,sort_order) VALUES (?,?,?,?,?,?,?)');
    defaults.forEach((d, i) => stmt.run(uid(req), d.name, d.work, d.brk, d.long, d.cycles, i));
    rows = db.prepare('SELECT * FROM timer_presets WHERE user_id=? ORDER BY sort_order ASC').all(uid(req));
  }
  res.json(rows);
});

router.post('/timer/presets', (req, res) => {
  const { name, work_minutes, break_minutes, long_break_minutes, cycles_before_long } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO timer_presets (user_id,name,work_minutes,break_minutes,long_break_minutes,cycles_before_long) VALUES (?,?,?,?,?,?)')
    .run(uid(req), name, work_minutes || 25, break_minutes || 5, long_break_minutes || 15, cycles_before_long || 4);
  res.json({ id: r.lastInsertRowid });
});

router.put('/timer/presets/:id', (req, res) => {
  const { name, work_minutes, break_minutes, long_break_minutes, cycles_before_long } = req.body;
  db.prepare('UPDATE timer_presets SET name=COALESCE(?,name), work_minutes=COALESCE(?,work_minutes), break_minutes=COALESCE(?,break_minutes), long_break_minutes=COALESCE(?,long_break_minutes), cycles_before_long=COALESCE(?,cycles_before_long) WHERE id=? AND user_id=?')
    .run(name, work_minutes, break_minutes, long_break_minutes, cycles_before_long, req.params.id, uid(req));
  res.json({ ok: true });
});

router.delete('/timer/presets/:id', (req, res) => {
  db.prepare('DELETE FROM timer_presets WHERE id=? AND user_id=?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

// ── TASK TAGS ──────────────────────────────────────────────
router.get('/tasks/:taskId/tags', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id=? AND user_id=?').get(req.params.taskId, uid(req));
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT tag FROM task_tags WHERE task_id=?').all(req.params.taskId).map(r => r.tag));
});

router.post('/tasks/:taskId/tags', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id=? AND user_id=?').get(req.params.taskId, uid(req));
  if (!task) return res.status(404).json({ error: 'Not found' });
  const { tag } = req.body;
  if (!tag?.trim()) return res.status(400).json({ error: 'Tag required' });
  db.prepare('INSERT OR IGNORE INTO task_tags (user_id, task_id, tag) VALUES (?,?,?)').run(uid(req), req.params.taskId, tag.trim().toLowerCase());
  res.json({ ok: true });
});

router.delete('/tasks/:taskId/tags/:tag', (req, res) => {
  db.prepare('DELETE FROM task_tags WHERE task_id=? AND user_id=? AND tag=?').run(req.params.taskId, uid(req), req.params.tag);
  res.json({ ok: true });
});

// ── LIGHTWEIGHT ANALYTICS EXTENSIONS ──────────────────────
// Tasks completed per day for last N days (for mini chart)
router.get('/analytics/daily', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 14, 60);
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = db.prepare(`
    SELECT date(completed_at,'unixepoch','localtime') as day, COUNT(*) as count
    FROM tasks WHERE user_id=? AND status='done' AND completed_at > ?
    GROUP BY day ORDER BY day ASC
  `).all(uid(req), since);
  res.json(rows);
});

// Focus time per category last 7 days
router.get('/analytics/focus-by-category', (req, res) => {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const rows = db.prepare(`
    SELECT COALESCE(c.name,'Uncategorized') as name, COALESCE(c.color,'#888') as color,
           SUM(fs.duration_minutes) as minutes, COUNT(*) as sessions
    FROM focus_sessions fs
    LEFT JOIN categories c ON fs.category_id = c.id
    WHERE fs.user_id=? AND fs.started_at > ?
    GROUP BY fs.category_id
    ORDER BY minutes DESC
  `).all(uid(req), since);
  res.json(rows);
});

// Task velocity: created vs completed by week
router.get('/analytics/velocity', (req, res) => {
  const since = Math.floor(Date.now() / 1000) - 28 * 86400;
  const created = db.prepare(`
    SELECT strftime('%Y-W%W', datetime(created_at,'unixepoch')) as week, COUNT(*) as n
    FROM tasks WHERE user_id=? AND created_at > ?
    GROUP BY week ORDER BY week ASC
  `).all(uid(req), since);
  const completed = db.prepare(`
    SELECT strftime('%Y-W%W', datetime(completed_at,'unixepoch')) as week, COUNT(*) as n
    FROM tasks WHERE user_id=? AND status='done' AND completed_at > ?
    GROUP BY week ORDER BY week ASC
  `).all(uid(req), since);
  res.json({ created, completed });
});

// Goal progress: task completion per goal
router.get('/analytics/goal-progress', (req, res) => {
  const rows = db.prepare(`
    SELECT g.id, g.title, g.status,
           COUNT(t.id) as total_tasks,
           SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done_tasks
    FROM goals g
    LEFT JOIN projects p ON p.goal_id = g.id
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE g.user_id=?
    GROUP BY g.id ORDER BY g.created_at DESC LIMIT 10
  `).all(uid(req));
  res.json(rows);
});

// ── PHASE 3: ACCEPT ADAPTIVE SUGGESTION ───────────────────────
// When user clicks "Accept" on a decomposition suggestion,
// create it as a new subtask on the original task.
router.post('/ai/suggestions/accept', (req, res) => {
  const { original_task_id, suggestion } = req.body;
  if (!suggestion?.trim()) return res.status(400).json({ error: 'suggestion required' });

  // Verify task ownership
  if (original_task_id) {
    const task = db.prepare('SELECT id FROM tasks WHERE id=? AND user_id=?').get(original_task_id, uid(req));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Add as subtask
    const r = db.prepare('INSERT INTO subtasks (task_id, user_id, title) VALUES (?,?,?)').run(original_task_id, uid(req), suggestion.trim());
    db.prepare('INSERT INTO adaptive_actions (user_id, original_task_id, suggestion, accepted) VALUES (?,?,?,1)').run(uid(req), original_task_id, suggestion.trim());
    return res.json({ ok: true, subtask_id: r.lastInsertRowid });
  }

  // No task id — just log the acceptance
  db.prepare('INSERT INTO adaptive_actions (user_id, suggestion, accepted) VALUES (?,?,1)').run(uid(req), suggestion.trim());
  res.json({ ok: true });
});

module.exports = router;
