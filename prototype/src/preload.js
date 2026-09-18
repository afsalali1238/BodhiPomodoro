// @ts-check
/**
 * @fileoverview Secure Electron preload script.
 * Exposes strictly typed and whitelisted domain APIs via contextBridge without arbitrary IPC access.
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

try {
  webFrame.setZoomLevel(0);
  webFrame.setZoomFactor(1);
  webFrame.setVisualZoomLevelLimits(1, 1);
} catch {
  // webFrame may be undefined in certain test mock contexts
}

/**
 * Whitelist of permissible event channels from main process to renderer.
 */
const ALLOWED_CHANNELS = new Set([
  'state',
  'report-date',
  'tasks-mode',
  'open-wizard',
  'chime',
  'blast',
  'launcher-tab'
]);

contextBridge.exposeInMainWorld('bodhi', {
  /**
   * Safely listens to whitelisted main process events.
   * @param {string} ch
   * @param {(data: any) => void} fn
   */
  on: (ch, fn) => {
    if (ALLOWED_CHANNELS.has(ch)) {
      ipcRenderer.on(ch, (_e, data) => fn(data));
    } else {
      console.warn(`[security] Blocked subscription to unauthorized channel: ${ch}`);
    }
  },

  // Pet window controls
  toggle: () => ipcRenderer.send('toggle'),
  menu: () => ipcRenderer.send('menu'),
  petAction: (/** @type {string} */ a) => ipcRenderer.send('pet-action', a),
  dragStart: (/** @type {{x: number, y: number}} */ p) => ipcRenderer.send('drag-start', p),
  dragMove: (/** @type {{x: number, y: number}} */ p) => ipcRenderer.send('drag-move', p),
  dragEnd: () => ipcRenderer.send('drag-end'),
  startSession: (/** @type {number} */ minutes) => ipcRenderer.send('start-session', minutes),
  openLauncher: (/** @type {string} */ [tab]) => ipcRenderer.send('open-launcher', tab || 'start'),

  // Settings
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  saveSettings: (/** @type {any} */ s) => ipcRenderer.send('save-settings', s),
  action: (/** @type {string} */ a) => ipcRenderer.send('action', a),

  // Tasks API
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    add: (/** @type {{title: string, estimate?: number}} */ t) => ipcRenderer.invoke('tasks:add', t),
    update: (/** @type {string} */ id, /** @type {any} */ patch) => ipcRenderer.invoke('tasks:update', { id, patch }),
    remove: (/** @type {string} */ id) => ipcRenderer.invoke('tasks:delete', id),
    reorder: (/** @type {string[]} */ ids) => ipcRenderer.invoke('tasks:reorder', ids),
    select: (/** @type {string} */ id) => ipcRenderer.invoke('tasks:select', id),
    start: (/** @type {string} */ id) => ipcRenderer.send('tasks:start', id)
  },

  // Start-session & apps panel
  apps: {
    list: () => ipcRenderer.invoke('apps:list')
  },
  session: {
    defaults: () => ipcRenderer.invoke('session:defaults'),
    start: (/** @type {any} */ o) => ipcRenderer.invoke('session:start', o)
  },

  open: (/** @type {string} */ what) => ipcRenderer.send('open', what),

  // Report API
  report: {
    get: (/** @type {string} */ [date]) => ipcRenderer.invoke('report:get', date),
    notes: (/** @type {string} */ date, /** @type {string} */ notes) => ipcRenderer.invoke('report:notes', { date, notes }),
    save: (/** @type {string} */ date, /** @type {string} */ markdown) => ipcRenderer.invoke('report:save', { date, markdown }),
    copy: (/** @type {string} */ text) => ipcRenderer.invoke('clipboard:write', text)
  }
});
