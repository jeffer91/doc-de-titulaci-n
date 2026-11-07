'use strict';
/* PRO-164 - Base de datos SQLite local. No almacena archivos PDF.
 * sql.js evita módulos nativos incompatibles con Electron.
 * Escrituras: serializadas, transaccionales, copia temporal y renombrado atómico.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
// Cargar SQLite bajo demanda: una dependencia no instalada no debe impedir
// abrir Inicio, Documentos u otras pantallas de la aplicación.
let initSqlJs;
function sqliteEngine(){
 if(!initSqlJs){
  try { initSqlJs=require('sql.js'); }
  catch(error){
   if(error?.code==='MODULE_NOT_FOUND' && /Cannot find module ['"]sql\.js['"]/.test(String(error.message))){
    throw new Error('Falta instalar la base local SQLite (sql.js). En la carpeta de UTET ejecuta: npm install; después vuelve a abrir la aplicación.');
   }
   throw error;
  }
 }
 return initSqlJs;
}
const NAME='utet-antiplagio.sqlite';
const MAX_ROWS=5000;
let instance=null;
let chain=Promise.resolve();
const str=x=>String(x==null?'':x);
const validPeriod=x=>/^\d{4}-(0[1-9]|1[0-2])__\d{4}-(0[1-9]|1[0-2])$/.test(str(x));
const validCedula=x=>/^[0-9A-Za-z]{6,20}$/.test(str(x));
const key=(p,c)=>{if(!validPeriod(p)||!validCedula(c))throw Error('Período o cédula inválidos.');return [p,str(c)];};
const iso=()=>new Date().toISOString();
const tableFor=tipo=>{if(tipo!=='trabajo'&&tipo!=='articulo')throw Error('Tipo documental inválido.');return tipo==='articulo'?'memorandos_articulo':'memorandos';};
const prepared=(db,sql,values=[])=>{const st=db.prepare(sql);try{st.bind(values);const rows=[];while(st.step())rows.push(st.getAsObject());return rows;}finally{st.free();}};
const one=(db,sql,values=[])=>prepared(db,sql,values)[0]||null;
function schema(db){
 db.run('PRAGMA foreign_keys=ON');
 db.run('CREATE TABLE IF NOT EXISTS periodos_sync(periodo_id TEXT PRIMARY KEY, sincronizado_en TEXT NOT NULL, estudiantes INTEGER NOT NULL, memorandos INTEGER NOT NULL)');
 db.run('CREATE TABLE IF NOT EXISTS estudiantes(periodo_id TEXT NOT NULL, cedula TEXT NOT NULL, estudiante_id TEXT NOT NULL, nombres TEXT NOT NULL, carrera_id TEXT NOT NULL, carrera_nombre TEXT NOT NULL, modalidad TEXT NOT NULL, sede TEXT NOT NULL, jornada TEXT NOT NULL, retirado INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(periodo_id,cedula))');
 db.run('CREATE INDEX IF NOT EXISTS idx_estudiantes_periodo_carrera ON estudiantes(periodo_id,carrera_nombre)');
 db.run('CREATE INDEX IF NOT EXISTS idx_estudiantes_periodo_nombre ON estudiantes(periodo_id,nombres)');
 db.run("CREATE TABLE IF NOT EXISTS memorandos(periodo_id TEXT NOT NULL, cedula TEXT NOT NULL, documento TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('sincronizado','pendiente')), actualizado_en TEXT NOT NULL, PRIMARY KEY(periodo_id,cedula))");
 db.run('CREATE INDEX IF NOT EXISTS idx_memorandos_periodo ON memorandos(periodo_id)');
 db.run("CREATE TABLE IF NOT EXISTS memorandos_articulo(periodo_id TEXT NOT NULL, cedula TEXT NOT NULL, documento TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('sincronizado','pendiente')), actualizado_en TEXT NOT NULL, PRIMARY KEY(periodo_id,cedula))");
 db.run('CREATE INDEX IF NOT EXISTS idx_memorandos_articulo_periodo ON memorandos_articulo(periodo_id)');
 db.run('CREATE TABLE IF NOT EXISTS articulos_sync(periodo_id TEXT PRIMARY KEY, sincronizado_en TEXT NOT NULL)');
 db.run('CREATE TABLE IF NOT EXISTS actas_articulo(periodo_id TEXT NOT NULL, cedula TEXT NOT NULL, documento TEXT NOT NULL, actualizado_en TEXT NOT NULL, PRIMARY KEY(periodo_id,cedula))');
 db.run('CREATE INDEX IF NOT EXISTS idx_actas_articulo_periodo ON actas_articulo(periodo_id)');
 db.run('CREATE TABLE IF NOT EXISTS actas_articulo_evidencia(periodo_id TEXT NOT NULL, cedula TEXT NOT NULL, documento TEXT NOT NULL, actualizado_en TEXT NOT NULL, PRIMARY KEY(periodo_id,cedula))');
 db.run('PRAGMA user_version=3');
}
async function open(baseDir){
 if(typeof baseDir!=='string'||!baseDir.trim())throw Error('Directorio local inválido.');
 if(instance?.baseDir===baseDir)return instance;
 const SQL=await sqliteEngine()({locateFile:file=>require.resolve('sql.js/dist/'+file)});
 const folder=path.join(baseDir,'UTET');
 await fs.mkdir(folder,{recursive:true,mode:0o700});
 const filename=path.join(folder,NAME);
 let bytes=null;
 try{bytes=await fs.readFile(filename);}catch(e){if(e.code!=='ENOENT')throw e;}
 let db;
 try{db=bytes?new SQL.Database(new Uint8Array(bytes)):new SQL.Database();schema(db);}
 catch(e){throw Error('La base local de Antiplagio está dañada; no se reemplazará: '+e.message);}
 instance={SQL,db,baseDir,filename,folder};
 return instance;
}
async function persist(ctx){
 const tmp=ctx.filename+'.'+process.pid+'.tmp';
 await fs.rm(tmp,{force:true});
 try{
  await fs.writeFile(tmp,Buffer.from(ctx.db.export()),{mode:0o600,flag:'wx'});
  await fs.rename(tmp,ctx.filename);
 }finally{await fs.rm(tmp,{force:true}).catch(()=>{});}
}
function serialized(work){
 const next=chain.then(work,work);chain=next.catch(()=>{});return next;
}
async function write(baseDir,action){
 return serialized(async()=>{
  const ctx=await open(baseDir),backup=ctx.db.export();
  try{
   ctx.db.run('BEGIN TRANSACTION');
   const output=action(ctx.db);
   ctx.db.run('COMMIT');
   await persist(ctx);
   return output;
  }catch(e){
   try{ctx.db.close();}catch{}
   ctx.db=new ctx.SQL.Database(backup);
   schema(ctx.db);
   throw e;
  }
 });
}
async function snapshot(baseDir,periodoId,modo='trabajo'){
 const table=tableFor(modo);
 if(!validPeriod(periodoId))throw Error('Período inválido.');
 // Serializa también las lecturas: ninguna ve una transacción parcialmente aplicada.
 return serialized(async()=>{
 const ctx=await open(baseDir),db=ctx.db;
 const meta=one(db,'SELECT sincronizado_en AS sincronizadoEn,estudiantes,memorandos FROM periodos_sync WHERE periodo_id=?',[periodoId]);
 const articleMeta=modo==='articulo'?one(db,'SELECT sincronizado_en AS sincronizadoEn FROM articulos_sync WHERE periodo_id=?',[periodoId]):null;
 const students=prepared(db,'SELECT estudiante_id AS estudianteId,periodo_id AS periodoId,cedula,nombres,carrera_id AS carreraId,carrera_nombre AS carreraNombre,modalidad,sede,jornada,retirado FROM estudiantes WHERE periodo_id=? ORDER BY nombres COLLATE NOCASE',[periodoId]).map(s=>({...s,retirado:!!s.retirado}));
 const records=prepared(db,`SELECT cedula,documento,estado FROM ${table} WHERE periodo_id=?`,[periodoId]).map(x=>({...JSON.parse(x.documento),tipoDocumento:modo,cedula:x.cedula,syncStatus:x.estado}));
 return {periodoId,tipoDocumento:modo,hasCache:!!meta&&(modo==='trabajo'||!!articleMeta),hasStudentCache:!!meta,syncedAt:(articleMeta||meta)?.sincronizadoEn||null,students,records,source:'SQLite local'};
 });
}
function checkStudents(periodoId,students){
 if(!Array.isArray(students)||students.length>MAX_ROWS)throw Error('Listado Firebase fuera de límites.');
 const ids=new Set();
 return students.map(s=>{
  if(!s||s.periodoId!==periodoId||!validCedula(s.cedula)||s.estudianteId!==periodoId+'__'+s.cedula||ids.has(s.cedula))
   throw Error('Identificación o duplicado de matrícula inválido.');
  ids.add(s.cedula);
  const t=k=>str(s[k]).slice(0,250);
  return {periodoId,cedula:t('cedula'),estudianteId:t('estudianteId'),nombres:t('nombres'),carreraId:t('carreraId'),carreraNombre:t('carreraNombre'),
   modalidad:t('modalidad'),sede:t('sede'),jornada:t('jornada'),retirado:s.retirado===true};
 });
}
async function replaceFromFirebase(baseDir,periodoId,students,records,time=iso(),modo='trabajo'){
 const table=tableFor(modo);
 if(!validPeriod(periodoId)||(records!==null&&(!Array.isArray(records)||records.length>MAX_ROWS)))throw Error('Sincronización inválida.');
 const valid=students===null?null:checkStudents(periodoId,students);
 const remote=[];
 for(const r of records||[]){
  if(r.periodoId!==periodoId||!validCedula(r.cedula)||(r.tipoDocumento||'trabajo')!==modo)throw Error('Memorando remoto fuera del período o tipo documental.');
  remote.push({...r,syncStatus:undefined});
 }
 const result=await write(baseDir,db=>{
  if(valid!==null){
   db.run('DELETE FROM estudiantes WHERE periodo_id=?',[periodoId]);
   const insert=db.prepare('INSERT INTO estudiantes(periodo_id,cedula,estudiante_id,nombres,carrera_id,carrera_nombre,modalidad,sede,jornada,retirado) VALUES(?,?,?,?,?,?,?,?,?,?)');
   try{for(const s of valid)insert.run([periodoId,s.cedula,s.estudianteId,s.nombres,s.carreraId,s.carreraNombre,s.modalidad,s.sede,s.jornada,s.retirado?1:0]);}
   finally{insert.free();}
  }
  // Sincronización no sobrescribe borradores locales no publicados.
  if(records!==null){
  const upsert=db.prepare(`INSERT INTO ${table}(periodo_id,cedula,documento,estado,actualizado_en) VALUES(?,?,?,'sincronizado',?) ON CONFLICT(periodo_id,cedula) DO UPDATE SET documento=excluded.documento, estado=excluded.estado, actualizado_en=excluded.actualizado_en WHERE ${table}.estado='sincronizado'`);
  const stamp=iso();
  try{for(const r of remote)upsert.run([periodoId,r.cedula,JSON.stringify(r),stamp]);}finally{upsert.free();}
  const remoteIds=new Set(remote.map(r=>r.cedula));
  // Limpiar registros remotos eliminados solo si no hay edición pendiente.
  const old=prepared(db,`SELECT cedula FROM ${table} WHERE periodo_id=? AND estado='sincronizado'`,[periodoId]);
  const remove=db.prepare(`DELETE FROM ${table} WHERE periodo_id=? AND cedula=? AND estado='sincronizado'`);
  try{for(const r of old)if(!remoteIds.has(r.cedula))remove.run([periodoId,r.cedula]);}finally{remove.free();}
   if(modo==='articulo')db.run('INSERT INTO articulos_sync(periodo_id,sincronizado_en) VALUES(?,?) ON CONFLICT(periodo_id) DO UPDATE SET sincronizado_en=excluded.sincronizado_en',[periodoId,time]);
  }
  if(valid!==null)db.run('INSERT INTO periodos_sync(periodo_id,sincronizado_en,estudiantes,memorandos) VALUES(?,?,?,?) ON CONFLICT(periodo_id) DO UPDATE SET sincronizado_en=excluded.sincronizado_en,estudiantes=excluded.estudiantes,memorandos=excluded.memorandos',[periodoId,time,valid.length,modo==='trabajo'?(records===null?-1:remote.length):0]);
  return {students:valid===null?null:valid.length,records:records===null?null:remote.length};
 });
 return result;
}
async function saveDraft(baseDir,record){
 if(!record||typeof record!=='object')throw Error('Registro local inválido.');
 const [p,c]=key(record.periodoId,record.cedula),table=tableFor(record.tipoDocumento||'trabajo');
 if(record.estudianteId!==p+'__'+c)throw Error('Identidad incompatible con período.');
 const copy=JSON.parse(JSON.stringify(record));
 delete copy.syncStatus;
 if(JSON.stringify(copy).length>20000)throw Error('El registro excede el tamaño permitido.');
 await write(baseDir,db=>{
  const prev=one(db,`SELECT documento FROM ${table} WHERE periodo_id=? AND cedula=?`,[p,c]);
  // No permitir cambiar inadvertidamente folio/fecha de un documento oficial.
  if(prev){
   const existing=JSON.parse(prev.documento);
   if(existing.folio){copy.folio=existing.folio;copy.referencia=existing.referencia;copy.fecha=existing.fecha;}
  }
  db.run(`INSERT INTO ${table}(periodo_id,cedula,documento,estado,actualizado_en) VALUES(?,?,?,'pendiente',?) ON CONFLICT(periodo_id,cedula) DO UPDATE SET documento=excluded.documento,estado='pendiente',actualizado_en=excluded.actualizado_en`,[p,c,JSON.stringify(copy),iso()]);
 });
 return {saved:true,pending:true};
}
async function markSynced(baseDir,record){
 const [p,c]=key(record.periodoId,record.cedula),table=tableFor(record.tipoDocumento||'trabajo');
 const copy=JSON.parse(JSON.stringify(record));copy.syncStatus=undefined;
 await write(baseDir,db=>{
  db.run(`INSERT INTO ${table}(periodo_id,cedula,documento,estado,actualizado_en) VALUES(?,?,?,'sincronizado',?) ON CONFLICT(periodo_id,cedula) DO UPDATE SET documento=excluded.documento,estado='sincronizado',actualizado_en=excluded.actualizado_en`,[p,c,JSON.stringify(copy),iso()]);
 });
}
function verifyActaIdentity(periodoId,cedula){
 key(periodoId,cedula);
 if(!/^\\d{10}$/.test(cedula))throw Error('Cédula de diez dígitos requerida para el acta.');
}
async function loadActas(baseDir,periodoId){
 if(!validPeriod(periodoId))throw Error('Período de actas inválido.');
 return serialized(async()=>{
  const {db}=await open(baseDir);
  return prepared(db,'SELECT documento FROM actas_articulo WHERE periodo_id=?',[periodoId]).map(x=>JSON.parse(x.documento));
 });
}
async function getActa(baseDir,periodoId,cedula){
 verifyActaIdentity(periodoId,cedula);
 return serialized(async()=>{
  const {db}=await open(baseDir);
  const x=one(db,'SELECT documento FROM actas_articulo WHERE periodo_id=? AND cedula=?',[periodoId,cedula]);
  return x?JSON.parse(x.documento):null;
 });
}
async function saveActa(baseDir,record){
 if(!record||!/^AA-\\d{4}-\\d{4}-(0[1-9]|1[0-2])-\\d{4}$/.test(String(record.numeroActa||'')))
  throw Error('Número oficial AA inválido.');
 verifyActaIdentity(record.periodoId,record.cedula);
 const json=JSON.stringify(record);
 if(json.length>20000)throw Error('El acta excede el límite local.');
 return write(baseDir,db=>{
  const old=one(db,'SELECT documento FROM actas_articulo WHERE periodo_id=? AND cedula=?',[record.periodoId,record.cedula]);
  if(old&&JSON.parse(old.documento).numeroActa!==record.numeroActa)throw Error('El acta ya tiene otro número registrado.');
  db.run('INSERT INTO actas_articulo(periodo_id,cedula,documento,actualizado_en) VALUES(?,?,?,?) ON CONFLICT(periodo_id,cedula) DO UPDATE SET documento=excluded.documento,actualizado_en=excluded.actualizado_en',
   [record.periodoId,record.cedula,json,iso()]);
  return record;
 });
}
async function listActaEvidences(baseDir,periodoId){
 if(!validPeriod(periodoId))throw Error('Período inválido.');
 return serialized(async()=>{
  const {db}=await open(baseDir);
  return prepared(db,'SELECT cedula,documento FROM actas_articulo_evidencia WHERE periodo_id=?',[periodoId])
   .map(row=>({...JSON.parse(row.documento),cedula:row.cedula}));
 });
}
async function getActaEvidence(baseDir,periodoId,cedula){
 verifyActaIdentity(periodoId,cedula);
 return serialized(async()=>{
  const {db}=await open(baseDir);
  const x=one(db,'SELECT documento FROM actas_articulo_evidencia WHERE periodo_id=? AND cedula=?',[periodoId,cedula]);
  return x?JSON.parse(x.documento):null;
 });
}
async function saveActaEvidence(baseDir,periodoId,cedula,evidence){
 verifyActaIdentity(periodoId,cedula);
 const json=JSON.stringify(evidence);
 if(json.length>20000)throw Error('La verificación excede el límite local.');
 return write(baseDir,db=>{
  db.run('INSERT INTO actas_articulo_evidencia(periodo_id,cedula,documento,actualizado_en) VALUES(?,?,?,?) ON CONFLICT(periodo_id,cedula) DO UPDATE SET documento=excluded.documento,actualizado_en=excluded.actualizado_en',
  [periodoId,cedula,json,iso()]);
  return evidence;
 });
}
module.exports={open,snapshot,replaceFromFirebase,saveDraft,markSynced,validPeriod,checkStudents,tableFor,NAME,
 loadActas,getActa,saveActa,listActaEvidences,getActaEvidence,saveActaEvidence};
