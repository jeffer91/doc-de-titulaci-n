'use strict';
// Guardado directo de documentos generados en Descargas, sin diálogos ni sobrescritura.
// Compartido por los PDF individuales y el ZIP de memorandos UTET.
const fs=require('node:fs/promises');
const path=require('node:path');

function validateName(name,extension){
 if(!['pdf','zip'].includes(extension))throw Error('Extensión de descarga no permitida.');
 if(typeof name!=='string'||name.length>120||
    !/^[\p{L}\p{N}_ .()\-]+$/u.test(name)||
    name.includes('..')||name.startsWith('.')||name.endsWith(' ')||
    !name.toLowerCase().endsWith('.'+extension))
  throw Error('Nombre de archivo de descarga inválido.');
 // Evitar nombres reservados de Windows (CON, PRN, NUL, COM1, etc.).
 const basename=path.basename(name,'.'+extension);
 if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(basename))
  throw Error('Nombre de archivo reservado por Windows.');
 return name;
}
async function saveUnique(folder,name,buffer){
 const ext=String(name).toLowerCase().endsWith('.zip')?'zip':'pdf';
 validateName(name,ext);
 if(typeof folder!=='string'||!path.isAbsolute(folder))throw Error('Carpeta Descargas inválida.');
 if(!(Buffer.isBuffer(buffer)||buffer instanceof Uint8Array)||buffer.length===0)
  throw Error('El documento está vacío o es inválido.');
 await fs.mkdir(folder,{recursive:true});
 const suffix='.'+ext,stem=name.slice(0,-suffix.length);
 for(let i=0;i<10000;i++){
  const appended=i?' ('+i+')':'';
  const trimmed=stem.slice(0,120-suffix.length-appended.length);
  const candidate=trimmed+appended+suffix;
  const filePath=path.join(folder,candidate);
  try{
   // wx = crea archivo nuevo; nunca sobrescribe otro PDF/ZIP existente.
   const handle=await fs.open(filePath,'wx',0o600);
   try{
    await handle.writeFile(buffer);
    await handle.sync();
   }catch(error){
    await handle.close();
    await fs.unlink(filePath).catch(()=>{});
    throw error;
   }
   await handle.close();
   return {filePath,name:candidate};
  }catch(error){
   if(error?.code==='EEXIST')continue;
   throw error;
  }
 }
 throw Error('Hay demasiadas descargas con el mismo nombre.');
}
module.exports={saveUnique,validateName};
