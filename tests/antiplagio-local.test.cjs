'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Local=require('../electron/antiplagio-local.js');
const PERIOD='2025-10__2026-03',OTHER='2026-04__2026-09',CEDULA='0102030405';
const person=(p,c=CEDULA,name='Ana Pérez')=>({
  periodoId:p,estudianteId:p+'__'+c,cedula:c,nombres:name,carreraId:'C01',
  carreraNombre:'ADMINISTRACIÓN ONLINE',modalidad:'En línea',sede:'Matriz',jornada:'Nocturna',retirado:false
});
const memo=p=>({periodoId:p,cedula:CEDULA,estudianteId:p+'__'+CEDULA,nombres:'Ana Pérez',
 carreraNombre:'ADMINISTRACIÓN ONLINE',periodoNombre:'Octubre 2025 - Marzo 2026',
 similitud:'10.25',origen:'simulado',fecha:'2026-04-15',
 folio:'01 MEM-ITSQMET-UTET-2026-04-15',referencia:'UTET-ANT-2026-04-0001',
 fuentes:{google:'detected',institucional:'not-detected'},versionPlantilla:'2'});
(async()=>{
 // Un paquete sql.js ausente no debe causar un error durante el arranque de Electron.
 const code=require('node:fs').readFileSync(require.resolve('../electron/antiplagio-local.js'),'utf8');
 const moduleMock={exports:{}},vm=require('node:vm');
 let imports=0;
 vm.runInNewContext(code,{module:moduleMock,require:id=>{
  if(id==='sql.js'){imports++;const error=new Error("Cannot find module 'sql.js'");error.code='MODULE_NOT_FOUND';throw error;}
  return require(id);
 },process,Buffer,Date,Promise,console},{filename:'antiplagio-local.js'});
 assert.equal(imports,0,'SQLite solo debe cargarse al usar Antiplagio, nunca al abrir la app');
 await assert.rejects(()=>moduleMock.exports.snapshot(os.tmpdir(),PERIOD),/Falta instalar.*sql\.js.*npm install/);
 assert.equal(imports,1);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-local-first-'));
 try{
  const empty=await Local.snapshot(dir,PERIOD);
  assert.equal(empty.hasCache,false,'Sin primera carga, no hay caché');
  assert.equal(empty.students.length,0);
  await Local.replaceFromFirebase(dir,PERIOD,[person(PERIOD)],[memo(PERIOD)],'2026-11-07T11:00:00.000Z');
  let snap=await Local.snapshot(dir,PERIOD);
  assert.equal(snap.hasCache,true);
  assert.equal(snap.students.length,1);
  assert.equal(snap.students[0].cedula,CEDULA);
  assert.equal(snap.records.length,1);
  assert.equal(snap.records[0].folio,memo(PERIOD).folio);
  assert.equal(snap.records[0].syncStatus,'sincronizado');
  const filename=path.join(dir,'UTET',Local.NAME);
  assert.equal((await fs.readFile(filename)).subarray(0,15).toString('utf8'),'SQLite format 3');
  await Local.saveDraft(dir,{...snap.records[0],similitud:'13.50'});
  snap=await Local.snapshot(dir,PERIOD);
  assert.equal(snap.records[0].similitud,'13.50');
  assert.equal(snap.records[0].syncStatus,'pendiente');
  // Firebase cambia la ficha, pero nunca pisa una modificación local pendiente.
  await Local.replaceFromFirebase(dir,PERIOD,[person(PERIOD,CEDULA,'Ana Pérez Editada')],[memo(PERIOD)],'2026-11-08T11:00:00.000Z');
  snap=await Local.snapshot(dir,PERIOD);
  assert.equal(snap.students[0].nombres,'Ana Pérez Editada');
  assert.equal(snap.records[0].similitud,'13.50');
  assert.equal(snap.records[0].syncStatus,'pendiente');
  // Un error no puede vaciar el período ya guardado.
  await assert.rejects(()=>Local.replaceFromFirebase(dir,PERIOD,[person(PERIOD),person(PERIOD)],[],undefined),/duplicado/);
  assert.equal((await Local.snapshot(dir,PERIOD)).students[0].nombres,'Ana Pérez Editada');
  await Local.markSynced(dir,{...snap.records[0],similitud:'13.50'});
  assert.equal((await Local.snapshot(dir,PERIOD)).records[0].syncStatus,'sincronizado');
  // La eliminación remota solo borra registros locales SIN cambios.
  await Local.replaceFromFirebase(dir,PERIOD,[person(PERIOD)],[],undefined);
  assert.equal((await Local.snapshot(dir,PERIOD)).records.length,0);
  await Local.saveDraft(dir,memo(PERIOD));
  await Local.replaceFromFirebase(dir,PERIOD,[person(PERIOD)],null,undefined);
  assert.equal((await Local.snapshot(dir,PERIOD)).records.length,1,'No borrar memorandos cuando no se pudieron leer desde Firebase');
  await Local.replaceFromFirebase(dir,OTHER,[person(OTHER,'0102030406','Luis Pérez')],[],undefined);
  assert.equal((await Local.snapshot(dir,PERIOD)).students.length,1,'Períodos independientes');
  assert.equal((await Local.snapshot(dir,OTHER)).students[0].cedula,'0102030406');
  // Recarga en un nuevo módulo/proceso: los datos no dependen de RAM.
  delete require.cache[require.resolve('../electron/antiplagio-local.js')];
  const Reopened=require('../electron/antiplagio-local.js');
  const reloaded=await Reopened.snapshot(dir,PERIOD);
  assert.equal(reloaded.hasCache,true);
  assert.equal(reloaded.records.length,1);
  assert.equal(reloaded.syncedAt!==null,true);
  console.log('OK SQLite: primera carga, búsqueda local, reemplazo atómico, borradores y persistencia entre sesiones.');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
