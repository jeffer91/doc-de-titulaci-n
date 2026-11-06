'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'renderer','data.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'renderer','institutional.js'),'utf8'),sandbox);
const U=sandbox.window.UTET_INSTITUTIONAL;
const all=sandbox.window.UTET_DATA.procesos.flatMap(x=>x.documentos);
assert.equal(all.length,24,'Se conservan los 24 documentos aprobados');
assert.equal(sandbox.window.UTET_DATA.periodos.length,6);
assert.equal(sandbox.window.UTET_DATA.requisitos.length,11);
const period='Abril 2026 a Septiembre 2026';
const build=(type)=>({
  ...U.defaultDraftFields(type),periodId:'2026-04__2026-09',
  asunto:type.nombre,fecha:'2026-11-06',contenido:'Descripción verificable de ejemplo.',
  estado:'Borrador'
});
for(const t of all){
  const f=U.familyFor(t),d=build(t);
  const html=U.render(d,t,period);
  assert.ok(html.includes('institutional-document'));
  assert.ok(html.includes('MAQUETA · DOCUMENTO NO APROBADO'));
  assert.ok(html.includes(period));
  assert.ok(!html.includes('CASALIMPIA'));
  assert.ok(!html.includes('Página 3 de 4'));
  assert.ok(!html.includes('Arial 23'));
  const covers=(html.match(/class="inst-sign"/g)||[]).length;
  if(['RGI','INF','ACT'].includes(f)) {
    assert.equal(covers,1,`Firmas solo en primera hoja: ${t.id}`);
    assert.ok(html.includes('inst-cover'),`Portada: ${t.id}`);
    assert.ok(html.includes('inst-head'));
  }else assert.equal(covers,0,`Sin firmas de portada indebidas: ${t.id}`);
  if(f==='AT')assert.ok(html.includes('PENDIENTE DE VALIDACIÓN'));
  if(f==='INF')assert.ok(html.includes('Página 1 de 2'));
  if(f==='RGI')assert.ok(html.includes('width:45mm'));
  assert.ok(U.validate(d,t).warnings.length>0);
}
const rgi=all.find(t=>t.id==='asistencia-induccion'),d=build(rgi);
d.asistentes=Array.from({length:49},(_,i)=>`000000000${i}; Participante ${i}; Carrera demo; `).join('\n');
const rgiHtml=U.render(d,rgi,period);
assert.equal((rgiHtml.match(/class="inst-page inst-/g)||[]).length,4,'Portada + 3 hojas de asistencia');
assert.ok(rgiHtml.includes('<td>1</td>'));
assert.ok(rgiHtml.includes('<td>49</td>'));
const inf=all.find(t=>t.id==='informe-final'),di=build(inf);
di.asunto='Nombre <script>alert(1)</script> & prueba';
const ih=U.render(di,inf,period);
assert.ok(!ih.includes('<script>'), 'HTML escapado');
assert.ok(ih.includes('&lt;script&gt;'));
const bad={...di,codigoEmitido:'UTET-INF-0X-PRO-95-20XX-0X'};
assert.ok(U.validate(bad,inf).errors.some(e=>e.includes('marcadores')),'No acepta códigos plantilla');
assert.equal(U.familyFor(all.find(t=>t.id==='acta-examen')),'AT');
assert.equal(U.familyFor(all.find(t=>t.id==='acta-requisitos')),'ACT');
console.log('OK: 24 documentos, 6 períodos, 11 requisitos, familias, portada, firmas, asistencia y validaciones.');
