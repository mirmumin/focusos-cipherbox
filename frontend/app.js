// ── STATE ─────────────────────────────────────────────────────
const S = { user: null, categories: [], view: 'dashboard' };

// ── UTILS ─────────────────────────────────────────────────────
const api = async (method, path, body) => {
  const r = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
};

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 2500);
}

function el(id) { return document.getElementById(id); }

function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pri(n) { return ['', '🔵', '🟡', '🟠', '🔴', '🚨'][n] || ''; }
function diff(n) { return ['', '▁', '▃', '▅', '▇', '█'][n] || ''; }

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── AUTH ──────────────────────────────────────────────────────
async function doLogin() {
  const user = el('login-user').value.trim();
  const pass = el('login-pass').value;
  try {
    const r = await api('POST', '/auth/login', { username: user, password: pass });
    S.user = r;
    showApp();
  } catch(e) { el('auth-error').textContent = e.message; }
}

async function doRegister() {
  const user = el('reg-user').value.trim();
  const email = el('reg-email').value.trim();
  const pass = el('reg-pass').value;
  try {
    const r = await api('POST', '/auth/register', { username: user, email, password: pass });
    S.user = r;
    showApp();
  } catch(e) { el('auth-error').textContent = e.message; }
}

async function doLogout() {
  await api('POST', '/auth/logout');
  S.user = null;
  el('app').style.display = 'none';
  el('auth-screen').style.display = 'flex';
}

function showTab(tab) {
  el('login-form').style.display = tab === 'login' ? 'block' : 'none';
  el('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (tab === 'login')));
}

// ── NAV ───────────────────────────────────────────────────────
function showApp() {
  el('auth-screen').style.display = 'none';
  el('app').style.display = 'flex';
  el('nav-user').textContent = '> ' + S.user.username;
  loadCategories().then(() => {
    showView('dashboard');
    // Phase 3: load smart reminders banner
    if (typeof loadSmartReminders === 'function') loadSmartReminders();
  });
}

async function showView(name) {
  S.view = name;
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  el('view-' + name).style.display = 'block';
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.view === name));
  if (window.innerWidth <= 768) el('sidebar').classList.remove('open');

  const renders = {
    dashboard: renderDashboard,
    planner: renderPlanner,
    tasks: renderTasks,
    goals: renderGoals,
    timer: renderTimer,
    notes: renderNotes,
    reflect: renderReflect,
    energy: renderEnergy,
    analytics: renderAnalytics,
    calendar: renderCalendar,
    settings: renderSettings,
  };
  if (renders[name]) await renders[name]();
}

function toggleSidebar() { el('sidebar').classList.toggle('open'); }

async function loadCategories() {
  S.categories = await api('GET', '/categories');
}

