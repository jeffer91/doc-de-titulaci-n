'use strict';
// Estados documentales desde requisitos.valores y notas/antiplagio, nunca por omisión.
const REQS=Object.freeze([
 ['Academico','Académico / cumplimiento curricular',['Academico','Académico','academico']],
 ['Documentacion','Documentación académica',['Documentacion','Documentación','documentacion']],
 ['Financiero','Financiero',['Financiero','financiero']],
 ['PracticasVinculacion','Prácticas preprofesionales',['PracticasVinculacion','Practicas','PracticasPreprofesionales','PracticasVinculacion']],
 ['Vinculacion','Vinculación con la sociedad',['Vinculacion','Vinculación']],
 ['SeguimientoGraduados','Seguimiento a graduados',['SeguimientoGraduados','seguimientoGraduados']],
 ['Ingles','Segunda lengua / Inglés',['Ingles','Inglés']],
 ['ActualizacionDatos','Actualización de datos',['ActualizacionDatos','ActualizaciónDatos']],
 ['Titulacion','Titulación',['Titulacion','Titulación']]
]);
const Modalidades=require('../renderer/acta-titulacion.modalidades.js');
const {similarityApproved}=require('../renderer/antiplagio.model.js');
const APPROVALS=Object.freeze([
 ['AprobacionTitulacion','Aprobación de titulación',['AprobacionTitulacion']],
 ['AprobacionComplexivoProyecto','Aprobación del artículo académico',['AprobacionComplexivoProyecto']]
]);
const approvalsFor=cfg=>APPROVALS.map(([key,label,aliases])=>[key,key==='AprobacionComplexivoProyecto'?cfg.approvalLabel:label,aliases]);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const state=v=>{if(norm(v)==='cumple')return 'CUMPLE';if(norm(v)==='nocumple')return 'NO CUMPLE';if(norm(v)==='pendiente')return 'PENDIENTE';return 'SIN DATO';};
const number=x=>{if(x===null||x===undefined||x==='')return null;const n=Number(String(x).replace(',','.'));return Number.isFinite(n)?n:null;};
function lookup(values,aliases){
 const source=values&&typeof values==='object'?values:{};
 for(const a of aliases){const key=Object.keys(source).find(x=>norm(x)===norm(a));if(key&&source[key]!==null&&source[key]!==undefined&&source[key]!=='')return source[key];}
 return null;
}
function field(doc,names){
 const d=doc&&typeof doc==='object'?doc:{};
 for(const n of names){if(d[n]!==undefined&&d[n]!==null&&d[n]!=='')return d[n];}
 return null;
}
const requirementRows=values=>REQS.map(([key,label,aliases])=>({key,label,status:state(lookup(values,aliases))}));
const withdrawn=row=>row?.retirado===true||/retirad/i.test(String(row?.estadoMatricula||''));
function assess({requisitos,notas,antiplagio,matricula,periodoId,cedula,modalidad=Modalidades.DEFAULT}){
 const cfg=Modalidades.get(modalidad);
 const issue=[];
 const validDocument=(row)=>row&&!row.eliminado&&String(row.periodoId||'')===periodoId&&String(row.cedula||'')===cedula;
 const activeEnrollment=validDocument(matricula)&&!withdrawn(matricula);
 if(!activeEnrollment)issue.push('No consta una matrícula activa para este estudiante y período.');
 if(!validDocument(requisitos))issue.push('No se encontraron requisitos académicos vigentes para este estudiante y período.');
 const values=validDocument(requisitos)?requisitos.valores||{}:{};
 const rows=requirementRows(values);
 const approvals=approvalsFor(cfg).map(([key,label,aliases])=>({key,label,status:state(lookup(values,aliases))}));
 for(const row of [...rows,...approvals])if(row.status!=='CUMPLE')issue.push(row.label+': '+row.status);
 const checks={};
 const notesOK=validDocument(notas);
 if(cfg.requiresNotes){
  if(!notesOK)issue.push('No existe ficha oficial de calificaciones del período.');
  const writing=notesOK?number(field(notas,cfg.writingFields)):null;
  const defense=notesOK?number(field(notas,cfg.defenseFields)):null;
  const writingOK=writing!==null&&writing>=7&&writing<=10;
  const defenseOK=defense!==null&&defense>=7&&defense<=10;
  if(!writingOK)issue.push(cfg.writingLabel+': falta acreditar nota mínima de 7/10.');
  if(!defenseOK)issue.push('Defensa: falta acreditar nota mínima de 7/10.');
  checks[cfg.checks[0]]=writing===null?'SIN DATO':writingOK?'CUMPLE':'NO CUMPLE';
  checks.defensa=defense===null?'SIN DATO':defenseOK?'CUMPLE':'NO CUMPLE';
 }
 if(cfg.requiresSimilarity){
  const pl=validDocument(antiplagio)?antiplagio:null;
  const similarity=pl?number(pl.similitud):null;
  const kind=cfg.id==='ARTICULO_ACADEMICO'?'articulo':'trabajo';
  const plagioOK=pl?.origen==='real'&&similarityApproved(pl.similitud,kind);
  if(!plagioOK)issue.push('No consta un análisis real de similitud de '+cfg.antiplagioLabel+' que cumpla el criterio '+(kind==='articulo'?'de hasta 20,00 %.':'inferior a 20,00 %.'));
  checks.similitud=similarity===null?'SIN DATO':plagioOK?'CUMPLE':'NO CUMPLE';
 }
 // La modalidad se toma de la ficha de notas o de la matrícula; nunca se asume.
 const registered=(notesOK?field(notas,['modalidadTitulacion','modalidad']):null)||
  (activeEnrollment?field(matricula,['modalidadTitulacion']):null)||
  (validDocument(requisitos)?field(requisitos,['modalidadTitulacion']):null);
 const modeOK=new RegExp(cfg.modePattern).test(norm(registered));
 if(!modeOK)issue.push('No está acreditada la modalidad '+cfg.label+'.');
 checks.modalidad=modeOK?'CUMPLE':'SIN DATO';
 const consulted=['requisitos','matriculas'];
 if(cfg.requiresNotes)consulted.push('notas');
 if(cfg.requiresSimilarity)consulted.push('antiplagio de '+cfg.antiplagioLabel.toLowerCase());
 return {
  modalidad:cfg.id,requirements:rows,approvals,checks,
  // No exponer las notas en el PDF ni en la UI; solo el estado de los mínimos.
  eligible:issue.length===0,missing:issue,verifiedAt:new Date().toISOString(),
  source:'Firebase: '+consulted.join(', ')
 };
}
module.exports={REQS,APPROVALS,approvalsFor,requirementRows,withdrawn,norm,state,assess};
