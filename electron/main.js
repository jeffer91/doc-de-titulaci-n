'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, 'renderer');
const MAX_HTML = 2_000_000;

function createWindow() {
  const win = new BrowserWindow({
    width: 1500, height: 930, minWidth: 1000, minHeight: 660,
    show: false, backgroundColor: '#f5f7fb',
    title: 'UTET · Gestor Documental — Maqueta',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      sandbox: true, webSecurity: true
    }
  });
  win.loadFile(path.join(RENDERER, 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}

function verifySender(event) {
  const url = event.senderFrame?.url || '';
  // No aceptar solicitudes de impresión desde páginas remotas.
  if (!url.startsWith('file://') || !url.endsWith('/renderer/index.html')) {
    throw new Error('Origen no autorizado para imprimir documentos.');
  }
}

async function createPrintHTML(documentMarkup) {
  const [css, asset] = await Promise.all([
    fs.readFile(path.join(RENDERER,'institutional.css'),'utf8'),
    fs.readFile(path.join(RENDERER,'assets','logo-itsqmet.png'))
  ]);
  const logoURL = `data:image/png;base64,${asset.toString('base64')}`;
  // La única imagen interna empleada por el motor de portadas se convierte a data:.
  const markup = documentMarkup.replaceAll('src="assets/logo-itsqmet.png"',`src="${logoURL}"`);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:white}*{box-sizing:border-box}</style><style>${css}</style></head><body>${markup}</body></html>`;
}

async function savePDF(event, input) {
  verifySender(event);
  if (!input || typeof input !== 'object' || typeof input.html !== 'string' ||
      !input.html.includes('class="institutional-document"') ||
      input.html.length > MAX_HTML) throw new Error('Vista previa inválida o demasiado extensa.');
  const base = String(input.suggestedName || 'MAQUETA-UTET')
    .replace(/[^\p{L}\p{N}_ .-]/gu,'_').slice(0,90);
  const owner = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(owner, {
    title:'Exportar documento de MAQUETA en PDF',
    defaultPath:base.endsWith('.pdf')?base:base+'.pdf',
    filters:[{name:'Archivo PDF',extensions:['pdf']}]
  });
  if(canceled || !filePath) return { canceled: true };
  const printer = new BrowserWindow({
    show:false,
    webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,
      javascript:false,webSecurity:true,images:true}
  });
  try {
    const html = await createPrintHTML(input.html);
    const ready = new Promise((resolve,reject)=>{
      printer.webContents.once('did-finish-load',resolve);
      printer.webContents.once('did-fail-load',(_,code,desc)=>reject(new Error(`Vista previa: ${desc} (${code})`)));
    });
    await printer.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
    await ready;
    const pdf = await printer.webContents.printToPDF({
      printBackground:true,preferCSSPageSize:true,pageSize:'A4',
      margins:{marginType:'none'},displayHeaderFooter:false
    });
    await fs.writeFile(filePath,pdf);
    return { canceled:false,filePath };
  }finally{
    if(!printer.isDestroyed())printer.destroy();
  }
}

app.whenReady().then(()=>{
  ipcMain.handle('utet:save-pdf',savePDF);
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
