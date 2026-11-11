'use strict';
/* Actas de Titulación (AA · PRO-57, TT · PRO-164, CX · PRO-93): verificación explícita
 * de requisitos y numeración institucional por modalidad.
 * No lee listas globales de Firestore: sólo los documentos del estudiante.
 * La emisión requiere verificación nueva, y siempre falla cerrada si faltan datos.
 */
const {initializeApp,getApps}=require('firebase/app');
const {getFirestore,doc,getDocFromServer,runTransaction}=require('firebase/firestore');
const PdfModel=require('../renderer/acta-articulo.model.js');
const Modalidades=require('../renderer/acta-titulacion.modalidades.js');
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
const modality=m=>Modalidades.get(m==null||m===''?Modalidades.DEFAULT:m);
function identity(periodoId,cedula){
 if(!Local.validPeriod(periodoId)||!/^\d{10}$/.test(String(cedula||'')))throw Error('Se necesita período y cédula válida para el acta.');
 return periodoId+'__'+cedula;
}
const registryId=(cfg,id)=>cfg.prefix+'__'+id;
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
function studiesMode(student){
 const raw=String(student?.modalidad||'').trim();
 if(/^(ARTICULO_ACADEMICO|EXAMEN_COMPLEXIVO|TRABAJO_TITULACION)$/i.test(raw))
  return /online/i.test(student.carreraNombre||'')?'En línea':'No registrada';
 if(/\bonline\b|en l[ií]nea/i.test(raw))return 'En línea';
 if(/h[ií]brid/i.test(raw))return 'Híbrida';
 return raw||(/online/i.test(student.carreraNombre||'')?'En línea':'No registrada');
}

