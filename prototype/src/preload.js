const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bodhi', {
  on: (ch, fn) => ipcRenderer.on(ch, (_e, data) => fn(data)),
  // pet
  toggle: () => ipcRenderer.send('toggle'),
  menu: () => ipcRenderer.send('menu'),
  petAction: a => ipcRenderer.send('pet-action', a),
  dragStart: p => ipcRenderer.send('drag-start', p),
  dragMove: p => ipcRenderer.send('drag-move', p),
  dragEnd: () => ipcRenderer.send('drag-end'),
  // settings
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  saveSettings: s => ipcRenderer.send('save-settings', s),
  action: a => ipcRenderer.send('action', a),
  // tasks
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    add: t => ipcRenderer.invoke('tasks:add', t),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', { id, patch }),
    remove: id => ipcRenderer.invoke('tasks:delete', id),
    reorder: ids => ipcRenderer.invoke('tasks:reorder', ids),
    select: id => ipcRenderer.invoke('tasks:select', id),
    start: id => ipcRenderer.send('tasks:start', id)
  },
  // start-session panel
  apps: { list: () => ipcRenderer.invoke('apps:list') },
  session: {
    defaults: () => ipcRenderer.invoke('session:defaults'),
    start: o => ipcRenderer.invoke('session:start', o)
  },
  open: what => ipcRenderer.send('open', what),
  send: (ch, ...args) => ipcRenderer.send(ch, ...args),
  // report
  report: {
    get: date => ipcRenderer.invoke('report:get', date),
    notes: (date, notes) => ipcRenderer.invoke('report:notes', { date, notes }),
    save: (date, markdown) => ipcRenderer.invoke('report:save', { date, markdown }),
    copy: text => ipcRenderer.invoke('clipboard:write', text)
  }
});
