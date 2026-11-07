'use strict';
/* PRO-57 Acta AA: verificación explícita de requisitos y numeración institucional.
 * No lee listas globales de Firestore: sólo cuatro documentos del estudiante.
 * La emisión requiere verificación nueva, y siempre falla cerrada si faltan datos.
 */
const {initializeApp,getApps}=require('firebase/app');
const {getFirestore,doc,getDoc,runTransaction}=require('firebase/firestore');
const {FIREBASE_CONFIG}=require('./firebase-read.js');
const Local=require('./antiplagio-local.js');
const Dates=require('./acta-articulo-date.js');
const Evidence=require('./acta-articulo-evidence.js');
const APP='utet-actas-articulo';
const REGISTRY='actas_registro',COUNTERS='actas_contadores',NUMBERS='actas_numeros';
let database;
function db(){
 if(!database){
  const app=getApps().find(x=>x.name===APP)||initializeApp(FIREBASE_CONFIG,APP);
  database=getFirestore(app);
 }
 return database;
}
function identity(periodoId,cedula){
 if(!Local.validPeriod(periodoId)||!/^\\d{10}$/.test(String(cedula||'')))throw Error('Se necesita período y cédula válida para el acta.');
 return periodoId+'__'+cedula;
}
function explain(error){
 const code=String(error?.code||'');
 if(/permission-denied|unauthenticated/.test(code))
  throw Error('Firebase denegó el acceso a las actas o requisitos. Se necesita una sesión institucional autorizada; no se deben abrir permisos públicos.');
 throw error;
}
function normalizedStudent(student,p,cedula){
 if(!student||student.cedula!==cedula||student.periodoId!==p||student.retirado||!student.nombres?.trim()||!student.carreraNombre?.trim())
  throw Error('Estudiante sin ficha académica completa y activa en el período.');
 return student;
}
function cleanCareer(name){
 return String(name||'').replace(/\bonline\b/gi,'').replace(/\s+[-–|(]\s*$/g,'').replace(/\s+/g,' ').trim();
}
async function readEvidence(periodoId,cedula,baseDir){
 identity(periodoId,cedula);
 const student=(await Local.snapshot(baseDir,periodoId,'trabajo')).students.find(x=>x.cedula===cedula);
 normalizedStudent(student,periodoId,cedula);
 const d=db(),id=identity(periodoId,cedula);
 const refs=[
  doc(d,'requisitos',id),
  doc(d,'notas',id),
  doc(d,'matriculas',id),
  doc(d,'UTET_antiplagio_memorandos','articulo__'+id)
 ];
 let snaps;
 try{snaps=await Promise.all(refs.map(x=>getDoc(x)));}
 catch(error){return explain(error);}
 const [requisitos,notas,matricula,antiplagio]=snaps.map(s=>s.exists()?s.data():null);
 const evaluation=Evidence.assess({requisitos,notas,matricula,antiplagio,periodoId,cedula});
 await Local.saveActaEvidence(baseDir,periodoId,cedula,evaluation);
 return evaluation;
}
async function openPeriod(periodoId,baseDir,loadStudents){
 if(!Local.validPeriod(periodoId))throw Error('Período académico inválido.');
 let roster=await Local.snapshot(baseDir,periodoId,'trabajo');
 if(!roster.hasCache){
  const remote=await loadStudents(periodoId);
  if(remote.periodoId!==periodoId||!Array.isArray(remote.students))throw Error('Matrículas no disponibles.');
  await Local.replaceFromFirebase(baseDir,periodoId,remote.students,null,remote.readAt,'trabajo');
  roster=await Local.snapshot(baseDir,periodoId,'trabajo');
 }
 const [actas,evidences]=await Promise.all([Local.loadActas(baseDir,periodoId),Local.listActaEvidences(baseDir,periodoId)]);
 return {periodoId,students:roster.students,actas,evidences,emision:Dates.forPeriod(periodoId),source:roster.source,syncedAt:roster.syncedAt,
  count:roster.students.length};
}
async function refreshStudents(periodoId,baseDir,loadStudents){
 const remote=await loadStudents(periodoId);
 if(remote.periodoId!==periodoId||!Array.isArray(remote.students))throw Error('Respuesta Firebase inválida.');
 await Local.replaceFromFirebase(baseDir,periodoId,remote.students,null,remote.readAt,'trabajo');
 return openPeriod(periodoId,baseDir,loadStudents);
}
function numberCode(date,cedula,num){
 if(!Number.isSafeInteger(num)||num<1||num>9999)throw Error('El consecutivo mensual de actas está agotado.');
 return 'AA-'+date.year+'-'+cedula.slice(0,4)+'-'+date.monthNumber+'-'+String(num).padStart(4,'0');
}
async function issue(periodoId,cedula,baseDir){
 identity(periodoId,cedula);
 const existing=await Local.getActa(baseDir,periodoId,cedula);
 if(existing)return existing;
 const p=Dates.forPeriod(periodoId);
 if(!Dates.allowed(periodoId).ready){
  throw Error(p.calendarVerified?'La fecha institucional de emisión aún no ha llegado: '+p.date+'.':'Falta validar oficialmente el calendario de feriados para el año de emisión.');
 }
 const evidence=await readEvidence(periodoId,cedula,baseDir);
 if(!evidence.eligible)throw Error('Acta bloqueada. Pendientes: '+evidence.missing.join(' · '));
 const student=(await Local.snapshot(baseDir,periodoId,'trabajo')).students.find(x=>x.cedula===cedula);
 normalizedStudent(student,periodoId,cedula);
 const d=db(),id=identity(periodoId,cedula);
 const ref=doc(d,REGISTRY,'AA__'+id),counter=doc(d,COUNTERS,p.month);
 let saved;
 try{
  saved=await runTransaction(d,async tx=>{
   const prev=await tx.get(ref);
   if(prev.exists()){
    const item=prev.data();
    if(item.periodoId!==periodoId||item.cedula!==cedula||item.modalidad!=='ARTICULO_ACADEMICO'||!/^AA-\d{4}-\d{4}-\d{2}-\d{4}$/.test(item.numeroActa||''))
      throw Error('El registro central de actas AA presenta una identidad incompatible.');
    return item;
   }
   const current=await tx.get(counter);
   const last=Number(current.exists()?current.data().ultimo:0)||0;
   if(!Number.isSafeInteger(last)||last<0||last>=9999)throw Error('Correlativo mensual inválido o agotado.');
   const next=last+1,numeroActa=numberCode(p,cedula,next);
   const numberRef=doc(d,NUMBERS,numeroActa),numberSnap=await tx.get(numberRef);
   if(numberSnap.exists())throw Error('El número AA ya está utilizado en el libro institucional.');
   const now=new Date().toISOString(),regDate=Dates.todayEcuador();
   const record={
    modalidad:'ARTICULO_ACADEMICO',periodoId,cedula,numeroActa,
    codigoDocumento:p.documentCode,fechaEmision:p.date,fechaRegistro:regDate,
    nombre:student.nombres,carrera:cleanCareer(student.carreraNombre),
    modalidadEstudios:student.modalidad||(/online/i.test(student.carreraNombre)?'En línea':'No registrada'),
    requisitos:evidence.requirements,aprobaciones:evidence.approvals,
    comprobaciones:evidence.checks,verificadoEn:evidence.verifiedAt,
    version:'1.0',createdAt:now
   };
   tx.set(ref,record);
   tx.set(counter,{mesClave:p.month,ultimo:next,ultimaActa:numeroActa,updatedAt:now});
   tx.set(numberRef,{numeroActa,identidad:'AA__'+id,mesClave:p.month,consecutivo:next,periodoId,cedula,modalidad:'ARTICULO_ACADEMICO'});
   return record;
  });
 }catch(error){return explain(error);}
 await Local.saveActa(baseDir,saved);
 return saved;
}
async function get(baseDir,periodoId,cedula){
 identity(periodoId,cedula);
 return Local.getActa(baseDir,periodoId,cedula);
}
module.exports={openPeriod,refreshStudents,readEvidence,issue,get,numberCode,identity,cleanCareer,REGISTRY,COUNTERS,NUMBERS};
