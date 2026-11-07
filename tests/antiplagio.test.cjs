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
const meta={codigo:'01 MEM-ITSQMET-UTET-2026-11-07',destinatario:'Autoridad de prueba',
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
assert.ok(simple.includes('No. 01 MEM-ITSQMET-UTET-2026-11-07'));
assert.ok(!simple.includes('UEAI'));
assert.ok(!simple.includes('2026-11-001'));
assert.ok(M.validate(good,{...meta,codigo:'01 MEM-ITSQMET-UEAI-2026-11-07'}).some(x=>x.includes('Formato')));
assert.ok(M.validate(good,{...meta,codigo:'01 MEM-ITSQMET-UTET-2026-11-06'}).some(x=>x.includes('fecha')));
assert.ok(simple.includes('COORDINADOR DE TITULACIÓN'));
assert.ok(simple.includes('REPORTE DE PORCENTAJE DE ANTIPLAGIO'));
assert.ok(simple.includes('Google'),'fuente documentada visible');
assert.ok(!simple.includes('Turnitin'),'herramienta no documentada nunca inventada');
assert.equal((simple.match(/class="inst-page ap-page/g)||[]).length,2,'un estudiante = dos páginas');
assert.ok(simple.includes('ap-src-on'));
assert.ok(simple.includes('ap-src-off'));
assert.ok(!simple.includes('MAQUETA'));
assert.ok(simple.indexOf('No. 01 MEM-ITSQMET-UTET-2026-11-07')<simple.indexOf('REPORTE DE PORCENTAJE'));
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
  const sdkStatus=firebase.status();
  assert.equal(sdkStatus.projectId,'utet-4387a');
  assert.equal(sdkStatus.initialized,true,'Firestore Lite debe inicializarse en Node/Electron');
  const p='2026-04__2026-09';
  const trace={queries:[],students:[]};
  const store={
    '0102030405':{cedula:'0102030405',nombres:'Ana',apellidos:'Pérez'},
    '0102030406':{cedula:'0102030406',nombres:'Juan',apellidos:'López'}
  };
  const api={
    collection(_db,path){return path;},
    where(field,operation,value){return {field,operation,value};},
    limit(count){return {count};},
    query(collection,filter,cap){trace.queries.push({collection,filter,cap});return {collection,filter,cap};},
    async getDocs(query){
      assert.equal(query.collection,'matriculas');
      assert.equal(query.filter.field,'periodoId');
      assert.equal(query.filter.value,p);
      return {docs:[
        {id:p+'__0102030405',data:()=>({cedula:'0102030405',periodoId:p,nombreCarrera:'CONTABILIDAD',codigoCarrera:'C01'})},
        {id:p+'__0102030406',data:()=>({cedula:'0102030406',periodoId:p,nombreCarrera:'ADMINISTRACIÓN',codigoCarrera:'A01'})},
        {id:p+'__9999999999',data:()=>({cedula:'9999999999',periodoId:'2026-01__2026-07',nombreCarrera:'OTRA'})},
        {id:p+'__9999999998',data:()=>({cedula:'9999999998',periodoId:p,eliminado:true})}
      ]};
    },
    doc(_db,collection,id){return {collection,id};},
    async getDoc(ref){
      assert.equal(ref.collection,'Estudiante');
      trace.students.push(ref.id);
      return {exists:()=>!!store[ref.id],data:()=>store[ref.id]};
    }
  };
  const reader=firebase.createReader({db:{},api});
  const result=await reader.loadStudents(p);
  assert.equal(result.students.length,2);
  assert.equal(result.students[0].cedula,'0102030406');
  assert.equal(result.students[1].nombres,'Pérez Ana');
  assert.equal(result.students[1].carreraNombre,'CONTABILIDAD');
  assert.equal(result.source.includes('Firestore Lite'),true);
  assert.deepEqual(trace.students.sort(),['0102030405','0102030406']);
  assert.equal(trace.queries.length,1);
  await assert.rejects(()=>reader.loadStudents('incorrecto'),/período/);
  const denied=firebase.explain({code:'permission-denied',message:'Missing or insufficient permissions'},'matriculas');
  assert.match(denied.message,/reglas/);
  const bad=firebase.explain({code:'invalid-argument',message:'Unexpected parameter xyz'},'matriculas');
  assert.match(bad.message,/Unexpected parameter xyz/);
  // Sin escritura ni API REST construida a mano.
  const backend=fs.readFileSync(path.join(root,'electron/firebase-read.js'),'utf8');
  assert.doesNotMatch(backend,/batchGet\?|runQuery\?|signInWithPassword|firebase-admin|setDoc\(/);
  assert.equal(firebase.validPeriod(p),true);
}
testFirebase().then(()=>console.log('OK antiplagio: PDF, consulta por SDK Firestore Lite y mensajes de error.'))
  .catch(error=>{console.error(error);process.exitCode=1;});