function catOptions(selected) {
  return `<option value="">-- none --</option>` + S.categories.map(c => `<option value="${c.id}" ${selected == c.id ? 'selected' : ''}>${c.icon} ${escHtml(c.name)}</option>`).join('');
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(html) {
  el('modal').innerHTML = html;
  el('modal').style.display = 'block';
  el('modal-overlay').style.display = 'block';
}

function closeModal() {
  el('modal').style.display = 'none';
  el('modal-overlay').style.display = 'none';
}

// ── DASHBOARD ─────────────────────────────────────────────────
async function renderDashboard() {
  const v = el('view-dashboard');
  v.innerHTML = `<div class="loading">loading dashboard...</div>`;

  const [tasks, analytics, insight] = await Promise.all([
    api('GET', '/tasks?status=pending'),
    api('GET', '/analytics/overview'),
    api('GET', '/ai/insight').catch(() => ({ insight: '' }))
  ]);

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const urgent = tasks.filter(t => t.due_date && (t.due_date * 1000) < Date.now() + 86400000 * 2).slice(0, 5);
  const recent = tasks.slice(0, 8);

  v.innerHTML = `
    <div class="page-title">⬛ DASHBOARD <span class="muted small" style="float:right;font-size:11px">${today}</span></div>

    ${insight.insight ? `<div class="ai-block"><div class="label">◆ AI INSIGHT</div>${escHtml(insight.insight)}</div>` : ''}

    <div class="grid-4" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-val">${analytics.streak}</div><div class="stat-label">DAY STREAK</div></div>
      <div class="stat-card"><div class="stat-val">${analytics.todayDone}</div><div class="stat-label">DONE TODAY</div></div>
      <div class="stat-card"><div class="stat-val">${analytics.completionRate}%</div><div class="stat-label">COMPLETION</div></div>
      <div class="stat-card"><div class="stat-val">${Math.round(analytics.focusMinutes / 60 * 10) / 10}h</div><div class="stat-label">FOCUS / WEEK</div></div>
    </div>

    <div class="grid-2">
      <div>
        <div class="card-title">⚡ URGENT / DUE SOON</div>
        ${urgent.length ? urgent.map(t => taskRow(t, true)).join('') : '<div class="empty">no urgent tasks</div>'}
      </div>
      <div>
        <div class="card-title">✓ PENDING TASKS</div>
        ${recent.length ? recent.map(t => taskRow(t, false)).join('') : '<div class="empty">no pending tasks</div>'}
        ${tasks.length > 8 ? `<div class="small muted mt" style="text-align:center">+${tasks.length - 8} more — <a href="#" onclick="showView('tasks')" style="color:var(--accent2)">view all</a></div>` : ''}
      </div>
    </div>
  `;
}

function taskRow(t, showComplete = true) {
  const overdue = t.due_date && t.due_date * 1000 < Date.now();
  const subtaskBadge = t.subtask_total > 0
    ? `<span class="subtask-badge ${t.subtask_done === t.subtask_total ? 'done' : ''}">${t.subtask_done}/${t.subtask_total}</span>`
    : '';
  return `<div class="task-item" id="tr-${t.id}">
    <input type="checkbox" class="task-check" onchange="completeTask(${t.id}, this.checked)" ${t.status === 'done' ? 'checked' : ''}>
    <div style="flex:1;min-width:0">
      <div class="task-title">${pri(t.priority)} ${escHtml(t.title)} ${subtaskBadge}${t.is_recurring ? '<span class="recur-badge" title="'+escHtml(t.recur_interval||'recurring')+'">↻</span>' : ''}</div>
      <div class="task-meta">${t.category_name ? `<span class="tag">${escHtml(t.category_name)}</span>` : ''}${t.project_title ? ` <span class="tag tag-project">${escHtml(t.project_title)}</span>` : ''}${t.due_date ? ` <span style="color:${overdue ? 'var(--red)' : 'var(--text3)'}">${fmt(t.due_date)}</span>` : ''}</div>
    </div>
    <div class="task-actions">
      <button class="btn btn-sm" onclick="editTask(${t.id})">edit</button>
      <button class="btn btn-sm btn-danger" onclick="deleteTask(${t.id})">×</button>
    </div>
  </div>`;
}

async function completeTask(id, done) {
  const r = await api('PUT', `/tasks/${id}`, { status: done ? 'done' : 'pending' });
  if (r.recurred) toast('↻ recurring task — rescheduled to ' + fmt(r.next_due));
  else toast(done ? 'task completed ✓' : 'task reopened');
  if (S.view === 'dashboard') renderDashboard();
  if (S.view === 'tasks') renderTasks();
  if (S.view === 'calendar') renderCalendar();
}

async function deleteTask(id) {
  if (!confirm('Delete task?')) return;
  await api('DELETE', `/tasks/${id}`);
  toast('deleted');
  showView(S.view);
}

// ── PLANNER ───────────────────────────────────────────────────
async function renderPlanner() {
  const v = el('view-planner');

  v.innerHTML = `
    <div class="page-title">🗓 AI DAILY PLANNER</div>
    <div class="grid-2">
      <div>
        <div class="card">
          <div class="card-title">GENERATE TODAY'S PLAN</div>
          <div class="form-row">
            <label>Available hours today</label>
            <input type="number" id="p-hours" value="6" min="1" max="16" step="0.5">
          </div>
          <div class="form-row">
            <label>Energy level</label>
            <select id="p-energy">
              <option value="low">Low — tired, stressed</option>
              <option value="medium" selected>Medium — normal day</option>
              <option value="high">High — sharp, motivated</option>
            </select>
          </div>
          <div class="form-row">
            <label>Focus mode</label>
            <select id="p-mode">
              <option value="normal">Normal</option>
              <option value="deep_work">Deep Work</option>
              <option value="light">Light Day</option>
              <option value="exam">Exam Prep</option>
              <option value="recovery">Recovery</option>
            </select>
          </div>
          <div class="form-row">
            <label>Additional context (optional)</label>
            <textarea id="p-context" placeholder="e.g. have exam tomorrow, feeling stressed about thesis..." rows="3"></textarea>
          </div>
          <button class="btn-primary" onclick="generatePlan()">⚡ GENERATE PLAN</button>
        </div>
        <!-- Phase 3: Burnout status card -->
        <div class="card mt" id="burnout-widget-card">
          <div id="burnout-widget-container"><div class="loading small">◦◦◦</div></div>
        </div>
        <!-- Phase 3: Adaptive suggestions -->
        <div class="card mt">
          <div class="card-title">💡 ADAPTIVE SUGGESTIONS</div>
          <div style="font-size:0.75rem;color:var(--text3);margin-bottom:8px">Hard overdue tasks — suggested smaller entry points</div>
          <div id="adaptive-suggestions-container"><div class="loading small">◦◦◦</div></div>
        </div>
      </div>
      <div id="plan-output">
        <div class="empty">generate a plan to see it here</div>
      </div>
    </div>
  `;

  // Load Phase 3 panels
  if (typeof renderBurnoutWidget === 'function') renderBurnoutWidget('burnout-widget-container');
  if (typeof renderAdaptiveSuggestions === 'function') renderAdaptiveSuggestions('adaptive-suggestions-container');
}

async function generatePlan() {
  el('plan-output').innerHTML = '<div class="loading">◦◦◦ generating personalized plan with AI...</div>';
  try {
    const plan = await api('POST', '/ai/plan', {
      available_hours: el('p-hours').value,
      energy_level: el('p-energy').value,
      focus_mode: el('p-mode').value,
      context: el('p-context').value
    });
    renderPlan(plan);
    // Phase 3: inject burnout note if present
    if (plan.burnout_risk && plan.burnout_risk !== 'none' && typeof injectBurnoutToPlan === 'function') {
      injectBurnoutToPlan('plan-output');
    }
  } catch(e) {
    el('plan-output').innerHTML = `<div class="error-msg">${escHtml(e.message)}</div>`;
  }
}

function renderPlan(plan) {
  const typeColors = { deep_work: 'var(--accent)', light: 'var(--accent2)', break: 'var(--text3)', review: '#ffaa00' };
  const blocks = (plan.blocks || []).map(b => `
    <div class="plan-block ${b.type}" style="border-left-color:${typeColors[b.type]||'var(--border)'}">
      <div class="plan-time">${escHtml(b.time)}</div>
      <div class="plan-content">
        <div class="plan-task">${escHtml(b.task)} <span class="plan-dur">${b.duration}m</span>
          <span class="plan-type-badge">${b.type.replace('_',' ')}</span>
        </div>
        ${b.note ? `<div class="plan-note">${escHtml(b.note)}</div>` : ''}
      </div>
    </div>`).join('');

  const skips = (plan.skip_suggestions || []).map(s => `<li class="small muted" style="padding:2px 0">↷ ${escHtml(s)}</li>`).join('');

  el('plan-output').innerHTML = `
    <div class="ai-block" style="margin-bottom:0.5rem"><div class="label">◆ SUMMARY</div>${escHtml(plan.summary || '')}</div>
    ${plan.burnout_note ? `<div class="ai-block" style="margin-bottom:0.5rem;border-color:var(--accent3)"><div class="label">⚠ ADAPTIVE NOTE</div>${escHtml(plan.burnout_note)}</div>` : ''}
    <div style="margin-bottom:1rem">${blocks}</div>
    ${skips ? `<div class="card"><div class="card-title">SUGGESTED TO SKIP</div><ul style="list-style:none;padding:0">${skips}</ul></div>` : ''}
    <div class="ai-block"><div class="label">◆ COACH</div>${escHtml(plan.coach_message || '')}<br><br><em>${escHtml(plan.focus_tip || '')}</em></div>
  `;
}

// ── TASKS ─────────────────────────────────────────────────────
let taskFilter = { status: 'pending', category_id: '', project_id: '', tag: '' };

async function renderTasks() {
  const v = el('view-tasks');
  const params = new URLSearchParams(taskFilter).toString();
  const tasks = await api('GET', `/tasks?${params}`);

  v.innerHTML = `
    <div class="page-title flex-between">
      <span>✓ TASKS</span>
      <button class="btn btn-accent btn-sm" onclick="openAddTask()">+ ADD TASK</button>
    </div>
    <div class="flex-gap mb">
      <select onchange="taskFilter.status=this.value;renderTasks()" style="width:auto">
        <option value="pending" ${taskFilter.status==='pending'?'selected':''}>Pending</option>
        <option value="done" ${taskFilter.status==='done'?'selected':''}>Done</option>
        <option value="" ${taskFilter.status===''?'selected':''}>All</option>
      </select>
      <select onchange="taskFilter.category_id=this.value;renderTasks()" style="width:auto">
        <option value="">All categories</option>
        ${S.categories.map(c => `<option value="${c.id}" ${taskFilter.category_id==c.id?'selected':''}>${c.icon} ${escHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div id="task-list">
      ${tasks.length ? tasks.map(t => taskRow(t)).join('') : '<div class="empty">no tasks found</div>'}
    </div>
  `;
}

function openAddTask(task) {
  const isEdit = !!task;
  // Load projects for selector, then open modal
  api('GET', '/projects').then(projects => {
    const projOpts = '<option value="">-- none --</option>' + projects.map(p => `<option value="${p.id}" ${task?.project_id == p.id ? 'selected' : ''}>${escHtml(p.title)}</option>`).join('');
    const subtaskSection = isEdit ? `
      <div class="form-row">
        <label>SUBTASKS</label>
        <div id="subtask-list" class="subtask-list"><div class="loading" style="padding:4px">loading...</div></div>
        <div class="flex-gap mt" style="gap:4px">
          <input id="new-subtask" placeholder="add subtask..." style="flex:1;margin:0">
          <button class="btn btn-sm" onclick="addSubtask(${task.id})">+</button>
        </div>
      </div>` : '';
    openModal(`
      <div class="modal-title">${isEdit ? 'EDIT' : 'ADD'} TASK</div>
      <div class="form-row"><label>Title *</label><input id="t-title" value="${escHtml(task?.title || '')}"></div>
      <div class="form-row"><label>Description</label><textarea id="t-desc" rows="2">${escHtml(task?.description || '')}</textarea></div>
      <div class="grid-2">
        <div class="form-row"><label>Priority (1-5)</label><input type="number" id="t-pri" value="${task?.priority || 2}" min="1" max="5"></div>
        <div class="form-row"><label>Difficulty (1-5)</label><input type="number" id="t-diff" value="${task?.difficulty || 2}" min="1" max="5"></div>
      </div>
      <div class="form-row"><label>Due Date</label><input type="date" id="t-due" value="${task?.due_date ? new Date(task.due_date*1000).toISOString().split('T')[0] : ''}"></div>
      <div class="form-row"><label>Est. minutes</label><input type="number" id="t-est" value="${task?.estimated_minutes || ''}" placeholder="e.g. 90"></div>
      <div class="form-row"><label><input type="checkbox" id="t-recur" onchange="toggleRecurUI()" ${task?.is_recurring ? 'checked' : ''}> Recurring</label><select id="t-recur-interval" style="display:${task?.is_recurring ? 'inline-block' : 'none'};margin-left:8px"><option value="daily" ${task?.recur_interval==='daily'?'selected':''}>Daily</option><option value="weekly" ${task?.recur_interval==='weekly'?'selected':''}>Weekly</option><option value="biweekly" ${task?.recur_interval==='biweekly'?'selected':''}>Bi-weekly</option><option value="monthly" ${task?.recur_interval==='monthly'?'selected':''}>Monthly</option></select></div>
      <div class="grid-2">
        <div class="form-row"><label>Category</label><select id="t-cat">${catOptions(task?.category_id)}</select></div>
        <div class="form-row"><label>Project</label><select id="t-proj">${projOpts}</select></div>
      </div>
      ${subtaskSection}
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">cancel</button>
        <button class="btn btn-accent" onclick="${isEdit ? `saveTask(${task.id})` : 'addTask()'}">${isEdit ? 'SAVE' : 'ADD'}</button>
      </div>
    `);
    if (isEdit) loadSubtasks(task.id);
  });
}

function toggleRecurUI() {
  const cb = el('t-recur'); const sel = el('t-recur-interval');
  if (cb && sel) sel.style.display = cb.checked ? 'inline-block' : 'none';
}

async function addTask() {
  const due = el('t-due').value;
  const isRecur = el('t-recur')?.checked || false;
  await api('POST', '/tasks', {
    title: el('t-title').value,
    description: el('t-desc').value,
    priority: +el('t-pri').value,
    difficulty: +el('t-diff').value,
    due_date: due ? Math.floor(new Date(due+'T00:00:00').getTime()/1000) : null,
    estimated_minutes: +el('t-est').value || null,
    category_id: el('t-cat').value || null,
    project_id: el('t-proj')?.value || null,
    is_recurring: isRecur,
    recur_interval: isRecur ? (el('t-recur-interval')?.value || 'weekly') : null,
  });
  closeModal(); toast('task added'); renderTasks();
}

async function editTask(id) {
  const tasks = await api('GET', '/tasks');
  const task = tasks.find(t => t.id === id);
  if (task) openAddTask(task);
}

async function saveTask(id) {
  const due = el('t-due').value;
  const isRecur = el('t-recur')?.checked || false;
  await api('PUT', `/tasks/${id}`, {
    title: el('t-title').value,
    description: el('t-desc').value,
    priority: +el('t-pri').value,
    difficulty: +el('t-diff').value,
    due_date: due ? Math.floor(new Date(due+'T00:00:00').getTime()/1000) : null,
    estimated_minutes: +el('t-est').value || null,
    category_id: el('t-cat').value || null,
    project_id: el('t-proj')?.value || null,
    is_recurring: isRecur,
    recur_interval: isRecur ? (el('t-recur-interval')?.value || 'weekly') : null,
  });
  closeModal(); toast('saved'); renderTasks();
}

// ── GOALS & PROJECTS ──────────────────────────────────────────
async function renderGoals() {
  const v = el('view-goals');
  const [goals, projects] = await Promise.all([api('GET', '/goals'), api('GET', '/projects')]);

  v.innerHTML = `
    <div class="page-title flex-between">
      <span>🎯 GOALS & PROJECTS</span>
      <div class="flex-gap">
        <button class="btn btn-sm" onclick="openAddGoal()">+ GOAL</button>
        <button class="btn btn-sm btn-accent" onclick="openAddProject()">+ PROJECT</button>
      </div>
    </div>
    <div class="grid-2">
      <div>
        <div class="card-title">GOALS</div>
        ${goals.length ? goals.map(g => `
          <div class="card" style="margin-bottom:6px">
            <div class="flex-between">
              <div>
                <strong>${escHtml(g.title)}</strong>
                ${g.category_name ? `<span class="tag">${escHtml(g.category_name)}</span>` : ''}
                <span class="badge ${g.status==='active'?'badge-green':'badge-red'}">${g.status}</span>
              </div>
              <div class="flex-gap">
                <button class="btn btn-sm" onclick="editGoal(${g.id}, '${escHtml(g.title)}', '${g.status}')">edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteGoal(${g.id})">×</button>
              </div>
            </div>
            ${g.description ? `<div class="small muted mt">${escHtml(g.description)}</div>` : ''}
            ${g.target_date ? `<div class="small muted">target: ${fmtDate(new Date(g.target_date*1000).toISOString().split('T')[0])}</div>` : ''}
          </div>`).join('') : '<div class="empty">no goals yet</div>'}
      </div>
      <div>
        <div class="card-title">PROJECTS</div>
        ${projects.length ? projects.map(p => `
          <div class="card" style="margin-bottom:6px">
            <div class="flex-between">
              <div>
                <strong>${escHtml(p.title)}</strong>
                ${p.category_name ? `<span class="tag">${escHtml(p.category_name)}</span>` : ''}
                <span class="badge ${p.status==='active'?'badge-blue':'badge-red'}">${p.status}</span>
              </div>
              <div class="flex-gap">
                <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id})">×</button>
              </div>
            </div>
            ${p.goal_title ? `<div class="small muted">goal: ${escHtml(p.goal_title)}</div>` : ''}
          </div>`).join('') : '<div class="empty">no projects yet</div>'}
      </div>
    </div>
  `;
}

function openAddGoal() {
  openModal(`
    <div class="modal-title">ADD GOAL</div>
    <div class="form-row"><label>Title *</label><input id="g-title"></div>
    <div class="form-row"><label>Description</label><textarea id="g-desc" rows="2"></textarea></div>
    <div class="form-row"><label>Category</label><select id="g-cat">${catOptions(null)}</select></div>
    <div class="form-row"><label>Target Date</label><input type="date" id="g-date"></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn btn-accent" onclick="addGoal()">ADD</button>
    </div>
  `);
}

async function addGoal() {
  const date = el('g-date').value;
  await api('POST', '/goals', { title: el('g-title').value, description: el('g-desc').value, category_id: el('g-cat').value || null, target_date: date ? Math.floor(new Date(date+'T00:00:00').getTime()/1000) : null });
  closeModal(); toast('goal added'); renderGoals();
}

async function deleteGoal(id) {
  if (!confirm('Delete goal?')) return;
  await api('DELETE', `/goals/${id}`);
  toast('deleted'); renderGoals();
}

async function editGoal(id, title, status) {
  openModal(`
    <div class="modal-title">EDIT GOAL</div>
    <div class="form-row"><label>Title</label><input id="eg-title" value="${escHtml(title)}"></div>
    <div class="form-row"><label>Status</label><select id="eg-status">
      <option value="active" ${status==='active'?'selected':''}>Active</option>
      <option value="completed" ${status==='completed'?'selected':''}>Completed</option>
      <option value="paused" ${status==='paused'?'selected':''}>Paused</option>
    </select></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn btn-accent" onclick="saveGoal(${id})">SAVE</button>
    </div>
  `);
}

async function saveGoal(id) {
  await api('PUT', `/goals/${id}`, { title: el('eg-title').value, status: el('eg-status').value });
  closeModal(); toast('saved'); renderGoals();
}

function openAddProject() {
  api('GET', '/goals').then(goals => {
    openModal(`
      <div class="modal-title">ADD PROJECT</div>
      <div class="form-row"><label>Title *</label><input id="pj-title"></div>
      <div class="form-row"><label>Description</label><textarea id="pj-desc" rows="2"></textarea></div>
      <div class="form-row"><label>Goal</label><select id="pj-goal">
        <option value="">-- none --</option>
        ${goals.map(g => `<option value="${g.id}">${escHtml(g.title)}</option>`).join('')}
      </select></div>
      <div class="form-row"><label>Category</label><select id="pj-cat">${catOptions(null)}</select></div>
      <div class="form-row"><label>Priority (1-5)</label><input type="number" id="pj-pri" value="2" min="1" max="5"></div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">cancel</button>
        <button class="btn btn-accent" onclick="addProject()">ADD</button>
      </div>
    `);
  });
}

async function addProject() {
  await api('POST', '/projects', { title: el('pj-title').value, description: el('pj-desc').value, goal_id: el('pj-goal').value || null, category_id: el('pj-cat').value || null, priority: +el('pj-pri').value });
  closeModal(); toast('project added'); renderGoals();
}

async function deleteProject(id) {
  if (!confirm('Delete project?')) return;
  await api('DELETE', `/projects/${id}`);
  toast('deleted'); renderGoals();
}

// ── FOCUS TIMER (Phase 2: Pomodoro + presets) ─────────────────
let timerState = {
  running: false, seconds: 0, interval: null, interruptions: 0, categoryId: null,
  mode: 'stopwatch', // 'stopwatch' | 'pomodoro'
  pomodoroPhase: 'work', // 'work' | 'break' | 'long_break'
  cycle: 0,
  preset: null, // active preset object
};

async function renderTimer() {
  const v = el('view-timer');
  const presets = await api('GET', '/timer/presets').catch(() => []);

  const presetBtns = presets.map(p => `
    <button class="btn btn-sm preset-btn" id="preset-${p.id}" onclick="applyPreset(${p.id}, ${JSON.stringify(p).replace(/"/g,"'")})">${escHtml(p.name)}</button>
  `).join('');

  v.innerHTML = `
    <div class="page-title">⏱ FOCUS TIMER</div>
    <div style="max-width:520px;margin:0 auto">
      <div class="card" style="text-align:center">
        <div class="timer-mode-tabs" style="margin-bottom:1rem">
          <button class="btn btn-sm" id="mode-sw" onclick="setTimerMode('stopwatch')" style="border-color:var(--accent);color:var(--accent)">STOPWATCH</button>
          <button class="btn btn-sm" id="mode-pm" onclick="setTimerMode('pomodoro')">POMODORO</button>
        </div>
        <div id="timer-phase-label" class="small muted" style="height:16px;margin-bottom:4px"></div>
        <div id="timer-display" class="timer-display">00:00</div>
        <div id="timer-cycle-dots" style="margin:6px 0;min-height:14px"></div>
        <div class="form-row" style="text-align:left">
          <label>Category</label>
          <select id="timer-cat">${catOptions(null)}</select>
        </div>
        <div class="timer-controls">
          <button class="btn" onclick="timerReset()">RESET</button>
          <button class="btn btn-accent" id="timer-toggle" onclick="timerToggle()">START</button>
          <button class="btn" onclick="timerInterrupt()">+INTERRUPT</button>
        </div>
        <div class="small muted mt">interruptions: <span id="interrupt-count">0</span></div>
        <div id="timer-save" style="display:none;margin-top:1rem">
          <button class="btn btn-accent" onclick="saveSession()">SAVE SESSION</button>
        </div>
      </div>

      <div class="card" style="margin-top:0.75rem">
        <div class="card-title flex-between">
          <span>PRESETS</span>
          <button class="btn btn-sm" onclick="openAddPreset()">+ ADD</button>
        </div>
        <div class="flex-gap" style="flex-wrap:wrap;gap:6px">${presetBtns || '<span class="small muted">no presets</span>'}</div>
      </div>

      <div class="card" style="margin-top:0.75rem">
        <div class="card-title">RECENT SESSIONS</div>
        <div id="recent-sessions"><div class="loading">loading...</div></div>
      </div>
    </div>
  `;
  loadRecentSessions();
  updateTimerDisplay();
}

function setTimerMode(mode) {
  timerState.mode = mode;
  el('mode-sw').style.borderColor = mode === 'stopwatch' ? 'var(--accent)' : 'var(--border)';
  el('mode-sw').style.color = mode === 'stopwatch' ? 'var(--accent)' : 'var(--text2)';
  el('mode-pm').style.borderColor = mode === 'pomodoro' ? 'var(--accent)' : 'var(--border)';
  el('mode-pm').style.color = mode === 'pomodoro' ? 'var(--accent)' : 'var(--text2)';
  timerReset();
}

function applyPreset(id, preset) {
  timerState.preset = preset;
  setTimerMode('pomodoro');
  document.querySelectorAll('.preset-btn').forEach(b => b.style.borderColor = 'var(--border)');
  const btn = el('preset-' + id);
  if (btn) btn.style.borderColor = 'var(--accent2)';
  toast('Preset: ' + preset.name);
}

function openAddPreset() {
  openModal(`
    <div class="modal-title">ADD TIMER PRESET</div>
    <div class="form-row"><label>Name</label><input id="tp-name" placeholder="e.g. Deep Work"></div>
    <div class="grid-2">
      <div class="form-row"><label>Work (min)</label><input type="number" id="tp-work" value="25" min="1" max="120"></div>
      <div class="form-row"><label>Break (min)</label><input type="number" id="tp-brk" value="5" min="1" max="60"></div>
    </div>
    <div class="grid-2">
      <div class="form-row"><label>Long Break (min)</label><input type="number" id="tp-long" value="15" min="5" max="60"></div>
      <div class="form-row"><label>Cycles before long</label><input type="number" id="tp-cycles" value="4" min="1" max="10"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn btn-accent" onclick="savePreset()">ADD</button>
    </div>
  `);
}

async function savePreset() {
  await api('POST', '/timer/presets', {
    name: el('tp-name').value, work_minutes: +el('tp-work').value,
    break_minutes: +el('tp-brk').value, long_break_minutes: +el('tp-long').value,
    cycles_before_long: +el('tp-cycles').value
  });
  closeModal(); toast('preset added'); renderTimer();
}

function getPomodoroSeconds() {
  const p = timerState.preset || { work_minutes: 25, break_minutes: 5, long_break_minutes: 15, cycles_before_long: 4 };
  if (timerState.pomodoroPhase === 'work') return p.work_minutes * 60;
  if (timerState.pomodoroPhase === 'long_break') return p.long_break_minutes * 60;
  return p.break_minutes * 60;
}

function updateTimerDisplay() {
  const disp = el('timer-display');
  if (!disp) return;
  let secs = timerState.seconds;
  if (timerState.mode === 'pomodoro') {
    secs = Math.max(0, getPomodoroSeconds() - timerState.seconds);
  }
  const h = Math.floor(secs / 3600);
  const m = String(Math.floor(secs % 3600 / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  disp.textContent = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;

  const phaseEl = el('timer-phase-label');
  const dotsEl = el('timer-cycle-dots');
  if (phaseEl && timerState.mode === 'pomodoro') {
    const p = timerState.preset || { cycles_before_long: 4 };
    phaseEl.textContent = timerState.pomodoroPhase.replace('_', ' ').toUpperCase();
    const dots = Array.from({length: p.cycles_before_long || 4}, (_, i) =>
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 2px;background:${i < timerState.cycle ? 'var(--accent)' : 'var(--border)'}"></span>`).join('');
    if (dotsEl) dotsEl.innerHTML = dots;
  } else {
    if (phaseEl) phaseEl.textContent = '';
    if (dotsEl) dotsEl.innerHTML = '';
  }
}

