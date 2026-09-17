// Start-session panel: time chips, task pick/add, focus apps, strict lasers. Plus Tasks and Today tabs.
const $ = id => document.getElementById(id);
const B = window.bodhi;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const hm = m => m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
const BREAK_FOR = { 15: 3, 25: 5, 50: 10, 90: 20 };

const ui = { minutes: 25, taskId: null, apps: new Set(), strict: true, presets: [10, 15, 25, 50, 90] };

const db = { tasks: [], currentTaskId: null };
const known = [];          // [{process, name, title}]
let state = null;

// ---------- tabs ----------
function showTab(name) {
  document.querySelectorAll('nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + name));
  $('foot').style.display = name === 'start' && !isRunning() ? '' : 'none';
  if (name === 'tasks') setTimeout(() => $('taskAdd').focus(), 50);
}
document.querySelectorAll('nav [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
B.on('launcher-tab', t => { showTab(t || 'start'); refreshApps(); });
$('gear').onclick = $('openSettings').onclick = () => B.open('settings');
$('openReport').onclick = () => B.open('report');

// ---------- time ----------
function renderTimes() {
  const isPreset = ui.presets.includes(ui.minutes);
  $('times').innerHTML = ui.presets.map(m => `<div class="chip ${m === ui.minutes ? 'on' : ''}" data-min="${m}">${m}</div>`).join('') +
    `<label class="chip custom ${isPreset ? '' : 'on'}"><input id="customMin" type="number" min="1" max="240" placeholder="—" value="${isPreset ? '' : ui.minutes}">m</label>`;
  $('customMin').oninput = e => { const v = Math.round(+e.target.value); if (v >= 1 && v <= 240) { ui.minutes = v; renderTimes(); $('customMin').focus(); const i = $('customMin'); i.setSelectionRange(i.value.length, i.value.length); } };
  const brk = BREAK_FOR[ui.minutes] || Math.max(3, Math.min(20, Math.round(ui.minutes / 5)));
  $('breakHint').textContent = `${brk}m break`;
  renderGo();
}
$('times').addEventListener('click', e => { const c = e.target.closest('[data-min]'); if (c) { ui.minutes = +c.dataset.min; renderTimes(); } });

// ---------- task pick ----------
function renderPick() {
  const open = db.tasks.filter(t => !t.done);
  const rows = [`<div class="row ${ui.taskId === null && !$('newTask').value.trim() ? 'on' : ''}" data-id=""><span class="radio"></span><span class="t muted">No specific task</span></div>`]
    .concat(open.map(t => `<div class="row ${t.id === ui.taskId && !$('newTask').value.trim() ? 'on' : ''}" data-id="${t.id}">
      <span class="radio"></span><span class="t">${esc(t.title)}</span><span class="n">${t.sessionsDone || 0}/${t.estimate}</span><button class="x done-btn" title="Mark done" data-done="${t.id}">✓</button></div>`));
  $('pickList').innerHTML = rows.join('');
}
$('pickList').addEventListener('click', e => {
  const r = e.target.closest('.row'); const doneBtn = e.target.closest('[data-done]');
  if (doneBtn) { B.tasks.update(doneBtn.dataset.done, { done: true }).then(() => renderAll()); }
  if (r) { ui.taskId = r.dataset.id || null; $('newTask').value = ''; renderPick(); renderGo(); }
});
$('newTask').oninput = () => { renderPick(); renderGo(); };
$('newTask').onkeydown = e => { if (e.key === 'Enter') start(); };

// ---------- apps ----------
function renderApps() {
  const byProc = new Map(known.map(a => [a.process.toLowerCase(), a]));
  for (const p of ui.apps) if (!byProc.has(p.toLowerCase())) byProc.set(p.toLowerCase(), { process: p, name: p, title: 'not open right now' });
  const list = [...byProc.values()];
  $('apps').innerHTML = list.length
    ? list.map(a => `<div class="chip app ${[...ui.apps].some(x => x.toLowerCase() === a.process.toLowerCase()) ? 'on' : ''}" data-proc="${esc(a.process)}" title="${esc(a.title)}"><span class="dot"></span>${esc(a.name)}</div>`).join('')
    : '<span class="muted">No open apps found. Add one by name below.</span>';
  const n = ui.apps.size;
  $('strict').classList.toggle('on', ui.strict);
  $('strictHint').textContent = !ui.strict ? 'Off: only your distraction list (YouTube, Instagram…) fires lasers'
    : n ? `Anything other than ${n === 1 ? 'this app' : `these ${n} apps`} fires the lasers` : 'Select at least one app above';
  renderGo();
}
$('apps').addEventListener('click', e => {
  const c = e.target.closest('[data-proc]'); if (!c) return;
  const p = c.dataset.proc, hit = [...ui.apps].find(x => x.toLowerCase() === p.toLowerCase());
  hit ? ui.apps.delete(hit) : ui.apps.add(p);
  renderApps();
});
$('addApp').onkeydown = e => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  ui.apps.add(e.target.value.trim().replace(/\.exe$/i, '')); e.target.value = ''; renderApps();
};
$('strict').onclick = () => { ui.strict = !ui.strict; renderApps(); };
let loadingApps = false;
async function refreshApps() {
  if (loadingApps) return; loadingApps = true;
  $('refresh').textContent = '↻ …';
  known = await B.apps.list();
  loadingApps = false; $('refresh').textContent = '↻ refresh';
  renderApps();
}
$('refresh').onclick = refreshApps;

// ---------- start ----------
function renderGo() {
  const needApps = ui.strict && ui.apps.size === 0;
  const nt = $('newTask').value.trim();
  const task = nt || (db.tasks.find(t => t.id === ui.taskId) || {}).title;
  $('go').textContent = `Start ${ui.minutes} min${task ? ` · ${task.length > 22 ? task.slice(0, 21) + '…' : task}` : ' focus'}`;
  $('go').disabled = needApps;
  $('go').title = needApps ? 'Pick your focus apps or turn off “Lasers if I leave these apps”' : '';
}
async function start() {
  if ($('go').disabled) return;
  await B.session.start({ minutes: ui.minutes, taskId: ui.taskId, newTask: $('newTask').value, focusApps: [...ui.apps], strict: ui.strict });
  $('newTask').value = '';
}
$('go').onclick = start;

// ---------- running session card ----------
const isRunning = () => state && !['idle', 'ready'].includes(state.phase);
function renderRunning() {
  const run = isRunning();
  $('setup').style.display = run ? 'none' : '';
  $('running').style.display = run ? '' : 'none';
  if ($('tab-start').classList.contains('on')) $('foot').style.display = run ? 'none' : '';
  if (!run) return;
  const st = state;
  const names = { focus: st.paused ? (st.pauseReason === 'away' ? 'Waiting for you' : 'Paused') : 'Meditating', waking: 'Session complete — how did it go?',
    walkingOut: 'Walking out…', break: st.isLongBreak ? 'Long break' : 'Break', returning: 'Returning…' };
  $('nowPhase').textContent = names[st.phase] || st.phase;
  $('nowTime').textContent = ['focus', 'break'].includes(st.phase) ? fmt(st.remaining) : '—';
  $('nowTask').textContent = st.task ? `${st.task.title} · ${st.task.done}/${st.task.est}` : 'No specific task';
  const apps = (st.session && st.session.apps) || [];
  $('nowApps').innerHTML = apps.length ? apps.map(a => `<span class="chip">${esc((known.find(k => k.process.toLowerCase() === a.toLowerCase()) || { name: a }).name)}</span>`).join('') : '';
  const b = [];
  if (st.phase === 'waking') {
    if (st.task) b.push('<button class="good" data-pa="done">Done ✓</button>');
    b.push('<button data-pa="extend">+5 min</button>', '<button data-pa="go">Not yet</button>');
  } else if (st.phase === 'focus' || st.phase === 'break') {
    b.push(`<button data-a="start">${st.paused ? 'Resume' : 'Pause'}</button>`, '<button data-a="skip">Skip</button>', '<button data-a="reset">End</button>');
    if (st.phase === 'break' && !st.activityDone) b.unshift('<button class="good" data-pa="activity">Did it ✓</button>');
  } else b.push('<button data-a="skip">Skip</button>');
  $('nowBtns').innerHTML = b.join('');
}
$('nowBtns').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.pa) B.petAction(t.dataset.pa); else B.action(t.dataset.a);
});

