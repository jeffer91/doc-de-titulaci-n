'use strict';
const ExcelJS = require('exceljs');
const fs = require('node:fs/promises');
const path = require('node:path');
const MAX_ROWS=2500;
const MAX_FILE=10*1024*1024;
const safe = v=>String(v??'').trim().slice(0,5000);
function validSpec(spec){
  if(!spec || !Array.isArray(spec.columns) || spec.columns.length<1 || spec.columns.length>32)throw new Error('Columnas de plantilla inválidas.');
  if(!/^[a-z0-9-]{3,50}$/.test(spec.typeId||'')) throw new Error('Tipo de documento inválido.');
  const keys=new Set();
  for(const col of spec.columns){
    if(!/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(col.key||'') || keys.has(col.key))throw new Error('Campos duplicados o inválidos.');
    keys.add(col.key);
    if(!safe(col.label)||safe(col.label).length>120)throw new Error('Etiqueta inválida.');
  }
}
function formatDate(d){
  const year=d.getUTCFullYear(), month=d.getUTCMonth()+1, day=d.getUTCDate();
  return [String(year),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
function getValue(cell,col){
  const value=cell.value;
  if(value===null||value===undefined)return '';
  if(typeof value==='object'){
    if(value instanceof Date)return formatDate(value);
    if(value.formula||value.sharedFormula)throw new Error('Las fórmulas no se admiten en datos de entrada.');
    if(value.richText)return safe(value.richText.map(item=>item.text).join(''));
    if(value.text !== undefined)return safe(value.text);
    if(value.hyperlink !== undefined)return safe(value.text);
    throw new Error('Tipo de celda no compatible: usar texto, fecha o número.');
  }
  if(typeof value==='number' && col.kind==='id'){
    // Excel convierte identificadores numéricos; evitar importarlos con ceros iniciales perdidos.
    throw new Error('La cédula debe estar almacenada como texto para conservar los ceros iniciales.');
  }
  return safe(value);
}
async function downloadTemplate(event,spec){
  validSpec(spec);
  const owner=event.sender.getOwnerBrowserWindow();
  const defaultName='UTET_'+spec.typeId+'_'+safe(spec.periodId).replace(/[^0-9A-Za-z_-]/g,'_')+'.xlsx';
  const result=await require('electron').dialog.showSaveDialog(owner,{title:'Descargar plantilla Excel',defaultPath:defaultName,filters:[{name:'Excel',extensions:['xlsx']}]});
  if(result.canceled||!result.filePath)return {canceled:true};
  const workbook=new ExcelJS.Workbook();
  workbook.creator='UTET Gestor Documental';
  workbook.properties.date1904=false;
  const sheet=workbook.addWorksheet('Datos',{views:[{state:'frozen',ySplit:1}]});
  sheet.columns=spec.columns.map((col,i)=>({header:col.label,key:col.key,width:Math.min(42,Math.max(19,col.label.length+3))}));
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'},size:10};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2356CE'}};
  sheet.getRow(1).height=27;
  for(let j=1;j<=spec.columns.length;j++){
    const col=spec.columns[j-1];
    sheet.getColumn(j).numFmt='@';
    if(col.kind&&col.kind.startsWith('choice:')){
      const vals=col.kind.slice(7).split('|');
      if(vals.join(',').length<=200)sheet.dataValidations.add(sheet.getColumn(j).letter+'2:'+sheet.getColumn(j).letter+String(MAX_ROWS),{type:'list',allowBlank:true,formulae:['"'+vals.join(',')+'"']});
    }
  }
  sheet.autoFilter={from:'A1',to:sheet.getRow(1).getCell(spec.columns.length).address};
  const help=workbook.addWorksheet('Instrucciones');
  const lines=[
    ['Documento',safe(spec.title)],
    ['Período',safe(spec.periodLabel)],
    ['Tipo',safe(spec.typeId)],
    ['ID de período',safe(spec.periodId)],
    ['Uso','Escribir una fila por registro en la hoja Datos. No cambiar los nombres de las columnas.'],
    ['Fechas','Escribir AAAA-MM-DD.'],
    ['Horas','Escribir HH:MM en formato de 24 horas.'],
    ['Identificadores','Cédulas y códigos siempre como TEXTO, para evitar perder ceros iniciales.'],
    ['Referencia','Usar referencias distintas para convocatorias o conjuntos diferentes.'],
    ['Importación','La app mostrará errores, registros nuevos y duplicados antes de guardar.'],
    ['Almacenamiento','Maqueta local: no se escribe ni sincroniza Firebase.'],
    ['Número oficial','La plantilla no asigna números oficiales ni valida actas institucionales.']
  ];
  lines.forEach((line,index)=>{help.getCell(index+1,1).value=line[0];help.getCell(index+1,2).value=line[1];});
  help.getColumn(1).width=22;help.getColumn(2).width=110;
  await workbook.xlsx.writeFile(result.filePath);
  return {canceled:false,filePath:result.filePath};
}
async function importWorkbook(event,spec){
  validSpec(spec);
  const owner=event.sender.getOwnerBrowserWindow();
  const response=await require('electron').dialog.showOpenDialog(owner,{title:'Cargar plantilla Excel',filters:[{name:'Excel',extensions:['xlsx']}],properties:['openFile']});
  if(response.canceled||!response.filePaths?.[0])return {canceled:true};
  const target=response.filePaths[0];
  const stat=await fs.stat(target);
  if(stat.size>MAX_FILE)throw new Error('El Excel supera el límite de 10 MB.');
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await fs.readFile(target));
  return {canceled:false,fileName:path.basename(target),...readWorkbook(workbook,spec)};
}
function readWorkbook(workbook,spec){
  validSpec(spec);
  const help=workbook.getWorksheet('Instrucciones'),metadata=new Map();
  help?.eachRow(row=>metadata.set(safe(row.getCell(1).value),safe(row.getCell(2).value)));
  if(metadata.get('Tipo')&&metadata.get('Tipo')!==spec.typeId)throw Error('El Excel corresponde a otro tipo documental.');
  const workbookPeriod=metadata.get('ID de período');
  const label=metadata.get('Período');
  if((workbookPeriod&&workbookPeriod!==spec.periodId)||(!workbookPeriod&&label&&label!==spec.periodLabel))
    throw Error('El período del Excel no coincide con el período seleccionado.');
  const sheet=workbook.getWorksheet('Datos');
  if(!sheet)throw new Error('No se encontró la hoja Datos de la plantilla.');
  const byLabel=new Map(spec.columns.map(col=>[col.label,col])),positions=new Map(),seen=new Set();
  sheet.getRow(1).eachCell((cell,index)=>{
    const label=safe(cell.value),column=byLabel.get(label);
    if(!column||seen.has(column.key))throw Error('El encabezado de la columna '+index+' es desconocido o está repetido.');
    positions.set(index,column);seen.add(column.key);
  });
  const missing=spec.columns.filter(col=>col.required&&!seen.has(col.key));
  if(missing.length||!positions.size)throw Error('Faltan columnas obligatorias: '+missing.map(col=>col.label).join(', ')+'.');
  if(sheet.actualRowCount>MAX_ROWS+1)throw new Error('Hay demasiadas filas. Máximo 2500 registros.');
  const rows=[],errors=[];
  sheet.eachRow((excelRow,line)=>{
    if(line===1)return;
    const row={};let populated=false,issue=null;
    for(const [index,col] of positions){
      try{
        const v=getValue(excelRow.getCell(index),col);
        if(v)populated=true;
        row[col.key]=v;
      }catch(e){issue=e.message;break;}
    }
    if(issue){errors.push({line,message:issue});return;}
    if(!populated)return;
    rows.push({line,data:row});
    if(rows.length>MAX_ROWS)throw new Error('El Excel supera las 2500 filas.');
  });
  return {rows,errors};
}
module.exports={downloadTemplate,importWorkbook,readWorkbook,validSpec};