async function loadRecentSessions() {
  const sessions = await api('GET', '/sessions');
  const c = el('recent-sessions');
  if (!sessions.length) { c.innerHTML = '<div class="empty">no sessions yet</div>'; return; }
  c.innerHTML = sessions.slice(0, 10).map(s => `
    <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
      <span class="mono small">${new Date(s.started_at * 1000).toLocaleDateString()}</span>
      <span class="accent mono">${s.duration_minutes}m</span>
      <span class="small muted">${s.interruptions} interrupts</span>
    </div>`).join('');
}

function timerToggle() {
  if (timerState.running) {
    clearInterval(timerState.interval);
    timerState.running = false;
    el('timer-toggle').textContent = 'RESUME';
    if (timerState.mode === 'stopwatch') el('timer-save').style.display = 'block';
  } else {
    timerState.running = true;
    el('timer-toggle').textContent = 'PAUSE';
    el('timer-save').style.display = 'none';
    timerState.interval = setInterval(() => {
      timerState.seconds++;
      if (timerState.mode === 'pomodoro') {
        const total = getPomodoroSeconds();
        if (timerState.seconds >= total) {
          // phase complete
          clearInterval(timerState.interval);
          timerState.running = false;
          el('timer-toggle').textContent = 'START';
          const p = timerState.preset || { cycles_before_long: 4, work_minutes: 25 };
          if (timerState.pomodoroPhase === 'work') {
            timerState.cycle++;
            const autoSaveMins = p.work_minutes || 25;
            api('POST', '/sessions', { duration_minutes: autoSaveMins, interruptions: timerState.interruptions, category_id: el('timer-cat')?.value || null })
              .then(() => loadRecentSessions()).catch(() => {});
            timerState.pomodoroPhase = timerState.cycle >= (p.cycles_before_long || 4) ? 'long_break' : 'break';
            if (timerState.cycle >= (p.cycles_before_long || 4)) timerState.cycle = 0;
            toast('Work session done! Take a break ☕');
          } else {
            timerState.pomodoroPhase = 'work';
            toast('Break over — back to work 💪');
          }
          timerState.seconds = 0;
          timerState.interruptions = 0;
        }
      }
      updateTimerDisplay();
    }, 1000);
  }
}

