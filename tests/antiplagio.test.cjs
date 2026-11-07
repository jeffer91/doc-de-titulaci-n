'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const env={window:{}};
vm.createContext(env);
vm.runInContext(fs.readFileSync(path.join(root,'renderer/antiplagio.model.js'),'utf8'),env);
const M=env.window.UTET_ANTIPLAGIO_MODEL;
const student=(i,career='CONTABILIDAD')=>({
  estudianteId:'2026-04__2026-09__'+String(i).padStart(10,'0'),
  cedula:String(i).padStart(10,'0'),nombres:'Estudiante '+String(i).padStart(3,'0'),
  carreraNombre:career,carreraId:'TEST'
});
const row=(i,percent='0')=>({...M.createRow(student(i)),similitud:percent,
  fechaReporte:'2026-11-06',referencia:'REF-'+i,confirmado:true});
const meta={codigo:'MEM-ITSQMET-UTET-2026-11-001',destinatario:'Autoridad de prueba',
  cargoDestinatario:'Cargo de prueba',fecha:'2026-11-07',fechaCorte:'2026-11-06',herramienta:''};
assert.equal(M.number(''),null,'vacío no equivale a cero');
assert.equal(M.number('0'),0);
assert.equal(M.number('19'),19);
assert.equal(M.number('19,50'),19.5);
assert.equal(M.number('100'),100);
assert.equal(M.number('101'),null);
assert.equal(M.rowState(row(1,'19')),'En rango operativo');
assert.equal(M.rowState(row(1,'19.01')),'Fuera del rango operativo');
assert.equal(M.rowState(row(1,'')),'Sin registro');
let good=[row(1,'0'),row(2,'19')];
assert.equal(M.validate(good,meta).length,0);
assert.equal(M.summary(good).present,2);
assert.equal(M.summary(good).inRange,2);
assert.equal(M.summary([row(1,''),row(2,'25')]).missing,1);
assert.equal(M.summary([row(1,''),row(2,'25')]).outRange,1);
assert.ok(M.validate([row(1,'25')],meta).some(x=>x.includes('19')));
assert.ok(M.validate([row(1,'')],meta).some(x=>x.includes('Porcentaje ausente')));
assert.ok(M.validate([row(1,'0'),row(1,'1')],meta).some(x=>x.includes('duplicada')));
const injected=row(3,'12');
injected.nombres='<script>alert("X")</script>';
injected.fuentes.google='detected';
injected.fuentes.web='not-detected';
const simple=M.renderPDF(meta,[injected],'Abril 2026 a Septiembre 2026');
assert.ok(simple.includes('institutional-document'));
assert.ok(!simple.includes('<script>'));
assert.ok(simple.includes('&lt;script&gt;'));
assert.ok(simple.includes('Memorando No.'));
assert.ok(simple.includes('COORDINADOR DE TITULACIÓN'));
assert.ok(simple.includes('REPORTE DE PORCENTAJE DE ANTIPLAGIO'));
assert.ok(simple.includes('Google'),'fuente documentada visible');
assert.ok(!simple.includes('Turnitin'),'herramienta no documentada nunca inventada');
assert.equal((simple.match(/class="inst-page ap-page/g)||[]).length,2,'un estudiante = dos páginas');
assert.ok(simple.includes('ap-src-on'));
assert.ok(simple.includes('ap-src-off'));
assert.ok(!simple.includes('MAQUETA'));
assert.ok(simple.indexOf('Memorando No.')<simple.indexOf('REPORTE DE PORCENTAJE'));
const rows=Array.from({length:54},(_,i)=>row(i+1,String(i%20)));
rows[37].carreraNombre='ENFERMERÍA';
const pdf=M.renderPDF(meta,rows,'Abril 2026 a Septiembre 2026');
assert.equal((pdf.match(/class="inst-page ap-page/g)||[]).length>=6,true,'paginación automática');
for(const r of rows)assert.ok(pdf.includes(r.cedula),'No puede perder estudiantes: '+r.cedula);
assert.equal((pdf.match(/<td>0\d{9}<\/td>/g)||[]).length,rows.length);
assert.equal((pdf.match(/REPORTE DE PORCENTAJE DE ANTIPLAGIO/g)||[]).length,1);
assert.ok(pdf.includes('Distribución por rangos de similitud'));
assert.ok(pdf.includes('Promedio de similitud por carrera'));
assert.ok(pdf.includes('Fuentes identificadas en las evidencias'));
assert.ok(pdf.includes('Página 1 de'));
async function testFirebase(){
  const firebase=require('../electron/firebase-read.js');
  const original=global.fetch;
  const p='2026-04__2026-09';
  const v=x=>({stringValue:x});
  const doc=(coll,id,fields)=>({name:'projects/utet-4387a/databases/(default)/documents/'+coll+'/'+id,
    fields:Object.fromEntries(Object.entries(fields).map(([k,x])=>[k,v(x)]))});
  let calls=0;
  global.fetch=async(url,init)=>{
    calls++;
    let data=[];
    if(String(url).includes('runQuery')){
      const q=JSON.parse(init.body).structuredQuery;
      assert.equal(q.where.fieldFilter.value.stringValue,p,'filtrar exclusivamente período');
      data=[
        {document:doc('matriculas',p+'__0102030405',{cedula:'0102030405',periodoId:p,nombreCarrera:'CONTABILIDAD',codigoCarrera:'C01'})},
        {document:doc('matriculas',p+'__0102030406',{cedula:'0102030406',periodoId:p,nombreCarrera:'ADMINISTRACIÓN',codigoCarrera:'A01'})}
      ];
    }else if(String(url).includes('batchGet')){
      data=[
        {found:doc('Estudiante','0102030405',{cedula:'0102030405',nombres:'Ana',apellidos:'Pérez'})},
        {found:doc('Estudiante','0102030406',{cedula:'0102030406',nombres:'Juan',apellidos:'López'})}
      ];
    }else throw Error('Consulta inesperada');
    return {ok:true,status:200,text:async()=>JSON.stringify(data)};
  };
  try{
    const result=await firebase.loadStudents(p);
    assert.equal(result.students.length,2);
    assert.equal(result.students[0].cedula,'0102030406','orden alfabético por apellido');
    assert.equal(result.students[1].nombres,'Pérez Ana');
    assert.equal(result.students[1].carreraNombre,'CONTABILIDAD');
    assert.ok(calls===2);
    await assert.rejects(()=>firebase.loadStudents('incorrecto'),/período/);
  }finally{global.fetch=original;}
}
testFirebase().then(()=>console.log('OK antiplagio: PDF paginado, datos reales, fuentes, validaciones, Firebase read-only.'))
  .catch(e=>{console.error(e);process.exitCode=1;});
