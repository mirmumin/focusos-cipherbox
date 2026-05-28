// ── PHASE 2 FRONTEND EXTENSIONS ──────────────────────────────
// Subtasks, dashboard widget customization, mobile touch helpers,
// goal progress view, task filtering by tag

// ── SUBTASKS ─────────────────────────────────────────────────
async function loadSubtasks(taskId) {
  const c = el('subtask-list');
  if (!c) return;
  try {
    const subs = await api('GET', `/tasks/${taskId}/subtasks`);
    if (!subs.length) {
      c.innerHTML = '<div class="empty" style="padding:4px;text-align:left">no subtasks</div>';
      return;
    }
    c.innerHTML = subs.map(s => `
      <div class="subtask-item flex-between" id="sub-${s.id}">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1">
          <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubtask(${s.id}, ${taskId}, this.checked)">
          <span style="${s.done ? 'text-decoration:line-through;color:var(--text3)' : ''}">${escHtml(s.title)}</span>
        </label>
        <button class="btn btn-sm btn-danger" style="padding:1px 6px" onclick="deleteSubtask(${s.id}, ${taskId})">×</button>
      </div>`).join('');
  } catch(e) {
    c.innerHTML = '<div class="error-msg">failed to load</div>';
  }
}

async function addSubtask(taskId) {
  const inp = el('new-subtask');
  const title = inp?.value?.trim();
  if (!title) return;
  await api('POST', `/tasks/${taskId}/subtasks`, { title });
  inp.value = '';
  loadSubtasks(taskId);
}

async function toggleSubtask(subId, taskId, done) {
  await api('PUT', `/subtasks/${subId}`, { done });
  loadSubtasks(taskId);
}

async function deleteSubtask(subId, taskId) {
  await api('DELETE', `/subtasks/${subId}`);
  loadSubtasks(taskId);
}

// Enter key in subtask input
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'new-subtask') {
    const m = el('modal');
    if (!m) return;
    // find the task id from the addSubtask onclick
    const btn = m.querySelector('[onclick^="addSubtask"]');
    if (btn) btn.click();
  }
});

// ── DASHBOARD WIDGET CUSTOMIZATION ───────────────────────────
let widgetLayout = null;

async function loadWidgetLayout() {
  try {
    const r = await api('GET', '/widgets/layout');
    widgetLayout = r.layout;
  } catch(e) {
    widgetLayout = getDefaultWidgets();
  }
}

function getDefaultWidgets() {
  return [
    { id: 'stats', title: 'Stats', visible: true, order: 0 },
    { id: 'urgent', title: 'Urgent Tasks', visible: true, order: 1 },
    { id: 'pending', title: 'Pending Tasks', visible: true, order: 2 },
    { id: 'focus', title: 'Focus This Week', visible: true, order: 3 },
    { id: 'insight', title: 'AI Insight', visible: true, order: 4 },
    { id: 'goals', title: 'Goals Progress', visible: false, order: 5 },
    { id: 'heatmap', title: 'Heatmap', visible: false, order: 6 },
  ];
}

async function saveWidgetLayout() {
  if (!widgetLayout) return;
  await api('PUT', '/widgets/layout', { layout: widgetLayout }).catch(() => {});
}

function openWidgetSettings() {
  if (!widgetLayout) widgetLayout = getDefaultWidgets();
  const sorted = [...widgetLayout].sort((a, b) => a.order - b.order);
  openModal(`
    <div class="modal-title">CUSTOMIZE DASHBOARD</div>
    <div class="small muted" style="margin-bottom:0.75rem">Toggle widgets on/off</div>
    ${sorted.map(w => `
      <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border)">
        <span>${escHtml(w.title)}</span>
        <label class="toggle-switch">
          <input type="checkbox" id="wt-${w.id}" ${w.visible ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>`).join('')}
    <div class="modal-footer" style="margin-top:0.75rem">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn btn-accent" onclick="applyWidgetSettings()">SAVE</button>
    </div>
  `);
}

