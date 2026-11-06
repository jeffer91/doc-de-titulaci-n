'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('utetDesktop', Object.freeze({
  exportPDF: options => ipcRenderer.invoke('utet:save-pdf', options),
  downloadExcelTemplate: spec => ipcRenderer.invoke('utet:excel-template', spec),
  importExcel: spec => ipcRenderer.invoke('utet:excel-import', spec),
  platform: process.platform
}));
