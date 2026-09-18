// @ts-check
/**
 * @fileoverview Application state machine, timer loop, and session transitions.
 */
const D = require('./distraction');
const R = require('./report');
const storage = require('./storage');

const MIN = 60 * 1000;

/**
 * @typedef {'idle' | 'focus' | 'waking' | 'walkingOut' | 'break' | 'returning' | 'ready'} BodhiPhase
 */

/**
 * @typedef {Object} BodhiState
 * @property {BodhiPhase} phase
 * @property {boolean} paused
 * @property {string|null} pauseReason
 * @property {number} endsAt
 * @property {number} pausedRemaining
 * @property {number} total
 * @property {number} cycle
 * @property {boolean} isLongBreak
 * @property {number} focusStart
 * @property {number} activeMs
 * @property {number} sessionDistractions
 * @property {number} extended
 * @property {string|null} activity
 * @property {boolean} activityDone
 * @property {number} breakStart
 * @property {boolean} nudged
 * @property {boolean} hidden
 * @property {string|null} fx
 * @property {boolean} demo
 * @property {number} snoozeUntil
 * @property {number} lastTick
 * @property {number|null} sessionMin
 * @property {string[]} sessionApps
 * @property {number} [activeStreak]
 */

/** @type {BodhiState} */
const S = {
  phase: 'idle',
  paused: false,
  pauseReason: null,
  endsAt: 0,
  pausedRemaining: 0,
  total: 0,
  cycle: 0,
  isLongBreak: false,
  focusStart: 0,
  activeMs: 0,
  sessionDistractions: 0,
  extended: 0,
  activity: null,
  activityDone: false,
  breakStart: 0,
  nudged: false,
  hidden: false,
  fx: null,
  demo: false,
  snoozeUntil: 0,
  lastTick: Date.now(),
  sessionMin: null,
  sessionApps: [],
  activeStreak: 0
};

/** @type {(() => void)|null} */
let onTimerDone = null;
/** @type {NodeJS.Timeout|null} */
let wakingTimer = null;
/** @type {NodeJS.Timeout|null} */
let fxTimer = null;
let persistT = 0;

const esc = D.createEscalator();

/** @type {((force?: boolean) => void)|null} */
let stateChangeCallback = null;
/** @type {((title: string, body: string, onClick?: () => void) => void)|null} */
let notifyCallback = null;
/** @type {((silent?: boolean) => void)|null} */
let stopBlastCallback = null;
/** @type {((tab?: string) => void)|null} */
let openLauncherCallback = null;
/** @type {((dateKey?: string) => void)|null} */
let openReportCallback = null;
/** @type {(() => Promise<boolean>)|null} */
let confirmResetCallback = null;
/** @type {(() => boolean)|null} */
let isWatcherAvailableCallback = null;
/** @type {(() => number)|null} */
let getSystemIdleTimeCallback = null;

const remainingMs = () => S.paused ? S.pausedRemaining : Math.max(0, S.endsAt - Date.now());
const currentTask = () => {
  const db = storage.getTasksDb();
  return db.tasks.find(t => t.id === db.currentTaskId && !t.done) || null;
};
const openTasks = () => storage.getTasksDb().tasks.filter(t => !t.done);
const treeStage = () => {
  const n = storage.getLog().totalSessions;
  return n >= 80 ? 4 : n >= 40 ? 3 : n >= 15 ? 2 : n >= 5 ? 1 : 0;
};

// Canonical focus → break mapping lives in the shared utils module.
const { BREAK_FOR } = require('./utils');
/**
 * Computes appropriate break duration for a focus duration in minutes.
 * @param {number} min
 * @returns {number}
 */
const breakFor = min => BREAK_FOR[min] || Math.max(3, Math.min(20, Math.round(min / 5)));

/**
 * Returns focus, short break, and long break durations in milliseconds.
 */
