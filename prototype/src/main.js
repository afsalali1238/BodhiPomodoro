// Bodhi Pomodoro — main process (single source of truth)
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, Notification,
  powerMonitor, globalShortcut, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const D = require('./distraction');
const R = require('./report');
const { startWatcher, listApps } = require('./watcher');

const PET_W = 240, PET_H = 310;
const WALK_W = 110, WALK_H = 150;
const MIN = 60 * 1000;

// ---------------------------------------------------------------- storage
const file = name => path.join(app.getPath('userData'), name);
const readJson = (name, fallback) => { try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return fallback; } };
const writeJson = (name, data) => { try { fs.writeFileSync(file(name), JSON.stringify(data, null, 2)); } catch (e) { console.error('save failed:', e.message); } };

const DEFAULTS = {
  schemaVersion: 3,
  focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4,
  displayId: null, positions: {}, scale: 'auto', alwaysOnTop: true,
  walkAcross: true, autoStartBreak: true, autoStartFocus: false, sound: true,
  askTaskOnStart: true,
  lasers: true, laserMax: 3, graceSec: 5, cooldownSec: 30,
  distractList: D.DEFAULT_DISTRACT, allowList: D.DEFAULT_ALLOW,
  awayPauseMin: 3, hideInMeetings: true, hideFullscreen: true,
  breakNudge: true, reportTime: '18:00', reduceMotion: false, focusApps: [],
  lastSession: { minutes: 25, focusApps: [], strict: true }, autoStart: false
};
let settings = { ...DEFAULTS };
let tasksDb = { tasks: [], currentTaskId: null };
let log = { days: {}, totalSessions: 0, lastWrapDate: null };

const todayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const day = (key = todayKey()) => (log.days[key] = Object.assign(R.emptyDay(), log.days[key] || {}));
const saveSettings = () => writeJson('settings.json', settings);
const saveTasks = () => writeJson('tasks.json', tasksDb);
const saveLog = () => writeJson('log.json', log);

function backupSession() {
  try { fs.copyFileSync(file('session.json'), file('session.json.bak')); } catch { }
}
function backupData() {
  try { fs.copyFileSync(file('log.json'), file('log.json.bak')); fs.copyFileSync(file('tasks.json'), file('tasks.json.bak')); } catch { }
}

// ---------------------------------------------------------------- state
const S = {
  phase: 'idle',            // idle | focus | waking | walkingOut | break | returning | ready
  paused: false, pauseReason: null,
  endsAt: 0, pausedRemaining: 0, total: 0,
  cycle: 0, isLongBreak: false,
  focusStart: 0, activeMs: 0, sessionDistractions: 0, extended: 0,
  activity: null, activityDone: false, breakStart: 0, nudged: false,
  hidden: false, fx: null, demo: false, snoozeUntil: 0, lastTick: Date.now(),
  sessionMin: null, sessionApps: []   // chosen in the Start panel for this session
};
let onTimerDone = null;
let pet = null, walker = null, laserWin = null, settingsWin = null, tasksWin = null, reportWin = null, launcherWin = null, tray = null;
let wakingTimer = null, fxTimer = null, watcher = null, lastWin = null;
const esc = D.createEscalator();

const remainingMs = () => S.paused ? S.pausedRemaining : Math.max(0, S.endsAt - Date.now());
const currentTask = () => tasksDb.tasks.find(t => t.id === tasksDb.currentTaskId && !t.done) || null;
const openTasks = () => tasksDb.tasks.filter(t => !t.done);
const treeStage = () => { const n = log.totalSessions; return n >= 80 ? 4 : n >= 40 ? 3 : n >= 15 ? 2 : n >= 5 ? 1 : 0; };

function publicState() {
  const ct = currentTask();
  const sum = R.summarize(log.days[todayKey()], {});
  return {
    phase: S.phase, paused: S.paused, pauseReason: S.pauseReason,
    remaining: Math.ceil(remainingMs() / 1000), total: Math.round(S.total / 1000),
    cycle: S.cycle, isLongBreak: S.isLongBreak, activity: S.activity, activityDone: S.activityDone,
    nudged: S.nudged, fx: S.fx, treeStage: treeStage(), demo: S.demo,
    task: ct ? { id: ct.id, title: ct.title, done: ct.sessionsDone, est: ct.estimate } : null,
    today: { sessions: sum.sessions, focusMin: Math.round(sum.focusMin), distractions: sum.distractions },
    session: { minutes: S.sessionMin, apps: S.sessionApps },
    snoozed: Date.now() < S.snoozeUntil, watcher: !!(watcher && watcher.available),
    petScale: pet && !pet.isDestroyed() ? pet.getBounds().width / PET_W : 1,
    settings
  };
}

let lastPushSec = -1;
function pushState(force = true) {
  const st = publicState();
  if (!force && st.remaining === lastPushSec) return;
  lastPushSec = st.remaining;
  for (const w of [pet, settingsWin, tasksWin, launcherWin]) if (w && !w.isDestroyed()) w.webContents.send('state', st);
  updateTray();
  persistSession();
}