function timerReset() {
  clearInterval(timerState.interval);
  const preset = timerState.preset;
  const mode = timerState.mode;
  timerState = { running: false, seconds: 0, interval: null, interruptions: 0, categoryId: null, mode, pomodoroPhase: 'work', cycle: 0, preset };
  const tog = el('timer-toggle');
  if (tog) tog.textContent = 'START';
  const ic = el('interrupt-count');
  if (ic) ic.textContent = '0';
  const sv = el('timer-save');
  if (sv) sv.style.display = 'none';
  updateTimerDisplay();
}

function timerInterrupt() {
  timerState.interruptions++;
  const ic = el('interrupt-count');
  if (ic) ic.textContent = timerState.interruptions;
}

async function saveSession() {
  const mins = Math.ceil(timerState.seconds / 60);
  if (mins < 1) { toast('session too short', true); return; }
  await api('POST', '/sessions', { duration_minutes: mins, interruptions: timerState.interruptions, category_id: el('timer-cat')?.value || null });
  toast(`${mins}m session saved`);
  timerReset();
  loadRecentSessions();
}

// ── NOTES ─────────────────────────────────────────────────────
let currentNote = null;

async function renderNotes() {
  const v = el('view-notes');
  const notes = await api('GET', '/notes');
  v.innerHTML = `
    <div class="page-title flex-between">
      <span>📝 NOTES</span>
      <button class="btn btn-accent btn-sm" onclick="openNote(null)">+ NEW NOTE</button>
    </div>
    <div class="grid-2">
      <div id="notes-list">
        ${notes.length ? notes.map(n => `
          <div class="note-card" onclick="openNote(${n.id})">
            <h4>${escHtml(n.title)}</h4>
            <p>${escHtml(n.content || '(empty)')}</p>
            <div class="small muted" style="margin-top:4px">${n.category_name ? `<span class="tag">${escHtml(n.category_name)}</span>` : ''}</div>
          </div>`).join('') : '<div class="empty">no notes yet</div>'}
      </div>
      <div id="note-editor-area">
        <div class="empty">select a note or create a new one</div>
      </div>
    </div>
  `;
}

