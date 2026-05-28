// ── AI ROUTES (Phase 3) ──────────────────────────────────────
const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { callGemini } = require('../ai/gemini');
const { callGroq } = require('../ai/groq');
const { buildMemoryContext, detectBurnout, getAdaptiveSuggestions, getSmartReminders, updateMemoryFromAnalytics } = require('../ai/memory');
const router = express.Router();

router.use(requireAuth);
const uid = req => req.session.userId;

// ── AI PLAN ───────────────────────────────────────────────────
router.post('/plan', async (req, res) => {
  const { available_hours, energy_level, focus_mode, context } = req.body;
  const u = uid(req);

  const pending = db.prepare(`
    SELECT t.title, t.priority, t.difficulty, t.estimated_minutes, t.due_date,
           COALESCE(c.name,'General') as category
    FROM tasks t LEFT JOIN categories c ON t.category_id=c.id
    WHERE t.user_id=? AND t.status='pending'
    ORDER BY t.priority DESC, t.due_date ASC LIMIT 15
  `).all(u);

  const memory = buildMemoryContext(u);
  const burnout = detectBurnout(u);
  const today = new Date().toDateString();

  // Adaptive planning: inject burnout awareness into prompt
  const burnoutNote = burnout.risk === 'high'
    ? '\nIMPORTANT: User shows HIGH burnout risk. Generate a lighter recovery plan — max 3 tasks, short blocks, include a rest block.'
    : burnout.risk === 'medium'
    ? '\nNOTE: User shows medium burnout risk. Keep workload moderate, include breaks.'
    : '';

  const prompt = `You are a personal productivity AI coach with memory of this user's patterns. Create a realistic daily plan.

${memory}
${burnoutNote}

TODAY: ${today}
Available hours: ${available_hours || 4}
Energy level: ${energy_level || 'medium'} (low/medium/high)
Focus mode: ${focus_mode || 'normal'}
User context: ${context || 'none'}

PENDING TASKS (priority-sorted, up to 15):
${pending.map((t, i) => `${i+1}. [${t.category}] ${t.title} | priority:${t.priority}/5 | difficulty:${t.difficulty}/5 | est:${t.estimated_minutes||'?'}min | due:${t.due_date ? new Date(t.due_date*1000).toLocaleDateString() : 'none'}`).join('\n')}

Use the memory context to:
- Schedule deep work during the user's peak focus hour if known
- Put procrastinated categories earlier in the day
- Avoid stacking multiple high-difficulty tasks back-to-back
- Add recovery blocks if burnout risk is present

Respond in this exact JSON format:
{
  "summary": "one sentence overview",
  "blocks": [
    {"time": "9:00 AM", "duration": 90, "task": "task title", "category": "cat", "type": "deep_work|light|break|review", "note": "brief tip"}
  ],
  "skip_suggestions": ["task name - reason"],
  "coach_message": "2-3 sentence coaching message referencing user patterns",
  "focus_tip": "one actionable focus tip personalized to this user",
  "burnout_note": "${burnout.risk !== 'none' ? 'Brief burnout-aware recommendation' : ''}"
}
Only respond with valid JSON, no markdown.`;

  try {
    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);

    const today_str = new Date().toISOString().split('T')[0];
    db.prepare('INSERT OR REPLACE INTO daily_plans (user_id, date, plan_json, input_json) VALUES (?,?,?,?)')
      .run(u, today_str, JSON.stringify(plan), JSON.stringify(req.body));

    res.json({ ...plan, burnout_risk: burnout.risk });
  } catch (e) {
    res.status(500).json({ error: 'AI planning failed: ' + e.message });
  }
});

