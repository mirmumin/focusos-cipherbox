// ── PHASE 3: AI MEMORY, BURNOUT, REMINDERS, ADAPTIVE ─────────
// All functions are additive — they extend existing views.

// ── SMART REMINDERS BANNER ────────────────────────────────────
async function loadSmartReminders() {
  const container = document.getElementById('smart-reminders');
  if (!container) return;
  try {
    const reminders = await api('GET', '/ai/reminders');
    if (!reminders.length) { container.innerHTML = ''; return; }
    container.innerHTML = reminders.map(r => `
      <div class="reminder-item reminder-${r.priority}" data-type="${r.type}">
        ${escHtml(r.msg)}
        <button class="reminder-dismiss" onclick="dismissReminder(this)">×</button>
      </div>
    `).join('');
  } catch(e) { container.innerHTML = ''; }
}

function dismissReminder(btn) {
  btn.closest('.reminder-item').style.display = 'none';
}

// ── BURNOUT WIDGET ────────────────────────────────────────────
async function renderBurnoutWidget(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  try {
    const b = await api('GET', '/ai/burnout');
    const colorMap = { none: 'var(--accent)', low: '#ffaa00', medium: '#ff8800', high: 'var(--accent3)' };
    const labelMap = { none: '✓ No Burnout Risk', low: '⚡ Low Risk', medium: '⚠ Medium Risk', high: '🔥 High Risk' };
    const scoreBar = Math.min(b.score * 7, 100);

    c.innerHTML = `
      <div class="card-title">◆ BURNOUT STATUS</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="font-size:1.1rem;font-weight:700;color:${colorMap[b.risk]}">${labelMap[b.risk]}</div>
        <div style="font-size:0.75rem;color:var(--text3)">score: ${b.score}/12</div>
      </div>
      <div class="bar-track" style="height:6px;margin-bottom:10px">
        <div class="bar-fill" style="width:${scoreBar}%;background:${colorMap[b.risk]};height:6px;transition:width 0.5s"></div>
      </div>
      ${b.signals.length ? `
        <div style="font-size:0.72rem;color:var(--text3)">
          ${b.signals.map(s => `<div>• ${escHtml(s)}</div>`).join('')}
        </div>` : '<div style="font-size:0.72rem;color:var(--text3)">No significant signals detected.</div>'}
      ${b.risk !== 'none' ? `<button class="btn btn-sm btn-accent mt" onclick="showView('planner')">→ Get Recovery Plan</button>` : ''}
    `;
  } catch(e) { c.innerHTML = '<div class="empty">burnout data unavailable</div>'; }
}

// ── ADAPTIVE SUGGESTIONS PANEL ────────────────────────────────
async function renderAdaptiveSuggestions(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  try {
    const suggestions = await api('GET', '/ai/suggestions');
    if (!suggestions.length) {
      c.innerHTML = '<div class="empty">no hard-failing tasks — good work!</div>';
      return;
    }
    c.innerHTML = suggestions.map(s => `
      <div class="adaptive-card" id="ac-${s.original_id}">
        <div style="font-size:0.72rem;color:var(--text3);margin-bottom:2px">OVERDUE HIGH-DIFFICULTY TASK</div>
        <div style="color:var(--accent3);text-decoration:line-through;font-size:0.85rem;margin-bottom:4px">${escHtml(s.original)}</div>
        <div style="color:var(--accent);font-weight:600;margin-bottom:4px">→ ${escHtml(s.suggestion)}</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-bottom:8px">${escHtml(s.reason)}</div>
        <div class="flex-gap">
          <button class="btn btn-sm btn-accent" onclick="acceptAdaptiveSuggestion(${s.original_id}, '${escHtml(s.suggestion).replace(/'/g,'\\x27')}', this)">✓ Accept (add as subtask)</button>
          <button class="btn btn-sm" onclick="document.getElementById('ac-${s.original_id}').style.display='none'">dismiss</button>
        </div>
      </div>
    `).join('');
  } catch(e) { c.innerHTML = '<div class="empty">suggestions unavailable</div>'; }
}

