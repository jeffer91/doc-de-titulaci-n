'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Memo=require('../electron/memo-numbering.js');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'utet-memo-number-test-'));
  try{
    assert.equal(Memo.TITLE,'MEM-ITSQMET-UTET');
    assert.equal(Memo.format(1,'2023-06-01'),'01 MEM-ITSQMET-UTET-2023-06-01');
    assert.equal(Memo.format(2,'2023-06-01'),'02 MEM-ITSQMET-UTET-2023-06-01');
    assert.equal(Memo.format(100,'2023-06-01'),'100 MEM-ITSQMET-UTET-2023-06-01');
    assert.equal(Memo.parse('01 MEM-ITSQMET-UTET-2023-06-01').number,1);
    assert.equal(Memo.parse('01 MEM-ITSQMET-UEAI-2023-06-01'),null);
    assert.equal(Memo.parse('01 MEM-ITSQMET-UTET-2023-02-31'),null);
    assert.equal(Memo.parse('1 MEM-ITSQMET-UTET-2023-06-01'),null);
    assert.equal(Memo.dateValid('2024-02-29'),true);
    assert.equal(Memo.dateValid('2023-02-29'),false);
    assert.equal(Memo.dateValid('2026-13-01'),false);
    assert.equal(Memo.dateValid('2026-11-00'),false);
    await assert.rejects(()=>Memo.next(dir,'2026-11-31'),/Fecha/);
    const preview=await Memo.next(dir,'2026-11-07');
    assert.equal(preview.number,1);
    assert.equal(preview.isProvisional,true);
    // Consultas y cancelaciones NO consumen secuencia.
    assert.equal((await Memo.next(dir,'2026-11-08')).number,1);
    const nov1=await Memo.reserve(dir,'2026-11-07');
    assert.equal(nov1.code,'01 MEM-ITSQMET-UTET-2026-11-07');
    assert.equal((await Memo.next(dir,'2026-11-07')).number,2);
    const nov2=await Memo.reserve(dir,'2026-11-08');
    assert.equal(nov2.code,'02 MEM-ITSQMET-UTET-2026-11-08');
    assert.equal((await Memo.next(dir,'2026-11-20')).number,3);
    // Mismo mes y distinto día: NO reinicia.
    assert.equal((await Memo.reserve(dir,'2026-11-30')).code,'03 MEM-ITSQMET-UTET-2026-11-30');
    // Mes nuevo: comienza en 01, sin borrar registros previos.
    assert.equal((await Memo.next(dir,'2026-12-01')).number,1);
    assert.equal((await Memo.reserve(dir,'2026-12-01')).code,'01 MEM-ITSQMET-UTET-2026-12-01');
    assert.equal((await Memo.next(dir,'2026-11-15')).number,4);
    // Nuevo año: otro contador.
    assert.equal((await Memo.reserve(dir,'2027-01-01')).number,1);
    // Concurrencia de llamadas dentro del mismo proceso: nunca reutilizar un número.
    const batch=await Promise.all(Array.from({length:15},()=>Memo.reserve(dir,'2026-11-29')));
    assert.deepEqual(batch.map(x=>x.number),Array.from({length:15},(_,i)=>i+4));
    const saved=JSON.parse(await fs.readFile(path.join(dir,Memo.FILE),'utf8'));
    assert.equal(saved.months['2026-11'].last,18);
    assert.equal(saved.months['2026-12'].last,1);
    assert.equal(saved.months['2027-01'].last,1);
    assert.equal((await Memo.next(dir,'2026-11-07')).number,19);
    assert.equal(saved.months['2023-06'],undefined);
    // Almacén incompatible: prohibido reiniciar silenciosamente en 01.
    await fs.writeFile(path.join(dir,Memo.FILE),'{invalid','utf8');
    await assert.rejects(()=>Memo.next(dir,'2026-11-07'));
    await assert.rejects(()=>Memo.reserve(dir,'2026-11-07'));
    console.log('OK memorandos: formato XX UTET, persistencia mensual, reinicio y concurrencia local.');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
