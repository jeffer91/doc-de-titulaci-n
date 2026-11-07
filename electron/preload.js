'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('utetDesktop', Object.freeze({
  exportPDF: options => ipcRenderer.invoke('utet:save-pdf', options),
  previewMemoNumber: date => ipcRenderer.invoke('utet:memo-next',date),
  loadAntiplagioStudents: periodoId => ipcRenderer.invoke('utet:firebase-students',periodoId),
  antiplagioFirebaseLogin: credentials => ipcRenderer.invoke('utet:firebase-login',credentials),
  antiplagioFirebaseLogout: () => ipcRenderer.invoke('utet:firebase-logout'),
  antiplagioFirebaseStatus: () => ipcRenderer.invoke('utet:firebase-status'),
  downloadExcelTemplate: spec => ipcRenderer.invoke('utet:excel-template', spec),
  importExcel: spec => ipcRenderer.invoke('utet:excel-import', spec),
  platform: process.platform
}));