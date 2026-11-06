'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1500, height: 930, minWidth: 1000, minHeight: 660,
    show: false, backgroundColor: '#f5f7fb',
    title: 'UTET · Gestor Documental — Maqueta',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  ipcMain.handle('utet:save-pdf', async (event, suggestedName) => {
    const safeName = String(suggestedName || 'Documento-UTET').replace(/[^\p{L}\p{N}_ .-]/gu, '_').slice(0, 90);
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: 'Exportar vista previa a PDF',
      defaultPath: safeName.endsWith('.pdf') ? safeName : safeName + '.pdf',
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    const buffer = await event.sender.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'none' } });
    await fs.writeFile(filePath, buffer);
    return { canceled: false, filePath };
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
