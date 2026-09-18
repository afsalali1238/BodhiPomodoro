const { $, fmt } = BodhiUtils;
const nums = ['focusMin', 'breakMin', 'longBreakMin', 'cyclesBeforeLong', 'laserMax', 'graceSec', 'cooldownSec', 'awayPauseMin'];
const checks = ['alwaysOnTop', 'walkAcross', 'autoStartBreak', 'autoStartFocus', 'sound', 'lasers', 'hideInMeetings', 'hideFullscreen', 'breakNudge', 'askTaskOnStart', 'reduceMotion', 'autoStart'];
const textareas = ['distractList', 'allowList', 'focusApps'];
const time = ['reportTime'];
let loaded = false;
const names = { idle: 'Ready', focus: 'Meditating', waking: 'Awakening', walkingOut: 'Walking out',
  break: 'On a walk', returning: 'Returning', ready: 'Back under the tree' };

window.bodhi.getDisplays().then(ds => {
  $('displayId').innerHTML = ds.map(d => `<option value="${d.id}">${d.label}</option>`).join('');
});

window.bodhi.on('state', st => {
  $('phase').textContent = names[st.phase] + (st.paused ? ' (paused)' : '') + (st.cycle ? ` · ${st.cycle} done` : '');
  $('time').textContent = st.total ? fmt(st.remaining) : fmt(st.settings.focusMin * 60);
  const running = st.phase === 'focus' || st.phase === 'break';
  $('startBtn').textContent = running ? (st.paused ? 'Resume' : 'Pause') : 'Start';
  if (loaded) return;
  loaded = true;
  const s = st.settings;
  nums.forEach(k => $(k).value = s[k]);
  checks.forEach(k => $(k).checked = !!s[k]);
  time.forEach(k => $(k).value = s[k]);
  textareas.forEach(k => $(k).value = (s[k] || []).join('\n'));
  $('scale').value = String(s.scale);
  setTimeout(() => { if (s.displayId != null) $('displayId').value = String(s.displayId); }, 100);
});

document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
  const [f, br, lb] = b.dataset.p.split(',');
  $('focusMin').value = f; $('breakMin').value = br; $('longBreakMin').value = lb;
});
document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => window.bodhi.action(b.dataset.a));

$('pickApps').onclick = () => {
  window.bodhi.openLauncher('start');
};

$('save').onclick = () => {
  const s = {};
  nums.forEach(k => s[k] = Math.max(0, Number($(k).value) || 0));
  checks.forEach(k => s[k] = $(k).checked);
  time.forEach(k => s[k] = $(k).value);
  textareas.forEach(k => s[k] = $(k).value.trim().split('\n').map(x => x.trim()).filter(Boolean));
  s.scale = $('scale').value === 'auto' ? 'auto' : Number($('scale').value);
  const dispVal = Number($('displayId')?.value);
  if (dispVal) s.displayId = dispVal;
  window.bodhi.saveSettings(s);
  $('save').textContent = 'Saved ✓';
  setTimeout(() => $('save').textContent = 'Save', 1200);
};