function durations() {
  const settings = storage.getSettings();
  if (S.demo) return { focus: 1 * MIN, brk: 1 * MIN, long: 1 * MIN };
  const f = S.sessionMin || settings.focusMin;
  const custom = S.sessionMin && S.sessionMin !== settings.focusMin;
  return {
    focus: f * MIN,
    brk: (custom ? breakFor(f) : settings.breakMin) * MIN,
    long: (custom ? Math.max(breakFor(f) * 3, 15) : settings.longBreakMin) * MIN
  };
}

/**
 * Emits current public state to registered listener.
 * @param {boolean} [force=true]
 */
function pushState(force = true) {
  if (stateChangeCallback) stateChangeCallback(force);
  persistSession();
}

let cachedSum = null;
let cachedSumAt = 0;
let cachedSumKey = null;

function getTodaySummary() {
  const k = storage.todayKey();
  const now = Date.now();
  if (!cachedSum || cachedSumKey !== k || now - cachedSumAt > 4000) {
    cachedSum = R.summarize(storage.getLog().days[k], {});
    cachedSumAt = now;
    cachedSumKey = k;
  }
  return cachedSum;
}

function invalidateTodaySummary() {
  cachedSum = null;
}

/**
 * Serializes state for renderers.
 * @param {number} [petScale=1]
 */
function publicState(petScale = 1) {
  const ct = currentTask();
  const sum = getTodaySummary();
  const watcherAvailable = isWatcherAvailableCallback ? isWatcherAvailableCallback() : false;

  return {
    phase: S.phase,
    paused: S.paused,
    pauseReason: S.pauseReason,
    remaining: Math.ceil(remainingMs() / 1000),
    total: Math.round(S.total / 1000),
    cycle: S.cycle,
    isLongBreak: S.isLongBreak,
    activity: S.activity,
    activityDone: S.activityDone,
    nudged: S.nudged,
    fx: S.fx,
    treeStage: treeStage(),
    demo: S.demo,
    task: ct ? { id: ct.id, title: ct.title, done: ct.sessionsDone, est: ct.estimate } : null,
    today: { sessions: sum.sessions, focusMin: Math.round(sum.focusMin), distractions: sum.distractions },
    session: { minutes: S.sessionMin, apps: S.sessionApps },
    snoozed: Date.now() < S.snoozeUntil,
    watcher: watcherAvailable,
    petScale,
    settings: storage.getSettings()
  };
}

/**
 * Starts a countdown timer for ms milliseconds.
 * @param {number} ms
 * @param {() => void} done
 */
function startTimer(ms, done) {
  S.total = ms;
  S.endsAt = Date.now() + ms;
  S.paused = false;
  S.pauseReason = null;
  onTimerDone = done;
  pushState();
}

/**
 * Pauses the active timer.
 * @param {string} [reason='user']
 */
function pause(reason = 'user') {
  if (S.paused) return;
  S.pausedRemaining = remainingMs();
  S.paused = true;
  S.pauseReason = reason;
  pushState();
}

/**
 * Resumes a paused timer.
 */
function resume() {
  if (!S.paused) return;
  S.endsAt = Date.now() + S.pausedRemaining;
  S.paused = false;
  S.pauseReason = null;
  pushState();
}

/**
 * Sets a visual effect on the pet for ms milliseconds.
 * @param {string|null} fx
 * @param {number} ms
 */
function setFx(fx, ms) {
  S.fx = fx;
  pushState();
  if (fxTimer) clearTimeout(fxTimer);
  fxTimer = setTimeout(() => {
    S.fx = null;
    pushState();
  }, ms);
}

const SHORT_ACTS = ['water', 'breathe', 'stretch', 'eyes'];
const LONG_ACTS = ['coffee', 'walk'];
function activityText(a) {
  return {
    water: 'Drink a glass of water',
    breathe: 'Breathe slowly: in 4, hold 4, out 6',
    stretch: 'Stand up and stretch',
    eyes: 'Look at something far away for 20 seconds',
    coffee: 'Coffee or tea break',
    walk: 'Take a short walk'
  }[a] || 'Rest';
}

