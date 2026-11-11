'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('utetDesktop', Object.freeze({
  exportPDF: options => ipcRenderer.invoke('utet:save-pdf', options),
  previewMemoNumber: date => ipcRenderer.invoke('utet:memo-next',date),
  openAntiplagioPeriod: (periodoId,tipo='trabajo') => ipcRenderer.invoke('utet:antiplagio-open',periodoId,tipo),
  refreshAntiplagioPeriod: (periodoId,tipo='trabajo') => ipcRenderer.invoke('utet:antiplagio-refresh',periodoId,tipo),
  saveAntiplagioDraft: record => ipcRenderer.invoke('utet:antiplagio-draft',record),
  loadAntiplagioStudents: periodoId => ipcRenderer.invoke('utet:firebase-students',periodoId),
  antiplagioFirebaseStatus: () => ipcRenderer.invoke('utet:firebase-status'),
  downloadExcelTemplate: spec => ipcRenderer.invoke('utet:excel-template', spec),
  importExcel: spec => ipcRenderer.invoke('utet:excel-import', spec),
  getAntiplagioRecords: (periodoId,tipo='trabajo') => ipcRenderer.invoke('utet:antiplagio-list',periodoId,tipo),
  saveAntiplagioRecord: record => ipcRenderer.invoke('utet:antiplagio-save',record),
  exportAntiplagioFiles: spec => ipcRenderer.invoke('utet:antiplagio-export',spec),
  // Actas de titulación (AA, TT, CX): `m` es la modalidad; sin ella se asume Artículo Académico.
  openActaArticulo: (p,m) => ipcRenderer.invoke('utet:acta-articulo-open',p,m),
  refreshActaArticulo: (p,m) => ipcRenderer.invoke('utet:acta-articulo-refresh',p,m),
  verifyActaArticulo: (p,c,m) => ipcRenderer.invoke('utet:acta-articulo-verify',p,c,m),
  issueActaArticulo: (p,c,m) => ipcRenderer.invoke('utet:acta-articulo-issue',p,c,m),
  recoverActaArticulo: (p,c,m) => ipcRenderer.invoke('utet:acta-articulo-recover',p,c,m),
  exportActaArticulo: spec => ipcRenderer.invoke('utet:acta-articulo-export',spec),
  platform: process.platform
}));