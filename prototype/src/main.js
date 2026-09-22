// @ts-check
/**
 * @fileoverview Main process entry point for Bodhi Pomodoro desktop pet.
 * Wires together storage, state engine, window manager, IPC, and system tray.
 */
const { app, globalShortcut, powerMonitor, screen, dialog, Menu } = require('electron');
Menu.setApplicationMenu(null);
const storage = require('./storage');
const state = require('./state');
const windows = require('./windows');
const tray = require('./tray');
const { registerIpc } = require('./ipc');
const { startWatcher } = require('./watcher');

/** @type {{available: boolean, stop: () => void}|null} */
let watcher = null;

// Single instance enforcement
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  windows.openSettings();
});

// Wire callbacks between decoupled modules
state.setCallbacks({
  onStateChange: force => windows.pushState(force),
  onNotify: (title, body, onClick) => windows.notify(title, body, onClick),
  onStopBlast: silent => windows.stopBlast(silent),
  onOpenLauncher: tab => windows.openLauncher(tab),
  onOpenReport: dateKey => windows.openReport(dateKey),
  onEvalPushback: msg => windows.notify('Focus Check', msg),
  onConfirmReset: async () => {
    const res = await dialog.showMessageBox({
      type: 'question',
      title: 'Reset session?',
      message: 'Cancel current session and clear all timers?',
      buttons: ['Reset', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    });
    return res.response === 0;
  },
  isWatcherAvailable: () => !!(watcher && watcher.available),
  getSystemIdleTime: () => powerMonitor.getSystemIdleTime()
});

windows.setOnUpdateTray(() => tray.updateTray());

// Register all IPC events
registerIpc();

app.whenReady().then(() => {
  storage.initStorage();
  const settings = storage.getSettings();
  
  // Initialize LLM Brain if API key is configured
  state.initBrain();

  state.restoreSession();
  windows.createPet();
  tray.initTray();

  // Global keyboard shortcuts
  const shortcuts = {
    'CommandOrControl+Alt+P': windows.requestStart,
    'CommandOrControl+Alt+S': state.skip,
    'CommandOrControl+Alt+T': () => windows.openLauncher('tasks'),
    'CommandOrControl+Alt+R': () => windows.openReport()
  };
  for (const [accelerator, action] of Object.entries(shortcuts)) {
    try {
      const ok = globalShortcut.register(accelerator, action);
      if (!ok) console.warn(`[main] Global shortcut ${accelerator} is already in use by another app; it will not work in Bodhi.`);
    } catch (e) {
      console.warn(`[main] Failed to register global shortcut ${accelerator}:`, e.message);
    }
  }

  // Active window watcher
  watcher = startWatcher(windows.onWindowSample);

  // System lock & away detection
  powerMonitor.on('lock-screen', () => {
    if (state.S.phase === 'focus' && !state.S.paused && settings.awayPauseMin > 0) {
      storage.day().awayMin += settings.awayPauseMin;
      storage.saveLog();
      state.pause('away');
    }
  });

  // Display metrics changes
  screen.on('display-removed', windows.movePetToDisplay);
  screen.on('display-metrics-changed', windows.movePetToDisplay);

  // Periodic timer ticks and backup rotation
  setInterval(state.tick, 500);
  setInterval(() => {
    storage.backupSession();
    storage.backupData();
  }, 10 * 60 * 1000);

  // First run experience
  const fsModule = require('fs');
  if (!fsModule.existsSync(storage.file('settings.json'))) {
    storage.saveSettings();
    setTimeout(windows.openSettings, 1200);
  }

  // Auto-start configuration
  app.setLoginItemSettings({
    openAtLogin: settings.autoStart,
    path: process.execPath,
    args: ['--hidden']
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (watcher) watcher.stop();
  state.persistSession();
});

app.on('window-all-closed', e => e.preventDefault?.());
