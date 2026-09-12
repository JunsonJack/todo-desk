const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  tasks: {
    list: (filters) => ipcRenderer.invoke('tasks:list', filters),
    get: (id) => ipcRenderer.invoke('tasks:get', id),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('tasks:delete', id),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (input) => ipcRenderer.invoke('projects:create', input),
    update: (id, patch) => ipcRenderer.invoke('projects:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('projects:delete', id),
  },
  priorities: {
    list: () => ipcRenderer.invoke('priorities:list'),
    create: (input) => ipcRenderer.invoke('priorities:create', input),
    update: (id, patch) => ipcRenderer.invoke('priorities:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('priorities:delete', id),
    move: (id, direction) => ipcRenderer.invoke('priorities:move', { id, direction }),
    reorder: (orderedIds) => ipcRenderer.invoke('priorities:reorder', orderedIds),
  },
  notes: {
    list: (filters) => ipcRenderer.invoke('notes:list', filters),
    get: (id) => ipcRenderer.invoke('notes:get', id),
    create: (input) => ipcRenderer.invoke('notes:create', input),
    update: (id, patch) => ipcRenderer.invoke('notes:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('notes:delete', id),
    stats: () => ipcRenderer.invoke('notes:stats'),
  },
  noteCategories: {
    list: () => ipcRenderer.invoke('note-categories:list'),
    create: (input) => ipcRenderer.invoke('note-categories:create', input),
    update: (id, patch) => ipcRenderer.invoke('note-categories:update', { id, patch }),
    remove: (id) => ipcRenderer.invoke('note-categories:delete', id),
  },
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
  },
  data: {
    export: () => ipcRenderer.invoke('data:export'),
    import: (payload, mode = 'replace') => ipcRenderer.invoke('data:import', { payload, mode }),
  },
});