// ---------------------------------------------------------------- timer (endsAt based)
function startTimer(ms, done) {
  S.total = ms; S.endsAt = Date.now() + ms; S.paused = false; S.pauseReason = null; onTimerDone = done;
  pushState();
}
function pause(reason = 'user') {
  if (S.paused) return;
  S.pausedRemaining = remainingMs(); S.paused = true; S.pauseReason = reason; pushState();
}
function resume() {
  if (!S.paused) return;
  S.endsAt = Date.now() + S.pausedRemaining; S.paused = false; S.pauseReason = null; pushState();
}

function tick() {
  const now = Date.now();
  const dt = Math.min(5000, now - S.lastTick); S.lastTick = now;

  if (S.phase === 'focus' && !S.paused) S.activeMs += dt;

  // away detection during focus
  if (S.phase === 'focus') {
    const idle = powerMonitor.getSystemIdleTime();
    if (!S.paused && settings.awayPauseMin > 0 && idle >= settings.awayPauseMin * 60) {
      const back = Math.min(idle * 1000, S.activeMs);     // idle time doesn't count as focus
      S.activeMs -= back; day().awayMin += back / MIN; saveLog();
      S.pausedRemaining = Math.min(S.total, remainingMs() + back);
      S.paused = true; S.pauseReason = 'away'; pushState();
    } else if (S.paused && S.pauseReason === 'away' && idle < 3) {
      resume(); setFx('nod', 900);
    }
  }

  // break nudge: still hammering the keyboard while he's out walking
  if (S.phase === 'break' && !S.paused && settings.breakNudge && !S.nudged) {
    const idle = powerMonitor.getSystemIdleTime();
    S.activeStreak = idle < 3 ? (S.activeStreak || 0) + dt : 0;
    if (S.activeStreak > 90 * 1000) {
      S.nudged = true;
      notify('You are still working', `He's out on a break — you should be too. ${activityText(S.activity)}.`);
      pushState();
    }
  }

  if (onTimerDone && !S.paused && now >= S.endsAt) { const cb = onTimerDone; onTimerDone = null; cb(); }

  endOfDayCheck(now);
  pushState(false);
}

// ---------------------------------------------------------------- phases
// Break length follows the chosen focus length: 15→3, 25→5, 50→10, 90→20, custom ≈ 1/5 (3–20 min)
const BREAK_FOR = { 15: 3, 25: 5, 50: 10, 90: 20 };
const breakFor = min => BREAK_FOR[min] || Math.max(3, Math.min(20, Math.round(min / 5)));
const durations = () => {
  if (S.demo) return { focus: 1 * MIN, brk: 1 * MIN, long: 1 * MIN };
  const f = S.sessionMin || settings.focusMin;
  const custom = S.sessionMin && S.sessionMin !== settings.focusMin;
  return { focus: f * MIN, brk: (custom ? breakFor(f) : settings.breakMin) * MIN,
    long: (custom ? Math.max(breakFor(f) * 3, 15) : settings.longBreakMin) * MIN };
};

function requestStart() {
  if (S.phase === 'focus' || S.phase === 'break') { S.paused ? resume() : pause('user'); return; }
  if (S.phase !== 'idle' && S.phase !== 'ready') return;
  if (pet && !pet.isDestroyed()) pet.webContents.send('open-wizard');
  else openLauncher();
}

function startFocus(taskId, opts) {
  if (taskId !== undefined) { tasksDb.currentTaskId = taskId; saveTasks(); }
  if (opts) { S.sessionMin = opts.minutes || null; S.sessionApps = opts.strict ? (opts.focusApps || []) : []; }
  closeWalker();
  Object.assign(S, { phase: 'focus', focusStart: Date.now(), activeMs: 0, sessionDistractions: 0, extended: 0, nudged: false });
  startTimer(durations().focus, finishFocus);
}

function finishFocus() {
  S.phase = 'waking';
  S.fx = null;
  stopBlast();
  notify('Session complete', currentTask() ? `Did you finish “${currentTask().title}”?` : 'He awakens. Time for a break.');
  pushState();
  // 15 s decision window: “+5 min” or “Task done” buttons on the pet
  // decision window: Done ✓ / +5 min / Not yet — on the pet and in the Start panel (shown without stealing focus)
  if (launcherWin && !launcherWin.isDestroyed()) launcherWin.showInactive(); else openLauncher('start');
  clearTimeout(wakingTimer);
  wakingTimer = setTimeout(leaveForBreak, 15000);
}

function extendFocus() {
  if (S.phase !== 'waking') return;
  clearTimeout(wakingTimer);
  S.phase = 'focus'; S.extended++;
  startTimer(5 * MIN, finishFocus);
}

