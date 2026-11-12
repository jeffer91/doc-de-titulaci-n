'use strict';
/* Numeración institucional mensual de memorandos de cronograma.
 * Usa el contador mensual compartido con los memorandos de similitud para
 * evitar reutilizar correlativos entre módulos que escriben en Firestore.
 * No emite números locales oficiales ni reinicia un mes al cambiar período.
 */
const {initializeApp,getApps}=require('firebase/app');
const {getFirestore,doc,getDocFromServer,runTransaction}=require('firebase/firestore');
const Model=require('../renderer/cronograma.model.js');
const CONFIG={apiKey:'AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA',authDomain:'utet-4387a.firebaseapp.com',projectId:'utet-4387a',appId:'1:902848131454:web:47f515eb6480834724c32f'};
const APP='utet-cronograma-memorandos';
const RECORDS='UTET_cronograma_memorandos',COUNTERS='UTET_antiplagio_correlativos';
let db;
function firestore(){if(!db){const app=getApps().find(x=>x.name===APP)||initializeApp(CONFIG,APP);db=getFirestore(app);}return db;}
function code(month,number){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||''))||!Number.isSafeInteger(number)||number<1||number>999999)throw Error('Mes o correlativo de memorando inválido.');
 return 'MEM-ITSQMET-UTET-'+month+'-'+String(number).padStart(2,'0');
}
function explain(err){
 if(/permission-denied|unauthenticated/.test(String(err?.code||'')))throw Error('Firestore no permite emitir este memorando. Se conserva el borrador; solicita habilitar acceso institucional protegido para el registro de cronogramas y correlativos.');
 throw err;
}
async function getIssued(id){
 if(!/^[a-zA-Z0-9_-]{6,120}$/.test(String(id||'')))throw Error('Identificador del memorando no válido.');
 try{
  const snapshot=await getDocFromServer(doc(firestore(),RECORDS,id)),record=snapshot.exists()?snapshot.data():null;
  if(!record?.folio||record.documento?.id!==id)throw Error('No se encontró el memorando emitido.');
  return {folio:record.folio,numero:record.numero,documento:record.documento,alreadyIssued:true};
 }catch(err){return explain(err);}
}
async function issue(input){
 const data=Model.validate(input),month=data.fecha.slice(0,7);
 const database=firestore(),reference=doc(database,RECORDS,data.id),counter=doc(database,COUNTERS,month);
 try{return await runTransaction(database,async tx=>{
  const prev=await tx.get(reference);
  if(prev.exists()){
   const record=prev.data();
   if(!record||!record.folio||!record.documento)throw Error('Registro anterior del memorando incompleto.');
   return {folio:record.folio,numero:record.numero,documento:record.documento,alreadyIssued:true};
  }
  const n=await tx.get(counter),number=Number(n.exists()?n.data()?.ultimo:0)+1;
  if(!Number.isSafeInteger(number)||number>999999||number<1)throw Error('No se pudo asignar el consecutivo mensual.');
  const folio=code(month,number),now=new Date().toISOString();
  tx.set(counter,{ultimo:number,actualizadoEn:now});
  tx.set(reference,{folio,numero:number,mes:month,documento:data,emitidoEn:now,tipoDocumento:'cronograma-articulo'});
  return {folio,numero:number,documento:data,alreadyIssued:false};
 });}catch(err){return explain(err);}
}
module.exports={issue,getIssued,code,RECORDS,COUNTERS};
