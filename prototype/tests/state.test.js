// Tests for the application state machine (src/state.js).
// state.js keeps a module-level singleton (`S`), so each test gets a fresh
// module instance via require-cache busting, and a throwaway data directory
// so storage writes never touch real user data.
//
// Several transitions (finishFocus -> leaveForBreak, leaveForBreak -> beginBreak)
// schedule real setTimeout()s (15s / 1.5s). We use node:test's mock timers so
// those transitions can be driven deterministically and instantly instead of
// making the suite wait on real wall-clock time.
const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Loads a fresh copy of state.js (and its storage dependency) with an
 * isolated data directory, so tests don't share mutable module state.
 */
function freshState() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodhi-state-test-'));
  process.env.BODHI_DATA_DIR = dir;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}src${path.sep}state.js`) || key.includes(`${path.sep}src${path.sep}storage.js`)) {
      delete require.cache[key];
    }
  }
  const state = require('../src/state');
  const storage = require('../src/storage');
  storage.initStorage();
  return { state, storage, dir };
}

function withCallbacks(state, overrides = {}) {
  const calls = { notify: [], stateChanges: 0, blasts: [], stopBlasts: 0, launcherOpens: [], reportOpens: [] };
  state.setCallbacks({
    onStateChange: () => { calls.stateChanges++; },
    onNotify: (title, body) => calls.notify.push({ title, body }),
    onBlast: (tier, rect) => calls.blasts.push({ tier, rect }),
    onStopBlast: () => { calls.stopBlasts++; },
    onOpenLauncher: tab => calls.launcherOpens.push(tab),
    onOpenReport: dateKey => calls.reportOpens.push(dateKey),
    onConfirmReset: async () => true,
    isWatcherAvailable: () => false,
    getSystemIdleTime: () => 0,
    ...overrides
  });
  return calls;
}

test('durations(): classic preset uses configured focus/break minutes', () => {
  const { state, storage } = freshState();
  const settings = storage.getSettings();
  settings.focusMin = 25;
  settings.breakMin = 5;
  settings.longBreakMin = 15;
  const d = state.durations();
  assert.strictEqual(d.focus, 25 * 60 * 1000);
  assert.strictEqual(d.brk, 5 * 60 * 1000);
  assert.strictEqual(d.long, 15 * 60 * 1000);
});

test('durations(): custom session length derives its own break length', () => {
  const { state } = freshState();
  state.S.sessionMin = 50;
  const d = state.durations();
  assert.strictEqual(d.focus, 50 * 60 * 1000);
  assert.strictEqual(d.brk, 10 * 60 * 1000); // BREAK_FOR[50] = 10
});

test('breakFor(): known presets map exactly, unknown values are derived and clamped', () => {
  const { state } = freshState();
  assert.strictEqual(state.breakFor(25), 5);
  assert.strictEqual(state.breakFor(50), 10);
  assert.strictEqual(state.breakFor(90), 20);
  assert.strictEqual(state.breakFor(5), 3);   // clamped to minimum 3
  assert.strictEqual(state.breakFor(200), 20); // clamped to maximum 20
});

test('startFocus(): transitions idle -> focus and starts a countdown', () => {
  const { state } = freshState();
  withCallbacks(state);
  assert.strictEqual(state.S.phase, 'idle');
  state.startFocus();
  assert.strictEqual(state.S.phase, 'focus');
  assert.ok(state.S.focusStart > 0);
  assert.strictEqual(state.S.sessionDistractions, 0);
});

test('startFocus(): strict session records custom minutes and focus apps', () => {
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus(null, { minutes: 50, focusApps: ['code', 'chrome'], strict: true });
  assert.strictEqual(state.S.sessionMin, 50);
  assert.deepStrictEqual(state.S.sessionApps, ['code', 'chrome']);
});

test('startFocus(): non-strict session clears focus apps even if provided', () => {
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus(null, { minutes: 25, focusApps: ['code'], strict: false });
  assert.deepStrictEqual(state.S.sessionApps, []);
});

test('pause()/resume(): pausing freezes remaining time, resuming restores the deadline', () => {
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus(null, { minutes: 25 });
  const remainingBefore = state.remainingMs();
  state.pause('user');
  assert.strictEqual(state.S.paused, true);
  assert.strictEqual(state.S.pauseReason, 'user');
  // Remaining time is frozen while paused.
  const frozen = state.remainingMs();
  assert.ok(Math.abs(frozen - remainingBefore) < 50);
  state.resume();
  assert.strictEqual(state.S.paused, false);
  assert.strictEqual(state.S.pauseReason, null);
});

test('pause() is a no-op when already paused; resume() is a no-op when not paused', () => {
  const { state } = freshState();
  const calls = withCallbacks(state);
  state.startFocus();
  state.pause('user');
  const afterFirstPause = calls.stateChanges;
  state.pause('user'); // no-op, should not push another state change
  assert.strictEqual(calls.stateChanges, afterFirstPause);

  state.resume();
  const afterResume = calls.stateChanges;
  state.resume(); // no-op
  assert.strictEqual(calls.stateChanges, afterResume);
});

test('skip(): during focus, immediately finishes focus and opens the wake-up flow', t => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { state } = freshState();
  const calls = withCallbacks(state);
  state.startFocus();
  state.skip();
  assert.strictEqual(state.S.phase, 'waking');
  assert.ok(calls.notify.length >= 1);
  assert.deepStrictEqual(calls.launcherOpens, ['start']);
});

test('leaveForBreak(): commits the session and walks out before the break begins', t => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus();
  state.S.phase = 'waking';
  state.leaveForBreak();
  // beginBreak() itself is scheduled 1.5s later (walk-out animation); right
  // after leaveForBreak() the pet is still mid-walk, not yet on break.
  assert.strictEqual(state.S.phase, 'walkingOut');

  mock.timers.tick(1500);
  assert.strictEqual(state.S.phase, 'break');
});

test('skip(): during break, immediately finishes the break', t => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus();
  state.S.phase = 'waking';
  state.leaveForBreak();
  mock.timers.tick(1500); // let the walk-out animation finish -> phase becomes 'break'
  assert.strictEqual(state.S.phase, 'break');
  state.skip();
  assert.strictEqual(state.S.phase, 'returning');
});

test('reset(): returns to idle and clears cycle/fx when confirmed', async () => {
  const { state } = freshState();
  withCallbacks(state, { onConfirmReset: async () => true });
  state.startFocus();
  state.S.cycle = 3;
  await state.reset();
  assert.strictEqual(state.S.phase, 'idle');
  assert.strictEqual(state.S.cycle, 0);
  assert.strictEqual(state.S.paused, false);
});

test('reset(): leaves state untouched when the user cancels the confirmation', async () => {
  const { state } = freshState();
  withCallbacks(state, { onConfirmReset: async () => false });
  state.startFocus();
  await state.reset();
  assert.strictEqual(state.S.phase, 'focus');
});

test('sit(): transitions ready -> idle', () => {
  const { state } = freshState();
  withCallbacks(state);
  state.S.phase = 'ready';
  state.sit();
  assert.strictEqual(state.S.phase, 'idle');

  // No-op when not in ready phase
  state.S.phase = 'focus';
  state.sit();
  assert.strictEqual(state.S.phase, 'focus');
});

test('treeStage(): grows with total completed sessions', () => {
  const { state, storage } = freshState();
  const log = storage.getLog();
  const cases = [[0, 0], [5, 1], [15, 2], [40, 3], [80, 4]];
  for (const [total, expectedStage] of cases) {
    log.totalSessions = total;
    assert.strictEqual(state.treeStage(), expectedStage, `expected stage ${expectedStage} at ${total} sessions`);
  }
});

test('completeTask(): marks a task done, logs it, and reassigns currentTaskId if needed', () => {
  const { state, storage } = freshState();
  withCallbacks(state);
  const db = storage.getTasksDb();
  db.tasks.push(
    { id: 't1', title: 'First', estimate: 1, sessionsDone: 0, done: false, createdAt: Date.now() },
    { id: 't2', title: 'Second', estimate: 1, sessionsDone: 0, done: false, createdAt: Date.now() }
  );
  db.currentTaskId = 't1';
  state.completeTask('t1');
  const t1 = db.tasks.find(t => t.id === 't1');
  assert.strictEqual(t1.done, true);
  assert.ok(t1.doneAt);
  assert.strictEqual(db.currentTaskId, 't2'); // falls back to next open task
  const day = storage.day();
  assert.strictEqual(day.completedTasks.length, 1);
  assert.strictEqual(day.completedTasks[0].title, 'First');
});

test('completeTask(): is a no-op for unknown or already-done tasks', () => {
  const { state, storage } = freshState();
  withCallbacks(state);
  const db = storage.getTasksDb();
  db.tasks.push({ id: 't1', title: 'First', estimate: 1, sessionsDone: 0, done: true, createdAt: Date.now() });
  state.completeTask('t1');
  state.completeTask('does-not-exist');
  assert.strictEqual(storage.day().completedTasks.length, 0);
});

test('persistSession()/restoreSession(): a focus session in progress survives a reload', () => {
  const { state, storage, dir } = freshState();
  withCallbacks(state);
  state.startFocus(null, { minutes: 25 });
  state.S.activeMs = 60 * 1000;
  // Force a real write regardless of the 2s throttle inside persistSession().
  storage.writeJsonAtomic('session.json', {
    phase: state.S.phase,
    paused: state.S.paused,
    pauseReason: state.S.pauseReason,
    endsAt: state.S.endsAt,
    pausedRemaining: state.S.pausedRemaining,
    total: state.S.total,
    cycle: state.S.cycle,
    focusStart: state.S.focusStart,
    activeMs: state.S.activeMs,
    isLongBreak: state.S.isLongBreak,
    activity: state.S.activity,
    breakStart: state.S.breakStart,
    sessionMin: state.S.sessionMin,
    sessionApps: state.S.sessionApps,
    savedAt: Date.now()
  });

  // Simulate an app restart: reload state.js fresh, pointing at the same data dir.
  process.env.BODHI_DATA_DIR = dir;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}src${path.sep}state.js`) || key.includes(`${path.sep}src${path.sep}storage.js`)) {
      delete require.cache[key];
    }
  }
  const state2 = require('../src/state');
  const storage2 = require('../src/storage');
  storage2.initStorage();
  withCallbacks(state2);
  state2.restoreSession();
  assert.strictEqual(state2.S.phase, 'focus');
  assert.strictEqual(state2.S.activeMs, 60 * 1000);
});

test('restoreSession(): ignores idle/ready sessions from a previous run', () => {
  const { state, storage } = freshState();
  storage.writeJsonAtomic('session.json', { phase: 'idle', savedAt: Date.now() });
  withCallbacks(state);
  state.restoreSession();
  assert.strictEqual(state.S.phase, 'idle');
});

test('tick(): accumulates active focus time while running and unpaused', () => {
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus();
  state.S.lastTick = Date.now() - 500;
  state.tick();
  assert.ok(state.S.activeMs >= 400 && state.S.activeMs <= 600);
});

test('tick(): does not accumulate active time while paused', () => {
  const { state } = freshState();
  withCallbacks(state);
  state.startFocus();
  state.pause('user');
  state.S.lastTick = Date.now() - 500;
  state.tick();
  assert.strictEqual(state.S.activeMs, 0);
});
