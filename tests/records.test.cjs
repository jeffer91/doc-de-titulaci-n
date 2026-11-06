'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const folder=path.join(__dirname,'..','renderer');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(folder,'data.js'),'utf8'),{window});
vm.runInNewContext(fs.readFileSync(path.join(folder,'records.js'),'utf8'),{window});
const data=window.UTET_DATA,records=window.UTET_RECORDS;
const types=data.procesos.flatMap(x=>x.documentos);
assert.equal(types.length,24);
assert.equal(records.allIds.length,24);
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
}
assert.ok(records.validate('com-examen',{...records.empty('com-examen'),referencia:'REF-1',asunto:'Prueba',fecha:'2026-11-06',carrera:'Prueba',fechaExamen:'2026-11-31'}).some(e=>e.includes('AAAA-MM-DD')));
const x=records.empty('informe-individual');
x.referencia='A';x.cedula='0102030405';x.estudiante='Prueba';x.carrera='ADMINISTRACIÓN';x.fecha='2026-11-06';x.asunto='Informe';
const formatted=records.toEditor(x,types.find(t=>t.id==='informe-individual'),'2026-05__2026-11',{});
assert.equal(formatted.carrera,'ADMINISTRACIÓN');
assert.match(formatted.contenido,/Cédula/);
console.log('OK: 24 esquemas de Excel y formulario, validaciones y preparación de borradores.');
