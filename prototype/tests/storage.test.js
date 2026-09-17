const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const storage = require('../src/storage');

test('todayKey produces YYYY-MM-DD', () => {
  const ts = Date.parse('2026-09-17T12:00:00Z');
  const key = storage.todayKey(ts);
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
});

test('readJson returns fallback on non-existent file', () => {
  const res = storage.readJson('does-not-exist-' + Date.now() + '.json', { fallback: true });
  assert.deepStrictEqual(res, { fallback: true });
});

test('writeJsonAtomic writes valid JSON and preserves data integrity', () => {
  const testFile = 'test-storage-' + Date.now() + '.json';
  const data = { hello: 'world', counter: 42, list: [1, 2, 3] };
  
  storage.writeJsonAtomic(testFile, data);
  const readBack = storage.readJson(testFile, null);
  assert.deepStrictEqual(readBack, data);

  // Clean up
  const p = storage.file(testFile);
  if (fs.existsSync(p)) fs.unlinkSync(p);
});
