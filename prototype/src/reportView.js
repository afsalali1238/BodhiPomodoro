const { $ } = BodhiUtils;
const RP = window.BodhiReport, API = window.bodhi.report;
let current = null, md = '', noteT = 0;

async function load(date) {
  current = await API.get(date);
  $('date').innerHTML = [...new Set([current.date, ...current.days])].map(d => `<option ${d === current.date ? 'selected' : ''}>${d}</option>`).join('');
  $('notes').value = current.day.notes || '';
  draw();
}
function draw() {
  const sum = RP.summarize({ ...current.day, notes: $('notes').value }, current.tasksById);
  $('kFocus').textContent = RP.hm(sum.focusMin); $('kSess').textContent = sum.sessions;
  $('kDone').textContent = sum.completed.length; $('kDis').textContent = sum.distractions;
  md = RP.toMarkdown(current.date, sum);
  $('md').textContent = md;
}
$('date').onchange = e => load(e.target.value);
$('notes').oninput = () => { draw(); clearTimeout(noteT); noteT = setTimeout(() => API.notes(current.date, $('notes').value), 500); };
$('copy').onclick = async () => { await API.copy(RP.toPlainText(current.date, RP.summarize({ ...current.day, notes: $('notes').value }, current.tasksById))); $('copy').textContent = 'Copied ✓'; setTimeout(() => $('copy').textContent = 'Copy', 1200); };
$('waCopy').onclick = async () => { const sum = RP.summarize({ ...current.day, notes: $('notes').value }, current.tasksById); const text = `📊 Work report — ${current.date}\nFocused: ${RP.hm(sum.focusMin)} across ${sum.sessions} sessions\nTasks done: ${sum.completed.length}\nDistractions: ${sum.distractions}\n\n${sum.completed.map(t => `✓ ${t.title}`).join('\n')}`; await API.copy(text); $('waCopy').textContent = 'Copied ✓'; setTimeout(() => $('waCopy').textContent = 'WhatsApp', 1200); };
$('save').onclick = async () => { const p = await API.save(current.date, md); if (p) { $('save').textContent = 'Saved ✓'; setTimeout(() => $('save').textContent = 'Save .md', 1500); } };
window.bodhi.on('report-date', d => load(d));
load();
