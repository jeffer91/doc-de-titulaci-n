'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ExcelJS=require('exceljs');
const Plan=require('../renderer/planificacion.model.js');
const IA=require('../electron/planificacion-ia.js');
const {readWorkbook}=require('../electron/excel.js');

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

const window={UTET_PLANIFICACION:Plan};
for(const filename of ['data.js','planificacion.figures.js','institutional.js','records.js']){
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
assert.match(window.UTET_PLANIFICACION_FIGURES.render({...plan,figures:{principal:'flujo'}},summary)[0],/Secuencia de etapas/);

const reply={
  contexto:'Se organizan las actividades del período.',
  conclusiones:'La planificación registra 1 actividad con fechas pendientes.',
  recomendaciones:'Completar las fechas con la coordinación responsable.',
  principal:'gantt',complementaria:'flujo',piePrincipal:'Actividades con fechas completas.',pieComplementaria:'Etapas programadas.'
};
async function run(){
  const records=window.UTET_RECORDS;
  const workType=window.UTET_DATA.procesos.flatMap(proceso=>proceso.documentos).find(documento=>documento.id==='plan-trabajo');
  const spec={typeId:workType.id,title:workType.nombre,periodId:'2026-04__2026-09',periodLabel:periodo,columns:records.schema(workType.id)};
  const source=new ExcelJS.Workbook();
  const current=source.addWorksheet('Trabajo de Titulación');
  current.addRow(['Cronograma de Trabajo de Titulación · Abril 2026 – Septiembre 2026']);
  current.addRow(['Actividad','Fecha de inicio','Fecha final','Tutoría o revisión','Entregable','Sede']);
  current.addRow(['Etapa 1. Formulación']);
  current.addRow(['Revisión del proyecto','2/04/2026',{formula:'DATE(2026,4,4)',result:46116},'Tutoría metodológica','Propuesta revisada','Matriz']);
  current.addRow(['Etapa 2. Desarrollo']);
  current.addRow(['Revisión de avances','Pendiente','Por definir','Revisión del tutor','Borrador','Sur']);
  current.addRow(['Fecha inválida','31/04/2026','']);
  const historical=source.addWorksheet('Tesis anterior');
  historical.addRows([['Octubre 2025 a Marzo 2026'],['Actividad','Fecha'],['Actividad de otro período','2026-02-01']]);
  const complexivo=source.addWorksheet('Examen Complexivo');
  complexivo.addRows([['Actividad','Fecha'],['Examen de otra modalidad','2026-05-01']]);
  const milestone=source.addWorksheet('Hitos de tesis');
  milestone.addRows([['Actividad','Fecha programada'],['Entrega del informe final','2026-08-20']]);
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await source.xlsx.writeBuffer());
  const imported=readWorkbook(workbook,spec,'Cronograma Trabajo.xlsx');
  assert.equal(imported.rows.length,3);
  assert.equal(imported.rows[0].data.fechaInicio,'2026-04-02');
  assert.equal(imported.rows[0].data.fechaFin,'2026-04-04');
  assert.equal(imported.rows[0].data.ordenEtapa,'1');
  assert.equal(imported.rows[1].data.fechaInicio,'');
  assert.equal(imported.rows[1].data.fechaFin,'');
  assert.equal(imported.rows[2].data.fechaInicio,imported.rows[2].data.fechaFin);
  assert.equal(imported.rows[2].data.fechaFin,'2026-08-20');
  assert.equal(imported.rows[2].data.referencia,'Cronograma Trabajo');
  assert.equal(imported.errors.length,2);
  assert.ok(imported.errors.some(row=>row.sheet==='Tesis anterior'));
  for(const row of imported.rows)assert.equal(records.validate(workType.id,row.data).length,0);
  const workDraft=records.toDocument(imported.rows.map(row=>row.data),workType,spec.periodId,window.UTET_INSTITUTIONAL.defaultDraftFields(workType));
  const workPlan=Plan.fromDraft(workDraft);
  assert.match(workPlan.text.contexto,/del Trabajo de Titulación/);
  assert.match(workPlan.text.contexto,/consta en 2 actividades/);
  assert.match(workPlan.text.conclusiones,/1 actividad sin fechas completas/);
  const workHtml=window.UTET_INSTITUTIONAL.render(workDraft,workType,periodo);
  assert.match(workHtml,/UTET-PRO-96 y UTET-PRO-164/);
  assert.match(workHtml,/data-plan-figure="gantt"/);
  assert.match(workHtml,/data-plan-figure="sedes"/);
  assert.doesNotMatch(workHtml,/Examen Complexivo/);

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
  await IA.redact(workPlan,fakeFetch);
  assert.match(calls.at(-1).options.body,/Planificación del Trabajo de Titulación/);
  assert.match(calls.at(-1).options.body,/Propuesta revisada/);
  await assert.rejects(IA.redact(plan,async()=>{throw Error('offline');}),/borrador automático/);
  await assert.rejects(IA.redact({...plan,modelo:'modelo:cloud'},fakeFetch),/modelos locales/);
  await assert.rejects(IA.redact(plan,async(url,opts)=>url.endsWith('/api/tags')?fakeFetch(url,opts):{
    ok:true,json:async()=>({message:{content:JSON.stringify({...reply,conclusiones:'Se aprobaron 999 estudiantes.'})}})
  }),/cifras ajenas/);
  console.log('OK Planificación: Complexivo y Trabajo, carga de cronograma, figuras y redacción local simulada.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
