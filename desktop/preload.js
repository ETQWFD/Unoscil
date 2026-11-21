'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unoscil', {
  list: () => ipcRenderer.invoke('history:list'),
  copy: (id) => ipcRenderer.invoke('history:copy', id),
  togglePin: (id) => ipcRenderer.invoke('history:togglePin', id),
  remove: (id) => ipcRenderer.invoke('history:delete', id),
  clear: () => ipcRenderer.invoke('history:clear'),
  clearUnpinned: () => ipcRenderer.invoke('history:clearUnpinned'),
  info: () => ipcRenderer.invoke('app:info'),
  contact: () => ipcRenderer.invoke('shell:contact'),
  openDataDir: () => ipcRenderer.invoke('shell:dataDir'),
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
  close: () => ipcRenderer.send('window:close'),
  onHistoryChanged: (callback) => {
    const handler = (_event, items) => callback(items);
    ipcRenderer.on('history:changed', handler);
    return () => ipcRenderer.removeListener('history:changed', handler);
  },
  onWindowState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('window:state', handler);
    return () => ipcRenderer.removeListener('window:state', handler);
  },
});