async function readEvidence(periodoId,cedula,baseDir,modalidad){
 const cfg=modality(modalidad);
 identity(periodoId,cedula);
 const student=(await Local.snapshot(baseDir,periodoId,'trabajo')).students.find(x=>x.cedula===cedula);
 normalizedStudent(student,periodoId,cedula);
 const d=db(),id=identity(periodoId,cedula);
 const refs=[doc(d,'requisitos',id),doc(d,'notas',id),doc(d,'matriculas',id)];
 if(cfg.requiresSimilarity)refs.push(doc(d,'UTET_antiplagio_memorandos',cfg.antiplagioDocId+id));
 let snaps;
 try{snaps=await Promise.all(refs.map(x=>getDocFromServer(x)));}
 catch(error){return explain(error);}
 const [requisitos,notas,matricula,antiplagio]=snaps.map(s=>s.exists()?s.data():null);
 const evaluation=Evidence.assess({requisitos,notas,matricula,antiplagio:antiplagio||null,periodoId,cedula,modalidad:cfg.id});
 await Local.saveActaEvidence(baseDir,periodoId,cedula,evaluation,cfg.id);
 return evaluation;
}
async function openPeriod(periodoId,baseDir,loadStudents,modalidad){
 const cfg=modality(modalidad);
 if(!Local.validPeriod(periodoId))throw Error('Período académico inválido.');
 let roster=await Local.snapshot(baseDir,periodoId,'trabajo');
 if(!roster.hasCache){
  const remote=await loadStudents(periodoId);
  if(remote.periodoId!==periodoId||!Array.isArray(remote.students))throw Error('Matrículas no disponibles.');
  await Local.replaceFromFirebase(baseDir,periodoId,remote.students,null,remote.readAt,'trabajo');
  roster=await Local.snapshot(baseDir,periodoId,'trabajo');
 }
 const [actas,evidences]=await Promise.all([Local.loadActas(baseDir,periodoId,cfg.id),Local.listActaEvidences(baseDir,periodoId,cfg.id)]);
 return {periodoId,modalidad:cfg.id,students:roster.students,actas,evidences,emision:Dates.forPeriod(periodoId),source:roster.source,syncedAt:roster.syncedAt,
  count:roster.students.length};
}
async function refreshStudents(periodoId,baseDir,loadStudents,modalidad){
 const cfg=modality(modalidad);
 const remote=await loadStudents(periodoId);
 if(remote.periodoId!==periodoId||!Array.isArray(remote.students))throw Error('Respuesta Firebase inválida.');
 await Local.replaceFromFirebase(baseDir,periodoId,remote.students,null,remote.readAt,'trabajo');
 return openPeriod(periodoId,baseDir,loadStudents,cfg.id);
}
function numberCode(date,cedula,num,modalidad){
 const cfg=modality(modalidad);
 if(!Number.isSafeInteger(num)||num<1||num>9999)throw Error('El consecutivo mensual de actas está agotado.');
 return cfg.prefix+'-'+date.year+'-'+cedula.slice(0,4)+'-'+date.monthNumber+'-'+String(num).padStart(4,'0');
}
async function recover(periodoId,cedula,baseDir,modalidad){
 const cfg=modality(modalidad);
 const id=identity(periodoId,cedula);
 let snapshot;
 try{snapshot=await getDocFromServer(doc(db(),REGISTRY,registryId(cfg,id)));}
 catch(error){return explain(error);}
 if(!snapshot.exists())return null;
 const record=snapshot.data();
 if(record.periodoId!==periodoId||record.cedula!==cedula||record.modalidad!==cfg.id||!PdfModel.valid(record))
  throw Error('El registro central del acta no coincide con el documento institucional esperado.');
 await Local.saveActa(baseDir,record);
 return record;
}
async function issue(periodoId,cedula,baseDir,modalidad){
 const cfg=modality(modalidad);
 identity(periodoId,cedula);
 const existing=await Local.getActa(baseDir,periodoId,cedula,cfg.id);
 if(existing)return existing;
 const recovered=await recover(periodoId,cedula,baseDir,cfg.id);
 if(recovered)return recovered;
 const p=Dates.forPeriod(periodoId);
 if(!Dates.allowed(periodoId).ready){
  throw Error(p.calendarVerified?'La fecha institucional de emisión aún no ha llegado: '+p.date+'.':'Falta validar oficialmente el calendario de feriados para el año de emisión.');
 }
 const evidence=await readEvidence(periodoId,cedula,baseDir,cfg.id);
 if(!evidence.eligible)throw Error('Acta bloqueada. Pendientes: '+evidence.missing.join(' · '));
 const student=(await Local.snapshot(baseDir,periodoId,'trabajo')).students.find(x=>x.cedula===cedula);
 normalizedStudent(student,periodoId,cedula);
 const d=db(),id=identity(periodoId,cedula),pattern=Modalidades.numberPattern(cfg);
 const ref=doc(d,REGISTRY,registryId(cfg,id)),counter=doc(d,COUNTERS,p.month);
 let saved;
 try{
  saved=await runTransaction(d,async tx=>{
   const prev=await tx.get(ref);
   if(prev.exists()){
    const item=prev.data();
    if(item.periodoId!==periodoId||item.cedula!==cedula||item.modalidad!==cfg.id||!pattern.test(item.numeroActa||''))
      throw Error('El registro central de actas '+cfg.prefix+' presenta una identidad incompatible.');
    return item;
   }
   const current=await tx.get(counter);
   const last=Number(current.exists()?current.data().ultimo:0)||0;
   if(!Number.isSafeInteger(last)||last<0||last>=9999)throw Error('Correlativo mensual inválido o agotado.');
   const next=last+1,numeroActa=numberCode(p,cedula,next,cfg.id);
   const numberRef=doc(d,NUMBERS,numeroActa),numberSnap=await tx.get(numberRef);
   if(numberSnap.exists())throw Error('El número '+cfg.prefix+' ya está utilizado en el libro institucional.');
   const now=new Date().toISOString(),regDate=Dates.todayEcuador();
   const record={
    modalidad:cfg.id,periodoId,cedula,numeroActa,
    codigoDocumento:p.documentCode,fechaEmision:p.date,fechaRegistro:regDate,
    nombre:student.nombres,carrera:cleanCareer(student.carreraNombre),
    modalidadEstudios:studiesMode(student),
    requisitos:evidence.requirements,aprobaciones:evidence.approvals,
    comprobaciones:evidence.checks,verificadoEn:evidence.verifiedAt,
    version:'1.0',createdAt:now
   };
   tx.set(ref,record);
   tx.set(counter,{mesClave:p.month,ultimo:next,ultimaActa:numeroActa,updatedAt:now});
   tx.set(numberRef,{numeroActa,identidad:registryId(cfg,id),mesClave:p.month,consecutivo:next,periodoId,cedula,modalidad:cfg.id});
   return record;
  });
 }catch(error){return explain(error);}
 await Local.saveActa(baseDir,saved);
 return saved;
}
async function get(baseDir,periodoId,cedula,modalidad){
 identity(periodoId,cedula);
 return Local.getActa(baseDir,periodoId,cedula,modality(modalidad).id);
}
module.exports={openPeriod,refreshStudents,readEvidence,issue,recover,get,numberCode,identity,registryId,cleanCareer,studiesMode,modality,REGISTRY,COUNTERS,NUMBERS};
