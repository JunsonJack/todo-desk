const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const db = require('./db.cjs');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development';

// Keep dev/prod isolated so packaged app and `npm run dev` can run together.
if (isDev) {
  app.setName('Todo Desk Dev');
  app.setPath('userData', path.join(app.getPath('appData'), 'todo-desktop-dev'));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: isDev ? 'Todo Desk Dev' : 'Todo Desk',
    backgroundColor: '#0f1219',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('tasks:list', (_e, filters) => db.listTasks(filters || {}));
  ipcMain.handle('tasks:get', (_e, id) => db.getTask(id));
  ipcMain.handle('tasks:create', (_e, input) => db.createTask(input || {}));
  ipcMain.handle('tasks:update', (_e, { id, patch }) => db.updateTask(id, patch || {}));
  ipcMain.handle('tasks:delete', (_e, id) => db.deleteTask(id));

  ipcMain.handle('projects:list', () => db.listProjects());
  ipcMain.handle('projects:create', (_e, input) => db.createProject(input || {}));
  ipcMain.handle('projects:update', (_e, { id, patch }) => db.updateProject(id, patch || {}));
  ipcMain.handle('projects:delete', (_e, id) => db.deleteProject(id));

  ipcMain.handle('priorities:list', () => db.listPriorities());
  ipcMain.handle('priorities:create', (_e, input) => db.createPriority(input || {}));
  ipcMain.handle('priorities:update', (_e, { id, patch }) => db.updatePriority(id, patch || {}));
  ipcMain.handle('priorities:delete', (_e, id) => db.deletePriority(id));
  ipcMain.handle('priorities:move', (_e, { id, direction }) => db.movePriority(id, direction));
  ipcMain.handle('priorities:reorder', (_e, orderedIds) => db.reorderPriorities(orderedIds || []));

  ipcMain.handle('notes:list', (_e, filters) => db.listNotes(filters || {}));
  ipcMain.handle('notes:get', (_e, id) => db.getNote(id));
  ipcMain.handle('notes:create', (_e, input) => db.createNote(input || {}));
  ipcMain.handle('notes:update', (_e, { id, patch }) => db.updateNote(id, patch || {}));
  ipcMain.handle('notes:delete', (_e, id) => db.deleteNote(id));
  ipcMain.handle('notes:stats', () => db.getNoteStats());

  ipcMain.handle('note-categories:list', () => db.listNoteCategories());
  ipcMain.handle('note-categories:create', (_e, input) => db.createNoteCategory(input || {}));
  ipcMain.handle('note-categories:update', (_e, { id, patch }) => db.updateNoteCategory(id, patch || {}));
  ipcMain.handle('note-categories:delete', (_e, id) => db.deleteNoteCategory(id));

  ipcMain.handle('stats:get', () => db.getStats());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.error('[todo-desktop] another instance is already running, exit.');
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    db.initDb(app.getPath('userData'));
    registerIpc();
    createWindow();
    console.log(`[todo-desktop] started. dev=${isDev} userData=${app.getPath('userData')}`);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.closeDb();
    app.quit();
  }
});

app.on('before-quit', () => {
  db.closeDb();
});
