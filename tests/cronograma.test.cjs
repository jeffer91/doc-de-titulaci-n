'use strict';
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const Model=require('../renderer/cronograma.model.js');
const Reader=require('../electron/cronograma-excel.js');
const Memo=require('../electron/cronograma-numbering.js');
(async()=>{
 assert.equal(Memo.code('2026-07',1),'MEM-ITSQMET-UTET-2026-07-01');
 assert.equal(Memo.code('2026-07',12),'MEM-ITSQMET-UTET-2026-07-12');
 assert.equal(Reader.excelDate(46252),'2026-08-18');
 assert.equal(Reader.excelDate('18/08/2026'),'2026-08-18');
 assert.equal(Model.stage('Defensa oral'),'Defensa');
 assert.equal(Model.stage('Entrega del artículo académico'),'Entregas y revisiones');
 const wb=new ExcelJS.Workbook();
 function sheet(name,title,act){
  const ws=wb.addWorksheet(name);
  ws.addRow([title]);
  ws.addRow(['Actividad','Fecha inicio','Fecha fin']);
  ws.addRow([act,46252,46252]);
  return ws;
 }
 sheet('May Nov U','Mayo 2026 - Noviembre 2026 - Universitarios','Clase de metodología 1');
 sheet('May Nov S','Mayo 2026 - Noviembre 2026 - Superiores','Entrega de títulos del artículo académico');
 sheet('Complex Oct 27','Octubre 2026 a Marzo 2027','Examen complexivo');
 sheet('Trabajo','Trabajo de titulación','Aprobación de tesis');
 sheet('Nov May 2','Noviembre 2025 - Mayo 2025 - Universitarias 2','Evaluación de la interrogante');
 sheet('Nov May 3','Noviembre 2025 - Mayo 2025 - Universitarias 1','Clase de metodología 2');
 sheet('Agos Ene 26','Agosto 2025 – Enero 2026','Metodología 1');
 const result=await Reader.parseBuffer(Buffer.from(await wb.xlsx.writeBuffer()),'todos.xlsx');
 assert.equal(result.length,7);
 assert.equal(result[0].tipo,'articulo');
 assert.equal(result[0].grupo,'Universitarios');
 assert.equal(result[1].grupo,'Superiores');
 assert.equal(result[0].periodo,'Mayo 2026 - Noviembre 2026');
 assert.equal(result[2].tipo,'complexivo');
 assert.equal(result[2].selected,false);
 assert.equal(result[3].tipo,'trabajo');
 assert.equal(result[4].grupo,'Universitarios 2');
 assert.equal(result[5].grupo,'Universitarios 1');
 assert.equal(result[4].periodo,'Noviembre 2025 - Mayo 2025');
 assert.equal(result[6].grupo,'Por determinar');
 const p=Model.validate({
  id:'cr_unit_test',fecha:'2026-07-17',periodo:'Mayo 2026 - Noviembre 2026',
  cronogramas:result.slice(0,2).map(r=>({grupo:r.grupo,hoja:r.sheetName,actividades:r.actividades}))
 });
 const html=Model.render(p,'MEM-ITSQMET-UTET-2026-07-01');
 assert.match(html,/Memorando No\. MEM-ITSQMET-UTET-2026-07-01/);
 assert.match(html,/ANEXO 1/);assert.match(html,/ANEXO 2/);
 assert.match(html,/UNIVERSITARIOS/);assert.match(html,/SUPERIORES/);
 assert.match(html,/18\/08\/2026/);
 assert.equal((html.match(/class="cron-pdf-page/g)||[]).length,3);
 assert.throws(()=>Model.validate({...p,fecha:'2026-02-30'}),/fecha/i);
 assert.throws(()=>Model.validate({...p,cronogramas:[{grupo:'',actividades:result[0].actividades}]}),/grupo/i);
 assert.throws(()=>Model.validate({...p,cronogramas:[{grupo:'Por determinar',actividades:result[0].actividades}]}),/grupo/i);
 assert.throws(()=>Model.validate({...p,cronogramas:[{grupo:'Superiores',periodo:'Octubre 2025 - Marzo 2026',actividades:result[0].actividades}]}),/período/i);
 assert.doesNotThrow(()=>Model.validate({...p,cronogramas:[{grupo:'Superiores',periodo:'Mayo 2026 – Noviembre 2026',actividades:result[0].actividades}]}));
 console.log('Cronogramas UTET-PRO-57: parser flexible, numeración, PDF y validaciones OK');
})().catch(err=>{console.error(err);process.exitCode=1;});
