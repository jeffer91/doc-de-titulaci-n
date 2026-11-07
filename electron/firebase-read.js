'use strict';
/* PRO-164 | Lector EXCLUSIVAMENTE de Firestore (sin escrituras).
 * Equivalente funcional a Requisitos/BDLocal/firebase:
 * matriculas(periodoId) -> Estudiante(cedula).
 * Utiliza el SDK oficial Firestore Lite para evitar REST runQuery/batchGet
 * construido a mano (causa de fallos 400 sin detalles en versiones previas).
 * No usa Admin SDK, credenciales de servicio, autenticación ni cache local.
 */
const FIREBASE_CONFIG = Object.freeze({
  apiKey:'AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA',
  authDomain:'utet-4387a.firebaseapp.com',
  projectId:'utet-4387a',
  storageBucket:'utet-4387a.firebasestorage.app',
  messagingSenderId:'902848131454',
  appId:'1:902848131454:web:47f515eb6480834724c32f'
});
const APP_NAME='utet-doc-titulacion-lectura';
const MAX_STUDENTS=5000;
const PERSON_CONCURRENCY=12;
let sdkInstance=null;

const str = value => String(value==null?'':value).trim();
const validPeriod = periodoId => /^\d{4}-(0[1-9]|1[0-2])__\d{4}-(0[1-9]|1[0-2])$/.test(str(periodoId));
const validId = value => /^[0-9A-Za-z]{6,20}$/.test(str(value));
const safeMessage = value => str(value).replace(/key=[^\s&]+/gi,'key=[protegida]').slice(0,320);

