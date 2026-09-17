// @ts-check
/**
 * @fileoverview System tray, context menus, and taskbar shortcuts.
 */
const { Tray, Menu, nativeImage, screen, app } = require('electron');
const path = require('path');
const storage = require('./storage');
const state = require('./state');
const windows = require('./windows');

/** @type {Tray|null} */
let tray = null;

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function labelFor() {
  const S = state.S;
  const r = fmt(Math.ceil(state.remainingMs() / 1000));
  return {
    idle: 'ready',
    focus: S.paused ? (S.pauseReason === 'away' ? `away, paused ${r}` : `paused ${r}`) : `meditating ${r}`,
    waking: 'session done',
    walkingOut: 'walking out',
    break: S.paused ? `break paused ${r}` : `on break ${r}`,
    returning: 'returning',
    ready: 'back — click to sit'
  }[S.phase];
}

function updateTray() {
  if (!tray) return;
  const ct = state.currentTask();
  tray.setToolTip(`Bodhi — ${labelFor()}${ct ? `\n${ct.title}` : ''}`);
}

function buildMenu() {
  const settings = storage.getSettings();
  const S = state.S;
  const displays = screen.getAllDisplays();
  const cur = windows.getPet() ? screen.getDisplayMatching(windows.getPet().getBounds()) : screen.getPrimaryDisplay();

  const preset = (label, f, b, lb, n = 4) => ({
    label,
    type: 'radio',
    checked: settings.focusMin === f && settings.breakMin === b,
    click: () => {
      Object.assign(settings, { focusMin: f, breakMin: b, longBreakMin: lb, cyclesBeforeLong: n });
      storage.saveSettings();
      windows.pushState(true);
    }
  });

  const running = S.phase === 'focus' || S.phase === 'break';
  const ct = state.currentTask();

  return Menu.buildFromTemplate([
    { label: `Bodhi — ${labelFor()}`, enabled: false },
    ...(ct ? [{ label: `Task: ${ct.title}`, enabled: false }] : []),
    { type: 'separator' },
    {
      label: running ? (S.paused ? 'Resume' : 'Pause') : 'Start focus',
      accelerator: 'Ctrl+Alt+P',
      click: windows.requestStart
    },
    {
      label: 'Skip',
      enabled: S.phase !== 'idle' && S.phase !== 'ready',
      accelerator: 'Ctrl+Alt+S',
      click: state.skip
    },
    { label: 'Reset', click: state.reset },
    { type: 'separator' },
    { label: 'Start session…', click: () => windows.openLauncher('start') },
    { label: 'Tasks…', accelerator: 'Ctrl+Alt+T', click: () => windows.openLauncher('tasks') },
    { label: 'Daily work report…', accelerator: 'Ctrl+Alt+R', click: () => windows.openReport() },
    { type: 'separator' },
    {
      label: 'Timing',
      submenu: [
        preset('Classic — 25 / 5', 25, 5, 15),
        preset('Short — 15 / 3', 15, 3, 10),
        preset('Deep — 50 / 10', 50, 10, 20),
        preset('Monk mode — 90 / 20', 90, 20, 30, 2),
        { type: 'separator' },
        { label: 'Custom…', click: windows.openSettings }
      ]
    },
    {
      label: 'Screen',
      submenu: displays.map((d, i) => ({
        label: `Display ${i + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' — primary' : ''}`,
        type: 'radio',
        checked: d.id === cur.id,
        click: () => {
          settings.displayId = d.id;
          storage.saveSettings();
          windows.movePetToDisplay();
        }
      }))
    },
    {
      label: 'Size',
      submenu: [['auto', 'Auto (fits screen)'], [0.4, '40%'], [0.5, '50%'], [0.6, '60%'], [0.75, '75%'], [1, '100%']].map(([v, l]) => ({
        label: l,
        type: 'radio',
        checked: String(settings.scale) === String(v),
        click: () => {
          settings.scale = v;
          storage.saveSettings();
          windows.movePetToDisplay();
        }
      }))
    },
    {
      label: 'Lasers',
      submenu: [
        {
          label: 'Enabled',
          type: 'checkbox',
          checked: settings.lasers,
          click: m => {
            settings.lasers = m.checked;
            storage.saveSettings();
          }
        },
        {
          label: Date.now() < S.snoozeUntil ? 'Snoozed — resume now' : 'Snooze 15 min',
          click: () => {
            S.snoozeUntil = Date.now() < S.snoozeUntil ? 0 : Date.now() + 15 * 60 * 1000;
            windows.stopBlast();
            windows.pushState(true);
          }
        },
        { label: 'Test blast', click: () => windows.fireBlast(2, null) }
      ]
    },
    { label: 'Take Bodhi for a walk (1-min demo)', click: state.demoWalk },
    { label: 'Settings…', click: windows.openSettings },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
}

function initTray() {
  const iconPath = path.join(__dirname, 'tray.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.on('click', () => tray?.popUpContextMenu(buildMenu()));
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()));
  updateTray();
}

module.exports = {
  initTray,
  updateTray,
  buildMenu,
  getTray: () => tray
};