/**
 * Starts a focus session.
 * @param {string|null} [taskId]
 * @param {{minutes?: number|null, focusApps?: string[], strict?: boolean}} [opts]
 */
function startFocus(taskId, opts) {
  if (taskId !== undefined) {
    storage.getTasksDb().currentTaskId = taskId;
    storage.saveTasks();
  }
  if (opts) {
    S.sessionMin = opts.minutes || null;
    S.sessionApps = opts.strict ? (opts.focusApps || []) : [];
  }
  Object.assign(S, {
    phase: 'focus',
    focusStart: Date.now(),
    activeMs: 0,
    sessionDistractions: 0,
    extended: 0,
    nudged: false
  });
  startTimer(durations().focus, finishFocus);
}

function finishFocus() {
  S.phase = 'waking';
  S.fx = null;
  if (stopBlastCallback) stopBlastCallback();
  const ct = currentTask();
  if (notifyCallback) {
    notifyCallback(
      'Session complete',
      ct ? `Did you finish “${ct.title}”?` : 'He awakens. Time for a break.'
    );
  }
  pushState();

  if (openLauncherCallback) openLauncherCallback('start');
  if (wakingTimer) clearTimeout(wakingTimer);
  wakingTimer = setTimeout(leaveForBreak, 15000);
}

function extendFocus() {
  if (S.phase !== 'waking') return;
  if (wakingTimer) clearTimeout(wakingTimer);
  S.phase = 'focus';
  S.extended++;
  startTimer(5 * MIN, finishFocus);
}

function commitSession() {
  const ct = currentTask();
  const now = Date.now();
  const minutes = Math.max(0.1, S.activeMs / MIN);
  const log = storage.getLog();
  const settings = storage.getSettings();

  storage.day().sessions.push({
    start: S.focusStart,
    end: now,
    minutes: +minutes.toFixed(1),
    taskId: ct ? ct.id : null,
    taskTitle: ct ? ct.title : null,
    distractions: S.sessionDistractions,
    extended: S.extended,
    apps: S.sessionApps
  });
  if (ct) ct.sessionsDone = (ct.sessionsDone || 0) + 1;
  const before = treeStage();
  log.totalSessions++;
  if (treeStage() > before && notifyCallback) {
    notifyCallback('The Bodhi tree grew', `${log.totalSessions} sessions under the tree.`);
  }
  S.cycle++;
  S.isLongBreak = S.cycle % settings.cyclesBeforeLong === 0;
  storage.saveLog();
  storage.saveTasks();
  invalidateTodaySummary();
}

function leaveForBreak() {
  if (S.phase !== 'waking') return;
  commitSession();
  S.phase = 'walkingOut';
  pushState();
  setTimeout(beginBreak, 1500);
}

function beginBreak() {
  S.phase = 'break';
  const acts = S.isLongBreak ? LONG_ACTS : SHORT_ACTS;
  S.activity = acts[(S.cycle - 1 + acts.length) % acts.length];
  S.activityDone = false;
  S.breakStart = Date.now();
  S.nudged = false;
  S.activeStreak = 0;
  if (notifyCallback) {
    notifyCallback(S.isLongBreak ? 'Long break' : 'Break time', activityText(S.activity));
  }
  const d = durations();
  startTimer(S.isLongBreak ? d.long : d.brk, finishBreak);
  if (!storage.getSettings().autoStartBreak) pause('user');
}

function markActivityDone() {
  if (S.phase !== 'break' || S.activityDone) return;
  S.activityDone = true;
  setFx('nod', 900);
  pushState();
}

