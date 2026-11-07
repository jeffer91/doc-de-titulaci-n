'use strict';
// Memorandos UTET: almacenamiento independiente de matrículas y estudiantes.
// Las reglas desplegadas de Firestore deben autorizar las escrituras; jamás se omiten.
const {initializeApp,getApps}=require('firebase/app');
const {getFirestore,doc,runTransaction,getDoc,getDocs,collection,query,where,limit}=require('firebase/firestore');
const CONFIG={apiKey:'AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA',authDomain:'utet-4387a.firebaseapp.com',projectId:'utet-4387a',appId:'1:902848131454:web:47f515eb6480834724c32f'};
const APP='utet-doc-titulacion-memorandos';
const RECORDS='UTET_antiplagio_memorandos',COUNTERS='UTET_antiplagio_correlativos',REFCOUNTERS='UTET_antiplagio_referencias';
let db;
function firestore(){if(!db){const app=getApps().find(a=>a.name===APP)||initializeApp(CONFIG,APP);db=getFirestore(app);}return db;}
const periodValid=s=>/^\d{4}-(0[1-9]|1[0-2])__\d{4}-(0[1-9]|1[0-2])$/.test(String(s||''));
const cedulaValid=s=>/^[0-9A-Za-z]{6,20}$/.test(String(s||''));
const dateValid=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return false;const [y,m,d]=s.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d));return v.getUTCFullYear()===y&&v.getUTCMonth()+1===m&&v.getUTCDate()===d;};
function key(periodoId,cedula){if(!periodValid(periodoId)||!cedulaValid(cedula))throw Error('Identificación del estudiante o período inválida.');return periodoId+'__'+cedula;}
function code(n,date){return String(n).padStart(2,'0')+' MEM-ITSQMET-UTET-'+date;}
function safeRecord(x){
  if(!x||typeof x!=='object')throw Error('Memorando inválido.');
  const keys=['periodoId','cedula','estudianteId','nombres','carreraNombre','modalidad','sede','jornada','periodoNombre','similitud','fecha','referencia','herramienta','origen','fuentes','versionPlantilla'];
  const r={};
  for(const k of keys){if(k==='fuentes')continue;r[k]=String(x[k]??'').slice(0,220);}
  if(!periodValid(r.periodoId)||!cedulaValid(r.cedula)||r.estudianteId!==key(r.periodoId,r.cedula))throw Error('Registro no coincide con la ficha académica.');
  if(!dateValid(r.fecha))throw Error('Fecha de emisión inválida.');
  const n=Number(String(r.similitud).replace(',','.'));
  if(!Number.isFinite(n)||n<0||n>100||!/^\d{1,3}([.,]\d{1,2})?$/.test(r.similitud))throw Error('Porcentaje inválido.');
  if(!['simulado','real'].includes(r.origen))throw Error('Debe indicarse origen simulado o real.');
  const allowed=['google','web','repositorios','publicaciones','documentos','trabajos','institucional'];
  r.fuentes=Object.fromEntries(allowed.map(k=>[k,['detected','not-detected','unknown'].includes(x.fuentes?.[k])?x.fuentes[k]:'unknown']));
  return r;
}
function explain(error){const c=String(error?.code||'');if(/permission-denied|unauthenticated/.test(c))throw Error('Firebase no autoriza guardar memorandos. Configura un acceso institucional protegido; no habilites escritura pública.');throw error;}
async function get(periodoId,cedula){
  try{const snap=await getDoc(doc(firestore(),RECORDS,key(periodoId,cedula)));return snap.exists()?snap.data():null;}catch(e){return explain(e);}
}
async function list(periodoId){
  if(!periodValid(periodoId))throw Error('Período inválido.');
  try{const snap=await getDocs(query(collection(firestore(),RECORDS),where('periodoId','==',periodoId),limit(5000)));return snap.docs.map(x=>x.data());}catch(e){return explain(e);}
}
async function save(input){
 const record=safeRecord(input),id=key(record.periodoId,record.cedula),month=record.fecha.slice(0,7),database=firestore();
 const recordRef=doc(database,RECORDS,id),counterRef=doc(database,COUNTERS,month),referenceRef=doc(database,REFCOUNTERS,month);
 try{return await runTransaction(database,async tx=>{
   const previous=await tx.get(recordRef);
   const existing=previous.exists()?previous.data():null;
   if(existing){
     // Un registro emitido nunca cambia su folio ni su fecha original.
     const {folio,numero,fecha,referencia}=existing;
     tx.set(recordRef,{...record,fecha,folio,numero,referencia,actualizadoEn:new Date().toISOString(),creadoEn:existing.creadoEn||new Date().toISOString()});
     return {folio,numero,fecha,referencia,existing:true};
   }
   const counter=await tx.get(counterRef);
   const refCounter=await tx.get(referenceRef);
   const number=(Number(counter.exists()?counter.data().ultimo:0)||0)+1;
   if(!Number.isSafeInteger(number)||number>999999)throw Error('Consecutivo mensual fuera de rango.');
   const refNumber=(Number(refCounter.exists()?refCounter.data().ultimo:0)||0)+1;
   if(!Number.isSafeInteger(refNumber)||refNumber>999999)throw Error('Consecutivo de reporte fuera de rango.');
   const referencia='UTET-ANT-'+month+'-'+String(refNumber).padStart(4,'0');
   const folio=code(number,record.fecha),now=new Date().toISOString();
   tx.set(counterRef,{ultimo:number,actualizadoEn:now});
   tx.set(referenceRef,{ultimo:refNumber,actualizadoEn:now});
   tx.set(recordRef,{...record,referencia,folio,numero:number,creadoEn:now,actualizadoEn:now});
   return {folio,numero:number,fecha:record.fecha,referencia,existing:false};
 });}catch(e){return explain(e);}
}
module.exports={get,list,save,key,code,safeRecord,dateValid,periodValid,cedulaValid,RECORDS,COUNTERS,REFCOUNTERS};