function commitSession() {
  const ct = currentTask();
  const now = Date.now();
  const minutes = Math.max(0.1, S.activeMs / MIN);
  day().sessions.push({ start: S.focusStart, end: now, minutes: +minutes.toFixed(1), taskId: ct ? ct.id : null,
    taskTitle: ct ? ct.title : null, distractions: S.sessionDistractions, extended: S.extended, apps: S.sessionApps });
  if (ct) ct.sessionsDone = (ct.sessionsDone || 0) + 1;
  const before = treeStage();
  log.totalSessions++;
  if (treeStage() > before) notify('The Bodhi tree grew', `${log.totalSessions} sessions under the tree.`);
  S.cycle++;
  S.isLongBreak = S.cycle % settings.cyclesBeforeLong === 0;
  saveLog(); saveTasks();
}

function leaveForBreak() {
  if (S.phase !== 'waking') return;
  commitSession();
  S.phase = 'walkingOut'; pushState();
  if (settings.walkAcross && !S.hidden) walkAcross('out', beginBreak);
  else setTimeout(beginBreak, 1800);
}

const SHORT_ACTS = ['water', 'breathe', 'stretch', 'eyes'];
const LONG_ACTS = ['coffee', 'walk'];
function activityText(a) {
  return { water: 'Drink a glass of water', breathe: 'Breathe slowly: in 4, hold 4, out 6', stretch: 'Stand up and stretch',
    eyes: 'Look at something far away for 20 seconds', coffee: 'Coffee or tea break', walk: 'Take a short walk' }[a] || 'Rest';
}

function beginBreak() {
  S.phase = 'break';
  const acts = S.isLongBreak ? LONG_ACTS : SHORT_ACTS;
  S.activity = acts[(S.cycle - 1 + acts.length) % acts.length];
  S.activityDone = false; S.breakStart = Date.now(); S.nudged = false; S.activeStreak = 0;
  notify(S.isLongBreak ? 'Long break' : 'Break time', activityText(S.activity));
  const d = durations();
  startTimer(S.isLongBreak ? d.long : d.brk, finishBreak);
  if (!settings.autoStartBreak) pause('user');
}

function markActivityDone() {
  if (S.phase !== 'break' || S.activityDone) return;
  S.activityDone = true; setFx('nod', 900); pushState();
}

function finishBreak() {
  day().breaks.push({ start: S.breakStart, minutes: +((Date.now() - S.breakStart) / MIN).toFixed(1),
    activity: S.activity, activityDone: S.activityDone, long: S.isLongBreak });
  saveLog();
  notify('Break over', currentTask() ? `Next: ${currentTask().title}` : 'He is returning to the Bodhi tree.');
  S.phase = 'returning'; pushState();
  const back = () => {
    S.phase = 'ready'; S.activity = null; pushState();
    if (S.demo) { S.demo = false; pushState(); return; }
    if (settings.autoStartFocus) setTimeout(() => startFocus(), 1500);
  };
  if (settings.walkAcross && !S.hidden) walkAcross('in', back); else setTimeout(back, 1500);
}

function skip() {
  if (S.phase === 'focus') { onTimerDone = null; finishFocus(); }
  else if (S.phase === 'waking') { clearTimeout(wakingTimer); leaveForBreak(); }
  else if (S.phase === 'break') { onTimerDone = null; finishBreak(); }
  else if (S.phase === 'walkingOut' || S.phase === 'returning') { closeWalker(); walkDone && walkDone(); }
}

function reset() {
  dialog.showMessageBox({ type: 'question', title: 'Reset session?', message: 'Cancel current session and clear all timers?' }).then(res => {
    if (res.response === 0) { clearTimeout(wakingTimer); onTimerDone = null; closeWalker(); stopBlast();
      Object.assign(S, { phase: 'idle', paused: false, pauseReason: null, total: 0, endsAt: 0, cycle: 0, fx: null, demo: false, activity: null });
      pushState();
    }
  });
}

function demoWalk() {
  reset(); S.demo = true; S.sessionMin = null; S.sessionApps = []; startFocus();
}

function setFx(fx, ms) {
  S.fx = fx; pushState();
  clearTimeout(fxTimer);
  fxTimer = setTimeout(() => { S.fx = null; pushState(); }, ms);
}

// ---------------------------------------------------------------- windows
function getDisplay() {
  return screen.getAllDisplays().find(d => d.id === settings.displayId) || screen.getPrimaryDisplay();
}
// 'auto' = pet is ~20% of the screen height (clamped), so it stays small on 720p laptops and big monitors alike
function petScale(d = getDisplay()) {
  if (settings.scale === 'auto' || !Number(settings.scale)) return Math.max(0.4, Math.min(1, (d.workArea.height * 0.2) / PET_H));
  return Number(settings.scale);
}
function petBounds() {
  const d = getDisplay(), wa = d.workArea, k = petScale(d);
  const w = Math.round(PET_W * k), h = Math.round(PET_H * k);
  const saved = settings.positions[d.id];
  let x = wa.x + wa.width - w - 30, y = wa.y + wa.height - h - 10;
  if (saved) { x = Math.min(Math.max(saved.x, wa.x), wa.x + wa.width - w); y = Math.min(Math.max(saved.y, wa.y), wa.y + wa.height - h); }
  return { x, y, width: w, height: h };
}
const prefs = () => ({ preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false });

