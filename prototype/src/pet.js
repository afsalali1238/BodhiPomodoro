const { $, fmt, esc: escHtml } = BodhiUtils;
const A = window.BodhiArt;
const svg = $('stage');

$('defsHost').innerHTML = A.defs();
$('standFlip').innerHTML = A.standingBuddha();
$('sit').innerHTML = A.sittingBuddha();

$('fallHost').innerHTML = [[60, 130, 0], [175, 125, 3], [115, 150, 6], [200, 100, 4.5], [40, 110, 7.5]]
  .map(([x, y, d]) => `<g transform="translate(${x},${y})"><g class="falling" style="animation-delay:${d}s">${A.leafSvg}</g></g>`).join('');

let treeStage = -1;
function setTree(stage) {
  if (stage === treeStage) return;
  treeStage = stage;
  $('treeHost').innerHTML = A.bodhiTree(stage);
}

const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const SIGN = { water: 'drink water', breathe: 'breathe slowly', stretch: 'stand & stretch', eyes: 'look far away',
  coffee: 'coffee break', walk: 'take a walk' };

// --- Inline Wizard State & Flow ---
let wizStep = 0;          // 0=closed, 1=time, 2=task, 3=apps
let wizData = { minutes: 25, taskId: null, newTask: '', focusApps: [], strict: true };
let cachedTasks = [];
let cachedApps = [];
let currentPhase = 'idle';
let askTaskOnStart = true;

function openWizard(step = 1) {
  if (currentPhase !== 'idle' && currentPhase !== 'ready') return;
  const wiz = $('wizard');
  if (!wiz) return;
  wizStep = step;
  wizData.taskId = null;
  wizData.newTask = '';
  wiz.style.display = 'block';

  if (step === 1) {
    window.bodhi.session.defaults().then(d => {
      if (d) {
        wizData.minutes = d.minutes || 25;
        wizData.focusApps = Array.isArray(d.focusApps) ? [...d.focusApps] : [];
        wizData.strict = d.strict !== undefined ? d.strict : true;
      }
      showWizStep1();
    }).catch(() => {
      showWizStep1();
    });
  } else if (step === 2) {
    showWizStep2();
  } else if (step === 3) {
    showWizStep3();
  }
}

function closeWizard() {
  wizStep = 0;
  const wiz = $('wizard');
  if (wiz) wiz.style.display = 'none';
}

// When "Ask for task on start" is disabled in Settings, skip straight past
// the task-picker step (step 2) to the focus-apps step, both when advancing
// and when going back.
function advanceFromStep1() {
  if (askTaskOnStart) showWizStep2();
  else showWizStep3();
}
function backFromStep3() {
  if (askTaskOnStart) showWizStep2();
  else showWizStep1();
}

function showWizStep1() {
  wizStep = 1;
  const body = $('wizBody');
  if (!body) return;
  const presets = [10, 15, 25, 50, 90];
  const isPreset = presets.includes(wizData.minutes);

  body.innerHTML = `
    <div class="wiz-hdr">
      <div class="wiz-hdr-title"><span>⏱ Duration</span></div>
      <button class="wiz-close-btn" id="wizBtnClose" title="Close">✕</button>
    </div>
    <div class="wiz-chips" id="wizTimeChips">
      ${presets.map(m => `<div class="wiz-chip${m === wizData.minutes ? ' on' : ''}" data-min="${m}">${m}m</div>`).join('')}
    </div>
    <div class="wiz-custom-row">
      <input type="number" id="wizCustomMin" class="wiz-input" min="1" max="240" placeholder="Custom" value="${isPreset ? '' : wizData.minutes}">
      <span style="font-size:10px; color:#a89c85;">min</span>
      <button class="wiz-btn-sm" id="wizCustomGo">Next →</button>
    </div>
    <button class="wiz-quick-btn" id="wizQuickStart">⚡ Quick Start (${wizData.minutes}m)</button>
  `;

  $('wizBtnClose').onclick = closeWizard;

  $('wizTimeChips').onclick = e => {
    const chip = e.target.closest('[data-min]');
    if (chip) {
      wizData.minutes = Number(chip.dataset.min) || 25;
      advanceFromStep1();
    }
  };

  const advanceCustom = () => {
    const v = Math.round(Number($('wizCustomMin').value));
    if (v >= 1 && v <= 240) {
      wizData.minutes = v;
      advanceFromStep1();
    }
  };

  $('wizCustomGo').onclick = advanceCustom;
  $('wizCustomMin').onkeydown = e => {
    if (e.key === 'Enter') advanceCustom();
  };

  $('wizQuickStart').onclick = () => {
    submitWizard();
  };
}