function first(object,keys){
  for(const name of keys){
    const value=str(object?.[name]);
    if(value && value!=='[object Object]') return value;
  }
  return '';
}
function nameOf(person,enrolment){
  const names=first(person,['nombres','Nombres','nombre','Nombre','firstName']);
  const surname=first(person,['apellidos','Apellidos','apellido','Apellido','lastName']);
  if(names&&surname)return (surname+' '+names).replace(/\s+/g,' ').trim();
  return first(person,['nombreCompleto','nombresCompletos','nombre_completo','estudiante','apellidosNombres'])
    ||names||surname
    ||first(enrolment,['nombreCompleto','nombreEstudiante','estudiante','nombres']);
}
function fromSDK(){
  if(sdkInstance)return sdkInstance;
  // Dependencia npm, ejecutada únicamente en el proceso principal de Electron.
  const appSDK=require('firebase/app');
  const api=require('firebase/firestore/lite');
  const existing=appSDK.getApps().find(app=>app.name===APP_NAME);
  const app=existing||appSDK.initializeApp(FIREBASE_CONFIG,APP_NAME);
  sdkInstance={db:api.getFirestore(app),api};
  return sdkInstance;
}
function explain(error,step){
  const code=str(error?.code)||'desconocido';
  const detail=safeMessage(error?.message)||'Sin detalle del servicio.';
  const prefix='Firebase ['+code+'] · '+step+': ';
  let hint='';
  if(/permission-denied|unauthenticated|403/i.test(code+' '+detail))
    hint=' Las reglas de Firestore no permiten esta lectura sin sesión.';
  else if(/failed-precondition|index/i.test(code+' '+detail))
    hint=' Comprueba los índices requeridos en Firestore.';
  else if(/invalid-argument|400/i.test(code+' '+detail))
    hint=' Firestore rechazó la consulta; revisa el código de error y el período.';
  else if(/unavailable|deadline-exceeded|network|offline/i.test(code+' '+detail))
    hint=' Comprueba la red y vuelve a pulsar Actualizar.';
  const output=new Error(prefix+detail+hint);
  output.code=code;
  output.step=step;
  return output;
}
function createReader(provider=fromSDK){
  const client=()=>typeof provider==='function'?provider():provider;

  async function readMatriculas(periodoId){
    const {db,api}=client();
    // Igual que Requisitos: se consulta sólo el periodoId solicitado.
    // No se hace una lectura global de toda la base ni de otros períodos.
    let snapshot;
    try{
      const query=api.query(
        api.collection(db,'matriculas'),
        api.where('periodoId','==',periodoId),
        api.limit(MAX_STUDENTS+1)
      );
      snapshot=await api.getDocs(query);
    }catch(error){throw explain(error,'matriculas');}
    if(!Array.isArray(snapshot?.docs))
      throw new Error('Firebase devolvió un listado de matrículas no válido.');
    if(snapshot.docs.length>MAX_STUDENTS)
      throw new Error('El período supera el máximo seguro de '+MAX_STUDENTS+' matrículas.');
    return snapshot.docs.map(record=>({...record.data(),_firebaseDocumentId:record.id}))
      .filter(row=>row.eliminado!==true && str(row.periodoId)===periodoId);
  }
  async function readPeople(ids){
    const {db,api}=client();
    const people=new Map();
    for(let i=0;i<ids.length;i+=PERSON_CONCURRENCY){
      const chunk=ids.slice(i,i+PERSON_CONCURRENCY);
      let docs;
      try{
        docs=await Promise.all(chunk.map(cedula=>
          api.getDoc(api.doc(db,'Estudiante',cedula))));
      }catch(error){throw explain(error,'Estudiante');}
      docs.forEach((snapshot,j)=>{
        if(!snapshot?.exists())return;
        const student=snapshot.data()||{};
        people.set(chunk[j],student);
      });
    }
    return people;
  }
  async function loadStudents(periodoId){
    if(!validPeriod(periodoId))
      throw new Error('El identificador del período es inválido.');
    const enrollments=await readMatriculas(periodoId);
    const ids=[...new Set(enrollments.map(row=>first(row,
      ['cedula','identificacion','numeroIdentificacion'])).filter(validId))];
    const people=await readPeople(ids);
    const selected=new Map();
    for(const row of enrollments){
      const cedula=first(row,['cedula','identificacion','numeroIdentificacion']);
      if(!validId(cedula)||str(row.periodoId)!==periodoId)continue;
      const person=people.get(cedula)||{};
      const estudiante={
        estudianteId:periodoId+'__'+cedula,
        cedula,periodoId,
        nombres:nameOf(person,row),
        carreraId:first(row,['codigoCarrera','carreraId','codigoCarreraActual']),
        carreraNombre:first(row,['nombreCarrera','carreraNombre','carrera'])
          || first(person,['nombreCarreraActual','nombreCarrera']),
        modalidad:first(row,['modalidadEstudios','modalidad','tipoModalidad','modalidadEstudio'])||first(person,['modalidadEstudios','modalidad']),
        sede:first(row,['sede','nombreSede','campus'])||first(person,['sede','nombreSede']),
        jornada:first(row,['jornada','nombreJornada','horario'])||first(person,['jornada']),
        retirado:row.retirado===true||/retirad/i.test(str(row.estadoMatricula))
      };
      // Si existe más de una matrícula para una cédula en el mismo período,
      // mantener una sola identidad sin fabricar estudiantes.
      if(!selected.has(cedula))selected.set(cedula,estudiante);
    }
    return {
      periodoId,students:[...selected.values()].sort((a,b)=>a.nombres.localeCompare(b.nombres,'es')),
      totalMatriculas:enrollments.length,
      sinFicha:[...selected.values()].filter(s=>!s.nombres).length,
      source:'Firebase · Firestore Lite · matriculas + Estudiante',
      readAt:new Date().toISOString(),
      access:'lectura-directa-sin-sesion'
    };
  }
  return {loadStudents,readMatriculas,readPeople};
}
function status(){
  const {db}=fromSDK();
  return {projectId:FIREBASE_CONFIG.projectId,initialized:!!db,
    mode:'Firestore Lite · lectura directa bajo reglas desplegadas; sin autenticación ni escrituras'};
}
const reader=createReader();
module.exports={loadStudents:reader.loadStudents,status,createReader,validPeriod,validId,nameOf,first,explain};
