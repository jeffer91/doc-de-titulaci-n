'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('utetDesktop', Object.freeze({
  exportPDF: (suggestedName) => ipcRenderer.invoke('utet:save-pdf', suggestedName),
  platform: process.platform
}));