function showWizStep2() {
  wizStep = 2;
  const body = $('wizBody');
  if (!body) return;

  body.innerHTML = `
    <div class="wiz-hdr">
      <div class="wiz-hdr-title">
        <button class="wiz-back-btn" id="wizBtnBack" title="Back">←</button>
        <span>📝 Task</span>
      </div>
      <button class="wiz-close-btn" id="wizBtnClose" title="Close">✕</button>
    </div>
    <div style="font-size:9.5px; color:#a89c85; margin-bottom:4px;">Loading tasks…</div>
  `;

  $('wizBtnClose').onclick = closeWizard;
  $('wizBtnBack').onclick = () => showWizStep1();

  window.bodhi.tasks.list().then(res => {
    cachedTasks = (res && res.tasks) || [];
    renderStep2Content();
  }).catch(() => {
    renderStep2Content();
  });
}

function renderStep2Content() {
  if (wizStep !== 2) return;
  const body = $('wizBody');
  if (!body) return;

  const open = cachedTasks.filter(t => !t.done);

  body.innerHTML = `
    <div class="wiz-hdr">
      <div class="wiz-hdr-title">
        <button class="wiz-back-btn" id="wizBtnBack" title="Back">←</button>
        <span>📝 Task</span>
      </div>
      <button class="wiz-close-btn" id="wizBtnClose" title="Close">✕</button>
    </div>
    <div class="wiz-task-list" id="wizTaskList">
      <div class="wiz-task-row${!wizData.taskId && !wizData.newTask ? ' on' : ''}" data-task-id="">
        <span class="wiz-task-title" style="color:#a89c85;">No specific task (Skip)</span>
        <span class="wiz-task-badge">→</span>
      </div>
      ${open.map(t => `
        <div class="wiz-task-row${t.id === wizData.taskId ? ' on' : ''}" data-task-id="${escHtml(t.id)}">
          <span class="wiz-task-title">${escHtml(t.title)}</span>
          <span class="wiz-task-badge">${t.sessionsDone || 0}/${t.estimate || 1}</span>
        </div>
      `).join('')}
    </div>
    <div class="wiz-custom-row" style="margin-bottom:0;">
      <input type="text" id="wizNewTask" class="wiz-input" placeholder="+ New task… (Enter)" style="flex:1;" value="${escHtml(wizData.newTask || '')}">
      <button class="wiz-btn-sm" id="wizNewTaskGo">Next →</button>
    </div>
  `;

  $('wizBtnClose').onclick = closeWizard;
  $('wizBtnBack').onclick = () => showWizStep1();

  $('wizTaskList').onclick = e => {
    const row = e.target.closest('.wiz-task-row');
    if (row) {
      const id = row.dataset.taskId || null;
      wizData.taskId = id;
      wizData.newTask = '';
      showWizStep3();
    }
  };

  const advanceNewTask = () => {
    const title = $('wizNewTask').value.trim();
    if (title) {
      wizData.taskId = null;
      wizData.newTask = title;
    } else {
      wizData.taskId = null;
      wizData.newTask = '';
    }
    showWizStep3();
  };

  $('wizNewTaskGo').onclick = advanceNewTask;
  $('wizNewTask').onkeydown = e => {
    if (e.key === 'Enter') advanceNewTask();
  };
}

function showWizStep3() {
  wizStep = 3;
  const body = $('wizBody');
  if (!body) return;

  body.innerHTML = `
    <div class="wiz-hdr">
      <div class="wiz-hdr-title">
        <button class="wiz-back-btn" id="wizBtnBack" title="Back">←</button>
        <span>🔒 Focus Apps</span>
      </div>
      <button class="wiz-close-btn" id="wizBtnClose" title="Close">✕</button>
    </div>
    <div style="font-size:9.5px; color:#a89c85; margin-bottom:4px;">Scanning open apps…</div>
  `;

  $('wizBtnClose').onclick = closeWizard;
  $('wizBtnBack').onclick = backFromStep3;

  window.bodhi.apps.list().then(apps => {
    cachedApps = apps || [];
    renderStep3Content();
  }).catch(() => {
    renderStep3Content();
  });
}