function finishBreak() {
  storage.day().breaks.push({
    start: S.breakStart,
    minutes: +((Date.now() - S.breakStart) / MIN).toFixed(1),
    activity: S.activity,
    activityDone: S.activityDone,
    long: S.isLongBreak
  });
  storage.saveLog();
  const ct = currentTask();
  if (notifyCallback) {
    notifyCallback('Break over', ct ? `Next: ${ct.title}` : 'He is returning to the Bodhi tree.');
  }
  S.phase = 'returning';
  pushState();
  setTimeout(() => {
    S.phase = 'ready';
    S.activity = null;
    pushState();
    if (S.demo) {
      S.demo = false;
      pushState();
      return;
    }
    if (storage.getSettings().autoStartFocus) {
      setTimeout(() => startFocus(), 1500);
    }
  }, 1500);
}

function skip() {
  if (S.phase === 'focus') {
    onTimerDone = null;
    finishFocus();
  } else if (S.phase === 'waking') {
    if (wakingTimer) clearTimeout(wakingTimer);
    leaveForBreak();
  } else if (S.phase === 'break') {
    onTimerDone = null;
    finishBreak();
  }
}

async function reset() {
  if (confirmResetCallback) {
    const confirmed = await confirmResetCallback();
    if (!confirmed) return;
  }
  if (wakingTimer) clearTimeout(wakingTimer);
  onTimerDone = null;
  if (stopBlastCallback) stopBlastCallback();
  Object.assign(S, {
    phase: 'idle',
    paused: false,
    pauseReason: null,
    total: 0,
    endsAt: 0,
    cycle: 0,
    fx: null,
    demo: false,
    activity: null
  });
  pushState();
}

async function demoWalk() {
  await reset();
  if (S.phase !== 'idle') return;
  S.demo = true;
  S.sessionMin = null;
  S.sessionApps = [];
  startFocus();
}

function completeTask(id) {
  const db = storage.getTasksDb();
  const t = db.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  t.done = true;
  t.doneAt = Date.now();
  storage.day().completedTasks.push({ id: t.id, title: t.title, at: t.doneAt, sessions: t.sessionsDone || 0 });
  if (db.currentTaskId === id) {
    db.currentTaskId = (openTasks()[0] || {}).id || null;
  }
  storage.saveTasks();
  storage.saveLog();
  invalidateTodaySummary();
  pushState();
}

function tick() {
  const now = Date.now();
  const dt = Math.min(5000, now - S.lastTick);
  S.lastTick = now;
  const settings = storage.getSettings();

  if (S.phase === 'focus' && !S.paused) S.activeMs += dt;

  // Away detection during focus
  if (S.phase === 'focus' && getSystemIdleTimeCallback) {
    const idle = getSystemIdleTimeCallback();
    if (!S.paused && settings.awayPauseMin > 0 && idle >= settings.awayPauseMin * 60) {
      const back = Math.min(idle * 1000, S.activeMs);
      S.activeMs -= back;
      storage.day().awayMin += back / MIN;
      storage.saveLog();
      invalidateTodaySummary();
      S.pausedRemaining = Math.min(S.total, remainingMs() + back);
      S.paused = true;
      S.pauseReason = 'away';
      pushState();
    } else if (S.paused && S.pauseReason === 'away' && idle < 3) {
      resume();
      setFx('nod', 900);
    }
  }

  // Break nudge: still working while he is on break
  if (S.phase === 'break' && !S.paused && settings.breakNudge && !S.nudged && getSystemIdleTimeCallback) {
    const idle = getSystemIdleTimeCallback();
    S.activeStreak = idle < 3 ? (S.activeStreak || 0) + dt : 0;
    if (S.activeStreak > 90 * 1000) {
      S.nudged = true;
      if (notifyCallback) {
        notifyCallback('You are still working', `He's out on a break — you should be too. ${activityText(S.activity)}.`);
      }
      pushState();
    }
  }

  if (onTimerDone && !S.paused && now >= S.endsAt) {
    const cb = onTimerDone;
    onTimerDone = null;
    cb();
  }

  endOfDayCheck(now);
  pushState(false);
}