// ── REFLECT + ANALYSIS ────────────────────────────────────────
router.post('/reflect', async (req, res) => {
  const { content, mood, energy, productivity } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const u = uid(req);
  const memory = buildMemoryContext(u);

  // Detect mood keywords for extra signal
  const moodKeywords = ['tired', 'exhausted', 'overwhelmed', 'stressed', 'burned out', 'unmotivated', 'anxious']
    .filter(k => content.toLowerCase().includes(k));

  const prompt = `You are a personal productivity coach analyzing a daily reflection.

${memory}

REFLECTION:
Mood: ${mood}/5 | Energy: ${energy}/5 | Productivity: ${productivity}/5
Entry: "${content}"
Mood signals detected: ${moodKeywords.join(', ') || 'none'}

Respond in this exact JSON format:
{
  "analysis": "2-3 sentence analysis of patterns, referencing memory if relevant",
  "burnout_signal": true/false,
  "motivation_trend": "improving|stable|declining",
  "mood_signals": ["specific signal 1", "signal 2"],
  "suggestions": ["actionable suggestion 1", "suggestion 2"],
  "tomorrow_plan": "one sentence lighter/heavier day recommendation for tomorrow",
  "encouragement": "one warm, specific encouraging sentence"
}
Only respond with valid JSON, no markdown.`;

  try {
    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

    // Store analysis on today's reflection
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare('SELECT id FROM reflections WHERE user_id=? AND date=?').get(u, today);
    if (existing) {
      db.prepare('UPDATE reflections SET ai_analysis=? WHERE id=?').run(JSON.stringify(analysis), existing.id);
    }

    // If burnout signal detected, bump the memory
    if (analysis.burnout_signal) {
      const { setMemory } = require('../ai/memory');
      setMemory(u, 'last_burnout_signal_date', today);
    }

    res.json(analysis);
  } catch (e) {
    res.status(500).json({ error: 'AI reflection failed' });
  }
});

// ── COACH ─────────────────────────────────────────────────────
router.post('/coach', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Question required' });

  const memory = buildMemoryContext(uid(req));
  const prompt = `You are a personal productivity and study coach. Be concise and practical.

${memory}

User question: "${question}"

Give a helpful, focused response in 2-4 sentences. Be direct, motivating, and specific to their situation based on their memory context.`;

  try {
    const answer = await callGroq(prompt, 512);
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: 'AI unavailable' });
  }
});

// ── INSIGHT ───────────────────────────────────────────────────
router.get('/insight', async (req, res) => {
  const u = uid(req);
  const memory = buildMemoryContext(u);
  const burnout = detectBurnout(u);

  const prompt = `${memory}

Burnout risk: ${burnout.risk}. Signals: ${burnout.signals.join('; ') || 'none'}

Give one sharp, personalized productivity insight for this user. 1-2 sentences. Be specific, actionable, and reference their actual patterns.`;

  try {
    const insight = await callGroq(prompt, 256);
    res.json({ insight: insight.trim(), burnout_risk: burnout.risk });
  } catch (e) {
    res.json({ insight: 'Keep making consistent progress — every small task completed builds momentum.', burnout_risk: burnout.risk });
  }
});

// ── BURNOUT STATUS (no AI call needed) ───────────────────────
router.get('/burnout', (req, res) => {
  updateMemoryFromAnalytics(uid(req));
  const result = detectBurnout(uid(req));
  res.json(result);
});

// ── ADAPTIVE SUGGESTIONS ──────────────────────────────────────
router.get('/suggestions', (req, res) => {
  const suggestions = getAdaptiveSuggestions(uid(req));
  res.json(suggestions);
});

// ── SMART REMINDERS ───────────────────────────────────────────
router.get('/reminders', (req, res) => {
  const reminders = getSmartReminders(uid(req));
  res.json(reminders);
});

// ── MEMORY DUMP (dev/debug view) ──────────────────────────────
router.get('/memory', (req, res) => {
  updateMemoryFromAnalytics(uid(req));
  const { getMemory } = require('../ai/memory');
  res.json(getMemory(uid(req)));
});

// ── SUGGESTION HISTORY ───────────────────────────────────────
router.get('/suggestions/history', (req, res) => {
  const rows = db.prepare(`SELECT aa.id, aa.suggestion, aa.accepted, aa.created_at, t.title as task_title
    FROM adaptive_actions aa LEFT JOIN tasks t ON aa.original_task_id = t.id
    WHERE aa.user_id = ? ORDER BY aa.created_at DESC LIMIT 50`).all(uid(req));
  res.json(rows);
});

module.exports = router;
