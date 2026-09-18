// @ts-check
/**
 * @fileoverview Window management, multi-monitor bounds, z-ordering, and rendering broadcasts.
 */
const { BrowserWindow, screen, Notification } = require('electron');
const path = require('path');
const storage = require('./storage');
const state = require('./state');
const D = require('./distraction');

const PET_W = 240, PET_H = 310;

/** @type {BrowserWindow|null} */
let pet = null;
/** @type {BrowserWindow|null} */
let laserWin = null;
/** @type {BrowserWindow|null} */
let settingsWin = null;
/** @type {BrowserWindow|null} */
let tasksWin = null;
/** @type {BrowserWindow|null} */
let reportWin = null;
/** @type {BrowserWindow|null} */
let launcherWin = null;

/** @type {NodeJS.Timeout[]} */
let blastTimers = [];
let lastPushSec = -1;

/** @type {(() => void)|null} */
let onUpdateTrayCallback = null;

function getDisplay() {
  const settings = storage.getSettings();
  return screen.getAllDisplays().find(d => d.id === settings.displayId) || screen.getPrimaryDisplay();
}

/**
 * Calculates pet scale ratio relative to current display height.
 * @param {Electron.Display} [d]
 * @returns {number}
 */
function petScale(d = getDisplay()) {
  const settings = storage.getSettings();
  if (settings.scale === 'auto' || !Number(settings.scale)) {
    return Math.max(0.4, Math.min(1, (d.workArea.height * 0.2) / PET_H));
  }
  return Math.max(0.1, Math.min(3, Number(settings.scale)));
}

/**
 * Computes pet window bounds clamped to display work area.
 * @returns {Electron.Rectangle}
 */
function petBounds() {
  const settings = storage.getSettings();
  const d = getDisplay();
  const wa = d.workArea;
  const k = petScale(d);
  const w = Math.round(PET_W * k);
  const h = Math.round(PET_H * k);
  const saved = settings.positions[d.id];
  let x = wa.x + wa.width - w - 30;
  let y = wa.y + wa.height - h - 10;
  if (saved) {
    x = Math.min(Math.max(saved.x, wa.x), wa.x + wa.width - w);
    y = Math.min(Math.max(saved.y, wa.y), wa.y + wa.height - h);
  }
  return { x, y, width: w, height: h };
}

const prefs = () => ({
  preload: path.join(__dirname, 'preload.js'),
  backgroundThrottling: false
});

/**
 * Creates the primary pet window.
 */
function createPet() {
  const settings = storage.getSettings();
  const b = petBounds();
  pet = new BrowserWindow({
    ...b,
    minWidth: b.width,
    maxWidth: b.width,
    minHeight: b.height,
    maxHeight: b.height,
    useContentSize: true,
    transparent: true,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: prefs()
  });

  pet.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  pet.setVisibleOnAllWorkspaces(true);
  pet.loadFile(path.join(__dirname, 'pet.html'));
  pet.once('ready-to-show', () => {
    pet?.show();
    pet?.focus();
  });
  pet.webContents.on('did-finish-load', () => {
    try {
      pet?.webContents.setVisualZoomLevelLimits(1, 1);
      pet?.webContents.setZoomFactor(1);
    } catch {
      // ignore
    }
    pushState(true);
  });
  pet.webContents.on('zoom-changed', e => {
    e.preventDefault();
    if (pet && !pet.isDestroyed()) {
      try {
        pet.webContents.setZoomFactor(1);
      } catch {
        // ignore
      }
    }
  });
  // Fallback: show if ready-to-show doesn't fire within 2 seconds
  setTimeout(() => {
    if (pet && !pet.isDestroyed()) pet.show();
  }, 2000);
}

function movePetToDisplay() {
  if (pet && !pet.isDestroyed()) {
    const target = petBounds();
    const cur = pet.getBounds();
    if (Math.abs(cur.width - target.width) > 1 || Math.abs(cur.height - target.height) > 1 ||
        Math.abs(cur.x - target.x) > 1 || Math.abs(cur.y - target.y) > 1) {
      pet.setMinimumSize(target.width, target.height);
      pet.setMaximumSize(target.width, target.height);
      pet.setBounds(target);
      pushState(true);
    }
  }
}

/**
 * Reusable utility for secondary modal/tool windows.
 * @param {BrowserWindow|null} win
 * @param {string} htmlFile
 * @param {Electron.BrowserWindowConstructorOptions} opts
 * @returns {BrowserWindow}
 */
