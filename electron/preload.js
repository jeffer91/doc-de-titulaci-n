'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('utetDesktop', Object.freeze({
  exportPDF: options => ipcRenderer.invoke('utet:save-pdf', options),
  previewMemoNumber: date => ipcRenderer.invoke('utet:memo-next',date),
  loadAntiplagioStudents: periodoId => ipcRenderer.invoke('utet:firebase-students',periodoId),
  antiplagioFirebaseStatus: () => ipcRenderer.invoke('utet:firebase-status'),
  downloadExcelTemplate: spec => ipcRenderer.invoke('utet:excel-template', spec),
  importExcel: spec => ipcRenderer.invoke('utet:excel-import', spec),
  getAntiplagioRecords: periodoId => ipcRenderer.invoke('utet:antiplagio-list',periodoId),
  saveAntiplagioRecord: record => ipcRenderer.invoke('utet:antiplagio-save',record),
  exportAntiplagioFiles: spec => ipcRenderer.invoke('utet:antiplagio-export',spec),
  platform: process.platform
}));