function createPet() {
  pet = new BrowserWindow({ ...petBounds(), transparent: true, frame: false, resizable: false, show: false,
    alwaysOnTop: settings.alwaysOnTop, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', webPreferences: prefs() });
  pet.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  pet.setVisibleOnAllWorkspaces(true);
  pet.loadFile(path.join(__dirname, 'pet.html'));
  pet.once('ready-to-show', () => { pet.show(); pet.focus(); });
  pet.webContents.on('did-finish-load', () => pushState());
  // fallback: show if ready-to-show doesn't fire within 2 seconds
  setTimeout(() => { if (pet && !pet.isDestroyed()) pet.show(); }, 2000);
}
function movePetToDisplay() { if (pet) { pet.setBounds(petBounds()); pushState(); } }

function closeWalker() { if (walker && !walker.isDestroyed()) walker.destroy(); walker = null; }
let walkDone = null;
function walkAcross(direction, done) {
  closeWalker();
  walkDone = () => { walkDone = null; done(); };
  const wa = getDisplay().workArea;
  const pb = pet.getBounds();
  const k = pb.width / PET_W;
  const w = Math.round(WALK_W * k), h = Math.round(WALK_H * k);
  const y = Math.round(pb.y + 105 * k);
  const home = pb.x + 150 * k - 55 * k;
  // hide near screen edge instead of walking full length
  const edge = wa.x + wa.width + 10;  // 10px past right edge
  const from = home;
  const to = edge;
  const facingLeft = false;
  walker = new BrowserWindow({ x: Math.round(from), y, width: w, height: h, transparent: true, frame: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false, show: false, backgroundColor: '#00000000', webPreferences: prefs() });
  walker.setIgnoreMouseEvents(true);
  walker.setAlwaysOnTop(true, 'screen-saver');
  walker.loadFile(path.join(__dirname, 'walker.html'));
  walker.webContents.on('did-finish-load', () => {
    walker.showInactive();
    walker.webContents.send('walker', { facingLeft });
    const speed = 120 * k;
    const dist = Math.abs(to - from), duration = Math.max(800, dist / speed * 1000), t0 = Date.now();
    const ease = x => x < .1 ? x * x * 5 : x > .9 ? 1 - (1 - x) * (1 - x) * 5 : x;
    const iv = setInterval(() => {
      if (!walker || walker.isDestroyed()) { clearInterval(iv); return; }
      const p = Math.min(1, (Date.now() - t0) / duration);
      walker.setPosition(Math.round(from + (to - from) * ease(p)), y);
      if (p >= 1) { clearInterval(iv); closeWalker(); walkDone && walkDone(); }
    }, 16);
  });
}

function smallWindow(win, htmlFile, opts) {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return win; }
  const wa = getDisplay().workArea;
  opts = { ...opts, width: Math.min(opts.width, wa.width - 40), height: Math.min(opts.height, wa.height - 40) };
  win = new BrowserWindow({ autoHideMenuBar: true, backgroundColor: '#1b1a17', webPreferences: prefs(), ...opts });
  win.loadFile(path.join(__dirname, htmlFile));
  win.webContents.on('did-finish-load', () => pushState());
  return win;
}
function openSettings() { settingsWin = smallWindow(settingsWin, 'settings.html', { width: 420, height: 720, title: 'Bodhi Pomodoro — Settings' }); }
function openTasks_(mode = 'manage') {
  const pb = pet.getBounds(), wa = getDisplay().workArea;
  const w = 360, h = Math.min(520, wa.height - 40);
  const x = Math.max(wa.x, Math.min(pb.x - w - 8, wa.x + wa.width - w)), y = Math.max(wa.y, Math.min(pb.y + pb.height - h, wa.y + wa.height - h));
  tasksWin = smallWindow(tasksWin, 'tasks.html', { width: w, height: h, x, y, title: 'Bodhi — Tasks', alwaysOnTop: true, minimizable: false });
  const send = () => tasksWin.webContents.send('tasks-mode', mode);
  tasksWin.webContents.isLoading() ? tasksWin.webContents.once('did-finish-load', send) : send();
}
function openLauncher(tab = 'start') {
  const pb = pet.getBounds(), wa = getDisplay().workArea;
  const w = 260, h = 320;
  const x = Math.max(wa.x + 10, Math.min(pb.x - w - 8, wa.x + wa.width - w - 10));
  const y = Math.max(wa.y + 10, Math.min(pb.y + pb.height - h, wa.y + wa.height - h - 10));
  const fresh = !launcherWin || launcherWin.isDestroyed();
  launcherWin = smallWindow(launcherWin, 'launcher.html', { width: w, height: h, x, y, title: 'Bodhi', alwaysOnTop: true,
    minimizable: false, maximizable: false, resizable: false });
  if (!fresh) launcherWin.setPosition(x, y);
  const send = () => launcherWin.webContents.send('launcher-tab', tab);
  launcherWin.webContents.isLoading() ? launcherWin.webContents.once('did-finish-load', send) : send();
}
function openReport(dateKey) {
  reportWin = smallWindow(reportWin, 'report.html', { width: 620, height: 760, title: 'Bodhi — Daily work report' });
  if (dateKey) {
    const send = () => reportWin.webContents.send('report-date', dateKey);
    reportWin.webContents.isLoading() ? reportWin.webContents.once('did-finish-load', send) : send();
  }
}

// ---------------------------------------------------------------- lasers & visibility
function onWindowSample(win) {
  lastWin = win;
  // hide during meetings / fullscreen apps
  const d = getDisplay();
  let dip = null;
  try { dip = screen.screenToDipRect(null, { x: win.x, y: win.y, width: win.w, height: win.h }); } catch { dip = { x: win.x, y: win.y, width: win.w, height: win.h }; }
  win.dip = dip;
  const proc = String(win.p || '').toLowerCase();
  const fullscreen = settings.hideFullscreen && !['explorer', 'searchhost', 'shellexperiencehost', 'lockapp'].includes(proc) &&
    dip.width >= d.bounds.width && dip.height >= d.bounds.height &&
    Math.abs(dip.x - d.bounds.x) < 8 && Math.abs(dip.y - d.bounds.y) < 8;
  const meeting = settings.hideInMeetings && D.isMeeting(win);
  setHidden(fullscreen || meeting);

  // distraction lasers
  const active = settings.lasers && S.phase === 'focus' && !S.paused && !S.hidden && Date.now() >= S.snoozeUntil;
  const focusApps = S.sessionApps.length ? S.sessionApps : settings.focusApps;
  const rule = active ? D.classify(win, settings.distractList, settings.allowList, focusApps) : null;
  const act = D.step(esc, { now: Date.now(), matchedRule: rule, graceMs: settings.graceSec * 1000,
    cooldownMs: settings.cooldownSec * 1000, maxTier: settings.laserMax });
  if (!act) return;
  if (act.type === 'stop') { stopBlast(); setFx('nod', 900); return; }
  S.sessionDistractions++;
  day().distractions.push({ at: Date.now(), app: act.rule, tier: act.tier }); saveLog();
  if (act.tier === 0) setFx('glance', 1600);
  else fireBlast(act.tier, dip);
}

function setHidden(h) {
  if (h === S.hidden) return;
  S.hidden = h;
  if (h) { pet.hide(); if (walker && !walker.isDestroyed()) walker.hide(); stopBlast(); }
  else { pet.showInactive(); if (walker && !walker.isDestroyed()) walker.showInactive(); }
  pushState();
}

function lensPoints() {
  const pb = pet.getBounds(), k = pb.width / PET_W;
  // head centre in pet art: x=150, y=247-83; lenses at ±7, +1
  const y = pb.y + (247 - 83 + 1.3) * k;
  return [{ x: pb.x + 143 * k, y }, { x: pb.x + 157 * k, y }];
}

function fireBlast(tier, targetRect) {
  stopBlast(true);
  const d = getDisplay(), wa = d.workArea;
  const duration = tier === 1 ? 1500 : 3000;
  S.fx = tier >= 3 ? 'blast-shake' : 'blast'; pushState();
  laserWin = new BrowserWindow({ x: wa.x, y: wa.y, width: wa.width, height: wa.height, transparent: true, frame: false,
    resizable: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false, show: false,
    backgroundColor: '#00000000', webPreferences: prefs() });
  laserWin.setIgnoreMouseEvents(true);
  laserWin.setAlwaysOnTop(true, 'screen-saver');
  laserWin.loadFile(path.join(__dirname, 'laser.html'));
  laserWin.webContents.on('did-finish-load', () => {
    laserWin.showInactive();
    laserWin.moveTop();
    if (pet && !pet.isDestroyed()) {
      pet.setAlwaysOnTop(true, 'screen-saver');
      pet.moveTop();
    }
    laserWin.moveTop();
    const local = p => ({ x: p.x - wa.x, y: p.y - wa.y });
    const [l, r] = lensPoints().map(local);
    let target = null;
    if (targetRect && targetRect.width > 50) {
      target = local({ x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 });
      target.x = Math.max(20, Math.min(wa.width - 20, target.x)); target.y = Math.max(20, Math.min(wa.height - 20, target.y));
    }
    laserWin.webContents.send('blast', { lensL: l, lensR: r, target, tier, duration, width: wa.width, height: wa.height, sound: settings.sound, reduceMotion: settings.reduceMotion });
  });
  setTimeout(() => { if (S.fx && S.fx.startsWith('blast')) { S.fx = null; pushState(); } esc.firing = false; }, duration + 400);
  setTimeout(() => stopBlast(true), duration + 1400);
}

function stopBlast(silent) {
  if (laserWin && !laserWin.isDestroyed()) laserWin.destroy();
  laserWin = null;
  if (pet && !pet.isDestroyed()) pet.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  if (!silent && S.fx && S.fx.startsWith('blast')) { S.fx = null; pushState(); }
}

// ---------------------------------------------------------------- end of day
function endOfDayCheck(now) {
  const [hh, mm] = String(settings.reportTime || '18:00').split(':').map(Number);
  const d = new Date(now);
  if (log.lastWrapDate === todayKey(now)) return;
  if (d.getHours() * 60 + d.getMinutes() < hh * 60 + mm) return;
  const sum = R.summarize(log.days[todayKey(now)], {});
  log.lastWrapDate = todayKey(now); saveLog();
  if (!sum.sessions) return;
  setFx('bow', 2500);
  notify('Day wrap-up', `${sum.sessions} sessions · ${R.hm(sum.focusMin)} focused · ${sum.completed.length} tasks done. Click for your report.`, () => openReport());
}

function notify(title, body, onClick) {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: true });
    if (onClick) n.on('click', onClick);
    n.show();
  }
  pet && !pet.isDestroyed() && pet.webContents.send('chime', settings.sound);
}

