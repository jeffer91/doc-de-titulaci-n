'use strict';
/* Numeración de memorandos UTET.
   Secuencial por MES DE EMISIÓN, mínimo dos dígitos; nunca por período académico.
   Persistencia LOCAL en userData. No sustituye un libro único multi-equipo. */
const fs = require('node:fs/promises');
const path = require('node:path');

const TITLE = 'MEM-ITSQMET-UTET';
const FILE = 'utet-memorandos-numeracion.json';
const CODE_PLACEHOLDER = 'UTET_MEMO_CODE_PENDING';
const MAX_SEQUENCE = 999999;
let chain=Promise.resolve();
const str = v => String(v == null ? '' : v).trim();

function dateValid(date){
  const s=str(date);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [year,month,day]=s.split('-').map(Number);
  const value=new Date(Date.UTC(year,month-1,day));
  return year>=2000&&year<=2100&&value.getUTCFullYear()===year&&
    value.getUTCMonth()+1===month&&value.getUTCDate()===day;
}
function key(date){
  if(!dateValid(date))throw new Error('Fecha de emisión inválida. Utiliza AAAA-MM-DD.');
  return date.slice(0,7);
}
function format(sequence,date){
  key(date);
  if(!Number.isSafeInteger(sequence)||sequence<1||sequence>MAX_SEQUENCE)
    throw new Error('Número consecutivo fuera de rango.');
  return String(sequence).padStart(2,'0')+' '+TITLE+'-'+date;
}
function parse(code){
  const match=/^([0-9]{2,}) MEM-ITSQMET-UTET-(\d{4}-\d{2}-\d{2})$/.exec(str(code));
  if(!match)return null;
  const number=Number(match[1]);
  if(!Number.isSafeInteger(number)||!dateValid(match[2])||format(number,match[2])!==str(code))return null;
  return {number,date:match[2],month:key(match[2]),code:str(code)};
}
const stamp=()=>new Date().toISOString();
function validateStore(value){
  if(!value||value.version!==1||!value.months||typeof value.months!=='object'||Array.isArray(value.months))
    throw new Error('Registro de numeración alterado o incompatible; no se reiniciará automáticamente.');
  for(const [month,entry] of Object.entries(value.months)){
    if(!/^\d{4}-\d{2}$/.test(month)||!dateValid(month+'-01')||
      !entry||!Number.isSafeInteger(entry.last)||entry.last<0||entry.last>MAX_SEQUENCE)
      throw new Error('Registro de numeración inconsistente para '+month+'.');
  }
  return value;
}
async function load(baseDir){
  const file=path.join(baseDir,FILE);
  try {return validateStore(JSON.parse(await fs.readFile(file,'utf8')));}
  catch(error){
    if(error.code==='ENOENT')return {version:1,months:{}};
    throw error;
  }
}
async function persist(baseDir,data){
  await fs.mkdir(baseDir,{recursive:true,mode:0o700});
  const file=path.join(baseDir,FILE);
  const tmp=file+'.'+process.pid+'.tmp';
  try{
    await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});
    await fs.rename(tmp,file);
  }finally{
    await fs.rm(tmp,{force:true}).catch(()=>{});
  }
}
function serial(fn){
  const work=chain.then(fn,fn);
  chain=work.catch(()=>{});
  return work;
}
async function next(baseDir,date){
  const month=key(date),store=await load(baseDir);
  const number=(store.months[month]?.last||0)+1;
  return {number,date,month,code:format(number,date),full:'No. '+format(number,date),
    local:true,scope:'equipo',isProvisional:true};
}
async function reserve(baseDir,date){
  return serial(async()=>{
    const month=key(date),store=await load(baseDir);
    const number=(store.months[month]?.last||0)+1;
    if(number>MAX_SEQUENCE)throw new Error('Se agotó la numeración mensual.');
    const code=format(number,date);
    store.months[month]={last:number,updatedAt:stamp()};
    await persist(baseDir,store);
    return {number,date,month,code,full:'No. '+code,
      local:true,scope:'equipo',isProvisional:false};
  });
}
module.exports={TITLE,FILE,CODE_PLACEHOLDER,dateValid,format,parse,next,reserve};
