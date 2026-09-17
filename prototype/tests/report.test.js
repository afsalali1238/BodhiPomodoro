const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/report');

const day = {
  sessions: [
    { start: Date.parse('2026-09-17T09:00:00'), end: Date.parse('2026-09-17T09:25:00'), minutes: 25, taskId: 'a', taskTitle: 'Supplier report', distractions: 1 },
    { start: Date.parse('2026-09-17T09:30:00'), end: Date.parse('2026-09-17T09:55:00'), minutes: 23.5, taskId: 'a', taskTitle: 'Supplier report', distractions: 0 },
    { start: Date.parse('2026-09-17T10:10:00'), end: Date.parse('2026-09-17T10:35:00'), minutes: 25, taskId: null, distractions: 0 }
  ],
  breaks: [{ activity: 'water', activityDone: true }, { activity: 'breathe', activityDone: false }],
  distractions: [{ app: 'youtube.com' }], completedTasks: [{ title: 'Supplier report', at: Date.parse('2026-09-17T09:55:00') }],
  awayMin: 4, notes: 'Waiting on quotes'
};

test('summary totals', () => {
  const s = R.summarize(day, { a: { title: 'Supplier report' } });
  assert.strictEqual(s.sessions, 3);
  assert.strictEqual(Math.round(s.focusMin * 10) / 10, 73.5);
  assert.strictEqual(s.perTask[0].title, 'Supplier report');
  assert.strictEqual(s.perTask[0].sessions, 2);
  assert.strictEqual(s.breaksWithActivity, 1);
});
test('markdown has the sections', () => {
  const md = R.toMarkdown('2026-09-17', R.summarize(day, {}));
  for (const h of ['# Daily work report — 2026-09-17', '## Completed', '## Time by task', '## Timeline', '## Distractions', '## Wellbeing', 'Waiting on quotes', '1h 14m'])
    assert.ok(md.includes(h), 'missing ' + h);
});
test('empty day is safe', () => {
  const md = R.toMarkdown('2026-09-18', R.summarize(undefined, {}));
  assert.ok(md.includes('No focus sessions yet'));
});
