const { $, parseTask } = BodhiUtils;
const T = window.bodhi.tasks;
let db = { tasks: [], currentTaskId: null };

function render() {
  const open = db.tasks.filter(t => !t.done);
  $('list').innerHTML = open.map(t => `
    <li class="${t.id === db.currentTaskId ? 'sel' : ''}" data-id="${t.id}">
      <button data-a="done" title="Mark done">✓</button>
      <span class="t" data-a="select"></span>
      <span class="n">${t.sessionsDone || 0}/${t.estimate}</span>
      <button data-a="del" title="Delete">✕</button>
    </li>`).join('') || '<li class="n">No open tasks. Add one above.</li>';
  // set titles as text (never innerHTML) to avoid injection
  open.forEach(t => { const li = $('list').querySelector(`[data-id="${t.id}"] .t`); if (li) li.textContent = t.title; });
}

$('add').addEventListener('keydown', async e => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  db = await T.add(parseTask(e.target.value)); e.target.value = ''; render();
});

let selectedIdx = -1;
function selectByIndex(idx) {
  const open = db.tasks.filter(t => !t.done);
  if (idx < 0 || idx >= open.length) return;
  T.select(open[idx].id);
}

$('list').addEventListener('keydown', e => {
  const open = db.tasks.filter(t => !t.done);
  if (e.key === 'ArrowDown') { selectByIndex(++selectedIdx % open.length); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { selectByIndex((selectedIdx - 1 + open.length) % open.length); e.preventDefault(); }
  else if (e.key === 'Enter' && selectedIdx >= 0) T.start(open[selectedIdx].id);
});

$('list').addEventListener('click', async e => {
  const li = e.target.closest('li[data-id]'); if (!li) return;
  const a = e.target.dataset.a, id = li.dataset.id;
  if (a === 'done') db = await T.update(id, { done: true });
  else if (a === 'del') db = await T.remove(id);
  else { selectedIdx = Array.from($('list').children).indexOf(li); db = await T.select(id); }
  render();
});
$('list').addEventListener('dblclick', e => { const li = e.target.closest('li[data-id]'); if (li && document.body.classList.contains('pick')) T.start(li.dataset.id); });
$('startSel').onclick = () => T.start(db.currentTaskId);
$('justFocus').onclick = () => T.start(null);

window.bodhi.on('tasks-mode', mode => {
  document.body.classList.toggle('pick', mode === 'pick');
  $('title').textContent = mode === 'pick' ? 'What will you focus on?' : 'Tasks';
  $('add').focus();
});
window.bodhi.on('state', async () => { db = await T.list(); render(); });
T.list().then(d => { db = d; render(); });
