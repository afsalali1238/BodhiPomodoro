// Pure distraction logic (no Electron) — matching + grace/cooldown/escalation.

const DEFAULT_DISTRACT = ['youtube.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'tiktok.com',
  'reddit.com', 'netflix.com', 'whatsapp', 'telegram', 'steam', 'primevideo', 'twitch'];
const DEFAULT_ALLOW = ['code', 'excel', 'winword', 'powerpnt', 'outlook', 'notion', 'figma', 'slack'];
const MEETING_RULES = ['teams', 'ms-teams', 'zoom', 'cpthost', 'webex', 'meet -', 'google meet', 'zoom meeting'];

const norm = s => String(s || '').toLowerCase().trim();

// A rule matches a process name exactly (without .exe) or appears in the window title.
// Domain rules ("youtube.com") match their name part ("youtube") in titles.
function ruleMatches(rule, win) {
  const r = norm(rule);
  if (!r) return false;
  const proc = norm(win.p).replace(/\.exe$/, '');
  const title = norm(win.t);
  const name = r.replace(/^www\./, '').includes('.') ? r.replace(/^www\./, '').split('.')[0] : r;
  if (proc === name || proc === r) return true;
  if (name.length <= 1) return false;
  if (name === 'x') return /(^|[\s\-|])x($|[\s\-|])/.test(title) && title.includes('/ x');
  return title.includes(name);
}

function firstMatch(rules, win) { return (rules || []).find(r => ruleMatches(r, win)) || null; }

// Windows shell surfaces never count as leaving your focus apps (taskbar, start menu, alt-tab, lock screen).
const SYSTEM_PROCS = ['explorer', 'shellexperiencehost', 'startmenuexperiencehost', 'searchhost', 'searchapp', 'lockapp',
  'textinputhost', 'systemsettings', 'taskmgr', 'bodhi pomodoro', 'electron', 'powershell', ''];

function classify(win, distractList, allowList, focusApps) {
  if (!win || (!win.p && !win.t)) return null;
  const proc = norm(win.p).replace(/\.exe$/, '');
  if (proc.includes('bodhi') || SYSTEM_PROCS.includes(proc)) return null;          // ourselves / Windows shell
  // Strict session: only the selected apps are allowed. Inside an allowed browser, blocked sites still count.
  if (focusApps && focusApps.length) {
    const inFocus = focusApps.some(a => norm(a).replace(/\.exe$/, '') === proc);
    if (!inFocus) return proc;                                                    // e.g. "whatsapp", "spotify"
    return firstMatch(distractList, { t: win.t, p: '' });                         // e.g. YouTube tab in allowed Chrome
  }
  if (firstMatch(allowList, win)) return null;                                     // allow list always wins
  return firstMatch(distractList, win);
}

function isMeeting(win) {
  if (!win) return false;
  return MEETING_RULES.some(r => ruleMatches(r, win));
}

// Escalation state machine. Call step() every poll; returns an action or null.
function createEscalator() {
  return { since: null, offenses: [], lastFire: -Infinity, lastTier: -1, firing: false, rule: null };
}

function step(esc, { now, matchedRule, graceMs, cooldownMs, maxTier }) {
  if (!matchedRule) {
    esc.since = null; esc.rule = null;
    if (esc.firing) { esc.firing = false; return { type: 'stop' }; }
    return null;
  }
  if (esc.since === null || esc.rule !== matchedRule) { esc.since = now; esc.rule = matchedRule; }
  if (esc.firing) return null;
  if (now - esc.since < graceMs) return null;
  const cd = esc.lastTier === 0 ? Math.min(8000, cooldownMs) : cooldownMs; // quick follow-up after a glance
  if (now - esc.lastFire < cd) return null;
  esc.offenses = esc.offenses.filter(t => now - t < 5 * 60 * 1000);
  const tier = Math.min(esc.offenses.length, maxTier);   // 0 glance, 1 beam, 2 sweep, 3 full
  esc.offenses.push(now);
  esc.lastFire = now;
  esc.lastTier = tier;
  esc.firing = tier > 0;
  return { type: 'fire', tier, rule: matchedRule };
}

module.exports = { DEFAULT_DISTRACT, DEFAULT_ALLOW, ruleMatches, classify, isMeeting, createEscalator, step };