function renderStep3Content() {
  if (wizStep !== 3) return;
  const body = $('wizBody');
  if (!body) return;

  const byProc = new Map((cachedApps || []).map(a => [a.process.toLowerCase(), a]));
  for (const p of wizData.focusApps) {
    if (!byProc.has(p.toLowerCase())) {
      byProc.set(p.toLowerCase(), { process: p, name: p, title: '' });
    }
  }
  const appList = [...byProc.values()];

  body.innerHTML = `
    <div class="wiz-hdr">
      <div class="wiz-hdr-title">
        <button class="wiz-back-btn" id="wizBtnBack" title="Back">←</button>
        <span>🔒 Focus Apps</span>
      </div>
      <button class="wiz-close-btn" id="wizBtnClose" title="Close">✕</button>
    </div>
    <div class="wiz-chips" id="wizAppChips" style="max-height:72px; overflow-y:auto;">
      ${appList.length ? appList.map(a => {
        const isSel = wizData.focusApps.some(p => p.toLowerCase() === a.process.toLowerCase());
        return `<div class="wiz-chip${isSel ? ' on' : ''}" data-proc="${escHtml(a.process)}">${escHtml(a.name)}</div>`;
      }).join('') : '<div style="color:#a89c85; font-size:9.5px; padding:2px;">No active apps detected</div>'}
    </div>
    <div class="wiz-switch${wizData.strict ? ' on' : ''}" id="wizStrictToggle">
      <span class="k"></span>
      <span class="wiz-switch-label">Strict mode (lasers if off-track)</span>
    </div>
    <button class="wiz-btn-primary" id="wizBtnStart">Start ${wizData.minutes}m Focus</button>
  `;

  $('wizBtnClose').onclick = closeWizard;
  $('wizBtnBack').onclick = backFromStep3;

  $('wizAppChips').onclick = e => {
    const chip = e.target.closest('[data-proc]');
    if (chip) {
      const proc = chip.dataset.proc;
      const idx = wizData.focusApps.findIndex(p => p.toLowerCase() === proc.toLowerCase());
      if (idx >= 0) {
        wizData.focusApps.splice(idx, 1);
        chip.classList.remove('on');
      } else {
        wizData.focusApps.push(proc);
        chip.classList.add('on');
      }
    }
  };

  $('wizStrictToggle').onclick = () => {
    wizData.strict = !wizData.strict;
    $('wizStrictToggle').classList.toggle('on', wizData.strict);
  };

  $('wizBtnStart').onclick = () => {
    submitWizard();
  };
}

function submitWizard() {
  const payload = {
    minutes: wizData.minutes,
    taskId: wizData.taskId,
    newTask: wizData.newTask,
    focusApps: [...wizData.focusApps],
    strict: wizData.strict
  };
  window.bodhi.session.start(payload).then(() => {
    closeWizard();
  }).catch(err => {
    console.error('Failed to start session:', err);
    closeWizard();
  });
}


window.bodhi.on('open-wizard', () => openWizard(1));

