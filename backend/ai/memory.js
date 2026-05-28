// ── AI MEMORY SYSTEM (Phase 3) ────────────────────────────────
// Lightweight rule-based memory using SQLite only.
// No vectors, no embeddings, no external AI for memory ops.

const db = require('../database/db');

// ── CORE MEMORY OPS ──────────────────────────────────────────
function getMemory(userId) {
  const rows = db.prepare('SELECT memory_key, memory_value FROM ai_memory WHERE user_id=?').all(userId);
  return Object.fromEntries(rows.map(r => [r.memory_key, r.memory_value]));
}

function setMemory(userId, key, value) {
  db.prepare('INSERT OR REPLACE INTO ai_memory (user_id, memory_key, memory_value, updated_at) VALUES (?,?,?,unixepoch())')
    .run(userId, key, String(value));
}

// ── DEEP ANALYTICS UPDATE ─────────────────────────────────────
// Called on every AI interaction to keep memory fresh.
function updateMemoryFromAnalytics(userId) {
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 604800;
  const twoWeeksAgo = now - 1209600;
  const monthAgo = now - 2592000;

  // ── Weekly completion rate
  const done7  = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status="done" AND completed_at > ?').get(userId, weekAgo).n;
  const made7  = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND created_at > ?').get(userId, weekAgo).n;
  if (made7 > 0) setMemory(userId, 'weekly_completion_rate', Math.round(done7 / made7 * 100));

  // ── Prev-week completion rate (for trend)
  const done14 = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status="done" AND completed_at BETWEEN ? AND ?').get(userId, twoWeeksAgo, weekAgo).n;
  const made14 = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND created_at BETWEEN ? AND ?').get(userId, twoWeeksAgo, weekAgo).n;
  if (made14 > 0) setMemory(userId, 'prev_week_completion_rate', Math.round(done14 / made14 * 100));

  // ── Most procrastinated category (overdue tasks)
  const overdue = db.prepare(`
    SELECT c.name, COUNT(*) as n FROM tasks t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id=? AND t.status=\'pending\' AND t.due_date < unixepoch()
    GROUP BY c.id ORDER BY n DESC LIMIT 1
  `).get(userId);
  if (overdue) setMemory(userId, 'most_procrastinated_category', overdue.name);

  // ── Category with most hard-failed tasks (difficulty 4-5, overdue)
  const hardFail = db.prepare(`
    SELECT COALESCE(c.name,'Uncategorized') as name, COUNT(*) as n FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id=? AND t.difficulty >= 4 AND t.status=\'pending\' AND t.due_date < unixepoch()
    GROUP BY t.category_id ORDER BY n DESC LIMIT 1
  `).get(userId);
  if (hardFail) setMemory(userId, 'hard_fail_category', hardFail.name);

  const hardFailCount = db.prepare(`
    SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND difficulty>=4 AND status=\'pending\' AND due_date < unixepoch()
  `).get(userId).n;
  setMemory(userId, 'hard_task_overdue_count', hardFailCount);

  // ── Avg focus session
  const focus = db.prepare('SELECT AVG(duration_minutes) as m, COUNT(*) as n FROM focus_sessions WHERE user_id=? AND started_at > ?').get(userId, weekAgo);
  if (focus?.m) {
    setMemory(userId, 'avg_focus_minutes', Math.round(focus.m));
    setMemory(userId, 'focus_sessions_this_week', focus.n);
  }

  // ── Peak focus hour (mode of focus session start hours)
  const focusHours = db.prepare(`
    SELECT strftime('%H', datetime(started_at,'unixepoch')) as hr, COUNT(*) as n
    FROM focus_sessions WHERE user_id=? AND started_at > ?
    GROUP BY hr ORDER BY n DESC LIMIT 1
  `).get(userId, monthAgo);
  if (focusHours) setMemory(userId, 'peak_focus_hour', parseInt(focusHours.hr));

  // ── Avg mood & energy
  const mood = db.prepare('SELECT AVG(mood) as m, AVG(energy) as e, AVG(stress) as s FROM energy_logs WHERE user_id=? AND created_at > ?').get(userId, weekAgo);
  if (mood?.m) {
    setMemory(userId, 'avg_mood', (mood.m).toFixed(1));
    setMemory(userId, 'avg_energy', (mood.e || 3).toFixed(1));
    setMemory(userId, 'avg_stress', (mood.s || 3).toFixed(1));
  }

  // ── Mood trend (comparing last 7 vs prev 7)
  const prevMood = db.prepare('SELECT AVG(mood) as m FROM energy_logs WHERE user_id=? AND created_at BETWEEN ? AND ?').get(userId, twoWeeksAgo, weekAgo);
  if (mood?.m && prevMood?.m) {
    const delta = mood.m - prevMood.m;
    const trend = delta > 0.3 ? 'improving' : delta < -0.3 ? 'declining' : 'stable';
    setMemory(userId, 'mood_trend', trend);
  }

  // ── Reflection mood trend (last 5 reflections)
  const reflMoods = db.prepare('SELECT mood FROM reflections WHERE user_id=? AND mood IS NOT NULL ORDER BY date DESC LIMIT 5').all(userId);
  if (reflMoods.length >= 3) {
    const avg = reflMoods.reduce((a, r) => a + r.mood, 0) / reflMoods.length;
    setMemory(userId, 'reflection_avg_mood', avg.toFixed(1));
    const firstHalf = reflMoods.slice(0, 2).reduce((a, r) => a + r.mood, 0) / 2;
    const lastHalf  = reflMoods.slice(-2).reduce((a, r) => a + r.mood, 0) / 2;
    setMemory(userId, 'reflection_mood_trend', firstHalf >= lastHalf ? 'declining' : 'improving');
  }

  // ── Consistency streak
  const streak = db.prepare(`
    SELECT COUNT(DISTINCT date(completed_at,'unixepoch')) as n
    FROM tasks WHERE user_id=? AND status='done' AND completed_at > ?
  `).get(userId, weekAgo).n;
  setMemory(userId, 'active_days_this_week', streak);

  // ── Task difficulty distribution
  const avgDiff = db.prepare('SELECT AVG(difficulty) as d FROM tasks WHERE user_id=? AND status=\'pending\'').get(userId);
  if (avgDiff?.d) setMemory(userId, 'avg_pending_difficulty', avgDiff.d.toFixed(1));

  // ── Overload signal: pending tasks count
  const pendingCount = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status=\'pending\'').get(userId).n;
  setMemory(userId, 'pending_task_count', pendingCount);

  // ── Longest focus session (personal best)
  const best = db.prepare('SELECT MAX(duration_minutes) as m FROM focus_sessions WHERE user_id=?').get(userId);
  if (best?.m) setMemory(userId, 'best_focus_minutes', best.m);

  // ── Deep work habit (sessions > 45 min last week)
  const deepWork = db.prepare('SELECT COUNT(*) as n FROM focus_sessions WHERE user_id=? AND duration_minutes >= 45 AND started_at > ?').get(userId, weekAgo).n;
  setMemory(userId, 'deep_work_sessions_this_week', deepWork);

  // ── Timestamp of last memory refresh
  setMemory(userId, 'memory_last_updated', now);
}

