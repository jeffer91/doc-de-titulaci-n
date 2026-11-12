'use strict';
// Imprime los PDF configurados con datos ficticios, usando el tamaño A4 de la app.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');

const renderer=path.join(__dirname,'../renderer');
const fixture={
 referencia:'Sesión de prueba',fecha:'2026-10-02',asunto:'Documento de control',
 carrera:'Carrera de prueba',cedula:'0100000001',estudiante:'Estudiante de prueba',
 actividad:'Revisión de los entregables',fechaInicio:'2026-10-03',fechaFin:'2026-10-05',
 fechaReunion:'2026-10-03',fechaExamen:'2026-10-04',fechaEvento:'2026-10-04',
 fechaInduccion:'2026-10-04',nucleo:'Núcleo 1',tutor:'Tutor de prueba',docente:'Docente de prueba',
 tema:'Inducción al proceso de titulación',asistio:'Sí',convocados:'2',asistentes:'1',
 estadoRequisitos:'CUMPLE',introduccion:'Descripción del período y del alcance del informe.',
 resultados:'Resultados del ejercicio de impresión.',contenido:'Registro ficticio de verificación.'
};

async function run(){
 const context=vm.createContext({window:{}});
 for(const script of ['data.js','records.js','institutional.js'])
  vm.runInContext(await fs.readFile(path.join(renderer,script),'utf8'),context,{filename:script});
 const {UTET_DATA:data,UTET_RECORDS:records,UTET_INSTITUTIONAL:institutional}=context.window;
 const period=data.periodos[0],types=data.procesos.flatMap(process=>process.documentos).filter(type=>!records.workflow(type.id).route);
 const [css,logo]=await Promise.all([
  fs.readFile(path.join(renderer,'institutional.css'),'utf8'),
  fs.readFile(path.join(renderer,'assets/logo-itsqmet.png'))
 ]);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-records-smoke-'));
 const printer=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try{
  const input=path.join(dir,'documento.html');
  for(const type of types){
   const rows=type.id==='plan-examen'?Array.from({length:31},(_,index)=>({...fixture,actividad:fixture.actividad+' '+(index+1)})):[fixture];
   const draft=records.toDocument(rows,type,period.id,institutional.defaultDraftFields(type));
   const markup=institutional.render(draft,type,period.label)
    .replaceAll('src="assets/logo-itsqmet.png"','src="data:image/png;base64,'+logo.toString('base64')+'"');
   const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><style>@page{size:A4;margin:0}html,body{margin:0}*{box-sizing:border-box}'+css+'</style></head><body>'+markup+'</body></html>';
   await fs.writeFile(input,html);
   await printer.loadFile(input);
   const clipped=await printer.webContents.executeJavaScript(`
    [...document.querySelectorAll('.inst-page:not(.inst-cover)')].some(page=>{
     const footer=page.querySelector('.inst-page-foot');
     if(!footer)return false;
     const content=[...page.children].flatMap(element=>element.matches('.inst-body-main')?[...element.children]:[element]);
     return content.filter(element=>!element.matches('.inst-page-foot,.inst-seal'))
      .some(element=>element.getBoundingClientRect().bottom>footer.getBoundingClientRect().top+2);
    })
   `);
   assert.equal(clipped,false,'El contenido invade el pie de '+type.id);
   const pdf=await printer.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:'A4',displayHeaderFooter:false});
   assert.equal(pdf.subarray(0,4).toString(),'%PDF');
   assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,(markup.match(/class="inst-page /g)||[]).length,type.id);
  }
  assert.equal(types.length,18);
  console.log('OK Electron: impresión A4 de los 18 documentos configurados.');
 }finally{
  if(!printer.isDestroyed())printer.destroy();
  await fs.rm(dir,{recursive:true,force:true});
 }
}
app.whenReady().then(async()=>{await run();app.quit();}).catch(error=>{console.error(error);app.exit(1);});
