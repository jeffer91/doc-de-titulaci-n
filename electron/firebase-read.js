'use strict';
/* UTET PRO-164. Consulta de SOLO LECTURA al proyecto Firebase utilizado por Requisitos.
   No replica matrículas, no modifica Firestore y no almacena credenciales en disco. */
const PROJECT = 'utet-4387a';
const API_KEY = 'AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA'; // Clave web pública (no es contraseña).
const ORIGIN = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY;
let session = null;
const str = v => String(v == null ? '' : v).trim();
const validPeriod = p => /^\d{4}-\d{2}__\d{4}-\d{2}$/.test(str(p));
const validId = v => /^[0-9A-Za-z]{6,20}$/.test(str(v));

async function request(url, options = {}) {
  const headers = {'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json'} : {})};
  if (session?.idToken && session.expiresAt > Date.now() + 60000) headers.Authorization = 'Bearer ' + session.idToken;
  const response = await fetch(url, {
    ...options, headers: {...headers, ...(options.headers || {})},
    signal: AbortSignal.timeout(25000)
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error('Firebase devolvió una respuesta no válida.'); }
  if (!response.ok) {
    const reason = str(data.error?.message || response.statusText);
    if (response.status === 401 || response.status === 403)
      throw new Error('Firebase rechazó la lectura (' + response.status + '). Comprueba las reglas de acceso o inicia sesión. ' + reason);
    throw new Error('No se pudo consultar Firebase: ' + reason.slice(0, 220));
  }
  return data;
}
function field(f) {
  if (!f || 'nullValue' in f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return Number(f.doubleValue);
  if ('booleanValue' in f) return f.booleanValue;
  if ('timestampValue' in f) return f.timestampValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(field);
  if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k,v]) => [k,field(v)]));
  return null;
}
function documentValue(item) {
  const data = Object.fromEntries(Object.entries(item?.fields || {}).map(([k,v]) => [k,field(v)]));
  data._firebaseDocumentId = str(item?.name).split('/').pop();
  return data;
}
function first(obj, names) {
  for (const name of names) {
    const value = str(obj?.[name]);
    if (value && value !== '[object Object]') return value;
  }
  return '';
}
function nameOf(person, matricula) {
  const given = first(person,['nombres','Nombres','nombre','Nombre','firstName']);
  const surname = first(person,['apellidos','Apellidos','apellido','Apellido','lastName']);
  if (given && surname) return (surname + ' ' + given).replace(/\s+/g,' ').trim();
  return first(person,['nombreCompleto','nombresCompletos','nombre_completo','estudiante','apellidosNombres'])
    || first(matricula,['nombreCompleto','estudiante','nombreEstudiante','nombres'])
    || (surname || given);
}
async function readMatriculas(periodoId) {
  const rows = [];
  // Firestore runQuery filtra por período en servidor. Las páginas se limitan
  // deliberadamente para evitar lecturas indiscriminadas de otros períodos.
  for (let offset = 0; offset <= 5000; offset += 250) {
    const result = await request(ORIGIN + ':runQuery?key=' + API_KEY, {
      method:'POST', body:JSON.stringify({structuredQuery:{
        from:[{collectionId:'matriculas'}],
        where:{fieldFilter:{field:{fieldPath:'periodoId'},op:'EQUAL',value:{stringValue:periodoId}}},
        limit:250, offset
      }})
    });
    if (!Array.isArray(result)) throw new Error('La consulta de matrículas no devolvió una lista.');
    const page = result.filter(v => v.document).map(v => documentValue(v.document));
    rows.push(...page);
    if (page.length < 250) break;
    if (offset >= 5000) throw new Error('El período supera el máximo seguro de matrículas por consulta.');
  }
  return rows;
}
async function readPeople(ids) {
  const people = new Map();
  for (let i = 0; i < ids.length; i += 60) {
    const names = ids.slice(i,i+60).map(id => ORIGIN + '/Estudiante/' + encodeURIComponent(id));
    const result = await request(ORIGIN + ':batchGet?key=' + API_KEY,{
      method:'POST',body:JSON.stringify({documents:names})
    });
    if (!Array.isArray(result)) throw new Error('Respuesta de estudiantes no válida.');
    for (const response of result) {
      if (!response.found) continue;
      const student = documentValue(response.found);
      people.set(str(student.cedula || student._firebaseDocumentId),student);
    }
  }
  return people;
}
async function loadStudents(periodoId) {
  if (!validPeriod(periodoId)) throw new Error('El período seleccionado no tiene un identificador válido.');
  const enrollments = await readMatriculas(periodoId);
  const ids = [...new Set(enrollments.map(m => first(m,['cedula','identificacion','numeroIdentificacion'])).filter(validId))];
  const people = await readPeople(ids);
  const result = new Map();
  for (const matricula of enrollments) {
    const cedula = first(matricula,['cedula','identificacion','numeroIdentificacion']);
    if (!validId(cedula) || str(matricula.periodoId) !== periodoId || matricula.eliminado === true) continue;
    const person = people.get(cedula) || {};
    const estudiante = {
      estudianteId: periodoId + '__' + cedula, cedula, periodoId,
      nombres: nameOf(person, matricula),
      carreraId: first(matricula,['codigoCarrera','carreraId','codigoCarreraActual']),
      carreraNombre: first(matricula,['nombreCarrera','carrera','carreraNombre'])
        || first(person,['nombreCarreraActual','nombreCarrera']),
      retirado: matricula.retirado === true || /retirad/i.test(str(matricula.estadoMatricula))
    };
    if (!result.has(cedula)) result.set(cedula,estudiante);
  }
  return {periodoId,students:[...result.values()].sort((a,b)=>a.nombres.localeCompare(b.nombres,'es')),
    totalMatriculas:enrollments.length, source:'Firebase · Estudiante + matriculas',
    readAt:new Date().toISOString(), authenticated:!!session && session.expiresAt > Date.now()};
}
async function signIn(email, password) {
  if (!str(email) || typeof password !== 'string' || !password)
    throw new Error('Ingresa correo y contraseña de Firebase Authentication.');
  const info = await request(AUTH_URL,{method:'POST',body:JSON.stringify({
    email:str(email),password,returnSecureToken:true
  })});
  if (!info.idToken) throw new Error('Firebase no devolvió una sesión válida.');
  session = {idToken:info.idToken,email:str(info.email || email),
    expiresAt:Date.now() + Math.max(60,Number(info.expiresIn || 3600))*1000};
  return status();
}
function status() {
  if (session && session.expiresAt <= Date.now()) session = null;
  return {projectId:PROJECT,authenticated:!!session,email:session?.email || '',
    mode:'Solo lectura; sin escrituras ni sincronización de matrículas'};
}
function signOut() {session = null;return status();}
module.exports = {loadStudents,signIn,signOut,status,validPeriod,field,documentValue,nameOf};
