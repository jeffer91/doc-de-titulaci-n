'use strict';
/* Impresión real de la plantilla AA en Chromium/Electron, sin datos reales. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const Evidence=require('./acta-articulo-evidence.js');
const Dates=require('./acta-articulo-date.js');
const Model=require('../renderer/acta-articulo.model.js');
const root=path.resolve(__dirname,'..'),renderer=path.join(root,'renderer');
const date=Dates.forPeriod('2025-10__2026-03');
const record={
 modalidad:'ARTICULO_ACADEMICO',periodoId:'2025-10__2026-03',cedula:'0000000000',
 numeroActa:'AA-2026-0000-05-0001',codigoDocumento:date.documentCode,
 fechaEmision:date.date,fechaRegistro:'2026-11-07',nombre:'ESTUDIANTE DE CONTROL',
 carrera:'CARRERA DE REFERENCIA',modalidadEstudios:'En línea',
 requisitos:Evidence.REQS.map(([key,label])=>({key,label,status:'CUMPLE'})),
 aprobaciones:Evidence.APPROVALS.map(([key,label])=>({key,label,status:'CUMPLE'})),
 comprobaciones:{articulo:'CUMPLE',defensa:'CUMPLE',similitud:'CUMPLE',modalidad:'CUMPLE'}
};
const img=fs.readFileSync(path.join(renderer,'assets','logo-itsqmet.png')).toString('base64');
const markup=Model.render(record,'Octubre 2025 a Marzo 2026')
 .replaceAll('src="assets/logo-itsqmet.png"','src="data:image/png;base64,'+img+'"');
const css=fs.readFileSync(path.join(renderer,'institutional.css'),'utf8')+'\n'+
 fs.readFileSync(path.join(renderer,'acta-articulo.css'),'utf8');
const html='<!doctype html><html lang="es"><head><meta charset="utf-8">'+
 '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">'+
 '<style>@page{size:letter;margin:0}html,body{margin:0;padding:0;background:#fff}*{box-sizing:border-box}</style>'+
 '<style>'+css+'</style></head><body>'+markup+'</body></html>';
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,javascript:false,webSecurity:true}});
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'utet-aa-smoke-'));
 try{
  const source=path.join(tmp,'acta.html');fs.writeFileSync(source,html,{mode:0o600});
  await win.loadFile(source);
  const pdf=Buffer.from(await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:'Letter',margins:{marginType:'none'},displayHeaderFooter:false}));
  assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  assert.ok(pdf.length>10000);
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  assert.equal(pages,3,'Acta AA debe tener exactamente tres hojas carta');
  if(process.env.UTET_SMOKE_ARTIFACT_DIR){
   fs.mkdirSync(process.env.UTET_SMOKE_ARTIFACT_DIR,{recursive:true});
   fs.writeFileSync(path.join(process.env.UTET_SMOKE_ARTIFACT_DIR,'acta-articulo-academico-control.pdf'),pdf);
  }
  console.log('OK Electron Acta AA: '+pages+' páginas carta, PDF '+pdf.length+' bytes.');
 }finally{win.destroy();fs.rmSync(tmp,{recursive:true,force:true});}
 process.exit(0);
}).catch(error=>{console.error(error);process.exit(1);});
