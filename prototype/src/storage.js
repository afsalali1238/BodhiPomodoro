// @ts-check
/**
 * @fileoverview Data storage, atomic file persistence, and schema migrations.
 */
const path = require('path');
const fs = require('fs');
const D = require('./distraction');
const R = require('./report');

// `electron` is only resolvable when running inside the Electron runtime.
// Falling back to null lets this module (and anything that depends on it,
// like state.js) be required and unit-tested under plain Node.js.
/** @type {import('electron').App|null} */
let app = null;
try {
  ({ app } = require('electron'));
} catch {
  app = null;
}

/**
 * @typedef {Object} BodhiSettings
 * @property {number} schemaVersion
 * @property {number} focusMin
 * @property {number} breakMin
 * @property {number} longBreakMin
 * @property {number} cyclesBeforeLong
 * @property {number|null} displayId
 * @property {Record<string, {x: number, y: number}>} positions
 * @property {string|number} scale
 * @property {boolean} alwaysOnTop
 * @property {boolean} walkAcross
 * @property {boolean} autoStartBreak
 * @property {boolean} autoStartFocus
 * @property {boolean} sound
 * @property {boolean} askTaskOnStart
 * @property {boolean} lasers
 * @property {number} laserMax
 * @property {number} graceSec
 * @property {number} cooldownSec
 * @property {Array<{domain?: string, app?: string, label?: string}>} distractList
 * @property {Array<{domain?: string, app?: string, label?: string}>} allowList
 * @property {number} awayPauseMin
 * @property {boolean} hideInMeetings
 * @property {boolean} hideFullscreen
 * @property {boolean} breakNudge
 * @property {string} reportTime
 * @property {boolean} reduceMotion
 * @property {string[]} focusApps
 * @property {{minutes: number, focusApps: string[], strict: boolean}} lastSession
 * @property {boolean} autoStart
 */

/**
 * @typedef {Object} TaskItem
 * @property {string} id
 * @property {string} title
 * @property {number} estimate
 * @property {number} sessionsDone
 * @property {boolean} done
 * @property {number} createdAt
 * @property {number|null} [doneAt]
 */

/**
 * @typedef {Object} TasksDatabase
 * @property {TaskItem[]} tasks
 * @property {string|null} currentTaskId
 */

/**
 * @typedef {Object} LogDatabase
 * @property {Record<string, any>} days
 * @property {number} totalSessions
 * @property {string|null} lastWrapDate
 */

/** @type {BodhiSettings} */
const DEFAULTS = {
  schemaVersion: 4,
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLong: 4,
  displayId: null,
  positions: {},
  scale: 'auto',
  alwaysOnTop: true,
  walkAcross: true,
  autoStartBreak: true,
  autoStartFocus: false,
  sound: true,
  askTaskOnStart: true,
  lasers: true,
  laserMax: 3,
  graceSec: 5,
  cooldownSec: 30,
  distractList: D.DEFAULT_DISTRACT,
  allowList: D.DEFAULT_ALLOW,
  awayPauseMin: 3,
  hideInMeetings: true,
  hideFullscreen: true,
  breakNudge: true,
  reportTime: '18:00',
  reduceMotion: false,
  focusApps: [],
  lastSession: { minutes: 25, focusApps: [], strict: true },
  autoStart: false
};

/** @type {BodhiSettings} */
let settings = { ...DEFAULTS };

/** @type {TasksDatabase} */
let tasksDb = { tasks: [], currentTaskId: null };

/** @type {LogDatabase} */
let log = { days: {}, totalSessions: 0, lastWrapDate: null };

/**
 * Resolves a filename inside the user data directory.
 * @param {string} name
 * @returns {string}
 */
const file = name => {
  // Falls back to a plain directory when running outside Electron (unit tests,
  // scripts). BODHI_DATA_DIR lets tests point this at a throwaway temp folder
  // instead of polluting the repo's working directory.
  const userData = app ? app.getPath('userData') : (process.env.BODHI_DATA_DIR || path.join(process.cwd(), '.data'));
  return path.join(userData, name);
};