// ── BURNOUT DETECTION ─────────────────────────────────────────
// Returns { score, risk, signals[] } — pure rule-based, explainable.
function detectBurnout(userId) {
  const mem = getMemory(userId);
  const signals = [];
  let score = 0;

  const rate     = parseFloat(mem.weekly_completion_rate || 50);
  const prevRate = parseFloat(mem.prev_week_completion_rate || 50);
  const hardFail = parseInt(mem.hard_task_overdue_count || 0);
  const avgMood  = parseFloat(mem.avg_mood || 3);
  const avgStress= parseFloat(mem.avg_stress || 3);
  const pending  = parseInt(mem.pending_task_count || 0);
  const activeDays = parseInt(mem.active_days_this_week || 0);
  const moodTrend  = mem.mood_trend || 'stable';
  const reflTrend  = mem.reflection_mood_trend || 'stable';

  // Rule 1: Low completion rate this week
  if (rate < 20) { score += 3; signals.push('Very low task completion this week (' + rate + '%)'); }
  else if (rate < 40) { score += 1; signals.push('Below average completion (' + rate + '%)'); }

  // Rule 2: Declining completion trend
  if (prevRate - rate > 20) { score += 2; signals.push('Completion rate dropping vs last week'); }

  // Rule 3: Many hard tasks failing
  if (hardFail >= 5) { score += 3; signals.push(hardFail + ' hard tasks overdue — possible overwhelm'); }
  else if (hardFail >= 3) { score += 1; signals.push(hardFail + ' hard tasks overdue'); }

  // Rule 4: Low mood
  if (avgMood < 2.5) { score += 2; signals.push('Low average mood (' + avgMood + '/5)'); }
  else if (avgMood < 3.2) { score += 1; signals.push('Below average mood'); }

  // Rule 5: High stress
  if (avgStress >= 4) { score += 2; signals.push('High stress level (' + avgStress + '/5)'); }

  // Rule 6: Overloaded task queue
  if (pending >= 30) { score += 2; signals.push('Task backlog overloaded (' + pending + ' pending)'); }
  else if (pending >= 20) { score += 1; signals.push('Large task backlog (' + pending + ' pending)'); }

  // Rule 7: Inactivity
  if (activeDays === 0) { score += 2; signals.push('No completed tasks this week'); }
  else if (activeDays <= 2) { score += 1; signals.push('Low active days (' + activeDays + '/7)'); }

  // Rule 8: Declining mood trends
  if (moodTrend === 'declining') { score += 1; signals.push('Energy log mood declining this week'); }
  if (reflTrend === 'declining') { score += 1; signals.push('Reflection mood trending down'); }

  const risk = score >= 7 ? 'high' : score >= 4 ? 'medium' : score >= 2 ? 'low' : 'none';
  return { score, risk, signals };
}