function endOfDayCheck(now) {
  const settings = storage.getSettings();
  const log = storage.getLog();
  const [hh, mm] = String(settings.reportTime || '18:00').split(':').map(Number);
  const d = new Date(now);
  if (log.lastWrapDate === storage.todayKey(now)) return;
  if (d.getHours() * 60 + d.getMinutes() < hh * 60 + mm) return;
  const sum = R.summarize(log.days[storage.todayKey(now)], {});
  log.lastWrapDate = storage.todayKey(now);
  storage.saveLog();
  if (!sum.sessions) return;
  setFx('bow', 2500);
  if (notifyCallback) {
    notifyCallback(
      'Day wrap-up',
      `${sum.sessions} sessions · ${R.hm(sum.focusMin)} focused · ${sum.completed.length} tasks done. Click for your report.`,
      () => openReportCallback && openReportCallback()
    );
  }
}

function persistSession() {
  if (Date.now() - persistT < 2000) return;
  persistT = Date.now();
  storage.writeJsonAtomic('session.json', {
    phase: S.phase,
    paused: S.paused,
    pauseReason: S.pauseReason,
    endsAt: S.endsAt,
    pausedRemaining: S.pausedRemaining,
    total: S.total,
    cycle: S.cycle,
    focusStart: S.focusStart,
    activeMs: S.activeMs,
    isLongBreak: S.isLongBreak,
    activity: S.activity,
    breakStart: S.breakStart,
    sessionMin: S.sessionMin,
    sessionApps: S.sessionApps,
    savedAt: Date.now()
  });
}

function restoreSession() {
  const s = storage.readJson('session.json', null);
  if (!s || !['focus', 'break', 'waking', 'walkingOut'].includes(s.phase)) return;
  Object.assign(S, {
    cycle: s.cycle || 0,
    isLongBreak: s.isLongBreak,
    total: s.total,
    focusStart: s.focusStart,
    activeMs: s.activeMs || 0,
    sessionMin: s.sessionMin,
    sessionApps: s.sessionApps || []
  });
  const left = s.paused ? s.pausedRemaining : s.endsAt - Date.now();
  if (s.phase === 'focus' && left > 0) {
    S.phase = 'focus';
    startTimer(left, finishFocus);
    S.total = s.total;
    if (s.paused) pause(s.pauseReason || 'user');
  } else if (s.phase === 'focus' || s.phase === 'waking') {
    S.phase = 'waking';
    commitSession();
    S.phase = 'ready';
  } else if ((s.phase === 'break' || s.phase === 'walkingOut') && left > 0) {
    S.phase = 'break';
    S.activity = s.activity;
    S.breakStart = s.breakStart;
    startTimer(left, finishBreak);
    S.total = s.total;
  } else {
    S.phase = 'ready';
  }
}

module.exports = {
  S,
  esc,
  durations,
  breakFor,
  publicState,
  startTimer,
  pause,
  resume,
  tick,
  setFx,
  startFocus,
  finishFocus,
  extendFocus,
  leaveForBreak,
  beginBreak,
  markActivityDone,
  finishBreak,
  skip,
  reset,
  demoWalk,
  completeTask,
  persistSession,
  restoreSession,
  currentTask,
  openTasks,
  remainingMs,
  treeStage,
  pushState,
  setCallbacks: (cbs) => {
    if (cbs.onStateChange) stateChangeCallback = cbs.onStateChange;
    if (cbs.onNotify) notifyCallback = cbs.onNotify;
    if (cbs.onStopBlast) stopBlastCallback = cbs.onStopBlast;
    if (cbs.onOpenLauncher) openLauncherCallback = cbs.onOpenLauncher;
    if (cbs.onOpenReport) openReportCallback = cbs.onOpenReport;
    if (cbs.onConfirmReset) confirmResetCallback = cbs.onConfirmReset;
    if (cbs.isWatcherAvailable) isWatcherAvailableCallback = cbs.isWatcherAvailable;
    if (cbs.getSystemIdleTime) getSystemIdleTimeCallback = cbs.getSystemIdleTime;
  }
};