// ---------------------------------------------------------------- session restore
let persistT = 0;
function persistSession() {
  if (Date.now() - persistT < 2000) return;
  persistT = Date.now();
  writeJson('session.json', { phase: S.phase, paused: S.paused, pauseReason: S.pauseReason, endsAt: S.endsAt,
    pausedRemaining: S.pausedRemaining, total: S.total, cycle: S.cycle, focusStart: S.focusStart, activeMs: S.activeMs,
    isLongBreak: S.isLongBreak, activity: S.activity, breakStart: S.breakStart,
    sessionMin: S.sessionMin, sessionApps: S.sessionApps, savedAt: Date.now() });
}
function restoreSession() {
  const s = readJson('session.json', null);
  if (!s || !['focus', 'break', 'waking', 'walkingOut'].includes(s.phase)) return;
  Object.assign(S, { cycle: s.cycle || 0, isLongBreak: s.isLongBreak, total: s.total, focusStart: s.focusStart, activeMs: s.activeMs || 0,
    sessionMin: s.sessionMin, sessionApps: s.sessionApps || [] });
  const left = s.paused ? s.pausedRemaining : s.endsAt - Date.now();
  if (s.phase === 'focus' && left > 0) {
    S.phase = 'focus'; startTimer(left, finishFocus); S.total = s.total;
    if (s.paused) pause(s.pauseReason || 'user');
  } else if (s.phase === 'focus' || s.phase === 'waking') {
    S.phase = 'waking'; commitSession(); S.phase = 'ready';
  } else if (s.phase === 'break' && left > 0) {
    S.phase = 'break'; S.activity = s.activity; S.breakStart = s.breakStart; startTimer(left, finishBreak); S.total = s.total;
  } else S.phase = 'ready';
}