async function openNote(id) {
  let note = null;
  if (id) {
    const notes = await api('GET', '/notes');
    note = notes.find(n => n.id === id);
  }
  const area = el('note-editor-area');
  area.innerHTML = `
    <div class="form-row"><input id="ne-title" placeholder="Note title" value="${escHtml(note?.title || '')}"></div>
    <div class="form-row"><select id="ne-cat">${catOptions(note?.category_id)}</select></div>
    <div class="form-row"><textarea id="ne-content" class="note-editor">${escHtml(note?.content || '')}</textarea></div>
    <div class="flex-gap">
      <button class="btn btn-accent" onclick="saveNote(${id || 'null'})">${id ? 'SAVE' : 'CREATE'}</button>
      ${id ? `<button class="btn btn-danger" onclick="deleteNote(${id})">DELETE</button>` : ''}
    </div>
  `;
}

async function saveNote(id) {
  const payload = { title: el('ne-title').value, content: el('ne-content').value, category_id: el('ne-cat').value || null };
  if (id) await api('PUT', `/notes/${id}`, payload);
  else await api('POST', '/notes', payload);
  toast('note saved'); renderNotes();
}

async function deleteNote(id) {
  if (!confirm('Delete note?')) return;
  await api('DELETE', `/notes/${id}`);
  toast('deleted'); renderNotes();
}

