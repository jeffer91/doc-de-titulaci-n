'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('utetDesktop', Object.freeze({
  exportPDF: options => ipcRenderer.invoke('utet:save-pdf', options),
  platform: process.platform
}));