// ---------------------------------------------------------------- tray / menu
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
function labelFor() {
  const r = fmt(Math.ceil(remainingMs() / 1000));
  return { idle: 'ready', focus: S.paused ? (S.pauseReason === 'away' ? `away, paused ${r}` : `paused ${r}`) : `meditating ${r}`,
    waking: 'session done', walkingOut: 'walking out', break: S.paused ? `break paused ${r}` : `on break ${r}`,
    returning: 'returning', ready: 'back — click to sit' }[S.phase];
}
function updateTray() {
  if (!tray) return;
  const ct = currentTask();
  tray.setToolTip(`Bodhi — ${labelFor()}${ct ? `\n${ct.title}` : ''}`);
}

function buildMenu() {
  const displays = screen.getAllDisplays(), cur = getDisplay();
  const preset = (label, f, b, lb, n = 4) => ({ label, type: 'radio', checked: settings.focusMin === f && settings.breakMin === b,
    click: () => { Object.assign(settings, { focusMin: f, breakMin: b, longBreakMin: lb, cyclesBeforeLong: n }); saveSettings(); pushState(); } });
  const running = S.phase === 'focus' || S.phase === 'break';
  const ct = currentTask();
  return Menu.buildFromTemplate([
    { label: `Bodhi — ${labelFor()}`, enabled: false },
    ...(ct ? [{ label: `Task: ${ct.title}`, enabled: false }] : []),
    { type: 'separator' },
    { label: running ? (S.paused ? 'Resume' : 'Pause') : 'Start focus', accelerator: 'Ctrl+Alt+P', click: requestStart },
    { label: 'Skip', enabled: S.phase !== 'idle' && S.phase !== 'ready', accelerator: 'Ctrl+Alt+S', click: skip },
    { label: 'Reset', click: reset },
    { type: 'separator' },
    { label: 'Start session…', click: () => openLauncher('start') },
    { label: 'Tasks…', accelerator: 'Ctrl+Alt+T', click: () => openLauncher('tasks') },
    { label: 'Daily work report…', accelerator: 'Ctrl+Alt+R', click: () => openReport() },
    { type: 'separator' },
    { label: 'Timing', submenu: [
      preset('Classic — 25 / 5', 25, 5, 15), preset('Short — 15 / 3', 15, 3, 10),
      preset('Deep — 50 / 10', 50, 10, 20), preset('Monk mode — 90 / 20', 90, 20, 30, 2),
      { type: 'separator' }, { label: 'Custom…', click: openSettings }] },
    { label: 'Screen', submenu: displays.map((d, i) => ({
      label: `Display ${i + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' — primary' : ''}`,
      type: 'radio', checked: d.id === cur.id, click: () => { settings.displayId = d.id; saveSettings(); movePetToDisplay(); } })) },
    { label: 'Size', submenu: [['auto', 'Auto (fits screen)'], [0.4, '40%'], [0.5, '50%'], [0.6, '60%'], [0.75, '75%'], [1, '100%']].map(([v, l]) => ({
      label: l, type: 'radio', checked: String(settings.scale) === String(v),
      click: () => { settings.scale = v; saveSettings(); movePetToDisplay(); } })) },
    { label: 'Lasers', submenu: [
      { label: 'Enabled', type: 'checkbox', checked: settings.lasers, click: m => { settings.lasers = m.checked; saveSettings(); } },
      { label: Date.now() < S.snoozeUntil ? 'Snoozed — resume now' : 'Snooze 15 min', click: () => { S.snoozeUntil = Date.now() < S.snoozeUntil ? 0 : Date.now() + 15 * MIN; stopBlast(); pushState(); } },
      { label: 'Test blast', click: () => fireBlast(2, null) }] },
    { label: 'Take Bodhi for a walk (1-min demo)', click: demoWalk },
    { label: 'Settings…', click: openSettings },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
}

// ---------------------------------------------------------------- IPC
ipcMain.on('toggle', requestStart);
ipcMain.on('menu', () => buildMenu().popup({ window: pet }));
ipcMain.on('pet-action', (_e, a) => ({
  extend: extendFocus,
  done: () => { completeTask(tasksDb.currentTaskId); setFx('nod', 900); },
  go: () => { clearTimeout(wakingTimer); leaveForBreak(); },
  activity: markActivityDone,
  tasks: () => openLauncher('tasks'),
  settings: openSettings,
  toggle: requestStart,
  timer: () => openLauncher('start')
})[a]?.());
let dragOffset = null;
ipcMain.on('drag-start', (_e, p) => { const [x, y] = pet.getPosition(); dragOffset = { dx: p.x - x, dy: p.y - y }; });
ipcMain.on('drag-move', (_e, p) => { if (dragOffset) pet.setPosition(Math.round(p.x - dragOffset.dx), Math.round(p.y - dragOffset.dy)); });
ipcMain.on('drag-end', () => {
  if (!dragOffset) return; dragOffset = null;
  const b = pet.getBounds(), d = screen.getDisplayMatching(b);
  settings.displayId = d.id; settings.positions[d.id] = { x: b.x, y: b.y }; saveSettings();
});
ipcMain.handle('get-displays', () => screen.getAllDisplays().map((d, i) => ({
  id: d.id, label: `Display ${i + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' — primary' : ''}` })));
ipcMain.on('save-settings', (_e, s) => {
  const moved = s.displayId !== settings.displayId || s.scale !== settings.scale;
  const autoStartChanged = s.autoStart !== settings.autoStart;
  Object.assign(settings, s); saveSettings();
  if (autoStartChanged) {
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      path: process.execPath,
      args: ['--hidden']
    });
  }
  pet.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  if (moved) movePetToDisplay();
  pushState();
});
ipcMain.on('action', (_e, a) => ({ start: requestStart, skip, reset, demo: demoWalk, report: () => openReport(), tasks: () => openTasks_('manage'), testLaser: () => fireBlast(2, null) })[a]?.());