async function acceptAdaptiveSuggestion(taskId, suggestion, btn) {
  try {
    await api('POST', '/ai/suggestions/accept', { original_task_id: taskId, suggestion });
    btn.closest('.adaptive-card').innerHTML = `<div style="color:var(--accent);padding:8px">✓ Added as subtask to task #${taskId}</div>`;
    toast('Subtask created from suggestion');
  } catch(e) { toast('Failed: ' + e.message, true); }
}

// ── AI MEMORY PANEL ───────────────────────────────────────────
async function renderMemoryPanel(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '<div class="loading">◦◦◦ loading memory...</div>';
  try {
    const mem = await api('GET', '/ai/memory');
    const keys = Object.keys(mem);
    if (!keys.length) { c.innerHTML = '<div class="empty">no memory yet — use the app more to build context</div>'; return; }

    const categories = {
      'Performance': ['weekly_completion_rate','prev_week_completion_rate','active_days_this_week','deep_work_sessions_this_week'],
      'Focus': ['avg_focus_minutes','best_focus_minutes','peak_focus_hour','focus_sessions_this_week'],
      'Wellbeing': ['avg_mood','avg_energy','avg_stress','mood_trend','reflection_avg_mood','reflection_mood_trend'],
      'Patterns': ['most_procrastinated_category','hard_fail_category','hard_task_overdue_count','pending_task_count','avg_pending_difficulty'],
      'Burnout': ['burnout_risk','last_burnout_signal_date'],
    };

    const fmt = (k, v) => {
      if (k.includes('rate')) return v + '%';
      if (k.includes('hour')) return v + ':00';
      if (k.includes('minutes')) return v + ' min';
      if (k === 'memory_last_updated') return new Date(parseInt(v)*1000).toLocaleString();
      return v;
    };

    let html = '';
    for (const [cat, catKeys] of Object.entries(categories)) {
      const relevant = catKeys.filter(k => mem[k] !== undefined);
      if (!relevant.length) continue;
      html += `<div class="memory-section"><div class="label">${cat}</div>`;
      html += relevant.map(k => `
        <div class="memory-row">
          <span class="memory-key">${k.replace(/_/g,' ')}</span>
          <span class="memory-val">${escHtml(fmt(k, mem[k]))}</span>
        </div>`).join('');
      html += '</div>';
    }

    // Show any remaining keys not in categories
    const allCatKeys = Object.values(categories).flat();
    const remaining = keys.filter(k => !allCatKeys.includes(k) && k !== 'memory_last_updated');
    if (remaining.length) {
      html += `<div class="memory-section"><div class="label">Other</div>`;
      html += remaining.map(k => `
        <div class="memory-row">
          <span class="memory-key">${k.replace(/_/g,' ')}</span>
          <span class="memory-val">${escHtml(mem[k])}</span>
        </div>`).join('');
      html += '</div>';
    }

    if (mem.memory_last_updated) {
      html += `<div style="font-size:0.68rem;color:var(--text3);margin-top:8px">Last updated: ${new Date(parseInt(mem.memory_last_updated)*1000).toLocaleString()}</div>`;
    }
    c.innerHTML = html;
  } catch(e) { c.innerHTML = '<div class="empty">memory panel unavailable</div>'; }
}

// ── ENHANCED PLANNER: inject burnout-aware UI ─────────────────
// Called from renderPlanner() in app.js — injects burnout panel
async function injectBurnoutToPlan(containerId) {
  const b = await api('GET', '/ai/burnout').catch(() => null);
  if (!b || b.risk === 'none') return;
  const c = document.getElementById(containerId);
  if (!c) return;
  const colorMap = { low: '#ffaa00', medium: '#ff8800', high: 'var(--accent3)' };
  const existing = c.innerHTML;
  c.innerHTML = `
    <div class="ai-block" style="border-color:${colorMap[b.risk]};margin-bottom:1rem">
      <div class="label">⚠ BURNOUT ${b.risk.toUpperCase()} RISK</div>
      ${b.signals.slice(0,2).map(s => `<div style="font-size:0.8rem">• ${escHtml(s)}</div>`).join('')}
      <div style="font-size:0.8rem;margin-top:6px;color:var(--text2)">Plan has been adapted for your current state.</div>
    </div>
  ` + existing;
}

