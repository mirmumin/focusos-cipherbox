const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const { status, category_id, project_id, tag } = req.query;
  let q = `SELECT t.*, c.name as category_name, c.color as category_color, p.title as project_title,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id) as subtask_total,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id AND s.done=1) as subtask_done
    FROM tasks t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN projects p ON t.project_id = p.id WHERE t.user_id = ?`;
  const params = [req.session.userId];
  if (status) { q += ' AND t.status = ?'; params.push(status); }
  if (category_id) { q += ' AND t.category_id = ?'; params.push(category_id); }
  if (project_id) { q += ' AND t.project_id = ?'; params.push(project_id); }
  if (tag) { q += ' AND t.id IN (SELECT task_id FROM task_tags WHERE tag=? AND user_id=?)'; params.push(tag, req.session.userId); }
  q += ' ORDER BY t.sort_order ASC, t.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

router.post('/', (req, res) => {
  const { title, description, priority, difficulty, due_date, estimated_minutes, category_id, project_id, is_recurring, recur_interval } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const r = db.prepare(`INSERT INTO tasks (user_id, title, description, priority, difficulty, due_date, estimated_minutes, category_id, project_id, is_recurring, recur_interval) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.session.userId, title, description || null, priority || 2, difficulty || 2, due_date || null, estimated_minutes || null, category_id || null, project_id || null, is_recurring ? 1 : 0, recur_interval || null);
  res.json({ id: r.lastInsertRowid });
});

const RECUR_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };

router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const { title, description, priority, difficulty, due_date, estimated_minutes, category_id, project_id, status, sort_order, is_recurring, recur_interval } = req.body;
  const completed_at = status === 'done' ? Math.floor(Date.now() / 1000) : null;

  // Handle recurring task completion: reset to pending with shifted due_date
  if (status === 'done' && (is_recurring ?? task.is_recurring)) {
    const interval = recur_interval || task.recur_interval || 'weekly';
    const days = RECUR_DAYS[interval] || 7;
    const base = task.due_date ? task.due_date * 1000 : Date.now();
    const nextDue = Math.floor((base + days * 86400000) / 1000);
    db.prepare("UPDATE tasks SET status='pending', due_date=?, completed_at=NULL WHERE id=?").run(nextDue, req.params.id);
    return res.json({ ok: true, recurred: true, next_due: nextDue });
  }

  db.prepare(`UPDATE tasks SET title=COALESCE(?,title), description=COALESCE(?,description), priority=COALESCE(?,priority), difficulty=COALESCE(?,difficulty), due_date=?, estimated_minutes=COALESCE(?,estimated_minutes), category_id=COALESCE(?,category_id), project_id=COALESCE(?,project_id), status=COALESCE(?,status), sort_order=COALESCE(?,sort_order), completed_at=COALESCE(?,completed_at), is_recurring=COALESCE(?,is_recurring), recur_interval=COALESCE(?,recur_interval) WHERE id=?`
  ).run(title, description, priority, difficulty, due_date ?? null, estimated_minutes, category_id, project_id, status, sort_order, completed_at, is_recurring != null ? (is_recurring ? 1 : 0) : null, recur_interval, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
