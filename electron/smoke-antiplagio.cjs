'use strict';
/* Prueba real de Chromium PDF, sin red ni datos personales; ejecutada bajo Xvfb en CI. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const renderer=path.join(root,'renderer');
const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(renderer,'antiplagio.model.js'),'utf8'),ctx);
const M=ctx.window.UTET_ANTIPLAGIO_MODEL;
const meta={codigo:'MEM-ITSQMET-UTET-2026-11-001',destinatario:'Autoridad de ejemplo',
  cargoDestinatario:'Responsable académico',fecha:'2026-11-07',fechaCorte:'2026-11-06'};
const label='Abril 2026 a Septiembre 2026';
const careers=['CONTABILIDAD','ADMINISTRACIÓN','ENFERMERÍA','DESARROLLO DE SOFTWARE'];
const logo=fs.readFileSync(path.join(renderer,'assets','logo-itsqmet.png')).toString('base64');
const styles=fs.readFileSync(path.join(renderer,'institutional.css'),'utf8')+
  fs.readFileSync(path.join(renderer,'antiplagio.css'),'utf8');
function students(count){
  return Array.from({length:count},(_,i)=>{
    const cedula=String(i+1).padStart(10,'0');
    const r=M.createRow({estudianteId:'2026-04__2026-09__'+cedula,cedula,
      nombres:'ESTUDIANTE FICTICIO '+(i+1),carreraNombre:careers[i%careers.length]});
    r.similitud=String(i%20);r.fechaReporte='2026-11-06';r.confirmado=true;
    r.referencia='PRUEBA-'+(i+1);r.fuentes.google=i%3===0?'detected':'unknown';
    r.fuentes.repositorios=i%3===1?'not-detected':'unknown';
    return r;
  });
}
function documentFor(count){
  const html=M.renderPDF(meta,students(count),label).replaceAll('src="assets/logo-itsqmet.png"',
    'src="data:image/png;base64,'+logo+'"');
  const pages=(html.match(/class="inst-page ap-page/g)||[]).length;
  const src='<!doctype html><html lang="es"><head><meta charset="utf-8">'+
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">'+
    '<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}*{box-sizing:border-box}</style>'+
    '<style>'+styles+'</style></head><body>'+html+'</body></html>';
  return {src,pages};
}
async function check(count,expected){
  const {src,pages}=documentFor(count);
  if(expected)assert.equal(pages,expected);
  const win=new BrowserWindow({show:false,webPreferences:{
    sandbox:true,nodeIntegration:false,contextIsolation:true,javascript:false,webSecurity:true
  }});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'utet-pdf-test-'));
  try{
    const file=path.join(tmp,'impresion.html');
    fs.writeFileSync(file,src,{mode:0o600});
    await win.loadFile(file);
    const pdf=Buffer.from(await win.webContents.printToPDF({
      printBackground:true,preferCSSPageSize:true,pageSize:'A4',
      margins:{marginType:'none'},displayHeaderFooter:false
    }));
    assert.equal(pdf.subarray(0,4).toString(),'%PDF','PDF válido');
    assert.ok(pdf.length>10000,'PDF no puede estar vacío');
    const detected=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    assert.equal(detected,pages,'El PDF no debe agregar páginas ni perderlas: '+count+' estudiantes');
    console.log('OK Electron PDF: '+count+' estudiantes, '+detected+' páginas, '+pdf.length+' bytes.');
  }finally{win.destroy();fs.rmSync(tmp,{recursive:true,force:true});}
}
app.whenReady().then(async()=>{await check(1,2);await check(54);app.exit(0);})
  .catch(err=>{console.error(err);app.exit(1);});
