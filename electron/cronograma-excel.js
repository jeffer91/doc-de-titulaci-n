'use strict';
/* Lector flexible de cronogramas Excel (uno, varios, con varias hojas). */
const fs=require('node:fs/promises');
const path=require('node:path');
const ExcelJS=require('exceljs');
const MAX_FILE=10*1024*1024;
const text=x=>String(x==null?'':x).trim();
const plain=x=>{
 if(x==null)return '';
 if(typeof x==='object'){
  if(x instanceof Date)return x;
  if(x.richText)return x.richText.map(y=>y.text||'').join('');
  if(x.text)return x.text;
  if(x.result!==undefined && !x.formula && !x.sharedFormula)return x.result;
  if(x.formula||x.sharedFormula)return '';
  return '';
 }
 return x;
};
const norm=x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function excelDate(value,date1904=false){
 const v=plain(value);
 if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
 if(typeof v==='number'&&v>=15000&&v<90000){
  const base=Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30);
  return new Date(base+Math.round(v)*86400000).toISOString().slice(0,10);
 }
 if(typeof v==='string'){
  const s=v.trim();
  if(/^\d{4}-\d\d-\d\d$/.test(s))return s;
  const d=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if(d)return d[3]+'-'+d[2].padStart(2,'0')+'-'+d[1].padStart(2,'0');
 }
 return '';
}
function classify(name,head,activities){
 const s=norm([name,head].join(' '));
 if(/complexiv|nucleo|examen complexiv/.test(s))return 'complexivo';
 if(/trabajo de titulaci|redaccion eficiente de tesis/.test(s))return 'trabajo';
 if(/articulo|universitari|superior|may nov|nov may|feb agos|agos ene|jun dic|ene sept/.test(s))return 'articulo';
 if(activities.some(a=>/articulo|metodologia|interrogante de investigacion/i.test(norm(a.actividad))))return 'articulo';
 return 'por-revisar';
}
function group(name,heading){
 const s=norm(name+' '+heading);
 if(/universitari|\b(?:uni|u)\b/.test(s))return 'Universitarios';
 if(/superior|\b(?:sup|s)\b/.test(s))return 'Superiores';
 return 'Por determinar';
}
function periodFrom(x){
 const cleaned=text(x).replace(/\s*:{2,}\s*/g,' - ').replace(/\s+[-–—]\s+(universitarios?|superiores?)(\s*\d+)?\s*$/i,'').trim();
 return cleaned.replace(/^\s*(cronograma\s*(de\s*)?(art[ií]culo\s*(acad[eé]mico)?)?)\s*[-:]?\s*/i,'').trim();
}
function parseSheet(ws,filename,date1904){
 const get=(r,c)=>plain(ws.getRow(r).getCell(c).value);
 const headingRows=[];
 let header=-1,activityCol=1,startCol=2,endCol=3;
 const max=Math.min(ws.rowCount,1500);
 for(let r=1;r<=Math.min(max,25);r++){
  const cells=Array.from({length:Math.min(ws.columnCount,10)},(_,j)=>norm(get(r,j+1)));
  const a=cells.findIndex(x=>/actividad/.test(x)),b=cells.findIndex(x=>/fecha\s*(de\s*)?(inicio|inicial)/.test(x)),c=cells.findIndex(x=>/fecha\s*(de\s*)?(fin|final)/.test(x));
  if(a>=0&&b>=0&&c>=0 && a!==b&&a!==c&&b!==c){header=r;activityCol=a+1;startCol=b+1;endCol=c+1;break;}
  const first=text(get(r,1));
  if(first)headingRows.push(first);
 }
 if(header<0)return {fileName:filename,sheetName:ws.name,error:'No se encontraron las columnas Actividad, Fecha inicio y Fecha fin.',actividades:[],selected:false};
 const heading=headingRows.find(x=>/20\d\d/.test(x))||headingRows[0]||ws.name;
 const actividades=[],warnings=[];
 let fase='',invalid=0;
 for(let r=header+1;r<=max;r++){
  const activity=text(get(r,activityCol)),a=norm(activity);
  if(!activity)continue;
  if(/^actividad$/.test(a)||/^(total|subtotal|numero de estudiantes)/.test(a))continue;
  const ini=excelDate(get(r,startCol),date1904),fin=excelDate(get(r,endCol),date1904);
  if(/^fase\s*\d|^etapa\s*\d/.test(a)&&!ini&&!fin){fase=activity;continue;}
  if(!ini&&!fin){continue;}
  if(!ini||!fin||fin<ini){invalid++;if(warnings.length<8)warnings.push('Fila '+r+': fecha incompleta, inválida o invertida.');continue;}
  actividades.push({etapa:fase,actividad:activity.slice(0,350),inicio:ini,fin});
  if(actividades.length>=250){warnings.push('Límite de 250 actividades alcanzado.');break;}
 }
 if(invalid>warnings.length)warnings.push('Otras '+(invalid-warnings.length)+' filas con fechas inválidas.');
 const tipo=classify(ws.name,headingRows.slice(0,3).join(' '),actividades);
 return {fileName:filename,sheetName:ws.name,periodo:periodFrom(heading),grupo:group(ws.name,heading),tipo,actividades,warnings,
  selected:tipo==='articulo'&&actividades.length>0,error:!actividades.length?'No se detectaron actividades con fechas válidas.':''};
}
async function parseBuffer(buffer,filename){
 if(buffer.length>MAX_FILE)throw Error('Un archivo supera el límite de 10 MB.');
 const wb=new ExcelJS.Workbook();
 await wb.xlsx.load(buffer);
 const items=[];
 for(const ws of wb.worksheets.slice(0,35))items.push(parseSheet(ws,filename,!!wb.properties.date1904));
 return items;
}
async function importFiles(event){
 const owner=event.sender.getOwnerBrowserWindow();
 const {dialog}=require('electron');
 const chosen=await dialog.showOpenDialog(owner,{title:'Importar uno o varios Excel de cronogramas',filters:[{name:'Excel (*.xlsx)',extensions:['xlsx']}],properties:['openFile','multiSelections']});
 if(chosen.canceled||!chosen.filePaths?.length)return {canceled:true};
 if(chosen.filePaths.length>15)throw Error('Selecciona como máximo 15 archivos por importación.');
 const result=[];
 for(const filePath of chosen.filePaths){
  const st=await fs.stat(filePath);
  if(st.size>MAX_FILE)throw Error('El archivo '+path.basename(filePath)+' supera 10 MB.');
  result.push(...await parseBuffer(await fs.readFile(filePath),path.basename(filePath)));
 }
 if(result.length>60)throw Error('Se detectaron demasiadas hojas. Máximo 60 por lote.');
 return {canceled:false,sheets:result,files:chosen.filePaths.length};
}
module.exports={parseBuffer,parseSheet,excelDate,periodFrom,classify,importFiles};
