'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Downloads=require('../electron/downloads.js');
(async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'utet-downloads-'));
 try{
  const input=Buffer.from('%PDF-1.7\nPRUEBA LOCAL');
  const a=await Downloads.saveUnique(folder,'MEM_UTET_123.pdf',input);
  const b=await Downloads.saveUnique(folder,'MEM_UTET_123.pdf',input);
  assert.equal(path.basename(a.filePath),'MEM_UTET_123.pdf');
  assert.equal(path.basename(b.filePath),'MEM_UTET_123 (1).pdf');
  assert.deepEqual(await fs.readFile(a.filePath),input);
  assert.deepEqual(await fs.readFile(b.filePath),input);
  const parallel=await Promise.all(Array.from({length:5},()=>
    Downloads.saveUnique(folder,'MEM_UTET_123.pdf',input)));
  assert.equal(new Set(parallel.map(x=>x.filePath)).size,5,'Las descargas simultáneas necesitan nombres distintos.');
  const zip=await Downloads.saveUnique(folder,'Memorandos_UTET.zip',Buffer.from('ZIP'));
  const zip2=await Downloads.saveUnique(folder,'Memorandos_UTET.zip',Buffer.from('ZIP'));
  assert.equal(zip.name,'Memorandos_UTET.zip');
  assert.equal(zip2.name,'Memorandos_UTET (1).zip');
  for(const invalid of ['../x.pdf','C:\\x.pdf','CON.pdf','x.txt','x/abc.pdf']){
   await assert.rejects(()=>Downloads.saveUnique(folder,invalid,input),/inválido|reservado/);
  }
  await assert.rejects(()=>Downloads.saveUnique(folder,'archivo.pdf',Buffer.alloc(0)),/vacío/);
  console.log('OK Descargas: PDF/ZIP sin diálogo, nombres únicos y nunca sobrescribir.');
 }finally{await fs.rm(folder,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1;});