function smallWindow(win, htmlFile, opts) {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }
  const wa = getDisplay().workArea;
  const mergedOpts = {
    autoHideMenuBar: true,
    backgroundColor: '#1b1a17',
    webPreferences: prefs(),
    ...opts,
    width: Math.min(opts.width || 400, wa.width - 40),
    height: Math.min(opts.height || 400, wa.height - 40)
  };
  win = new BrowserWindow(mergedOpts);
  win.loadFile(path.join(__dirname, htmlFile));
  win.webContents.on('did-finish-load', () => pushState(true));
  return win;
}

function openSettings() {
  settingsWin = smallWindow(settingsWin, 'settings.html', {
    width: 380,
    height: 440,
    title: 'Bodhi Pomodoro — Settings'
  });
}

function openTasks(mode = 'manage') {
  if (!pet || pet.isDestroyed()) return;
  const pb = pet.getBounds();
  const wa = getDisplay().workArea;
  const w = 360;
  const h = Math.min(520, wa.height - 40);
  const x = Math.max(wa.x, Math.min(pb.x - w - 8, wa.x + wa.width - w));
  const y = Math.max(wa.y, Math.min(pb.y + pb.height - h, wa.y + wa.height - h));
  tasksWin = smallWindow(tasksWin, 'tasks.html', {
    width: w,
    height: h,
    x,
    y,
    title: 'Bodhi — Tasks',
    alwaysOnTop: true,
    minimizable: false
  });
  const send = () => {
    if (tasksWin && !tasksWin.isDestroyed()) tasksWin.webContents.send('tasks-mode', mode);
  };
  tasksWin.webContents.isLoading() ? tasksWin.webContents.once('did-finish-load', send) : send();
}

function openLauncher(tab = 'start') {
  if (!pet || pet.isDestroyed()) return;
  const pb = pet.getBounds();
  const wa = getDisplay().workArea;
  const w = 260;
  const h = 320;
  const x = Math.max(wa.x + 10, Math.min(pb.x - w - 8, wa.x + wa.width - w - 10));
  const y = Math.max(wa.y + 10, Math.min(pb.y + pb.height - h, wa.y + wa.height - h - 10));
  const fresh = !launcherWin || launcherWin.isDestroyed();
  launcherWin = smallWindow(launcherWin, 'launcher.html', {
    width: w,
    height: h,
    x,
    y,
    title: 'Bodhi',
    alwaysOnTop: true,
    minimizable: false,
    maximizable: false,
    resizable: false
  });
  if (!fresh) launcherWin.setPosition(x, y);
  const send = () => {
    if (launcherWin && !launcherWin.isDestroyed()) launcherWin.webContents.send('launcher-tab', tab);
  };
  launcherWin.webContents.isLoading() ? launcherWin.webContents.once('did-finish-load', send) : send();
}

function openReport(dateKey) {
  reportWin = smallWindow(reportWin, 'report.html', {
    width: 620,
    height: 760,
    title: 'Bodhi — Daily work report'
  });
  if (dateKey) {
    const send = () => {
      if (reportWin && !reportWin.isDestroyed()) reportWin.webContents.send('report-date', dateKey);
    };
    reportWin.webContents.isLoading() ? reportWin.webContents.once('did-finish-load', send) : send();
  }
}

/**
 * Broadcasts public state to active windows and updates the tray.
 * @param {boolean} [force=true]
 */
function pushState(force = true) {
  const currentScale = pet && !pet.isDestroyed() ? pet.getBounds().width / PET_W : 1;
  const st = state.publicState(currentScale);
  if (!force && st.remaining === lastPushSec) return;
  lastPushSec = st.remaining;

  for (const w of [pet, settingsWin, tasksWin, launcherWin]) {
    if (w && !w.isDestroyed()) {
      w.webContents.send('state', st);
    }
  }
  if (onUpdateTrayCallback) onUpdateTrayCallback();
}

function requestStart() {
  const S = state.S;
  if (S.phase === 'ready') {
    state.sit();
    return;
  }
  if (S.phase === 'focus' || S.phase === 'break') {
    S.paused ? state.resume() : state.pause('user');
    return;
  }
  if (S.phase !== 'idle') return;
  if (pet && !pet.isDestroyed()) {
    pet.webContents.send('open-wizard');
  } else {
    openLauncher('start');
  }
}