// ---------- tasks tab ----------
function parseTask(text) {
  const m = text.match(/\s(\d{1,2})\s*(p|x|pomo|poms?|sessions?)\s*$/i);
  return m ? { title: text.slice(0, m.index).trim(), estimate: +m[1] } : { title: text.trim(), estimate: 1 };
}
function renderTasks() {
  const open = db.tasks.filter(t => !t.done);
  const today = new Date().toDateString();
  const done = db.tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt).toDateString() === today);
  $('openList').innerHTML = open.length ? open.map(t => `<div class="row" data-id="${t.id}">
      <button class="x done-btn" data-a="done" title="Mark done">✓</button><span class="t">${esc(t.title)}</span>
      <span class="n">${t.sessionsDone || 0}/${t.estimate}</span><button class="x" data-a="del" title="Delete">✕</button></div>`).join('')
    : '<div class="empty">Nothing open. Add a task above.</div>';
  $('doneList').innerHTML = done.length ? done.map(t => `<div class="row" data-id="${t.id}" style="opacity:.7">
      <button class="x" data-a="undo" title="Reopen">↺</button><span class="t" style="text-decoration:line-through">${esc(t.title)}</span>
      <span class="n">${t.sessionsDone || 0} sess.</span></div>`).join('') : '<div class="empty">Nothing yet.</div>';
}
$('taskAdd').onkeydown = async e => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  db = await B.tasks.add(parseTask(e.target.value)); e.target.value = ''; renderAll();
};
$('tab-tasks').addEventListener('click', async e => {
  const btn = e.target.closest('[data-a]'), row = e.target.closest('.row[data-id]');
  if (!btn || !row) return;
  const id = row.dataset.id;
  if (btn.dataset.a === 'done') db = await B.tasks.update(id, { done: true });
  if (btn.dataset.a === 'undo') db = await B.tasks.update(id, { done: false });
  if (btn.dataset.a === 'del') db = await B.tasks.remove(id);
  renderAll();
});

// ---------- today ----------
function renderToday() {
  if (!state || !state.today) return;
  $('kFocus').textContent = hm(state.today.focusMin); $('kSess').textContent = state.today.sessions;
  $('kDis').textContent = state.today.distractions;
  const today = new Date().toDateString();
  $('kDone').textContent = db.tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt).toDateString() === today).length;
}

function renderAll() { renderPick(); renderTasks(); renderToday(); renderGo(); }

B.on('state', async st => {
  const phaseChanged = !state || state.phase !== st.phase;
  state = st;
  if (phaseChanged) { db = await B.tasks.list(); renderAll(); }
  renderRunning(); renderToday();
});

(async () => {
  const d = await B.session.defaults();
  ui.minutes = d.minutes || 25; ui.presets = d.presets || ui.presets; ui.strict = d.strict !== false;
  (d.focusApps || []).forEach(a => ui.apps.add(a));
  db = await B.tasks.list();
  ui.taskId = db.currentTaskId && db.tasks.some(t => t.id === db.currentTaskId && !t.done) ? db.currentTaskId : null;
  renderTimes(); renderAll(); renderApps();
  refreshApps();
})();
