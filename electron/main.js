'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Excel = require('./excel.js');
const Firebase = require('./firebase-read.js');
const Memo = require('./memo-numbering.js');
const AntiplagioStore = require('./antiplagio-store.js');
const AntiplagioLocal = require('./antiplagio-local.js');
const ActaArticulo = require('./acta-articulo.js');
const ActaArticuloModel = require('../renderer/acta-articulo.model.js');
const JSZip = require('jszip');
const Downloads = require('./downloads.js');


const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, 'renderer');
// Identidad visual propia de UTET; no sustituye el membrete institucional de PDF.
const WINDOW_ICON = path.join(RENDERER, 'assets', process.platform === 'win32' ? 'utet-app-icon.ico' : 'utet-app-icon.png');
if (process.platform === 'win32') app.setAppUserModelId('ec.edu.itsqmet.utet.gestor-documental');
const MAX_HTML = 2_000_000;

function createWindow() {
  const win = new BrowserWindow({
    width: 1500, height: 930, minWidth: 1000, minHeight: 660,
    show: false, backgroundColor: '#f5f7fb',
    icon: WINDOW_ICON,
    title: 'UTET · Gestor Documental',
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

async function createPrintHTML(documentMarkup,kind='a4') {
  const [css, extraCss, asset, memoFooterSVG] = await Promise.all([
    fs.readFile(path.join(RENDERER,'institutional.css'),'utf8'),
    fs.readFile(path.join(RENDERER,kind==='acta'?'acta-articulo.css':'antiplagio.css'),'utf8'),
    fs.readFile(path.join(RENDERER,'assets','logo-itsqmet.png')),
    fs.readFile(path.join(RENDERER,'assets','memorando-pie-itsqmet.svg'),'utf8')
  ]);
  const logoURL = `data:image/png;base64,${asset.toString('base64')}`;
  // La única imagen interna empleada por el motor de portadas se convierte a data:.
  const memoFooterURL = `data:image/svg+xml;base64,${Buffer.from(memoFooterSVG,'utf8').toString('base64')}`;
  const markup = documentMarkup.replaceAll('src="assets/logo-itsqmet.png"',`src="${logoURL}"`)
    .replaceAll('src="assets/memorando-pie-itsqmet.svg"',`src="${memoFooterURL}"`);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>@page{size:${kind==='acta'?'letter':'A4'};margin:0}html,body{margin:0;padding:0;background:white}*{box-sizing:border-box}</style><style>${css}</style><style>${extraCss}</style></head><body>${markup}</body></html>`;
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
 if(!spec||!Array.isArray(spec.files)||!['pdfs','zip'].includes(spec.mode)||!spec.files.length||spec.files.length>500)
  throw Error('Selección de memorandos inválida (1 a 500).');
 for(const file of spec.files){
  if(typeof file.html!=='string'||file.html.length>MAX_HTML||!file.html.includes('class="institutional-document'))
   throw Error('Contenido PDF inválido.');
  Downloads.validateName(file.name,'pdf');
 }
}
async function exportAntiplagio(event,spec){
 verifySender(event);
 validateAntiplagioExport(spec);
 // Nunca pedir carpeta ni diálogo de Guardar como: usar Descargas del usuario.
 const destination=app.getPath('downloads');
 const isZip=spec.mode==='zip';
 const printer=new BrowserWindow({show:false,webPreferences:{
  sandbox:true,nodeIntegration:false,contextIsolation:true,javascript:false,
  webSecurity:true,images:true
 }});
 let tempDir=null;
 const saved=[];
 try{
  tempDir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-ant-'));
  const zip=isZip?new JSZip():null;
  const names=new Set();
  let index=0;
  for(const file of spec.files){
   const name=Downloads.validateName(file.name,'pdf');
   if(names.has(name))throw Error('Nombre de PDF duplicado: '+name);
   names.add(name);
   const inputFile=path.join(tempDir,'p'+index+'.html');index++;
   await fs.writeFile(inputFile,await createPrintHTML(file.html),{mode:0o600});
   await printer.loadFile(inputFile);
   const pdf=await printer.webContents.printToPDF({
    printBackground:true,preferCSSPageSize:true,pageSize:'A4',
    margins:{marginType:'none'},displayHeaderFooter:false
   });
   if(zip)zip.file(name,pdf);
   else saved.push(await Downloads.saveUnique(destination,name,pdf));
  }
  if(zip){
   const compressed=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
   saved.push(await Downloads.saveUnique(destination,'Memorandos_UTET.zip',compressed));
  }
  return {canceled:false,count:spec.files.length,location:destination,
   files:saved.map(x=>x.filePath)};
 }finally{
  if(!printer.isDestroyed())printer.destroy();
  if(tempDir)await fs.rm(tempDir,{recursive:true,force:true});
 }
}


async function exportArticleActs(event,spec){
 verifySender(event);
 if(!spec||!['pdfs','zip'].includes(spec.mode)||!Array.isArray(spec.cedulas)||
    spec.cedulas.length<1||spec.cedulas.length>300||new Set(spec.cedulas).size!==spec.cedulas.length||
    !AntiplagioLocal.validPeriod(spec.periodoId)||typeof spec.periodLabel!=='string'||spec.periodLabel.length>120)
  throw Error('Selección de actas AA inválida.');
 const records=[];
 for(const cedula of spec.cedulas){
  const r=await ActaArticulo.get(localDir(),spec.periodoId,cedula);
  if(!ActaArticuloModel.valid(r))throw Error('No existe un acta AA emitida y verificada para '+cedula+'.');
  records.push(r);
 }
 const printer=new BrowserWindow({show:false,webPreferences:{
  sandbox:true,nodeIntegration:false,contextIsolation:true,javascript:false,webSecurity:true,images:true
 }});
 let tempDir=null;
 try{
  tempDir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-aa-'));
  const zip=spec.mode==='zip'?new JSZip():null,output=[],dest=app.getPath('downloads');
  for(let i=0;i<records.length;i++){
   const record=records[i],filename=ActaArticuloModel.filename(record);
   const html=ActaArticuloModel.render(record,spec.periodLabel);
   const file=path.join(tempDir,'acta_'+i+'.html');
   await fs.writeFile(file,await createPrintHTML(html,'acta'),{mode:0o600});
   await printer.loadFile(file);
   const pdf=await printer.webContents.printToPDF({
    printBackground:true,preferCSSPageSize:true,pageSize:'Letter',
    margins:{marginType:'none'},displayHeaderFooter:false
   });
   if(zip)zip.file(filename,pdf);
   else output.push(await Downloads.saveUnique(dest,filename,pdf));
  }
  if(zip)output.push(await Downloads.saveUnique(dest,'Actas_Articulo_Academico_UTET.zip',
    await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})));
  return {count:records.length,location:dest,files:output.map(x=>x.filePath)};
 }finally{
  if(!printer.isDestroyed())printer.destroy();
  if(tempDir)await fs.rm(tempDir,{recursive:true,force:true});
 }
}

const periodSyncs=new Map();
const localDir=()=>app.getPath('userData');
async function refreshAntiplagioPeriod(periodoId,modo='trabajo'){
 AntiplagioStore.tipo(modo);
 if(!AntiplagioLocal.validPeriod(periodoId))throw Error('Período académico inválido.');
 const requestKey=modo+'__'+periodoId;
 if(periodSyncs.has(requestKey))return periodSyncs.get(requestKey);
 const job=(async()=>{
   // Las fichas académicas son compartidas; los memorandos se sincronizan por
   // tipo. Los folios institucionales de ambos tipos usan el mismo contador.
   const studentData=await Firebase.loadStudents(periodoId);
   if(studentData?.periodoId!==periodoId||!Array.isArray(studentData.students))
    throw Error('Respuesta de matrícula incoherente.');
   let memos=null,warning='';
   try{memos=await AntiplagioStore.list(periodoId,modo);}
   catch(e){warning='Los memorandos no se pudieron consultar en Firebase; se conservaron los datos locales: '+String(e.message||e).slice(0,180);}
   await AntiplagioLocal.replaceFromFirebase(localDir(),periodoId,studentData.students,memos,studentData.readAt,modo);
   return {...await AntiplagioLocal.snapshot(localDir(),periodoId,modo),source:'Firebase → SQLite',warning};
 })();
 periodSyncs.set(requestKey,job);
 try{return await job;}finally{periodSyncs.delete(requestKey);}
}
async function openAntiplagioPeriod(periodoId,modo='trabajo'){
 AntiplagioStore.tipo(modo);
 const local=await AntiplagioLocal.snapshot(localDir(),periodoId,modo);
 if(local.hasCache)return {...local,source:'SQLite local'};
 // Si ya existen estudiantes del período, no descargarlos nuevamente al abrir
 // por primera vez el otro proceso: solo recuperar sus memorandos propios.
 if(modo==='articulo'&&local.hasStudentCache){
   const records=await AntiplagioStore.list(periodoId,modo);
   await AntiplagioLocal.replaceFromFirebase(localDir(),periodoId,null,records,new Date().toISOString(),modo);
   return {...await AntiplagioLocal.snapshot(localDir(),periodoId,modo),source:'Firebase → SQLite'};
 }
 return refreshAntiplagioPeriod(periodoId,modo);
}
async function saveAntiplagioRecord(record){
 AntiplagioStore.tipo(record?.tipoDocumento||'trabajo');
 await AntiplagioLocal.saveDraft(localDir(),record);
 const official=await AntiplagioStore.save(record);
 await AntiplagioLocal.markSynced(localDir(),{...record,...official});
 return official;
}

// Solo una instancia por perfil: evita dos escritores sobre el mismo archivo SQLite.
const instanceLock=app.requestSingleInstanceLock();
if(!instanceLock)app.quit();
else {
 app.on('second-instance',()=>{
   const win=BrowserWindow.getAllWindows()[0];
   if(win){if(win.isMinimized())win.restore();win.focus();}
 });
 app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  ipcMain.handle('utet:save-pdf',savePDF);
  ipcMain.handle('utet:memo-next',(event,date)=>{
    verifySender(event);
    return Memo.next(app.getPath('userData'),date);
  });
  ipcMain.handle('utet:acta-articulo-open',(event,p)=>{verifySender(event);return ActaArticulo.openPeriod(p,localDir(),Firebase.loadStudents);});
  ipcMain.handle('utet:acta-articulo-refresh',(event,p)=>{verifySender(event);return ActaArticulo.refreshStudents(p,localDir(),Firebase.loadStudents);});
  ipcMain.handle('utet:acta-articulo-verify',(event,p,c)=>{verifySender(event);return ActaArticulo.readEvidence(p,c,localDir());});
  ipcMain.handle('utet:acta-articulo-issue',(event,p,c)=>{verifySender(event);return ActaArticulo.issue(p,c,localDir());});
  ipcMain.handle('utet:acta-articulo-export',exportArticleActs);
  ipcMain.handle('utet:antiplagio-open',(event,periodoId,modo)=>{verifySender(event);return openAntiplagioPeriod(periodoId,modo);});
  ipcMain.handle('utet:antiplagio-refresh',(event,periodoId,modo)=>{verifySender(event);return refreshAntiplagioPeriod(periodoId,modo);});
  ipcMain.handle('utet:antiplagio-draft',(event,record)=>{verifySender(event);return AntiplagioLocal.saveDraft(localDir(),record);});
  ipcMain.handle('utet:antiplagio-list',async(event,periodoId,modo)=>{verifySender(event);return (await AntiplagioLocal.snapshot(localDir(),periodoId,modo)).records;});
  ipcMain.handle('utet:antiplagio-save',(event,record)=>{verifySender(event);return saveAntiplagioRecord(record);});
  ipcMain.handle('utet:antiplagio-export',exportAntiplagio);
  ipcMain.handle('utet:firebase-students',(event,periodoId)=>{verifySender(event);return Firebase.loadStudents(periodoId);});
  ipcMain.handle('utet:firebase-status',(event)=>{verifySender(event);return Firebase.status();});
  ipcMain.handle('utet:excel-template',(event,spec)=>{verifySender(event);return Excel.downloadTemplate(event,spec);});
  ipcMain.handle('utet:excel-import',(event,spec)=>{verifySender(event);return Excel.importWorkbook(event,spec);});
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