function onWindowSample(win) {
  const settings = storage.getSettings();
  const S = state.S;
  const d = getDisplay();
  let dip = null;
  try {
    dip = screen.screenToDipRect(null, { x: win.x, y: win.y, width: win.w, height: win.h });
  } catch {
    dip = { x: win.x, y: win.y, width: win.w, height: win.h };
  }
  win.dip = dip;
  const proc = String(win.p || '').toLowerCase();
  const fullscreen = settings.hideFullscreen && !['explorer', 'searchhost', 'shellexperiencehost', 'lockapp'].includes(proc) &&
    dip.width >= d.bounds.width && dip.height >= d.bounds.height &&
    Math.abs(dip.x - d.bounds.x) < 8 && Math.abs(dip.y - d.bounds.y) < 8;
  const meeting = settings.hideInMeetings && D.isMeeting(win);
  setHidden(fullscreen || meeting);

  // Distraction lasers
  const active = settings.lasers && S.phase === 'focus' && !S.paused && !S.hidden && Date.now() >= S.snoozeUntil;
  const focusApps = S.sessionApps.length ? S.sessionApps : settings.focusApps;
  const rule = active ? D.classify(win, settings.distractList, settings.allowList, focusApps) : null;
  const act = D.step(state.esc, {
    now: Date.now(),
    matchedRule: rule,
    graceMs: settings.graceSec * 1000,
    cooldownMs: settings.cooldownSec * 1000,
    maxTier: settings.laserMax
  });
  if (!act) return;
  if (act.type === 'stop') {
    stopBlast();
    state.setFx('nod', 900);
    return;
  }
  S.sessionDistractions++;
  storage.day().distractions.push({ at: Date.now(), app: act.rule, tier: act.tier });
  storage.saveLog();
  if (act.tier === 0) state.setFx('glance', 1600);
  else fireBlast(act.tier, dip);
}

function setHidden(h) {
  const S = state.S;
  if (h === S.hidden) return;
  S.hidden = h;
  if (h) {
    if (pet && !pet.isDestroyed()) pet.hide();
    stopBlast();
  } else {
    if (pet && !pet.isDestroyed()) pet.showInactive();
  }
  pushState(true);
}

function lensPoints() {
  if (!pet || pet.isDestroyed()) return [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const pb = pet.getBounds();
  const k = pb.width / PET_W;
  const y = pb.y + (247 - 83 + 1.3) * k;
  return [{ x: pb.x + 143 * k, y }, { x: pb.x + 157 * k, y }];
}

function fireBlast(tier, targetRect) {
  stopBlast(true);
  const settings = storage.getSettings();
  const S = state.S;
  const d = getDisplay();
  const wa = d.workArea;
  const duration = tier === 1 ? 1500 : 3000;
  S.fx = tier >= 3 ? 'blast-shake' : 'blast';
  pushState(true);

  laserWin = new BrowserWindow({
    x: wa.x,
    y: wa.y,
    width: wa.width,
    height: wa.height,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: prefs()
  });

  laserWin.setIgnoreMouseEvents(true);
  laserWin.setAlwaysOnTop(true, 'screen-saver');
  laserWin.loadFile(path.join(__dirname, 'laser.html'));
  laserWin.webContents.on('did-finish-load', () => {
    if (!laserWin || laserWin.isDestroyed()) return;
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
      target.x = Math.max(20, Math.min(wa.width - 20, target.x));
      target.y = Math.max(20, Math.min(wa.height - 20, target.y));
      target.width = targetRect.width;
      target.height = targetRect.height;
    }
    laserWin.webContents.send('blast', {
      lensL: l,
      lensR: r,
      target,
      tier,
      duration,
      width: wa.width,
      height: wa.height,
      sound: settings.sound,
      reduceMotion: settings.reduceMotion
    });
  });

  blastTimers.push(
    setTimeout(() => {
      if (S.fx && S.fx.startsWith('blast')) {
        S.fx = null;
        pushState(true);
      }
      state.esc.firing = false;
    }, duration + 400),
    setTimeout(() => stopBlast(true), duration + 1400)
  );
}

function stopBlast(silent = false) {
  blastTimers.forEach(clearTimeout);
  blastTimers = [];
  if (laserWin && !laserWin.isDestroyed()) laserWin.destroy();
  laserWin = null;
  const settings = storage.getSettings();
  if (pet && !pet.isDestroyed()) pet.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  if (!silent && state.S.fx && state.S.fx.startsWith('blast')) {
    state.S.fx = null;
    pushState(true);
  }
}

function notify(title, body, onClick) {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: true });
    if (onClick) n.on('click', onClick);
    n.show();
  }
  if (pet && !pet.isDestroyed()) {
    pet.webContents.send('chime', storage.getSettings().sound);
  }
}

module.exports = {
  PET_W,
  PET_H,
  getPet: () => pet,
  getLauncherWin: () => launcherWin,
  getTasksWin: () => tasksWin,
  getReportWin: () => reportWin,
  getSettingsWin: () => settingsWin,
  createPet,
  movePetToDisplay,
  smallWindow,
  openSettings,
  openTasks,
  openLauncher,
  openReport,
  pushState,
  requestStart,
  onWindowSample,
  setHidden,
  fireBlast,
  stopBlast,
  notify,
  setOnUpdateTray: fn => { onUpdateTrayCallback = fn; }
};
