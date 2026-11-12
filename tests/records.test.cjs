'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ExcelJS=require('exceljs');
const {readWorkbook,validSpec}=require('../electron/excel.js');
const {createReader}=require('../electron/firebase-read.js');
const folder=path.join(__dirname,'..','renderer');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(folder,'data.js'),'utf8'),{window});
vm.runInNewContext(fs.readFileSync(path.join(folder,'plan-examen.model.js'),'utf8'),{window});
vm.runInNewContext(fs.readFileSync(path.join(folder,'plan-examen.figures.js'),'utf8'),{window});
vm.runInNewContext(fs.readFileSync(path.join(folder,'records.js'),'utf8'),{window});
vm.runInNewContext(fs.readFileSync(path.join(folder,'institutional.js'),'utf8'),{window});
const data=window.UTET_DATA,records=window.UTET_RECORDS;
const institutional=window.UTET_INSTITUTIONAL;
const types=data.procesos.flatMap(x=>x.documentos);
assert.equal(types.length,24);
assert.equal(records.allIds.length,24);
assert.equal(types.filter(t=>records.workflow(t.id).route).length,6);
for(const type of types){
  const fields=records.schema(type.id);
  assert.ok(fields.length>=5,type.id+' debe contar con campos propios');
  assert.equal(fields.length,new Set(fields.map(x=>x.key)).size,'Campos duplicados: '+type.id);
  assert.deepEqual(records.headers(type.id).length,fields.length);
  const empty=records.empty(type.id);
  assert.ok(records.validate(type.id,empty).length>=3);
  const filled={...empty,referencia:'REF-1',fecha:'2026-11-06',asunto:type.nombre};
  for(const f of fields.filter(x=>x.required)){
    if(f.key==='referencia'||f.key==='fecha'||f.key==='asunto')continue;
    filled[f.key]=f.kind==='date'?'2026-11-07':f.kind==='id'?'0102030405':f.kind.startsWith('choice:')?f.kind.slice(7).split('|')[0]:'Ejemplo';
  }
  assert.equal(records.validate(type.id,filled).length,0,'Debe aceptar fila válida de '+type.id);
  assert.ok(records.uniqueKey(type.id,filled));
  const spec=records.workflow(type.id);
  assert.ok(spec.scope&&spec.source&&spec.output);
  validSpec({typeId:type.id,columns:fields});
  if(!spec.route){
    const period=data.periodos[0];
    const d=records.toEditor(filled,type,period.id,institutional.defaultDraftFields(type));
    const html=institutional.render(d,type,period.label);
    assert.match(html,/institutional-document/);
    assert.ok(d.documentSections.length||spec.attendance,type.id+' debe producir sus apartados');
    assert.match(html,/MAQUETA · DOCUMENTO NO APROBADO/);
  }
}
assert.ok(records.validate('com-examen',{...records.empty('com-examen'),referencia:'REF-1',asunto:'Prueba',fecha:'2026-11-06',carrera:'Prueba',fechaExamen:'2026-11-31'}).some(e=>e.includes('AAAA-MM-DD')));
const x=records.empty('informe-individual');
x.referencia='A';x.cedula='0102030405';x.estudiante='Prueba';x.carrera='ADMINISTRACIÓN';x.fecha='2026-11-06';x.asunto='Informe';
const formatted=records.toEditor(x,types.find(t=>t.id==='informe-individual'),'2026-05__2026-11',{});
assert.equal(formatted.carrera,'ADMINISTRACIÓN');
assert.ok(formatted.documentSections[0].rows.some(([field,value])=>field==='Cédula'&&value===x.cedula));
assert.equal(formatted.documentSections[1].rows.length,9);
assert.equal(formatted.documentSections[1].rows[0][1],'SIN DATO');

const type=id=>types.find(t=>t.id===id);
const period=data.periodos[0];
const sample={referencia:'Corte 1',fecha:'2026-11-01',asunto:'Control',carrera:'Carrera de prueba'};
const plan={...sample,actividad:'<script>Prueba</script>',fechaInicio:'2026-11-02',fechaFin:'2026-11-03'};
assert.throws(()=>records.toDocument([plan,{...plan,referencia:'Corte 2'}],type('plan-examen'),period.id,{}),/sola convocatoria/);
assert.ok(records.validate('plan-examen',{...plan,fechaFin:'2026-11-01'}).some(e=>e.includes('precede')));
const planDraft=records.toEditor(plan,type('plan-examen'),period.id,{});
const planHTML=institutional.render(planDraft,type('plan-examen'),period.label);
assert.match(planHTML,/&lt;script&gt;Prueba/);
assert.doesNotMatch(planHTML,/<script>/);
const attendance=records.toDocument([
  {...sample,cedula:'0100000001',estudiante:'Confirmado',asistio:'Sí'},
  {...sample,cedula:'0100000002',estudiante:'Ausente',asistio:'No'}
],type('asistencia-induccion'),period.id,{});
assert.match(attendance.asistentes,/Confirmado/);
assert.doesNotMatch(attendance.asistentes,/Ausente/);
const closure=records.toEditor({...sample,cedula:'0100000001',estudiante:'Registro de prueba'},type('reporte-final'),period.id,{});
assert.equal(closure.documentSections.find(s=>s.title.includes('Resumen')).rows[0][4],1);

const workbook=new ExcelJS.Workbook();
const sheet=workbook.addWorksheet('Datos');
const fields=records.schema('informe-individual');
const oldColumns=fields.filter(field=>field.required).reverse();
sheet.addRow(Array.from(oldColumns,field=>field.label));
sheet.addRow(Array.from(oldColumns,field=>x[field.key]));
const help=workbook.addWorksheet('Instrucciones');
help.addRow(['Tipo','informe-individual']);
help.addRow(['Período',period.label]);
const importSpec={typeId:'informe-individual',periodId:period.id,periodLabel:period.label,columns:fields};
assert.equal(readWorkbook(workbook,importSpec).rows[0].data.cedula,x.cedula);
assert.throws(()=>readWorkbook(workbook,{...importSpec,periodLabel:'Otro período'}),/período del Excel/);

(async()=>{
  const id=period.id+'__'+x.cedula;
  const docs=new Map([
    ['matriculas/'+id,{periodoId:period.id,cedula:x.cedula,nombreCarrera:'Carrera de prueba'}],
    ['Estudiante/'+x.cedula,{nombreCompleto:'Nombre de prueba'}],
    ['requisitos/'+id,{periodoId:period.id,cedula:x.cedula,valores:{Académico:'CUMPLE',Ingles:'PENDIENTE'}}]
  ]);
  const reader=createReader({db:{},api:{
    doc:(_,collection,key)=>collection+'/'+key,
    getDoc:async key=>({exists:()=>docs.has(key),data:()=>docs.get(key)})
  }});
  const result=await reader.loadDocumentStudent(period.id,x.cedula,true);
  assert.equal(result.student.cedula,x.cedula);
  assert.equal(result.requirements.Academico,'CUMPLE');
  assert.equal(result.requirements.Ingles,'PENDIENTE');
  assert.equal(result.requirements.Titulacion,'SIN DATO');
  docs.get('matriculas/'+id).retirado=true;
  assert.equal((await reader.loadDocumentStudent(period.id,x.cedula,true)).student,null);
  console.log('OK: 24 configuraciones, 18 salidas documentales, grupos, Excel anterior y consulta académica simulada.');
})().catch(error=>{console.error(error);process.exitCode=1;});