// ── REFLECTION: mood trend badge ─────────────────────────────
function getMoodTrendBadge(reflections) {
  if (reflections.length < 3) return '';
  const recent = reflections.slice(0, 5).map(r => r.mood || 3);
  const avg = recent.reduce((a,b) => a+b,0) / recent.length;
  const trend = recent[0] > recent[recent.length-1] ? '↓ declining' : recent[0] < recent[recent.length-1] ? '↑ improving' : '→ stable';
  const color = trend.includes('↓') ? 'var(--accent3)' : trend.includes('↑') ? 'var(--accent)' : 'var(--text3)';
  return `<span style="font-size:0.75rem;color:${color};margin-left:8px">${trend} (avg: ${avg.toFixed(1)}/5)</span>`;
}


// ── CALENDAR VIEW ─────────────────────────────────────────────
let calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

async function renderCalendar() {
  const v = el('view-calendar');
  v.innerHTML = '<div class="loading">loading calendar...</div>';
  try {
    const tasks = await api('GET', '/tasks');
    _drawCalendar(v, tasks);
  } catch(e) { v.innerHTML = '<div class="error-msg">Calendar unavailable</div>'; }
}

function _drawCalendar(v, tasks) {
  const { year, month } = calState;
  const now = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Index tasks by day of month
  const byDay = {};
  tasks.forEach(t => {
    if (!t.due_date) return;
    const d = new Date(t.due_date * 1000);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(t);
    }
  });

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let cells = '';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) cells += '<div class="cal-cell cal-empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
    const dayTasks = byDay[d] || [];
    const overdue = dayTasks.filter(t => t.due_date * 1000 < Date.now() && t.status !== 'done').length;
    cells += `
      <div class="cal-cell${isToday ? ' cal-today' : ''}${overdue > 0 ? ' cal-overdue' : ''}">
        <div class="cal-day-num">${d}</div>
        ${dayTasks.slice(0,3).map(t => `
          <div class="cal-task-dot${t.status==='done'?' cal-done-task':''}" title="${escHtml(t.title)}" onclick="editTask(${t.id})">
            ${pri(t.priority)} <span class="cal-task-label">${escHtml(t.title.substring(0,18))}${t.title.length>18?'…':''}</span>${t.is_recurring ? ' ↻' : ''}
          </div>`).join('')}
        ${dayTasks.length > 3 ? `<div class="cal-more">+${dayTasks.length-3} more</div>` : ''}
      </div>`;
  }

  v.innerHTML = `
    <div class="page-title flex-between">
      <span>📅 CALENDAR</span>
      <div class="flex-gap">
        <button class="btn btn-sm" onclick="calNav(-1)">‹</button>
        <span style="font-size:0.85rem;color:var(--text2)">${monthName}</span>
        <button class="btn btn-sm" onclick="calNav(1)">›</button>
        <button class="btn btn-sm" onclick="calNav(0)">today</button>
      </div>
    </div>
    <div class="cal-grid-header">${dayNames.map(d => `<div class="cal-header-cell">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div style="margin-top:0.75rem;font-size:0.72rem;color:var(--text3)">
      Click any task to edit. <span style="color:var(--accent)">↻</span> = recurring.
    </div>
  `;
}

async function calNav(dir) {
  if (dir === 0) {
    calState = { year: new Date().getFullYear(), month: new Date().getMonth() };
  } else {
    calState.month += dir;
    if (calState.month > 11) { calState.month = 0; calState.year++; }
    if (calState.month < 0) { calState.month = 11; calState.year--; }
  }
  renderCalendar();
}

// ── JSON EXPORT / IMPORT ──────────────────────────────────────
async function exportData() {
  try {
    const [tasks, goals, projects, notes, reflections] = await Promise.all([
      api('GET', '/tasks'),
      api('GET', '/goals'),
      api('GET', '/projects'),
      api('GET', '/notes'),
      api('GET', '/reflections'),
    ]);
    const blob = new Blob([JSON.stringify({ version: 3, exported_at: Date.now(), tasks, goals, projects, notes, reflections }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `focusos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Data exported!');
  } catch(e) { toast('Export failed: ' + e.message, true); }
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.tasks) { toast('Invalid backup file', true); return; }
      if (!confirm(`Import ${data.tasks.length} tasks, ${data.notes?.length||0} notes, ${data.goals?.length||0} goals?\n\nExisting data will NOT be deleted.`)) return;

      let imported = 0;
      for (const t of (data.tasks || [])) {
        try {
          await api('POST', '/tasks', { title: t.title, description: t.description, priority: t.priority, difficulty: t.difficulty, due_date: t.due_date, estimated_minutes: t.estimated_minutes, is_recurring: t.is_recurring, recur_interval: t.recur_interval });
          imported++;
        } catch(_) {}
      }
      for (const n of (data.notes || [])) {
        try { await api('POST', '/notes', { title: n.title, content: n.content, tags: n.tags }); } catch(_) {}
      }
      toast(`Imported ${imported} tasks + ${data.notes?.length||0} notes`);
      if (S.view === 'tasks') renderTasks();
    } catch(e) { toast('Import failed: ' + e.message, true); }
  };
  input.click();
}

