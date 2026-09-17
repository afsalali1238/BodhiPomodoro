const test = require('node:test');
const assert = require('node:assert');
const D = require('../src/distraction');

const yt = { p: 'chrome', t: 'Lofi beats - YouTube - Google Chrome' };
const code = { p: 'Code', t: 'main.js - bodhi - Visual Studio Code' };

test('matches domains by title and apps by process', () => {
  assert.strictEqual(D.classify(yt, D.DEFAULT_DISTRACT, D.DEFAULT_ALLOW), 'youtube.com');
  assert.strictEqual(D.classify({ p: 'WhatsApp', t: 'WhatsApp' }, D.DEFAULT_DISTRACT, []), 'whatsapp');
  assert.strictEqual(D.classify(code, D.DEFAULT_DISTRACT, D.DEFAULT_ALLOW), null);
});
test('allow list wins', () => {
  assert.strictEqual(D.classify(yt, D.DEFAULT_DISTRACT, ['chrome']), null);
});
test('meetings detected', () => {
  assert.ok(D.isMeeting({ p: 'ms-teams', t: 'Weekly sync | Microsoft Teams' }));
  assert.ok(!D.isMeeting(code));
});
test('grace, glance, then escalation with cooldown', () => {
  const e = D.createEscalator(); const o = { graceMs: 5000, cooldownMs: 30000, maxTier: 3 };
  assert.strictEqual(D.step(e, { ...o, now: 0, matchedRule: 'youtube.com' }), null);
  assert.strictEqual(D.step(e, { ...o, now: 4000, matchedRule: 'youtube.com' }), null);
  assert.deepStrictEqual(D.step(e, { ...o, now: 5000, matchedRule: 'youtube.com' }).tier, 0);   // glance
  assert.strictEqual(D.step(e, { ...o, now: 9000, matchedRule: 'youtube.com' }), null);           // glance cooldown 8 s
  assert.strictEqual(D.step(e, { ...o, now: 13000, matchedRule: 'youtube.com' }).tier, 1);        // beam
  assert.strictEqual(D.step(e, { ...o, now: 14000, matchedRule: null }).type, 'stop');            // refocus stops
  assert.strictEqual(D.step(e, { ...o, now: 50000, matchedRule: 'reddit.com' }), null);           // new grace
  assert.strictEqual(D.step(e, { ...o, now: 55000, matchedRule: 'reddit.com' }).tier, 2);         // sweep
});
test('maxTier caps intensity', () => {
  const e = D.createEscalator(); const o = { graceMs: 0, cooldownMs: 0, maxTier: 1 };
  for (let i = 0; i < 5; i++) { const a = D.step(e, { ...o, now: i * 10000, matchedRule: 'x' }); e.firing = false; assert.ok(a.tier <= 1); }
});

test('strict focus apps: anything else is a distraction', () => {
  const apps = ['chrome', 'Code'];
  assert.strictEqual(D.classify({ p: 'Code', t: 'main.js' }, D.DEFAULT_DISTRACT, [], apps), null);
  assert.strictEqual(D.classify({ p: 'chrome', t: 'Supplier quotes - Google Sheets - Google Chrome' }, D.DEFAULT_DISTRACT, [], apps), null);
  assert.strictEqual(D.classify({ p: 'chrome', t: 'Funny cats - YouTube - Google Chrome' }, D.DEFAULT_DISTRACT, [], apps), 'youtube.com');
  assert.strictEqual(D.classify({ p: 'Spotify', t: 'Spotify Premium' }, D.DEFAULT_DISTRACT, [], apps), 'spotify');
  assert.strictEqual(D.classify({ p: 'explorer', t: '' }, D.DEFAULT_DISTRACT, [], apps), null);
});
