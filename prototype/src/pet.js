const $ = id => document.getElementById(id);
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

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const SIGN = { water: 'drink water', breathe: 'breathe slowly', stretch: 'stand & stretch', eyes: 'look far away',
  coffee: 'coffee break', walk: 'take a walk' };

// Expose startSession on window.bodhi
window.bodhi.startSession = minutes => {
  window.bodhi.send('start-session', minutes);
};

window.bodhi.on('state', st => {
  setTree(st.treeStage);
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
    idle: 'Click to meditate',
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

  $('signText').textContent = st.nudged && !st.activityDone ? 'rest, please' : (SIGN[st.activity] || 'rest');
  $('signSub').textContent = st.activityDone ? 'done ✓' : 'tap when done';

  if (st.phase !== window._lastPhase) {
    const s = $('stand'); s.style.animation = 'none'; void s.getBBox(); s.style.animation = '';
    window._lastPhase = st.phase;
    // cycle through idle poses
    if (window._poseTimer) clearInterval(window._poseTimer);
    if (st.phase === 'idle' || st.phase === 'ready') {
      const poses = ['listening', 'reading', 'listening'];
      window._poseTimer = setInterval(() => {
        window._idlePose = poses[Math.floor(Math.random() * 3)];
        svg.setAttribute('class', [...svg.classList].join(' '));
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
  if (down.act) window.bodhi.petAction(down.act);
  else { window.bodhi.dragEnd(); if (!down.moved) window.bodhi.toggle(); }
  down = null;
});
// control buttons (toggle/tasks/settings)
svg.addEventListener('click', e => {
  const ctl = e.target.closest('#ctl .btn');
  if (ctl && ctl.dataset.act) window.bodhi.petAction(ctl.dataset.act);
});
// quick buttons (timer/tasks/settings)
svg.addEventListener('click', e => {
  const q = e.target.closest('#quick .btn');
  if (q && q.dataset.act) {
    if (q.dataset.act === 'timer') {
      // show time popup
      const popup = $('timePopup');
      if (!popup) return;
      const timeOpts = $('timeOpts');
      if (timeOpts.innerHTML === '') {
        const presets = [10, 15, 25, 50, 90];
        timeOpts.innerHTML = presets.map((m, i) => 
          `<g class="timeChip" data-min="${m}" transform="translate(${i*18}-10)">
            <rect x="0" y="0" width="16" height="10" rx="2"/>
            <text x="8" y="7" text-anchor="middle">${m}</text>
          </g>`
        ).join('');
        timeOpts.addEventListener('click', e => {
          const c = e.target.closest('.timeChip');
          if (c) {
            const minutes = +c.dataset.min;
            popup.setAttribute('style', 'opacity:0; pointer-events:none');
            // Start session directly with selected time
            window.bodhi.startSession(minutes);
          }
        });
      }
      popup.setAttribute('style', popup.getAttribute('style').includes('opacity:0') ? 'opacity:1; pointer-events:auto' : 'opacity:0; pointer-events:none');
    } else if (q.dataset.act === 'tasks') window.bodhi.petAction('tasks');
    else if (q.dataset.act === 'settings') window.bodhi.petAction('settings');
  }
});
svg.addEventListener('dblclick', e => { if (!e.target.closest('[data-act]')) window.bodhi.petAction('tasks'); });
svg.addEventListener('contextmenu', e => { e.preventDefault(); window.bodhi.menu(); });
