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
const APPROVALS=Object.freeze([
 ['AprobacionTitulacion','Aprobación de titulación',['AprobacionTitulacion']],
 ['AprobacionComplexivoProyecto','Aprobación del artículo académico',['AprobacionComplexivoProyecto']]
]);
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
function assess({requisitos,notas,antiplagio,matricula,periodoId,cedula}){
 const issue=[];
 const validDocument=(row)=>row&&!row.eliminado&&String(row.periodoId||'')===periodoId&&String(row.cedula||'')===cedula;
 if(!validDocument(requisitos))issue.push('No se encontraron requisitos académicos vigentes para este estudiante y período.');
 const values=validDocument(requisitos)?requisitos.valores||{}:{};
 const rows=REQS.map(([key,label,aliases])=>({key,label,status:state(lookup(values,aliases))}));
 const approvals=APPROVALS.map(([key,label,aliases])=>({key,label,status:state(lookup(values,aliases))}));
 for(const row of [...rows,...approvals])if(row.status!=='CUMPLE')issue.push(row.label+': '+row.status);
 if(!validDocument(notas))issue.push('No existe ficha oficial de calificaciones del período.');
 const writing=validDocument(notas)?number(field(notas,['notaArticulo','notaEscrito','Notart','Nart'])):null;
 const defense=validDocument(notas)?number(field(notas,['notaDefensa','notaDefensaTrabajo','Notdef','Ndef'])):null;
 const writingOK=writing!==null&&writing>=7&&writing<=10;
 const defenseOK=defense!==null&&defense>=7&&defense<=10;
 if(!writingOK)issue.push('Artículo académico: falta acreditar nota mínima de 7/10.');
 if(!defenseOK)issue.push('Defensa: falta acreditar nota mínima de 7/10.');
 const modalidad=field(notas,['modalidadTitulacion'])||field(matricula,['modalidadTitulacion']);
 const modeOK=/articuloacademico/.test(norm(modalidad));
 if(!modeOK)issue.push('No está acreditada la modalidad Artículo Académico.');
 const pl=validDocument(antiplagio)?antiplagio:null;
 const similarity=pl?number(pl.similitud):null;
 const plagioOK=similarity!==null&&similarity>=0&&similarity<=20&&pl.origen==='real';
 if(!plagioOK)issue.push('No consta un análisis real de similitud de Artículo Académico dentro del máximo 20,00 %.');
 return {
  requirements:rows,approvals,checks:{
   articulo:writing===null?'SIN DATO':writingOK?'CUMPLE':'NO CUMPLE',
   defensa:defense===null?'SIN DATO':defenseOK?'CUMPLE':'NO CUMPLE',
   similitud:similarity===null?'SIN DATO':plagioOK?'CUMPLE':'NO CUMPLE',
   modalidad:modeOK?'CUMPLE':'SIN DATO'
  },
  // No exponer las notas en el PDF ni en la UI; solo el estado de los mínimos.
  eligible:issue.length===0,missing:issue,verifiedAt:new Date().toISOString(),
  source:'Firebase: requisitos, notas, matriculas y antiplagio de artículo'
 };
}
module.exports={REQS,APPROVALS,norm,state,assess};