// ── REFLECTION ────────────────────────────────────────────────
async function renderReflect() {
  const v = el('view-reflect');
  const reflections = await api('GET', '/reflections');
  const today = reflections.find(r => r.date === new Date().toISOString().split('T')[0]);
  // Phase 3: mood trend badge
  const moodBadge = (typeof getMoodTrendBadge === 'function') ? getMoodTrendBadge(reflections) : '';

  v.innerHTML = `
    <div class="page-title">🌙 DAILY REFLECTION ${moodBadge}</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">TODAY'S REFLECTION</div>
        <div class="form-row">
          <div class="scale-label">Mood (1-5)</div>
          <div class="scale-row">${[1,2,3,4,5].map(n => `<button class="scale-btn ${today?.mood == n ? 'selected' : ''}" onclick="selectScale('r-mood', ${n}, this)">${n}</button>`).join('')}</div>
          <input type="hidden" id="r-mood" value="${today?.mood || ''}">
        </div>
        <div class="form-row">
          <div class="scale-label">Energy (1-5)</div>
          <div class="scale-row">${[1,2,3,4,5].map(n => `<button class="scale-btn ${today?.energy == n ? 'selected' : ''}" onclick="selectScale('r-energy', ${n}, this)">${n}</button>`).join('')}</div>
          <input type="hidden" id="r-energy" value="${today?.energy || ''}">
        </div>
        <div class="form-row">
          <div class="scale-label">Productivity (1-5)</div>
          <div class="scale-row">${[1,2,3,4,5].map(n => `<button class="scale-btn ${today?.productivity == n ? 'selected' : ''}" onclick="selectScale('r-prod', ${n}, this)">${n}</button>`).join('')}</div>
          <input type="hidden" id="r-prod" value="${today?.productivity || ''}">
        </div>
        <div class="form-row">
          <label>How did today go?</label>
          <textarea id="r-content" rows="5" placeholder="Thoughts, wins, difficulties, plans for tomorrow...">${escHtml(today?.content || '')}</textarea>
        </div>
        <div class="flex-gap">
          <button class="btn btn-accent" onclick="saveReflection()">SAVE & ANALYZE</button>
        </div>
        <div id="reflect-analysis" style="margin-top:1rem"></div>
      </div>
      <div>
        <div class="card-title">RECENT REFLECTIONS</div>
        ${reflections.slice(0, 10).map(r => `
          <div class="card" style="margin-bottom:6px">
            <div class="flex-between">
              <span class="mono small">${r.date}</span>
              <span>😊${r.mood || '?'} ⚡${r.energy || '?'} 🎯${r.productivity || '?'}</span>
            </div>
            ${r.content ? `<div class="small muted mt" style="overflow:hidden;max-height:40px">${escHtml(r.content.slice(0, 120))}${r.content.length > 120 ? '...' : ''}</div>` : ''}
          </div>`).join('')}
        ${!reflections.length ? '<div class="empty">no reflections yet</div>' : ''}
      </div>
    </div>
  `;
}

