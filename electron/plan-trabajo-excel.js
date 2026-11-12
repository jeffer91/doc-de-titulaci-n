'use strict';

const path=require('node:path');
const {excelDate,excelCellValue}=require('./cronograma-excel.js');
const {periodKey}=require('../renderer/cronograma.model.js');
const {todayEcuador}=require('./acta-articulo-date.js');

const headers={
  actividad:['actividad','actividades','tarea','hito','descripcion de la actividad'],
  fechaInicio:['inicio','fecha inicio','fecha de inicio','fecha inicial','inicio actividad','inicio planificacion'],
  fechaFin:['fin','fecha fin','fecha de fin','fecha final','fin actividad','fin planificacion','fecha de entrega','fecha limite'],
  fechaUnica:['fecha','fecha programada'],
  etapa:['etapa','fase'],ordenEtapa:['orden de la etapa','orden etapa','orden fase'],
  carrera:['carrera','programa'],grupo:['grupo','grupo o cohorte','cohorte','paralelo'],
  responsable:['responsable','responsables','docente responsable','tutor'],
  tutoria:['tutoria','tutorias','revision','tutoria o revision'],
  entregable:['entregable','entregables','producto','evidencia esperada'],
  sede:['sede','campus','ubicacion'],evidencia:['referencia de evidencia','evidencia','referencia documental'],
  referencia:['referencia','convocatoria','referencia convocatoria'],
  contenido:['observaciones','contenido observaciones','observacion','notas']
};
const aliases=new Map(Object.entries(headers).flatMap(([key,names])=>names.map(name=>[name,key])));
const text=value=>String(excelCellValue(value)??'').trim().slice(0,5000);
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const headerKey=value=>fold(value).replace(/[^a-z0-9]+/g,' ').trim();

function scheduleSheet(sheet){
  const titles=[sheet.name];
  for(let line=1;line<=Math.min(30,sheet.rowCount);line++){
    const positions=new Map();
    const values=[];
    sheet.getRow(line).eachCell((cell,index)=>{
      const value=text(cell.value),key=aliases.get(headerKey(value));
      if(value)values.push(value);
      if(key&&!positions.has(key))positions.set(key,index);
    });
    if(positions.has('actividad')&&['fechaInicio','fechaFin','fechaUnica'].some(key=>positions.has(key))){
      const heading=fold(titles.join(' ')).replace(/\s+/g,' ');
      const trabajo=/\b(?:trabajo (?:de )?titulacion|tesis)\b/.test(heading);
      const other=/\b(?:complexiv[oa]s?|articulo academico)\b/.test(heading);
      const periods=(heading.match(/\b(?:\d{4}-\d{2}__\d{4}-\d{2}|[a-z]+(?:\s+de)?\s+\d{4}\s*(?:[-–—]|\ba\b|\bal\b|\bhasta\b)\s*[a-z]+(?:\s+de)?\s+\d{4})\b/g)||[])
        .map(periodKey).filter(Boolean);
      return {sheet,line,positions,trabajo,other,periods};
    }
    if(values.length)titles.push(values.slice(0,5).join(' '));
  }
  return null;
}

function readSchedule(workbook,spec,fileName,maxRows){
  const candidates=workbook.worksheets.filter(sheet=>!['hidden','veryHidden'].includes(sheet.state))
    .map(scheduleSheet).filter(item=>item&&!item.other);
  const selected=candidates.some(item=>item.trabajo)?candidates.filter(item=>item.trabajo):candidates;
  if(!selected.length)throw Error('Busca una hoja de Trabajo de Titulación con la columna Actividad y al menos una columna de fecha.');
  const reference=path.parse(fileName||'Cronograma de Trabajo de Titulación.xlsx').name;
  const period=periodKey(spec.periodId)||periodKey(spec.periodLabel);
  const issued=todayEcuador(),rows=[],errors=[];
  const date1904=!!workbook.properties.date1904;
  let eligibleSheets=0;
  for(const {sheet,line,positions,periods} of selected){
    if(period&&periods.some(key=>key!==period)){
      errors.push({line:1,sheet:sheet.name,message:'El período de esta hoja difiere del período seleccionado.'});
      continue;
    }
    eligibleSheets++;
    let stage='',order='';
    sheet.eachRow((row,number)=>{
      if(number<=line)return;
      const data={referencia:reference,asunto:spec.title,fecha:issued};
      const raw=new Map();
      for(const [key,index] of positions)raw.set(key,row.getCell(index).value);
      data.actividad=text(raw.get('actividad'));
      if(!data.actividad||/^(actividad(?:es)?|total|subtotal)$/i.test(data.actividad))return;
      for(const [key,value] of raw)if(!['actividad','fechaInicio','fechaFin','fechaUnica'].includes(key)&&text(value))data[key]=text(value);
      const dateKeys=['fechaInicio','fechaFin','fechaUnica'];
      const invalid=dateKeys.find(key=>{
        const value=text(raw.get(key));
        return value&&!/^(?:[-–—]+|pendiente|por definir|sin fecha|n\/a)$/i.test(value)&&!excelDate(raw.get(key),date1904);
      });
      if(invalid){
        errors.push({line:number,sheet:sheet.name,message:'Fecha inválida en la actividad «'+data.actividad.slice(0,120)+'».'});
        return;
      }
      const single=excelDate(raw.get('fechaUnica'),date1904);
      const start=excelDate(raw.get('fechaInicio'),date1904),end=excelDate(raw.get('fechaFin'),date1904);
      data.fechaInicio=start||(!end?single:'');
      data.fechaFin=end||(!start?single:'');
      const heading=/^(?:etapa|fase)\s+([1-9]\d{0,2})\b/i.exec(data.actividad);
      if(heading&&!data.fechaInicio&&!data.fechaFin&&!data.responsable&&!data.entregable&&!data.tutoria){
        stage=data.actividad;order=heading[1];return;
      }
      if(!data.etapa&&stage){data.etapa=stage;data.ordenEtapa||=order;}
      data.evidencia||=(fileName?fileName+' · ':'')+sheet.name;
      rows.push({line:number,sheet:sheet.name,data});
      if(rows.length>maxRows)throw Error('El Excel supera las '+maxRows+' filas.');
    });
  }
  if(!eligibleSheets)throw Error('El cronograma corresponde a otro período. Cambia el período seleccionado o carga su Excel.');
  if(!rows.length&&!errors.length)throw Error('El cronograma no contiene actividades para importar.');
  return {rows,errors};
}

module.exports={readSchedule};
