'use strict';

const { app, BrowserWindow, clipboard, ipcMain, nativeImage, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CONTACT_EMAIL = '241644244@qq.com';
const MAX_ITEMS = 800;
const POLL_INTERVAL_MS = 700;

let mainWindow = null;
let pollTimer = null;
let lastTextSignature = '';
let lastImageSignature = '';
let quitting = false;

function dataDir() {
  return app.getPath('userData');
}

function historyFile() {
  return path.join(dataDir(), 'history.json');
}

function imagesDir() {
  const dir = path.join(dataDir(), 'images');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(historyFile(), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* first run */
  }
  return [];
}

let history = [];
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(historyFile(), JSON.stringify(history));
    } catch (error) {
      console.error('Failed to persist history', error);
    }
  }, 250);
}

function broadcast() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history:changed', history);
  }
}

function signature(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function trimHistory() {
  if (history.length <= MAX_ITEMS) return;
  const pinned = history.filter((item) => item.pinned);
  const rest = history.filter((item) => !item.pinned);
  const keep = Math.max(0, MAX_ITEMS - pinned.length);
  history = [...pinned, ...rest.slice(0, keep)];
}

function addTextItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (history.some((item) => item.kind === 'text' && item.text === trimmed)) return;
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: 'text',
    text: trimmed,
    preview: trimmed.replace(/\s+/g, ' ').slice(0, 160),
    createdAt: Date.now(),
    pinned: false,
    source: 'local',
  });
  trimHistory();
  scheduleSave();
  broadcast();
}

function addImageItem(image) {
  if (image.isEmpty()) return;
  const png = image.toPNG();
  if (!png || png.length === 0) return;
  const hash = signature(png);
  if (history.some((item) => item.kind === 'image' && item.hash === hash)) return;
  const file = path.join(imagesDir(), `${hash}.png`);
  try {
    fs.writeFileSync(file, png);
  } catch (error) {
    console.error('Failed to store clipboard image', error);
    return;
  }
  const size = image.getSize();
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: 'image',
    hash,
    file,
    width: size.width,
    height: size.height,
    preview: `${size.width} × ${size.height}`,
    createdAt: Date.now(),
    pinned: false,
    source: 'local',
  });
  trimHistory();
  scheduleSave();
  broadcast();
}

function pollClipboard() {
  try {
    const text = clipboard.readText();
    if (text) {
      const sig = signature(text);
      if (sig !== lastTextSignature) {
        lastTextSignature = sig;
        addTextItem(text);
      }
    }
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const sig = signature(image.toPNG());
      if (sig !== lastImageSignature) {
        lastImageSignature = sig;
        addImageItem(image);
      }
    }
  } catch (error) {
    console.error('Clipboard poll failed', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#0f1513',
    title: 'Unoscil',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', { maximized: false }));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('history:list', () => history);
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    contact: CONTACT_EMAIL,
    platform: process.platform,
    userData: dataDir(),
  }));

  ipcMain.handle('history:copy', (_event, id) => {
    const item = history.find((entry) => entry.id === id);
    if (!item) return false;
    if (item.kind === 'text') {
      clipboard.writeText(item.text);
      lastTextSignature = signature(item.text);
    } else if (item.kind === 'image') {
      const image = nativeImage.createFromPath(item.file);
      if (image.isEmpty()) return false;
      clipboard.writeImage(image);
      lastImageSignature = signature(image.toPNG());
    }
    return true;
  });

  ipcMain.handle('history:togglePin', (_event, id) => {
    const item = history.find((entry) => entry.id === id);
    if (!item) return false;
    item.pinned = !item.pinned;
    const index = history.indexOf(item);
    if (item.pinned && index > 0) {
      history.splice(index, 1);
      history.unshift(item);
    } else if (!item.pinned) {
      const firstUnpinned = history.findIndex((entry) => !entry.pinned);
      history.splice(index, 1);
      history.splice(firstUnpinned < 0 ? 0 : firstUnpinned, 0, item);
    }
    scheduleSave();
    broadcast();
    return true;
  });

  ipcMain.handle('history:delete', (_event, id) => {
    const index = history.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    const [removed] = history.splice(index, 1);
    if (removed.kind === 'image' && removed.file) {
      fs.rm(removed.file, { force: true }, () => {});
    }
    scheduleSave();
    broadcast();
    return true;
  });

  ipcMain.handle('history:clear', () => {
    for (const item of history) {
      if (item.kind === 'image' && item.file) fs.rm(item.file, { force: true }, () => {});
    }
    history = [];
    scheduleSave();
    broadcast();
    return true;
  });

  ipcMain.handle('history:clearUnpinned', () => {
    const removed = history.filter((item) => !item.pinned);
    for (const item of removed) {
      if (item.kind === 'image' && item.file) fs.rm(item.file, { force: true }, () => {});
    }
    history = history.filter((item) => item.pinned);
    scheduleSave();
    broadcast();
    return true;
  });

  ipcMain.handle('shell:contact', () => shell.openExternal(`mailto:${CONTACT_EMAIL}`));
  ipcMain.handle('shell:dataDir', () => shell.openPath(dataDir()));

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggleMaximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    history = loadHistory();
    registerIpc();
    createWindow();
    pollClipboard();
    pollTimer = setInterval(pollClipboard, POLL_INTERVAL_MS);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('window-all-closed', () => {
    if (pollTimer) clearInterval(pollTimer);
    if (process.platform !== 'darwin' || quitting) app.quit();
  });
}