window.bodhi.on('state', st => {
  setTree(st.treeStage);
  currentPhase = st.phase;
  askTaskOnStart = st.settings.askTaskOnStart !== false;
  if (st.phase !== 'idle' && st.phase !== 'ready') {
    closeWizard();
  }
  const cls = [st.phase];
  if (st.paused) cls.push('paused');
  if (st.pauseReason === 'away') cls.push('away');
  if (!st.settings.walkAcross) cls.push('inscene');
  if (st.task) cls.push('has-task');
  if (st.activity) cls.push('act-' + st.activity);
  if (st.activityDone) cls.push('activity-done');
  if (st.nudged) cls.push('nudged');
  if (st.fx) cls.push('fx-' + st.fx);
  if ((st.petScale || 1) < 0.7) cls.push('compact');
  // idle: cycle through poses when not in focus
  if (st.phase === 'idle' || st.phase === 'ready') cls.push('idle', window._idlePose || 'listening');
  svg.setAttribute('class', cls.join(' '));

  const C = 226.2;
  const frac = st.total ? 1 - st.remaining / st.total : 0;
  $('ring').setAttribute('stroke-dashoffset', (C * (1 - frac)).toFixed(1));

  const label = {
    idle: 'Click to start',
    focus: st.paused ? (st.pauseReason === 'away' ? `Waiting for you · ${fmt(st.remaining)}` : `Paused · ${fmt(st.remaining)}`) : fmt(st.remaining),
    waking: 'Session complete',
    walkingOut: 'Walking out…',
    break: `${st.paused ? 'Break paused' : (st.isLongBreak ? 'Long break' : 'On a break')} · ${fmt(st.remaining)}`,
    returning: 'Returning…',
    ready: 'Back · click to sit'
  }[st.phase];
  $('label').textContent = st.fx === 'blast-shake' ? 'Return to the path' : label;

  // second line: current task (click to open tasks)
  const taskText = st.task ? `${clip(st.task.title, 30)}  ${st.task.done}/${st.task.est}` : (st.phase === 'idle' || st.phase === 'ready' ? '+ add a task' : '');
  $('taskLine').textContent = taskText;
  const two = !!taskText;
  const compact = (st.petScale || 1) < 0.7;
  $('label').setAttribute('dy', two ? (compact ? '-2' : '-1') : (compact ? '5.5' : '4'));
  $('taskLine').setAttribute('dy', compact ? '12.5' : '10.5');
  $('pillRect').setAttribute('y', two ? (compact ? '-17' : '-14') : '-12');
  $('pillRect').setAttribute('height', two ? (compact ? '34' : '29') : (compact ? '26' : '24'));

  // update start/pause button text
  const running = st.phase === 'focus' || st.phase === 'break';
  if ($('ctlToggle')) $('ctlToggle').textContent = running ? (st.paused ? '▶' : '⏸') : '▶';

  $('signText').textContent = st.nudged && !st.activityDone ? 'rest, please' : (SIGN[st.activity] || 'rest');
  $('signSub').textContent = st.activityDone ? 'done ✓' : 'tap when done';

  if (st.phase !== window._lastPhase) {
    const s = $('stand'); s.style.animation = 'none'; void s.getBBox(); s.style.animation = '';
    window._lastPhase = st.phase;
    // cycle through idle poses
    if (window._poseTimer) clearInterval(window._poseTimer);
    if (st.phase === 'idle' || st.phase === 'ready') {
      const poses = ['listening', 'reading'];
      window._poseTimer = setInterval(() => {
        window._idlePose = poses[Math.floor(Math.random() * poses.length)];
        svg.classList.remove('listening', 'reading');
        svg.classList.add(window._idlePose);
      }, 8000);
    }
  }
});

// --- soft temple bell (WebAudio) ---
let ctx;
window.bodhi.on('chime', on => {
  if (!on) return;
  ctx = ctx || new AudioContext();
  const t = ctx.currentTime;
  [[528, .3], [792, .15], [1056, .08], [1320, .05]].forEach(([f, g]) => {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .01);
    v.gain.exponentialRampToValueAtTime(.0001, t + 4);
    o.connect(v).connect(ctx.destination); o.start(t); o.stop(t + 4.1);
  });
});

// --- click vs drag vs buttons ---
let down = null;
svg.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  // If clicking inside the wizard HTML, ignore so standard HTML controls work
  if (e.target.closest('#wizBody')) return;
  // If wizard is open and user clicks outside, close it
  if (wizStep > 0) {
    closeWizard();
    return;
  }
  const act = e.target.closest('[data-act]');
  down = { x: e.screenX, y: e.screenY, moved: false, act: act && act.dataset.act };
  // prevent drag if clicking any control button
  if (!down.act && !e.target.closest('#ctl')) window.bodhi.dragStart({ x: e.screenX, y: e.screenY });
});
window.addEventListener('mousemove', e => {
  if (!down || down.act) return;
  if (Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) > 4) down.moved = true;
  if (down.moved) window.bodhi.dragMove({ x: e.screenX, y: e.screenY });
});
window.addEventListener('mouseup', () => {
  if (!down) return;
  if (down.act) {
    if (down.act === 'timer') openWizard(1);
    else window.bodhi.petAction(down.act);
  } else {
    window.bodhi.dragEnd();
    if (!down.moved) window.bodhi.toggle();
  }
  down = null;
});

svg.addEventListener('dblclick', e => {
  if (e.target.closest('#wizBody')) return;
  if (!e.target.closest('[data-act]')) window.bodhi.petAction('tasks');
});
svg.addEventListener('contextmenu', e => {
  if (e.target.closest('#wizBody')) return;
  e.preventDefault();
  window.bodhi.menu();
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && wizStep > 0) {
    closeWizard();
  }
});