/**
 * Safely reads and parses a JSON file, returning fallback on error.
 * @template T
 * @param {string} name
 * @param {T} fallback
 * @returns {T}
 */
function readJson(name, fallback) {
  try {
    const filePath = file(name);
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.warn(`[storage] readJson failed for ${name}, returning fallback:`, e.message);
    return fallback;
  }
}

/**
 * Atomically writes data to a JSON file using a temporary file and atomic rename.
 * Prevents file corruption during unexpected crashes or power loss.
 * @param {string} name
 * @param {any} data
 */
function writeJsonAtomic(name, data) {
  const target = file(name);
  const dir = path.dirname(target);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // Non-fatal: the write below will surface its own error if the dir truly
    // couldn't be created (e.g. permissions).
    console.warn(`[storage] Could not ensure data directory exists (${dir}):`, e.message);
  }

  const tmp = `${target}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, target);
  } catch (e) {
    console.error(`[storage] Atomic write failed for ${name}:`, e.message);
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (cleanupErr) {
      // Best-effort cleanup of the leftover temp file; not fatal either way.
      console.warn(`[storage] Could not remove leftover temp file ${tmp}:`, cleanupErr.message);
    }
    // Fallback direct write if rename fails
    try {
      fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
    } catch (err2) {
      console.error(`[storage] Direct fallback write also failed for ${name}:`, err2.message);
    }
  }
}

/**
 * Returns a YYYY-MM-DD key for a given timestamp.
 * @param {number} [t]
 * @returns {string}
 */
const todayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Retrieves or initializes the day entry in the log database.
 * @param {string} [key]
 * @returns {any}
 */
const day = (key = todayKey()) => {
  log.days[key] = Object.assign(R.emptyDay(), log.days[key] || {});
  return log.days[key];
};

const saveSettings = () => writeJsonAtomic('settings.json', settings);
const saveTasks = () => writeJsonAtomic('tasks.json', tasksDb);
const saveLog = () => writeJsonAtomic('log.json', log);

function backupSession() {
  try {
    const src = file('session.json');
    if (fs.existsSync(src)) fs.copyFileSync(src, file('session.json.bak'));
  } catch (e) {
    // Best-effort backup; losing it doesn't affect the live session file.
    console.warn('[storage] backupSession failed:', e.message);
  }
}

function backupData() {
  try {
    const logFile = file('log.json');
    if (fs.existsSync(logFile)) fs.copyFileSync(logFile, file('log.json.bak'));
    const tasksFile = file('tasks.json');
    if (fs.existsSync(tasksFile)) fs.copyFileSync(tasksFile, file('tasks.json.bak'));
  } catch (e) {
    // Best-effort backup; losing it doesn't affect the live data files.
    console.warn('[storage] backupData failed:', e.message);
  }
}

/**
 * Initializes and loads persisted data on application launch.
 */
function initStorage() {
  backupData();
  const loadedSettings = readJson('settings.json', {});
  settings = { ...DEFAULTS, ...loadedSettings };

  // Migrations
  if ((settings.schemaVersion || 1) < 4) {
    if (settings.scale === 1 || Number(settings.scale) > 3) settings.scale = 'auto';
    settings.schemaVersion = 4;
    saveSettings();
  }

  tasksDb = { ...tasksDb, ...readJson('tasks.json', {}) };
  log = { ...log, ...readJson('log.json', {}) };
}

module.exports = {
  DEFAULTS,
  file,
  readJson,
  writeJsonAtomic,
  todayKey,
  day,
  saveSettings,
  saveTasks,
  saveLog,
  backupSession,
  backupData,
  initStorage,
  getSettings: () => settings,
  getTasksDb: () => tasksDb,
  getLog: () => log
};