// ── ADAPTIVE DIFFICULTY SUGGESTIONS ──────────────────────────
// Returns smaller, more achievable task suggestions for failing tasks.
function getAdaptiveSuggestions(userId) {
  const hardFailingTasks = db.prepare(`
    SELECT t.id, t.title, t.difficulty, t.estimated_minutes, COALESCE(c.name,'') as category
    FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id=? AND t.difficulty >= 4 AND t.status=\'pending\'
    AND t.due_date < unixepoch() AND t.due_date IS NOT NULL
    ORDER BY t.created_at ASC LIMIT 5
  `).all(userId);

  return hardFailingTasks.map(t => ({
    original_id: t.id,
    original: t.title,
    category: t.category,
    suggestion: decomposeSuggestion(t.title, t.category),
    reason: `"${t.title}" is overdue & high difficulty — breaking it down reduces overwhelm`
  }));
}

// Rule-based decomposition heuristics
function decomposeSuggestion(title, category) {
  const low = title.toLowerCase();
  // Academic writing
  if (low.includes('write') || low.includes('essay') || low.includes('thesis') || low.includes('report'))
    return `Write a rough outline for: ${title}`;
  if (low.includes('read') || low.includes('chapter') || low.includes('textbook'))
    return `Read first 10 pages of: ${title.replace(/read/i,'').trim() || title}`;
  if (low.includes('study') || low.includes('review') || low.includes('prepare'))
    return `Spend 20 min reviewing key points: ${title}`;
  // Code/project work
  if (low.includes('implement') || low.includes('build') || low.includes('create') || low.includes('code'))
    return `Sketch the structure/design for: ${title}`;
  if (low.includes('fix') || low.includes('debug') || low.includes('bug'))
    return `Reproduce and document the issue: ${title}`;
  if (low.includes('test') || low.includes('check'))
    return `Write one test case for: ${title}`;
  // Research
  if (low.includes('research') || low.includes('find') || low.includes('look'))
    return `Spend 15 min searching key sources for: ${title}`;
  // Generic fallback
  return `Do a 15-min start on: ${title}`;
}

