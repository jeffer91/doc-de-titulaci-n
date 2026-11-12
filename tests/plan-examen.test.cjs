'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Plan=require('../renderer/plan-examen.model.js');
const IA=require('../electron/plan-examen-ia.js');

const periodo='Abril 2026 a Septiembre 2026';
const common={carrera:'Carrera de prueba',responsable:'Nombre reservado',entregable:'Registro',grupo:'Grupo de prueba'};
const rows=[
  {...common,actividad:'Inducción <revisar>',etapa:'Inducción',ordenEtapa:'1',fechaInicio:'2026-04-03',fechaFin:'2026-04-03',sede:'Matriz'},
  {...common,actividad:'Preparación del núcleo',etapa:'Núcleos',ordenEtapa:'2',fechaInicio:'2026-04-05',fechaFin:'2026-04-10',sede:'Sur'},
  {...common,actividad:'Supletorio',etapa:'Evaluación',ordenEtapa:'3',fechaInicio:'',fechaFin:'',responsable:'',sede:'Sur'}
];
const plan=Plan.create(rows,periodo);
const summary=Plan.summarize(plan.rows);
assert.deepEqual(Plan.available(summary),['gantt','flujo','sedes']);
assert.deepEqual(plan.figures,{principal:'gantt',complementaria:'sedes'});
assert.equal(summary.dated.length,2);
assert.match(plan.text.contexto,/Inducción/);
assert.match(plan.text.conclusiones,/1 actividad sin fechas completas/);
assert.match(plan.text.recomendaciones,/Confirmar las fechas pendientes/);
assert.equal(Plan.create([],periodo).figures.principal,'');
assert.equal(Plan.summarize(Plan.create([{...rows[0],fechaInicio:'2026-02-31'}],periodo).rows).dated.length,0);
const simultaneous=Plan.create(rows.slice(0,2).map(row=>({...row,ordenEtapa:'',fechaInicio:'2026-04-03'})),periodo);
assert.ok(!Plan.available(Plan.summarize(simultaneous.rows)).includes('flujo'),'Las fechas superpuestas no establecen una secuencia');
assert.deepEqual(plan.template,Plan.create(rows,'Octubre 2026 a Marzo 2027').template);
const reopened=JSON.parse(JSON.stringify(plan));
rows[0].actividad='Registro modificado después de preparar el PDF';
assert.equal(reopened.rows[0].actividad,'Inducción <revisar>');

const window={UTET_PLAN_EXAMEN:Plan};
for(const filename of ['plan-examen.figures.js','institutional.js']){
  const source=fs.readFileSync(path.join(__dirname,'../renderer',filename),'utf8');
  vm.runInNewContext(source,{window},{filename});
}
const type={id:'plan-examen',proceso:'PRO-56',nombre:'Planificación del Examen Complexivo',codigo:'UTET-RGI1-0X-PRO-56-AÑO-MES'};
const draft={
  ...window.UTET_INSTITUTIONAL.defaultDraftFields(type),planExamen:reopened,
  documentSections:[{title:'Programación registrada',headers:['Actividad'],rows:[['Supletorio']]}]
};
const html=window.UTET_INSTITUTIONAL.render(draft,type,periodo);
const headings=['Introducción','Base legal','Metodología','Planificación del período','Programación registrada','Figura 1','Conclusiones','Recomendaciones','Referencias'];
for(let i=1;i<headings.length;i++)assert.ok(html.indexOf(headings[i-1])<html.indexOf(headings[i]),headings[i]);
assert.match(html,/data-plan-figure="gantt"/);
assert.match(html,/data-plan-figure="sedes"/);
assert.match(html,/Inducción &lt;revisar&gt;/);
assert.doesNotMatch(html,/Inducción <revisar>/);
assert.match(window.UTET_PLAN_EXAMEN_FIGURES.render({...plan,figures:{principal:'flujo'}},summary)[0],/Secuencia de etapas/);

const reply={
  contexto:'Se organizan las actividades del período.',
  conclusiones:'La planificación registra 1 actividad con fechas pendientes.',
  recomendaciones:'Completar las fechas con la coordinación responsable.',
  principal:'gantt',complementaria:'flujo',piePrincipal:'Actividades con fechas completas.',pieComplementaria:'Etapas programadas.'
};
async function run(){
  const calls=[];
  const fakeFetch=async(url,options)=>{
    calls.push({url,options});
    return {ok:true,json:async()=>url.endsWith('/api/tags')?
      {models:[{name:'modelo:cloud',size:1},{name:'modelo-local:3b',size:1}]}:
      {message:{content:JSON.stringify(reply)}}};
  };
  const result=await IA.redact({...plan,observaciones:'Confirmar disponibilidad de sede.'},fakeFetch);
  assert.equal(result.model,'modelo-local:3b');
  assert.equal(result.figures.complementaria,'flujo');
  assert.equal(result.text.conclusiones,reply.conclusiones);
  assert.ok(calls.every(({url,options})=>url.startsWith('http://127.0.0.1:11434/')&&options.redirect==='error'));
  assert.equal(JSON.parse(calls[1].options.body).stream,false);
  assert.match(calls[1].options.body,/Confirmar disponibilidad de sede/);
  assert.doesNotMatch(calls[1].options.body,/Nombre reservado/);
  await assert.rejects(IA.redact(plan,async()=>{throw Error('offline');}),/borrador automático/);
  await assert.rejects(IA.redact({...plan,modelo:'modelo:cloud'},fakeFetch),/modelos locales/);
  await assert.rejects(IA.redact(plan,async(url,opts)=>url.endsWith('/api/tags')?fakeFetch(url,opts):{
    ok:true,json:async()=>({message:{content:JSON.stringify({...reply,conclusiones:'Se aprobaron 999 estudiantes.'})}})
  }),/cifras ajenas/);
  console.log('OK Planificación Complexivo: plantilla, figuras, pendientes y redacción local simulada.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
