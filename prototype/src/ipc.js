// @ts-check
/**
 * @fileoverview IPC event handling and request routing between main and renderer processes.
 */
const { ipcMain, screen, dialog, clipboard, app } = require('electron');
const path = require('path');
const fs = require('fs');
const storage = require('./storage');
const state = require('./state');
const windows = require('./windows');
const tray = require('./tray');
const R = require('./report');
const { listApps } = require('./watcher');

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Registers all IPC handlers and listeners with Electron's ipcMain.
 */
function registerIpc() {
  ipcMain.on('toggle', windows.requestStart);

  ipcMain.on('menu', () => {
    const pet = windows.getPet();
    if (pet && !pet.isDestroyed()) {
      tray.buildMenu().popup({ window: pet });
    }
  });

  ipcMain.on('pet-action', (_e, a) => {
    const actions = {
      extend: state.extendFocus,
      done: () => {
        state.completeTask(storage.getTasksDb().currentTaskId);
        state.setFx('nod', 900);
      },
      go: () => {
        state.leaveForBreak();
      },
      activity: state.markActivityDone,
      tasks: () => windows.openLauncher('tasks'),
      settings: windows.openSettings,
      toggle: windows.requestStart,
      timer: windows.requestStart
    };
    if (actions[a]) actions[a]();
  });

  let dragOffset = /** @type {{dx: number, dy: number}|null} */ (null);
  ipcMain.on('drag-start', (_e, p) => {
    const pet = windows.getPet();
    if (pet && !pet.isDestroyed()) {
      const [x, y] = pet.getPosition();
      dragOffset = { dx: p.x - x, dy: p.y - y };
    }
  });

  ipcMain.on('drag-move', (_e, p) => {
    const pet = windows.getPet();
    if (dragOffset && pet && !pet.isDestroyed()) {
      pet.setPosition(Math.round(p.x - dragOffset.dx), Math.round(p.y - dragOffset.dy));
    }
  });

  ipcMain.on('drag-end', () => {
    if (!dragOffset) return;
    dragOffset = null;
    const pet = windows.getPet();
    if (pet && !pet.isDestroyed()) {
      const b = pet.getBounds();
      const d = screen.getDisplayMatching(b);
      const settings = storage.getSettings();
      settings.displayId = d.id;
      settings.positions[d.id] = { x: b.x, y: b.y };
      storage.saveSettings();
    }
  });

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `Display ${i + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' — primary' : ''}`
    }));
  });

  ipcMain.on('save-settings', (_e, s) => {
    const settings = storage.getSettings();
    const moved = s.displayId !== settings.displayId || s.scale !== settings.scale;
    const autoStartChanged = s.autoStart !== undefined && s.autoStart !== settings.autoStart;

    Object.assign(settings, s);
    storage.saveSettings();

    if (autoStartChanged) {
      app.setLoginItemSettings({
        openAtLogin: settings.autoStart,
        path: process.execPath,
        args: ['--hidden']
      });
    }

    const pet = windows.getPet();
    if (pet && !pet.isDestroyed()) {
      pet.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
    }
    if (moved) windows.movePetToDisplay();
    windows.pushState(true);
  });

  ipcMain.on('action', (_e, a) => {
    const actionMap = {
      start: windows.requestStart,
      skip: state.skip,
      reset: state.reset,
      demo: state.demoWalk,
      report: () => windows.openReport(),
      tasks: () => windows.openTasks_('manage'),
      testLaser: () => windows.fireBlast(2, null)
    };
    if (actionMap[a]) actionMap[a]();
  });

  // Tasks API
  ipcMain.handle('tasks:list', () => storage.getTasksDb());

  ipcMain.handle('tasks:add', (_e, { title, estimate }) => {
    const tasksDb = storage.getTasksDb();
    const t = {
      id: uid(),
      title: String(title || '').slice(0, 140),
      estimate: Math.max(1, Math.min(12, Number(estimate) || 1)),
      sessionsDone: 0,
      done: false,
      createdAt: Date.now()
    };
    tasksDb.tasks.push(t);
    if (!state.currentTask()) tasksDb.currentTaskId = t.id;
    storage.saveTasks();
    windows.pushState(true);
    return tasksDb;
  });

  ipcMain.handle('tasks:update', (_e, { id, patch }) => {
    const tasksDb = storage.getTasksDb();
    const t = tasksDb.tasks.find(x => x.id === id);
    if (!t) return tasksDb;
    if (patch.done === true) {
      state.completeTask(id);
    } else if (patch.done === false) {
      t.done = false;
      t.doneAt = null;
    }
    if (patch.title) t.title = String(patch.title || '').slice(0, 140);
    if (patch.estimate) t.estimate = Math.max(1, Math.min(12, Number(patch.estimate)));
    storage.saveTasks();
    windows.pushState(true);
    return tasksDb;
  });

  ipcMain.handle('tasks:delete', async (_e, id) => {
    const tasksDb = storage.getTasksDb();
    const res = await dialog.showMessageBox({
      type: 'question',
      title: 'Delete task?',
      message: 'This action cannot be undone.',
      buttons: ['Delete', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    });
    if (res.response === 0) {
      tasksDb.tasks = tasksDb.tasks.filter(t => t.id !== id);
      if (tasksDb.currentTaskId === id) {
        tasksDb.currentTaskId = (state.openTasks()[0] || {}).id || null;
      }
      storage.saveTasks();
      windows.pushState(true);
    }
    return tasksDb;
  });

  ipcMain.handle('tasks:reorder', (_e, ids) => {
    const tasksDb = storage.getTasksDb();
    tasksDb.tasks.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    storage.saveTasks();
    return tasksDb;
  });

  ipcMain.handle('tasks:select', (_e, id) => {
    const tasksDb = storage.getTasksDb();
    tasksDb.currentTaskId = id;
    storage.saveTasks();
    windows.pushState(true);
    return tasksDb;
  });

  ipcMain.on('tasks:start', (_e, id) => {
    const tasksWin = windows.getTasksWin();
    if (tasksWin && !tasksWin.isDestroyed()) tasksWin.hide();
    if (state.S.phase === 'idle' || state.S.phase === 'ready') {
      state.startFocus(id);
    }
  });

  // Session API
  ipcMain.handle('apps:list', () => listApps());

  ipcMain.handle('session:defaults', () => {
    const settings = storage.getSettings();
    return {
      ...storage.DEFAULTS.lastSession,
      ...settings.lastSession,
      presets: [10, 15, 25, 50, 90]
    };
  });

  ipcMain.handle('session:start', (_e, o) => {
    if (state.S.phase !== 'idle' && state.S.phase !== 'ready') return false;
    const minutes = Math.max(1, Math.min(240, Math.round(Number(o.minutes) || 25)));
    let taskId = o.taskId || null;
    const tasksDb = storage.getTasksDb();
    if (o.newTask && String(o.newTask).trim()) {
      const t = {
        id: uid(),
        title: String(o.newTask).trim().slice(0, 140),
        estimate: 1,
        sessionsDone: 0,
        done: false,
        createdAt: Date.now()
      };
      tasksDb.tasks.push(t);
      taskId = t.id;
    }
    const focusApps = (o.focusApps || []).map(String).filter(Boolean);
    const settings = storage.getSettings();
    settings.lastSession = { minutes, focusApps, strict: !!o.strict };
    storage.saveSettings();

    const launcherWin = windows.getLauncherWin();
    if (launcherWin && !launcherWin.isDestroyed()) launcherWin.hide();
    state.startFocus(taskId, { minutes, focusApps, strict: !!o.strict && focusApps.length > 0 });
    return true;
  });

  ipcMain.on('open', (_e, what) => {
    const openers = {
      report: () => windows.openReport(),
      settings: windows.openSettings,
      launcher: (tab = 'start') => windows.openLauncher(tab)
    };
    if (openers[what]) openers[what]();
  });

  ipcMain.on('start-session', (_e, minutes) => {
    if (state.S.phase === 'idle' || state.S.phase === 'ready') {
      const mins = Math.max(1, Math.min(240, Math.round(Number(minutes) || 25)));
      const settings = storage.getSettings();
      settings.lastSession = { minutes: mins, focusApps: [], strict: false };
      storage.saveSettings();
      state.startFocus(null, { minutes: mins, focusApps: [], strict: false });
    }
  });

  ipcMain.on('open-launcher', (_e, tab) => windows.openLauncher(tab));

  // Report API
  ipcMain.handle('report:get', (_e, key) => {
    const tasksDb = storage.getTasksDb();
    const log = storage.getLog();
    const byId = Object.fromEntries(tasksDb.tasks.map(t => [t.id, t]));
    const k = key || storage.todayKey();
    return {
      date: k,
      day: log.days[k] || R.emptyDay(),
      tasksById: byId,
      days: Object.keys(log.days).sort().reverse()
    };
  });

  ipcMain.handle('report:notes', (_e, { date, notes }) => {
    storage.day(date).notes = notes;
    storage.saveLog();
    return true;
  });

  ipcMain.handle('report:save', async (_e, { date, markdown }) => {
    const reportWin = windows.getReportWin();
    const r = await dialog.showSaveDialog(reportWin || undefined, {
      defaultPath: path.join(app.getPath('documents'), `Work report ${date}.md`),
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] }
      ]
    });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, markdown, 'utf8');
    return r.filePath;
  });

  ipcMain.handle('clipboard:write', (_e, text) => {
    clipboard.writeText(text);
    return true;
  });
}

module.exports = {
  registerIpc
};
