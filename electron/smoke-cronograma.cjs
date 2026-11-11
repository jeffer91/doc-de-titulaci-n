'use strict';
/* Smoke test visual de impresión A4 para el nuevo documento PRO-57.
 * Usa únicamente cronogramas ficticios; no consulta ni escribe Firebase. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Model=require('../renderer/cronograma.model.js');
const ROOT=path.join(__dirname,'..');
function chronogram(grupo,offset){
 const names=[
  'Inducción general al proceso de titulación',
  'Entrega de títulos del artículo académico',
  'Revisión de los coordinadores de los títulos',
  'Clase de explicación del proceso de titulación',
  'Clase de metodología 1','Clase de metodología 2','Clase de metodología 3',
  'Cumplimiento de requisitos','Finalización de clases',
  'Entrega del artículo académico completo','Revisión del artículo completo',
  'Clase de refuerzo por carreras','Evaluación del borrador académico',
  'Entrega final del artículo académico completo',
  'Evaluación final del artículo académico','Defensa oral',
  'Clase de refuerzo supletorio','Revisión supletorio',
  'Evaluación final del artículo supletorio','Defensa oral supletorio'
 ];
 const activities=names.map((actividad,i)=>{
  const day=new Date(Date.UTC(2026,7,18+offset+i*4));
  const date=day.toISOString().slice(0,10);
  return {actividad,inicio:date,fin:date};
 });
 return {grupo,actividades};
}
async function run(){
 const sample={id:'cr_smoke_2026_07',fecha:'2026-07-17',periodo:'Mayo 2026 - Noviembre 2026',
  cronogramas:[chronogram('Superiores',0),chronogram('Universitarios',8)]};
 const body=Model.render(sample,'MEM-ITSQMET-UTET-2026-07-01');
 const [institutional,cronCSS,logo,foot]=await Promise.all([
  fs.readFile(path.join(ROOT,'renderer/institutional.css'),'utf8'),
  fs.readFile(path.join(ROOT,'renderer/cronograma.css'),'utf8'),
  fs.readFile(path.join(ROOT,'renderer/assets/logo-itsqmet.png')),
  fs.readFile(path.join(ROOT,'renderer/assets/memorando-pie-itsqmet.svg'),'utf8')
 ]);
 const wrapped=body.replaceAll('src="assets/logo-itsqmet.png"','src="data:image/png;base64,'+logo.toString('base64')+'"')
  .replaceAll('src="assets/memorando-pie-itsqmet.svg"','src="data:image/svg+xml;base64,'+Buffer.from(foot).toString('base64')+'"');
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"/><style>@page{size:A4;margin:0}html,body{margin:0;padding:0}*{box-sizing:border-box}</style><style>'+institutional+'</style><style>'+cronCSS+'</style></head><body>'+wrapped+'</body></html>';
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-cron-smoke-'));
 const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,javascript:false,webSecurity:true,images:true}});
 try{
  const file=path.join(dir,'cronograma.html');await fs.writeFile(file,html);
  await win.loadFile(file);
  const pdf=await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:'A4',margins:{marginType:'none'},displayHeaderFooter:false});
  if(pdf.length<9000||pdf.subarray(0,4).toString()!=='%PDF')throw Error('PDF de control inválido.');
  const output=process.env.UTET_SMOKE_ARTIFACT_DIR||dir;
  await fs.mkdir(output,{recursive:true});
  const save=path.join(output,'cronograma-articulo-control.pdf');
  await fs.writeFile(save,pdf);
  console.log('PDF cronograma A4 generado: '+pdf.length+' bytes; '+save);
 }finally{
  if(!win.isDestroyed())win.destroy();
  await fs.rm(dir,{recursive:true,force:true});
 }
 app.quit();
}
app.whenReady().then(run).catch(e=>{console.error(e);app.exit(1);});