function selectScale(fieldId, val, btn) {
  el(fieldId).value = val;
  btn.closest('.scale-row').querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function saveReflection() {
  const content = el('r-content').value;
  if (!content.trim()) { toast('write something first', true); return; }

  const payload = {
    mood: +el('r-mood').value || null,
    energy: +el('r-energy').value || null,
    productivity: +el('r-prod').value || null,
    content
  };

  await api('POST', '/reflections', payload);
  el('reflect-analysis').innerHTML = '<div class="loading">◦◦◦ analyzing with AI...</div>';

  try {
    const analysis = await api('POST', '/ai/reflect', payload);
    el('reflect-analysis').innerHTML = `
      <div class="ai-block">
        <div class="label">◆ AI ANALYSIS</div>
        <p>${escHtml(analysis.analysis)}</p>
        <br>
        ${(analysis.suggestions || []).map(s => `<div style="margin-top:4px">→ ${escHtml(s)}</div>`).join('')}
        ${analysis.tomorrow_plan ? `<div style="margin-top:8px;color:var(--accent2)">📅 Tomorrow: ${escHtml(analysis.tomorrow_plan)}</div>` : ''}
        <br>
        <em style="color:var(--accent)">${escHtml(analysis.encouragement)}</em>
        ${analysis.burnout_signal ? `<div style="color:var(--accent3);margin-top:8px">⚠ Burnout signal detected — consider a lighter day tomorrow</div>` : ''}
        ${(analysis.mood_signals||[]).length ? `<div style="font-size:0.72rem;color:var(--text3);margin-top:6px">Signals: ${analysis.mood_signals.join(', ')}</div>` : ''}
      </div>
    `;
    // Refresh reminders after reflection
    if (typeof loadSmartReminders === 'function') loadSmartReminders();
  } catch(e) {
    el('reflect-analysis').innerHTML = `<div class="error-msg">AI analysis unavailable</div>`;
  }

  toast('reflection saved');
}

// ── ENERGY ────────────────────────────────────────────────────
async function renderEnergy() {
  const v = el('view-energy');
  const logs = await api('GET', '/energy');
  const today = logs.find(l => l.date === new Date().toISOString().split('T')[0]);

  v.innerHTML = `
    <div class="page-title">⚡ ENERGY LOG</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">LOG TODAY</div>
        <div class="form-row">
          <label>Sleep hours</label>
          <input type="number" id="e-sleep" value="${today?.sleep_hours || ''}" min="0" max="12" step="0.5" placeholder="e.g. 7.5">
        </div>
        <div class="form-row">
          <div class="scale-label">Energy (1-5)</div>
          <div class="scale-row">${[1,2,3,4,5].map(n => `<button class="scale-btn ${today?.energy == n ? 'selected' : ''}" onclick="selectScale('e-energy', ${n}, this)">${n}</button>`).join('')}</div>
          <input type="hidden" id="e-energy" value="${today?.energy || ''}">
        </div>
        <div class="form-row">
          <div class="scale-label">Mood (1-5)</div>
          <div class="scale-row">${[1,2,3,4,5].map(n => `<button class="scale-btn ${today?.mood == n ? 'selected' : ''}" onclick="selectScale('e-mood', ${n}, this)">${n}</button>`).join('')}</div>
          <input type="hidden" id="e-mood" value="${today?.mood || ''}">
        </div>
        <div class="form-row">
          <div class="scale-label">Stress (1-5)</div>
          <div class="scale-row">${[1,2,3,4,5].map(n => `<button class="scale-btn ${today?.stress == n ? 'selected' : ''}" onclick="selectScale('e-stress', ${n}, this)">${n}</button>`).join('')}</div>
          <input type="hidden" id="e-stress" value="${today?.stress || ''}">
        </div>
        <div class="form-row"><label>Notes (optional)</label><textarea id="e-notes" rows="2">${escHtml(today?.notes || '')}</textarea></div>
        <button class="btn btn-accent" onclick="saveEnergy()">SAVE LOG</button>
      </div>
      <div>
        <div class="card-title">LAST 14 DAYS</div>
        ${logs.map(l => `
          <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="mono small">${l.date}</span>
            <span class="small">😴${l.sleep_hours || '?'}h ⚡${l.energy || '?'} 😊${l.mood || '?'} 😤${l.stress || '?'}</span>
          </div>`).join('')}
        ${!logs.length ? '<div class="empty">no logs yet</div>' : ''}
      </div>
    </div>
  `;
}

async function saveEnergy() {
  await api('POST', '/energy', {
    sleep_hours: +el('e-sleep').value || null,
    energy: +el('e-energy').value || null,
    mood: +el('e-mood').value || null,
    stress: +el('e-stress').value || null,
    notes: el('e-notes').value || null,
  });
  toast('energy logged'); renderEnergy();
}

// ── ANALYTICS ─────────────────────────────────────────────────
async function renderAnalytics() {
  const v = el('view-analytics');
  v.innerHTML = `<div class="loading">loading analytics...</div>`;

  const [overview, burnout, focusCat, goalProgress, velocity] = await Promise.all([
    api('GET', '/analytics/overview'),
    api('GET', '/analytics/burnout'),
    api('GET', '/analytics/focus-by-category').catch(() => []),
    api('GET', '/analytics/goal-progress').catch(() => []),
    api('GET', '/analytics/velocity').catch(() => ({ created: [], completed: [] })),
  ]);

  const heatmapHtml = buildHeatmap(overview.heatmap || []);
  const barHtml = buildCategoryBars(overview.byCategory || []);
  const burnoutColor = { low: 'badge-green', medium: 'badge-orange', high: 'badge-red' }[burnout.risk];

  // focus by category bars
  const focusBars = focusCat.length ? focusCat.map(f => {
    const maxM = Math.max(...focusCat.map(x => x.minutes), 1);
    return `<div class="bar-row">
      <div class="bar-label">${escHtml(f.name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${f.minutes/maxM*100}%;background:${f.color}"></div></div>
      <div class="bar-val">${f.minutes}m</div>
    </div>`;
  }).join('') : '<div class="empty">no focus data</div>';

  // goal progress bars
  const goalBars = goalProgress.filter(g => g.total_tasks > 0).map(g => {
    const pct = g.total_tasks ? Math.round(g.done_tasks / g.total_tasks * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-label">${escHtml(g.title)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
      <div class="bar-val">${pct}%</div>
    </div>`;
  }).join('') || '<div class="empty">no goals with tasks yet</div>';

  // velocity sparkline (simple text-based)
  const velHtml = buildVelocityChart(velocity);

  v.innerHTML = `
    <div class="page-title">📊 ANALYTICS</div>
    <div class="grid-4" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-val">${overview.streak}</div><div class="stat-label">STREAK</div></div>
      <div class="stat-card"><div class="stat-val">${overview.completionRate}%</div><div class="stat-label">COMPLETION</div></div>
      <div class="stat-card"><div class="stat-val">${overview.doneTasks}</div><div class="stat-label">DONE</div></div>
      <div class="stat-card"><div class="stat-val">${overview.overdue}</div><div class="stat-label">OVERDUE</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">ACTIVITY HEATMAP (30 DAYS)</div>
        ${heatmapHtml}
      </div>
      <div class="card">
        <div class="card-title">BURNOUT MONITOR</div>
        <div class="flex-gap" style="margin-bottom:0.5rem">
          <span>Risk: <span class="badge ${burnoutColor}">${burnout.risk.toUpperCase()}</span></span>
          <span class="small muted">score: ${burnout.burnoutScore}/6</span>
        </div>
        <div class="small">Weekly completion: <strong>${burnout.weeklyCompletionRate}%</strong></div>
        <div class="small">Overdue hard tasks: <strong>${burnout.hardFails}</strong></div>
        ${burnout.avgMood ? `<div class="small">Avg mood: <strong>${burnout.avgMood}/5</strong></div>` : ''}
        ${burnout.risk === 'high' ? `<div class="ai-block mt" style="color:var(--accent3)">⚠ High burnout risk detected. Consider reducing workload and taking a recovery day.</div>` : ''}
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">BY CATEGORY (TASKS)</div>
        <div class="bar-chart">${barHtml}</div>
      </div>
      <div class="card">
        <div class="card-title">FOCUS BY CATEGORY (7 DAYS)</div>
        <div class="bar-chart">${focusBars}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">GOAL PROGRESS</div>
        <div class="bar-chart">${goalBars}</div>
      </div>
      <div class="card">
        <div class="card-title">VELOCITY (4 WEEKS)</div>
        ${velHtml}
        <div class="flex-gap mt small muted">
          <span style="color:var(--accent)">■ completed</span>
          <span style="color:var(--text3)">■ created</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">FOCUS STATS (7 DAYS)</div>
      <div class="grid-3">
        <div><div class="stat-val" style="font-size:1.3rem">${Math.round(overview.focusMinutes)}m</div><div class="stat-label">TOTAL FOCUS</div></div>
        <div><div class="stat-val" style="font-size:1.3rem">${Math.round(overview.focusMinutes / 7)}m</div><div class="stat-label">DAILY AVG</div></div>
        <div><div class="stat-val" style="font-size:1.3rem">${Math.round(overview.focusMinutes / 60 * 10) / 10}h</div><div class="stat-label">TOTAL HOURS</div></div>
      </div>
    </div>
  `;
}

function buildVelocityChart(velocity) {
  // merge weeks
  const weeks = [...new Set([...velocity.created.map(r => r.week), ...velocity.completed.map(r => r.week)])].sort().slice(-4);
  if (!weeks.length) return '<div class="empty">not enough data</div>';
  const createdMap = Object.fromEntries(velocity.created.map(r => [r.week, r.n]));
  const doneMap = Object.fromEntries(velocity.completed.map(r => [r.week, r.n]));
  const maxN = Math.max(...weeks.map(w => Math.max(createdMap[w] || 0, doneMap[w] || 0)), 1);
  return `<div class="bar-chart">${weeks.map(w => {
    const c = createdMap[w] || 0;
    const d = doneMap[w] || 0;
    const label = 'W' + w.split('-W')[1];
    return `<div class="bar-row" style="align-items:center">
      <div class="bar-label">${label}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:2px">
        <div class="bar-track" style="height:7px"><div class="bar-fill" style="width:${d/maxN*100}%;background:var(--accent);height:7px"></div></div>
        <div class="bar-track" style="height:7px"><div class="bar-fill" style="width:${c/maxN*100}%;background:var(--text3);height:7px"></div></div>
      </div>
      <div class="bar-val" style="font-size:10px">${d}/${c}</div>
    </div>`;
  }).join('')}</div>`;
}

function buildHeatmap(data) {
  const map = {};
  data.forEach(d => map[d.day] = d.count);
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const count = map[key] || 0;
    const level = count === 0 ? '' : count <= 1 ? 'l1' : count <= 3 ? 'l2' : count <= 5 ? 'l3' : 'l4';
    cells.push(`<div class="heatmap-cell ${level}" title="${key}: ${count} tasks"></div>`);
  }
  return `<div class="heatmap">${cells.join('')}</div>`;
}

function buildCategoryBars(data) {
  if (!data.length) return '<div class="empty">no category data</div>';
  const max = Math.max(...data.map(d => d.total), 1);
  return `<div class="bar-chart">${data.map(d => `
    <div class="bar-row">
      <div class="bar-label">${escHtml(d.name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.total/max*100)}%;background:${d.color || 'var(--accent)'}"></div></div>
      <div class="bar-val">${d.done}/${d.total}</div>
    </div>`).join('')}</div>`;
}

// ── SETTINGS ──────────────────────────────────────────────────
async function renderSettings() {
  const v = el('view-settings');
  const cats = S.categories;

  v.innerHTML = `
    <div class="page-title">⚙ SETTINGS</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">CATEGORIES</div>
        <div id="cat-list">
          ${cats.map(c => `
            <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
              <span>${c.icon} <span style="color:${c.color}">${escHtml(c.name)}</span></span>
              <div class="flex-gap">
                <button class="btn btn-sm" onclick="editCategory(${c.id}, '${escHtml(c.name)}', '${c.color}', '${escHtml(c.icon)}')">edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">×</button>
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn-sm mt" onclick="openAddCategory()">+ ADD CATEGORY</button>
      </div>
      <div class="card">
        <div class="card-title">AI COACH</div>
        <div class="form-row">
          <label>Ask your AI coach anything</label>
          <textarea id="coach-q" rows="3" placeholder="e.g. How should I prepare for my exam next week?"></textarea>
        </div>
        <button class="btn btn-accent" onclick="askCoach()">ASK →</button>
        <div id="coach-answer" style="margin-top:1rem"></div>
      </div>
    </div>
    ${S.user?.role === 'owner' ? `<div class="card mt"><div class="card-title">ADMIN</div><a href="#" onclick="showView('admin')" class="btn btn-sm">Open Admin Panel</a></div>` : ''}
    <!-- Phase 3: AI Memory + Reminders + Export -->
    <div class="card mt">
      <div class="card-title">◆ AI MEMORY</div>
      <div style="font-size:0.75rem;color:var(--text3);margin-bottom:10px">What the AI has learned about your patterns — updated automatically.</div>
      <div id="memory-panel-container"><div class="loading small">◦◦◦ loading...</div></div>
    </div>
    <div class="grid-2 mt">
      <div class="card">
        <div class="card-title">🔔 REMINDER WIDGET</div>
        <div id="reminder-widget-container"><div class="loading small">◦◦◦ loading...</div></div>
      </div>
      <div class="card">
        <div class="card-title">◈ SUGGESTION HISTORY</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-bottom:6px">Adaptive suggestions you have accepted or dismissed.</div>
        <div id="suggestion-history-container"><div class="loading small">◦◦◦ loading...</div></div>
      </div>
    </div>
    <div class="card mt">
      <div class="card-title">⇅ DATA EXPORT / IMPORT</div>
      <div style="font-size:0.75rem;color:var(--text3);margin-bottom:10px">Export all your data as JSON or import from a previous backup.</div>
      <div class="flex-gap">
        <button class="btn btn-sm btn-accent" onclick="exportData()">⬇ EXPORT JSON</button>
        <button class="btn btn-sm" onclick="importData()">⬆ IMPORT JSON</button>
      </div>
    </div>
  `;

  // Load memory panel after render
  if (typeof renderMemoryPanel === 'function') renderMemoryPanel('memory-panel-container');
  if (typeof renderReminderWidget === 'function') renderReminderWidget('reminder-widget-container');
  if (typeof renderSuggestionHistory === 'function') renderSuggestionHistory('suggestion-history-container');
}

function openAddCategory() {
  openModal(`
    <div class="modal-title">ADD CATEGORY</div>
    <div class="form-row"><label>Name *</label><input id="nc-name"></div>
    <div class="form-row"><label>Icon (emoji)</label><input id="nc-icon" value="📁" style="width:80px"></div>
    <div class="form-row"><label>Color (hex)</label><input id="nc-color" type="text" value="#00ff88" style="width:120px"></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn btn-accent" onclick="addCategory()">ADD</button>
    </div>
  `);
}

async function addCategory() {
  await api('POST', '/categories', { name: el('nc-name').value, icon: el('nc-icon').value, color: el('nc-color').value });
  closeModal(); await loadCategories(); toast('category added'); renderSettings();
}

function editCategory(id, name, color, icon) {
  openModal(`
    <div class="modal-title">EDIT CATEGORY</div>
    <div class="form-row"><label>Name</label><input id="ec-name" value="${escHtml(name)}"></div>
    <div class="form-row"><label>Icon (emoji)</label><input id="ec-icon" value="${escHtml(icon)}" style="width:80px"></div>
    <div class="form-row"><label>Color (hex)</label><input id="ec-color" value="${color}" style="width:120px"></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn btn-accent" onclick="saveCategory(${id})">SAVE</button>
    </div>
  `);
}

async function saveCategory(id) {
  await api('PUT', `/categories/${id}`, { name: el('ec-name').value, icon: el('ec-icon').value, color: el('ec-color').value });
  closeModal(); await loadCategories(); toast('saved'); renderSettings();
}

async function deleteCategory(id) {
  if (!confirm('Delete category? Tasks will remain.')) return;
  await api('DELETE', `/categories/${id}`);
  await loadCategories(); toast('deleted'); renderSettings();
}

async function askCoach() {
  const q = el('coach-q').value.trim();
  if (!q) return;
  el('coach-answer').innerHTML = '<div class="loading">◦◦◦ thinking...</div>';
  try {
    const r = await api('POST', '/ai/coach', { question: q });
    el('coach-answer').innerHTML = `<div class="ai-block"><div class="label">◆ AI COACH</div>${escHtml(r.answer)}</div>`;
  } catch(e) {
    el('coach-answer').innerHTML = `<div class="error-msg">AI unavailable</div>`;
  }
}

// ── INIT ──────────────────────────────────────────────────────
(async () => {
  try {
    const me = await api('GET', '/auth/me');
    S.user = me;
    showApp();
  } catch(e) {
    // not logged in
  }

  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