// tasks
const uid = () => Math.random().toString(36).slice(2, 10);
function completeTask(id) {
  const t = tasksDb.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  t.done = true; t.doneAt = Date.now();
  day().completedTasks.push({ id: t.id, title: t.title, at: t.doneAt, sessions: t.sessionsDone || 0 });
  if (tasksDb.currentTaskId === id) tasksDb.currentTaskId = (openTasks()[0] || {}).id || null;
  saveTasks(); saveLog(); pushState();
}
ipcMain.handle('tasks:list', () => tasksDb);
ipcMain.handle('tasks:add', (_e, { title, estimate }) => {
  const t = { id: uid(), title: String(title || '').slice(0, 140), estimate: Math.max(1, Math.min(12, Number(estimate) || 1)), sessionsDone: 0, done: false, createdAt: Date.now() };
  tasksDb.tasks.push(t);
  if (!currentTask()) tasksDb.currentTaskId = t.id;
  saveTasks(); pushState(); return tasksDb;
});
ipcMain.handle('tasks:update', (_e, { id, patch }) => {
  const t = tasksDb.tasks.find(x => x.id === id); if (!t) return tasksDb;
  if (patch.done === true) completeTask(id);
  else if (patch.done === false) { t.done = false; t.doneAt = null; }
  if (patch.title) t.title = String(patch.title || '').slice(0, 140);
  if (patch.estimate) t.estimate = Math.max(1, Math.min(12, Number(patch.estimate)));
  saveTasks(); pushState(); return tasksDb;
});
ipcMain.handle('tasks:delete', (_e, id) => {
  dialog.showMessageBox({ type: 'question', title: 'Delete task?', message: 'This action cannot be undone.' }).then(res => {
    if (res.response) {
      tasksDb.tasks = tasksDb.tasks.filter(t => t.id !== id);
      if (tasksDb.currentTaskId === id) tasksDb.currentTaskId = (openTasks()[0] || {}).id || null;
      saveTasks(); pushState();
    }
  });
  return tasksDb;
});
ipcMain.handle('tasks:reorder', (_e, ids) => {
  tasksDb.tasks.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); saveTasks(); return tasksDb;
});
ipcMain.handle('tasks:select', (_e, id) => { tasksDb.currentTaskId = id; saveTasks(); pushState(); return tasksDb; });
ipcMain.on('tasks:start', (_e, id) => { if (tasksWin && !tasksWin.isDestroyed()) tasksWin.hide(); if (S.phase === 'idle' || S.phase === 'ready') startFocus(id); });