async function applyWidgetSettings() {
  if (!widgetLayout) widgetLayout = getDefaultWidgets();
  widgetLayout = widgetLayout.map(w => ({
    ...w,
    visible: el('wt-' + w.id)?.checked ?? w.visible
  }));
  await saveWidgetLayout();
  closeModal();
  toast('dashboard updated');
  renderDashboard();
}

// Patch renderDashboard to use widget layout
const _origRenderDashboard = window.renderDashboard;
window.renderDashboard = async function() {
  if (!widgetLayout) await loadWidgetLayout();

  const v = el('view-dashboard');
  v.innerHTML = `<div class="loading">loading dashboard...</div>`;

  const visible = [...widgetLayout].sort((a, b) => a.order - b.order).filter(w => w.visible).map(w => w.id);

  const [tasks, analytics] = await Promise.all([
    api('GET', '/tasks?status=pending'),
    api('GET', '/analytics/overview'),
  ]);

  let insightHtml = '';
  if (visible.includes('insight')) {
    try {
      const ins = await api('GET', '/ai/insight');
      if (ins.insight) insightHtml = `<div class="ai-block" style="margin-bottom:0.75rem"><div class="label">◆ AI INSIGHT</div>${escHtml(ins.insight)}</div>`;
    } catch(e) {}
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const urgent = tasks.filter(t => t.due_date && (t.due_date * 1000) < Date.now() + 86400000 * 2).slice(0, 5);
  const recent = tasks.slice(0, 8);

  const widgets = {
    stats: `<div class="grid-4" style="margin-bottom:0.75rem">
      <div class="stat-card"><div class="stat-val">${analytics.streak}</div><div class="stat-label">STREAK</div></div>
      <div class="stat-card"><div class="stat-val">${analytics.todayDone}</div><div class="stat-label">TODAY</div></div>
      <div class="stat-card"><div class="stat-val">${analytics.completionRate}%</div><div class="stat-label">DONE RATE</div></div>
      <div class="stat-card"><div class="stat-val">${Math.round(analytics.focusMinutes/60*10)/10}h</div><div class="stat-label">FOCUS/WK</div></div>
    </div>`,
    insight: insightHtml,
    urgent: `<div style="margin-bottom:0.75rem">
      <div class="card-title">⚡ URGENT / DUE SOON</div>
      ${urgent.length ? urgent.map(t => taskRow(t)).join('') : '<div class="empty">no urgent tasks</div>'}
    </div>`,
    pending: `<div style="margin-bottom:0.75rem">
      <div class="card-title flex-between"><span>✓ PENDING</span><a href="#" onclick="showView('tasks')" style="color:var(--accent2);font-size:11px">view all →</a></div>
      ${recent.length ? recent.map(t => taskRow(t)).join('') : '<div class="empty">no tasks</div>'}
    </div>`,
    focus: `<div class="card" style="margin-bottom:0.75rem">
      <div class="card-title">⏱ FOCUS TREND (7 DAYS)</div>
      <div id="dash-focus-mini"><div class="loading" style="font-size:11px">loading...</div></div>
    </div>`,
    goals: `<div class="card" style="margin-bottom:0.75rem">
      <div class="card-title">🎯 GOAL PROGRESS</div>
      <div id="dash-goals-mini"><div class="loading" style="font-size:11px">loading...</div></div>
    </div>`,
    heatmap: `<div class="card" style="margin-bottom:0.75rem">
      <div class="card-title">◼ ACTIVITY (30 DAYS)</div>
      ${buildHeatmap(analytics.heatmap || [])}
    </div>`,
  };

  v.innerHTML = `
    <div class="page-title flex-between">
      <span>⬛ DASHBOARD</span>
      <div class="flex-gap">
        <span class="muted small" style="font-size:11px">${today}</span>
        <button class="btn btn-sm" onclick="openWidgetSettings()" title="Customize widgets">⚙</button>
      </div>
    </div>
    <div class="grid-2">
      <div>
        ${visible.includes('stats') ? widgets.stats : ''}
        ${visible.includes('insight') ? widgets.insight : ''}
        ${visible.includes('urgent') ? widgets.urgent : ''}
        ${visible.includes('pending') ? widgets.pending : ''}
      </div>
      <div>
        ${visible.includes('focus') ? widgets.focus : ''}
        ${visible.includes('goals') ? widgets.goals : ''}
        ${visible.includes('heatmap') ? widgets.heatmap : ''}
      </div>
    </div>
  `;

  // Async-load mini widgets
  if (visible.includes('focus')) {
    api('GET', '/analytics/focus-by-category').then(data => {
      const c = el('dash-focus-mini');
      if (!c) return;
      if (!data.length) { c.innerHTML = '<div class="empty" style="padding:4px">no focus sessions this week</div>'; return; }
      const max = Math.max(...data.map(d => d.minutes), 1);
      c.innerHTML = data.slice(0, 4).map(d => `
        <div class="bar-row" style="margin-bottom:2px">
          <div class="bar-label">${escHtml(d.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${d.minutes/max*100}%;background:${d.color}"></div></div>
          <div class="bar-val">${d.minutes}m</div>
        </div>`).join('');
    }).catch(() => {});
  }

  if (visible.includes('goals')) {
    api('GET', '/analytics/goal-progress').then(data => {
      const c = el('dash-goals-mini');
      if (!c) return;
      const withTasks = data.filter(g => g.total_tasks > 0).slice(0, 4);
      if (!withTasks.length) { c.innerHTML = '<div class="empty" style="padding:4px">no goals with tasks yet</div>'; return; }
      c.innerHTML = withTasks.map(g => {
        const pct = Math.round(g.done_tasks / g.total_tasks * 100);
        return `<div class="bar-row" style="margin-bottom:2px">
          <div class="bar-label">${escHtml(g.title)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--accent2)"></div></div>
          <div class="bar-val">${pct}%</div>
        </div>`;
      }).join('');
    }).catch(() => {});
  }
};

// ── GOALS VIEW: show task count per project ───────────────────
const _origRenderGoals = window.renderGoals;
window.renderGoals = async function() {
  const v = el('view-goals');
  const [goals, projects, tasks] = await Promise.all([
    api('GET', '/goals'),
    api('GET', '/projects'),
    api('GET', '/tasks'),
  ]);

  // Build task counts per project
  const projTaskCount = {};
  const projTaskDone = {};
  tasks.forEach(t => {
    if (t.project_id) {
      projTaskCount[t.project_id] = (projTaskCount[t.project_id] || 0) + 1;
      if (t.status === 'done') projTaskDone[t.project_id] = (projTaskDone[t.project_id] || 0) + 1;
    }
  });

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
        ${goals.length ? goals.map(g => {
          // compute goal progress from projects
          const gProjs = projects.filter(p => p.goal_id === g.id);
          const gTotal = gProjs.reduce((s, p) => s + (projTaskCount[p.id] || 0), 0);
          const gDone = gProjs.reduce((s, p) => s + (projTaskDone[p.id] || 0), 0);
          const pct = gTotal ? Math.round(gDone / gTotal * 100) : null;
          return `
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
            ${pct !== null ? `<div class="goal-progress-bar mt"><div class="goal-progress-fill" style="width:${pct}%"></div></div><div class="small muted">${gDone}/${gTotal} tasks (${pct}%)</div>` : ''}
          </div>`;
        }).join('') : '<div class="empty">no goals yet</div>'}
      </div>
      <div>
        <div class="card-title">PROJECTS</div>
        ${projects.length ? projects.map(p => {
          const total = projTaskCount[p.id] || 0;
          const done = projTaskDone[p.id] || 0;
          const pct = total ? Math.round(done / total * 100) : null;
          return `
          <div class="card" style="margin-bottom:6px">
            <div class="flex-between">
              <div>
                <strong>${escHtml(p.title)}</strong>
                ${p.category_name ? `<span class="tag">${escHtml(p.category_name)}</span>` : ''}
                <span class="badge ${p.status==='active'?'badge-blue':'badge-red'}">${p.status}</span>
              </div>
              <div class="flex-gap">
                <button class="btn btn-sm" onclick="showProjectTasks(${p.id}, '${escHtml(p.title)}')">tasks</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id})">×</button>
              </div>
            </div>
            ${p.goal_title ? `<div class="small muted">goal: ${escHtml(p.goal_title)}</div>` : ''}
            ${pct !== null ? `<div class="goal-progress-bar mt"><div class="goal-progress-fill" style="width:${pct}%;background:var(--accent2)"></div></div><div class="small muted">${done}/${total} tasks</div>` : ''}
          </div>`;
        }).join('') : '<div class="empty">no projects yet</div>'}
      </div>
    </div>
  `;
};

async function showProjectTasks(projectId, projectTitle) {
  const tasks = await api('GET', `/tasks?project_id=${projectId}`);
  openModal(`
    <div class="modal-title">📂 ${escHtml(projectTitle)}</div>
    <div style="max-height:60vh;overflow-y:auto">
      ${tasks.length ? tasks.map(t => taskRow(t)).join('') : '<div class="empty">no tasks in this project</div>'}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">close</button>
      <button class="btn btn-accent" onclick="closeModal();openAddTask({project_id:${projectId}})">+ ADD TASK</button>
    </div>
  `);
}

// ── TASKS: filter by tag & project ───────────────────────────
const _origRenderTasks = window.renderTasks;
window.renderTasks = async function() {
  const v = el('view-tasks');
  const params = new URLSearchParams();
  if (taskFilter.status) params.set('status', taskFilter.status);
  if (taskFilter.category_id) params.set('category_id', taskFilter.category_id);
  if (taskFilter.project_id) params.set('project_id', taskFilter.project_id);
  if (taskFilter.tag) params.set('tag', taskFilter.tag);

  const [tasks, projects] = await Promise.all([
    api('GET', `/tasks?${params}`),
    api('GET', '/projects'),
  ]);

  const projOpts = '<option value="">All projects</option>' +
    projects.map(p => `<option value="${p.id}" ${taskFilter.project_id == p.id ? 'selected' : ''}>${escHtml(p.title)}</option>`).join('');

  v.innerHTML = `
    <div class="page-title flex-between">
      <span>✓ TASKS</span>
      <button class="btn btn-accent btn-sm" onclick="openAddTask()">+ ADD TASK</button>
    </div>
    <div class="task-filters">
      <select onchange="taskFilter.status=this.value;renderTasks()" style="width:auto">
        <option value="pending" ${taskFilter.status==='pending'?'selected':''}>Pending</option>
        <option value="done" ${taskFilter.status==='done'?'selected':''}>Done</option>
        <option value="" ${taskFilter.status===''?'selected':''}>All</option>
      </select>
      <select onchange="taskFilter.category_id=this.value;renderTasks()" style="width:auto">
        <option value="">All categories</option>
        ${S.categories.map(c => `<option value="${c.id}" ${taskFilter.category_id==c.id?'selected':''}>${c.icon} ${escHtml(c.name)}</option>`).join('')}
      </select>
      <select onchange="taskFilter.project_id=this.value;renderTasks()" style="width:auto">
        ${projOpts}
      </select>
      <input type="text" placeholder="tag filter…" value="${escHtml(taskFilter.tag||'')}"
        style="width:120px;margin:0"
        oninput="taskFilter.tag=this.value"
        onkeydown="if(event.key==='Enter')renderTasks()">
    </div>
    <div id="task-list">
      ${tasks.length ? tasks.map(t => taskRow(t)).join('') : '<div class="empty">no tasks found</div>'}
    </div>
    <div class="small muted mt" style="text-align:right">${tasks.length} task${tasks.length!==1?'s':''}</div>
  `;
};

// Also expose taskFilter.project_id (add to existing object if not present)
if (typeof taskFilter !== 'undefined' && !('project_id' in taskFilter)) {
  taskFilter.project_id = '';
  taskFilter.tag = '';
}

// ── MOBILE: swipe to close sidebar ───────────────────────────
(function() {
  let startX = 0;
  document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const sidebar = el('sidebar');
    if (!sidebar) return;
    if (dx < -60 && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    if (dx > 60 && startX < 30) sidebar.classList.add('open');
  }, { passive: true });
})();

// ── INIT PHASE 2 ──────────────────────────────────────────────
// Pre-load widget layout when app starts
const _origShowApp = window.showApp;
window.showApp = function() {
  _origShowApp();
  loadWidgetLayout().catch(() => {});
};
