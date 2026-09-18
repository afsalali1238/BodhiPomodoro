// Pure daily-report builder (used by main for notifications and by the report window).
(function (root) {
  // hm lives in the shared utils module: required directly under Node, and
  // loaded as window.BodhiUtils in the report window (utils.js is included
  // before this script in report.html).
  const U = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./utils') : root.BodhiUtils;
  const hm = U.hm;
  const clock = ts => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const ACT = { water: 'Drank water', breathe: 'Breathing exercise', stretch: 'Stretched', eyes: 'Rested eyes (look far away)', coffee: 'Coffee / tea break', walk: 'Short walk' };

  function emptyDay() { return { sessions: [], breaks: [], distractions: [], completedTasks: [], awayMin: 0, notes: '' }; }

  function summarize(day, tasksById) {
    day = Object.assign(emptyDay(), day || {});
    const focusMin = day.sessions.reduce((a, s) => a + (s.minutes || 0), 0);
    const perTask = {};
    for (const s of day.sessions) {
      const key = s.taskId || '_none';
      perTask[key] = perTask[key] || { title: s.taskId ? ((tasksById[s.taskId] && tasksById[s.taskId].title) || s.taskTitle || 'Task') : 'Unplanned focus', sessions: 0, minutes: 0 };
      perTask[key].sessions++; perTask[key].minutes += s.minutes || 0;
    }
    const apps = {};
    for (const d of day.distractions) apps[d.app] = (apps[d.app] || 0) + 1;
    const acts = {};
    for (const b of day.breaks) if (b.activityDone) acts[b.activity] = (acts[b.activity] || 0) + 1;
    const first = day.sessions.length ? Math.min(...day.sessions.map(s => s.start)) : null;
    const last = day.sessions.length ? Math.max(...day.sessions.map(s => s.end)) : null;
    return {
      focusMin, sessions: day.sessions.length, breaks: day.breaks.length,
      breaksWithActivity: day.breaks.filter(b => b.activityDone).length,
      distractions: day.distractions.length, awayMin: day.awayMin || 0,
      perTask: Object.values(perTask).sort((a, b) => b.minutes - a.minutes),
      completed: day.completedTasks, apps: Object.entries(apps).sort((a, b) => b[1] - a[1]),
      acts, first, last, notes: day.notes || '', timeline: day.sessions
    };
  }

  function toMarkdown(dateStr, sum) {
    const L = [];
    L.push(`# Daily work report — ${dateStr}`, '');
    L.push(`**Focused:** ${hm(sum.focusMin)} across ${sum.sessions} session${sum.sessions === 1 ? '' : 's'}` +
      (sum.first ? ` (${clock(sum.first)}–${clock(sum.last)})` : ''));
    L.push(`**Tasks completed:** ${sum.completed.length}  ·  **Breaks:** ${sum.breaks} (${sum.breaksWithActivity} with a rest activity)  ·  **Distractions:** ${sum.distractions}  ·  **Away:** ${hm(sum.awayMin)}`, '');
    L.push('## Completed');
    L.push(...(sum.completed.length ? sum.completed.map(t => `- [x] ${t.title} (${clock(t.at)})`) : ['- None']), '');
    L.push('## Time by task');
    L.push(...(sum.perTask.length ? sum.perTask.map(t => `- ${t.title} — ${hm(t.minutes)}, ${t.sessions} session${t.sessions === 1 ? '' : 's'}`) : ['- No focus sessions yet']), '');
    L.push('## Timeline');
    L.push(...(sum.timeline.length ? sum.timeline.map(s => `- ${clock(s.start)}–${clock(s.end)} · ${hm(s.minutes)} · ${s.taskTitle || 'Unplanned focus'}${s.distractions ? ` · ${s.distractions} distraction${s.distractions === 1 ? '' : 's'}` : ''}`) : ['- —']), '');
    if (sum.apps.length) { L.push('## Distractions'); L.push(...sum.apps.map(([a, n]) => `- ${a}: ${n}`), ''); }
    const acts = Object.entries(sum.acts);
    if (acts.length) { L.push('## Wellbeing'); L.push(...acts.map(([a, n]) => `- ${ACT[a] || a}: ${n}`), ''); }
    L.push('## Notes / blockers', sum.notes.trim() || '-', '');
    return L.join('\n');
  }

  function toPlainText(dateStr, sum) {
    return toMarkdown(dateStr, sum).replace(/^#+ /gm, '').replace(/\*\*/g, '').replace(/- \[x\] /g, '✓ ');
  }

  const api = { emptyDay, summarize, toMarkdown, toPlainText, hm, clock, ACT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BodhiReport = api;
})(this);