// ── SMART REMINDERS (rule-based, in-app) ─────────────────────
// Returns a list of reminder messages based on user patterns.
function getSmartReminders(userId) {
  updateMemoryFromAnalytics(userId);
  const mem = getMemory(userId);
  const reminders = [];
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun

  const peakHour    = parseInt(mem.peak_focus_hour || 9);
  const activeDays  = parseInt(mem.active_days_this_week || 0);
  const pending     = parseInt(mem.pending_task_count || 0);
  const rate        = parseFloat(mem.weekly_completion_rate || 50);
  const procrastCat = mem.most_procrastinated_category;
  const hardFail    = parseInt(mem.hard_task_overdue_count || 0);
  const deepWork    = parseInt(mem.deep_work_sessions_this_week || 0);
  const burnout     = detectBurnout(userId);

  // 1. Deep work window approaching
  if (Math.abs(hour - peakHour) <= 1 && hour < peakHour + 2) {
    reminders.push({ type: 'focus', priority: 'high', msg: `⏱ Peak focus window: your best deep work tends to happen around ${peakHour}:00.` });
  }

  // 2. Procrastination pattern
  if (procrastCat) {
    const overdueInCat = db.prepare(`
      SELECT COUNT(*) as n FROM tasks t JOIN categories c ON t.category_id=c.id
      WHERE t.user_id=? AND c.name=? AND t.status=\'pending\' AND t.due_date < unixepoch()
    `).get(userId, procrastCat).n;
    if (overdueInCat >= 2) {
      reminders.push({ type: 'procrastination', priority: 'medium', msg: `📌 ${overdueInCat} overdue tasks in "${procrastCat}" — tackle one small piece today.` });
    }
  }

  // 3. Consistency gap (no tasks done today yet, past noon)
  if (hour >= 12) {
    const todayDone = db.prepare(`
      SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND status='done'
      AND date(completed_at,'unixepoch')=date('now','localtime')
    `).get(userId).n;
    if (todayDone === 0) {
      reminders.push({ type: 'consistency', priority: 'medium', msg: `🎯 No tasks completed yet today — even one small win builds momentum.` });
    }
  }

  // 4. Recovery suggestion on burnout risk
  if (burnout.risk === 'high') {
    reminders.push({ type: 'recovery', priority: 'high', msg: `🌿 High burnout risk detected. Consider a lighter day: 1–2 easy tasks max, and a 15-min walk.` });
  } else if (burnout.risk === 'medium') {
    reminders.push({ type: 'recovery', priority: 'medium', msg: `⚡ Energy dipping. Try a short recovery session — 20 min light task + 10 min break.` });
  }

  // 5. Overloaded backlog
  if (pending >= 25) {
    reminders.push({ type: 'overload', priority: 'medium', msg: `📋 ${pending} pending tasks — consider archiving or splitting 3–5 tasks to reduce the load.` });
  }

  // 6. Encourage deep work if lacking
  if (deepWork === 0 && dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9) {
    reminders.push({ type: 'deep_work', priority: 'low', msg: `🧠 No deep work sessions this week yet. Even a 30-min focused block makes a difference.` });
  }

  // 7. Hard task decomposition reminder
  if (hardFail >= 3) {
    reminders.push({ type: 'adaptive', priority: 'medium', msg: `💡 ${hardFail} hard tasks are overdue. Check AI Suggestions to break them into smaller steps.` });
  }

  // 8. End-of-week reflection nudge
  if (dayOfWeek === 5 && hour >= 15) {
    const todayRefl = db.prepare(`SELECT id FROM reflections WHERE user_id=? AND date=date('now','localtime')`).get(userId);
    if (!todayRefl) {
      reminders.push({ type: 'reflection', priority: 'low', msg: `🌙 End of week — write a quick reflection to track your progress and mood.` });
    }
  }

  return reminders.slice(0, 5); // max 5 reminders shown
}

// ── PERSONALIZED PLANNING CONTEXT ────────────────────────────
// Builds rich context string for the AI planner prompt.
function buildMemoryContext(userId) {
  updateMemoryFromAnalytics(userId);
  const mem = getMemory(userId);
  const burnout = detectBurnout(userId);

  if (!Object.keys(mem).length) return '';

  const lines = [];
  lines.push('USER MEMORY CONTEXT:');

  if (mem.weekly_completion_rate)   lines.push(`- Weekly completion rate: ${mem.weekly_completion_rate}%`);
  if (mem.prev_week_completion_rate) lines.push(`- Prev-week completion rate: ${mem.prev_week_completion_rate}%`);
  if (mem.mood_trend)               lines.push(`- Mood trend: ${mem.mood_trend}`);
  if (mem.avg_mood)                 lines.push(`- Avg mood: ${mem.avg_mood}/5, avg energy: ${mem.avg_energy || '?'}/5, avg stress: ${mem.avg_stress || '?'}/5`);
  if (mem.peak_focus_hour)          lines.push(`- Peak focus hour: ${mem.peak_focus_hour}:00`);
  if (mem.avg_focus_minutes)        lines.push(`- Avg focus session: ${mem.avg_focus_minutes} min`);
  if (mem.best_focus_minutes)       lines.push(`- Personal best focus: ${mem.best_focus_minutes} min`);
  if (mem.deep_work_sessions_this_week) lines.push(`- Deep work sessions this week: ${mem.deep_work_sessions_this_week}`);
  if (mem.most_procrastinated_category) lines.push(`- Most procrastinated category: ${mem.most_procrastinated_category}`);
  if (mem.hard_fail_category)       lines.push(`- Category with most hard fails: ${mem.hard_fail_category}`);
  if (mem.hard_task_overdue_count && parseInt(mem.hard_task_overdue_count) > 0)
    lines.push(`- Hard tasks overdue: ${mem.hard_task_overdue_count}`);
  if (mem.pending_task_count)       lines.push(`- Total pending tasks: ${mem.pending_task_count}`);
  if (mem.active_days_this_week)    lines.push(`- Active days this week: ${mem.active_days_this_week}/7`);
  if (mem.reflection_mood_trend)    lines.push(`- Reflection mood trend: ${mem.reflection_mood_trend}`);

  // Burnout summary for planner
  lines.push(`- Burnout risk: ${burnout.risk}${burnout.signals.length ? ' [' + burnout.signals[0] + ']' : ''}`);

  return lines.join('\n');
}

module.exports = { getMemory, setMemory, buildMemoryContext, detectBurnout, getAdaptiveSuggestions, getSmartReminders, updateMemoryFromAnalytics };