// start-session panel
ipcMain.handle('apps:list', () => listApps());
ipcMain.handle('session:defaults', () => ({ ...DEFAULTS.lastSession, ...settings.lastSession, presets: [10, 15, 25, 50, 90] }));
ipcMain.handle('session:start', (_e, o) => {
  if (S.phase !== 'idle' && S.phase !== 'ready') return false;
  const minutes = Math.max(1, Math.min(240, Math.round(Number(o.minutes) || 25)));
  let taskId = o.taskId || null;
  if (o.newTask && String(o.newTask).trim()) {
    const t = { id: uid(), title: String(o.newTask).trim().slice(0, 140), estimate: 1, sessionsDone: 0, done: false, createdAt: Date.now() };
    tasksDb.tasks.push(t); taskId = t.id;
  }
  const focusApps = (o.focusApps || []).map(String).filter(Boolean);
  settings.lastSession = { minutes, focusApps, strict: !!o.strict }; saveSettings();
  if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide();
  startFocus(taskId, { minutes, focusApps, strict: !!o.strict && focusApps.length > 0 });
  return true;
});
ipcMain.on('open', (_e, what) => ({ report: () => openReport(), settings: openSettings })[what]?.());
ipcMain.on('start-session', (_e, minutes) => {
  // Start focus session directly with selected time
  if (S.phase === 'idle' || S.phase === 'ready') {
    const minutes = Math.max(1, Math.min(240, Math.round(Number(minutes) || 25)));
    settings.lastSession = { minutes, focusApps: [], strict: false }; saveSettings();
    startFocus(null, { minutes, focusApps: [], strict: false });
  }
});
ipcMain.on('open-launcher', (_e, tab) => openLauncher(tab));

// report
ipcMain.handle('report:get', (_e, key) => {
  const byId = Object.fromEntries(tasksDb.tasks.map(t => [t.id, t]));
  const k = key || todayKey();
  return { date: k, day: log.days[k] || R.emptyDay(), tasksById: byId, days: Object.keys(log.days).sort().reverse() };
});
ipcMain.handle('report:notes', (_e, { date, notes }) => { day(date).notes = notes; saveLog(); return true; });
ipcMain.handle('report:save', async (_e, { date, markdown }) => {
  const r = await dialog.showSaveDialog(reportWin, { defaultPath: path.join(app.getPath('documents'), `Work report ${date}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, markdown, 'utf8'); return r.filePath;
});
ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(text); return true; });

// ---------------------------------------------------------------- app
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => openSettings());
app.whenReady().then(() => {
  settings = { ...DEFAULTS, ...readJson('settings.json', {}) };
  if ((settings.schemaVersion || 1) < 3) { if (settings.scale === 1) settings.scale = 'auto'; settings.schemaVersion = 3; saveSettings(); }
  tasksDb = { ...tasksDb, ...readJson('tasks.json', {}) };
  log = { ...log, ...readJson('log.json', {}) };
  restoreSession();
  createPet();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
  tray.on('click', () => tray.popUpContextMenu(buildMenu()));
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  const keys = { 'CommandOrControl+Alt+P': requestStart, 'CommandOrControl+Alt+S': skip,
    'CommandOrControl+Alt+T': () => openLauncher('tasks'), 'CommandOrControl+Alt+R': () => openReport() };
  for (const [k, fn] of Object.entries(keys)) { try { globalShortcut.register(k, fn); } catch { } }
  watcher = startWatcher(onWindowSample);
  powerMonitor.on('lock-screen', () => {
    if (S.phase === 'focus' && !S.paused && settings.awayPauseMin > 0) {
      day().awayMin += settings.awayPauseMin; saveLog();
      pause('away');
    }
  });
  screen.on('display-removed', movePetToDisplay);
  screen.on('display-metrics-changed', movePetToDisplay);
  setInterval(tick, 500);
  setInterval(() => { backupSession(); backupData(); }, 10 * 60 * 1000);  // backup every 10 min
  if (!fs.existsSync(file('settings.json'))) { saveSettings(); setTimeout(openSettings, 1200); }  // first run

    // Auto-start at Windows login
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      path: process.execPath,
      args: ['--hidden']
    });
  });
app.on('will-quit', () => { globalShortcut.unregisterAll(); watcher && watcher.stop(); persistT = 0; persistSession(); });
app.on('window-all-closed', e => e.preventDefault?.());
