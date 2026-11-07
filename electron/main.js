'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Excel = require('./excel.js');
const Firebase = require('./firebase-read.js');
const Memo = require('./memo-numbering.js');
const AntiplagioStore = require('./antiplagio-store.js');
const JSZip = require('jszip');


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
  const [css, extraCss, asset] = await Promise.all([
    fs.readFile(path.join(RENDERER,'institutional.css'),'utf8'),
    fs.readFile(path.join(RENDERER,'antiplagio.css'),'utf8'),
    fs.readFile(path.join(RENDERER,'assets','logo-itsqmet.png'))
  ]);
  const logoURL = `data:image/png;base64,${asset.toString('base64')}`;
  // La única imagen interna empleada por el motor de portadas se convierte a data:.
  const markup = documentMarkup.replaceAll('src="assets/logo-itsqmet.png"',`src="${logoURL}"`);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:white}*{box-sizing:border-box}</style><style>${css}</style><style>${extraCss}</style></head><body>${markup}</body></html>`;
}

async function savePDF(event, input) {
  verifySender(event);
  if (!input || typeof input !== 'object' || typeof input.html !== 'string' ||
      !/class="institutional-document(?:\s|")/.test(input.html) ||
      input.html.length > MAX_HTML) throw new Error('Vista previa inválida o demasiado extensa.');
  const base = String(input.suggestedName || 'MAQUETA-UTET')
    .replace(/[^\p{L}\p{N}_ .-]/gu,'_').slice(0,90);
  const owner = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(owner, {
    title:input.kind==='antiplagio'?'Exportar memorando de antiplagio en PDF':'Exportar documento de MAQUETA en PDF',
    defaultPath:base.endsWith('.pdf')?base:base+'.pdf',
    filters:[{name:'Archivo PDF',extensions:['pdf']}]
  });
  if(canceled || !filePath) return { canceled: true };
  const isMemo = input.kind === 'antiplagio';
  if(isMemo){
    if(!Memo.dateValid(input.memoDate) || !input.html.includes(Memo.CODE_PLACEHOLDER))
      throw new Error('Falta la fecha válida o la referencia reservada del memorando.');
  }
  const printer = new BrowserWindow({
    show:false,
    webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,
      javascript:false,webSecurity:true,images:true}
  });
  // No usar data: URL: Chromium puede rechazar documentos largos con muchos estudiantes.
  // Archivo temporal privado, sin scripts y eliminado siempre al finalizar.
  let temporaryDirectory = null;
  try {
    // Se reserva después de confirmar el diálogo de guardado.
    // Una cancelación no consume número. Una falla posterior conserva el
    // correlativo reservado para evitar volver a emitirlo por accidente.
    const memo = isMemo ? await Memo.reserve(app.getPath('userData'),input.memoDate) : null;
    const source = memo ? input.html.replaceAll(Memo.CODE_PLACEHOLDER,memo.code) : input.html;
    const html = await createPrintHTML(source);
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(),'utet-pdf-'));
    const temporaryFile = path.join(temporaryDirectory,'impresion.html');
    await fs.writeFile(temporaryFile,html,{encoding:'utf8',mode:0o600});
    await printer.loadFile(temporaryFile);
    const pdf = await printer.webContents.printToPDF({
      printBackground:true,preferCSSPageSize:true,pageSize:'A4',
      margins:{marginType:'none'},displayHeaderFooter:false
    });
    await fs.writeFile(filePath,pdf);
    return { canceled:false,filePath, ...(memo?{memoCode:memo.code,memoNumber:memo.number}: {}) };
  }finally{
    if(!printer.isDestroyed())printer.destroy();
    if(temporaryDirectory) await fs.rm(temporaryDirectory,{recursive:true,force:true});
  }
}


function validateAntiplagioExport(spec){
 if(!spec||!Array.isArray(spec.files)||!['folder','zip'].includes(spec.mode)||!spec.files.length||spec.files.length>500)throw Error('Selección de memorandos inválida (1 a 500).');
 for(const file of spec.files){
   if(typeof file.html!=='string'||file.html.length>MAX_HTML||!file.html.includes('class="institutional-document'))throw Error('Contenido PDF inválido.');
   if(typeof file.name!=='string'||file.name.length>120||!/^[-_\\p{L}\\p{N} .]+\\.pdf$/u.test(file.name))throw Error('Nombre de PDF inválido.');
 }
}
async function exportAntiplagio(event,spec){
 verifySender(event);validateAntiplagioExport(spec);
 const owner=BrowserWindow.fromWebContents(event.sender);
 const isZip=spec.mode==='zip';
 let dir=null,target=null;
 if(isZip){
   const result=await dialog.showSaveDialog(owner,{title:'Guardar memorandos ZIP',defaultPath:'Memorandos_UTET.zip',filters:[{name:'ZIP',extensions:['zip']}]});
   if(result.canceled||!result.filePath)return {canceled:true};
   target=result.filePath;
 }else{
   const result=await dialog.showOpenDialog(owner,{title:'Seleccionar carpeta para memorandos',properties:['openDirectory','createDirectory']});
   if(result.canceled||!result.filePaths?.[0])return {canceled:true};
   dir=result.filePaths[0];
 }
 const printer=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,javascript:false,webSecurity:true,images:true}});
 let tempDir=null;
 try{
   tempDir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-ant-'));
   const zip=isZip?new JSZip():null;
   const names=new Set();
   let index=0;
   for(const file of spec.files){
     const name=file.name.replace(/[\\/]/g,'_');
     if(names.has(name))throw Error('Nombre de PDF duplicado: '+name);
     names.add(name);
     const inputFile=path.join(tempDir,'p'+index+'.html');index++;
     await fs.writeFile(inputFile,await createPrintHTML(file.html),{mode:0o600});
     await printer.loadFile(inputFile);
     const pdf=await printer.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:'A4',margins:{marginType:'none'},displayHeaderFooter:false});
     if(zip)zip.file(name,pdf);
     else await fs.writeFile(path.join(dir,name),pdf);
   }
   if(zip)await fs.writeFile(target,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
   return {canceled:false,count:spec.files.length,location:target||dir};
 }finally{
   if(!printer.isDestroyed())printer.destroy();
   if(tempDir)await fs.rm(tempDir,{recursive:true,force:true});
 }
}

app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  ipcMain.handle('utet:save-pdf',savePDF);
  ipcMain.handle('utet:memo-next',(event,date)=>{
    verifySender(event);
    return Memo.next(app.getPath('userData'),date);
  });
  ipcMain.handle('utet:antiplagio-list',(event,periodoId)=>{verifySender(event);return AntiplagioStore.list(periodoId);});
  ipcMain.handle('utet:antiplagio-save',(event,record)=>{verifySender(event);return AntiplagioStore.save(record);});
  ipcMain.handle('utet:antiplagio-export',exportAntiplagio);
  ipcMain.handle('utet:firebase-students',(event,periodoId)=>{verifySender(event);return Firebase.loadStudents(periodoId);});
  ipcMain.handle('utet:firebase-status',(event)=>{verifySender(event);return Firebase.status();});
  ipcMain.handle('utet:excel-template',(event,spec)=>{verifySender(event);return Excel.downloadTemplate(event,spec);});
  ipcMain.handle('utet:excel-import',(event,spec)=>{verifySender(event);return Excel.importWorkbook(event,spec);});
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