// ── REMINDER WIDGET PANEL ─────────────────────────────────────
async function renderReminderWidget(containerId) {
  const c = el(containerId); if (!c) return;
  try {
    const [tasks, reminders] = await Promise.all([
      api('GET', '/tasks?status=pending'),
      api('GET', '/ai/reminders').catch(() => []),
    ]);
    const today = Math.floor(Date.now() / 1000);
    const due = tasks.filter(t => t.due_date && t.due_date <= today + 86400 * 2).slice(0, 5);
    const recurring = tasks.filter(t => t.is_recurring).slice(0, 3);

    c.innerHTML = `
      <div class="card-title">🔔 REMINDERS</div>
      ${reminders.length ? reminders.slice(0,3).map(r => `
        <div class="reminder-widget-item reminder-${r.priority}">
          <span>${escHtml(r.msg)}</span>
        </div>`).join('') : ''}
      ${due.length ? `<div class="label mt" style="font-size:0.68rem">DUE SOON</div>` + due.map(t => `
        <div class="reminder-widget-item" onclick="editTask(${t.id})" style="cursor:pointer">
          ${pri(t.priority)} ${escHtml(t.title)} <span style="color:var(--text3);font-size:0.7rem">${fmt(t.due_date)}</span>
        </div>`).join('') : '<div class="empty" style="font-size:0.72rem">no urgent items</div>'}
      ${recurring.length ? `<div class="label mt" style="font-size:0.68rem">RECURRING ↻</div>` + recurring.map(t => `
        <div class="reminder-widget-item" style="color:var(--text2);font-size:0.78rem">${escHtml(t.title)} <span style="color:var(--text3)">[${t.recur_interval||'?'}]</span></div>`).join('') : ''}
    `;
  } catch(e) { c.innerHTML = '<div class="empty">reminders unavailable</div>'; }
}

// ── ADAPTIVE SUGGESTION HISTORY ───────────────────────────────
async function renderSuggestionHistory(containerId) {
  const c = el(containerId); if (!c) return;
  try {
    const history = await api('GET', '/ai/suggestions/history');
    if (!history.length) { c.innerHTML = '<div class="empty">no suggestion history yet</div>'; return; }
    const accepted = history.filter(h => h.accepted);
    const rate = history.length ? Math.round(accepted.length / history.length * 100) : 0;
    c.innerHTML = `
      <div style="font-size:0.75rem;color:var(--text3);margin-bottom:8px">
        Acceptance rate: <span style="color:var(--accent)">${rate}%</span> (${accepted.length}/${history.length})
      </div>
      ${history.slice(0,8).map(h => `
        <div class="memory-row" style="border-bottom:1px solid var(--border);padding:5px 0">
          <span style="color:${h.accepted?'var(--accent)':'var(--text3)'};font-size:0.75rem">${h.accepted?'✓':'×'}</span>
          <span style="flex:1;font-size:0.78rem;color:var(--text2)">${escHtml(h.suggestion)}</span>
          <span style="font-size:0.68rem;color:var(--text3)">${new Date(h.created_at*1000).toLocaleDateString()}</span>
        </div>`).join('')}
    `;
  } catch(e) { c.innerHTML = '<div class="empty">history unavailable</div>'; }
}
