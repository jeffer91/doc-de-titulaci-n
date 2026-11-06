'use strict';
/* Registro tabular por tipo documental; no se conecta a Firebase. */
(() => {
  const field = (key, label, required=false, kind='text') => ({key,label,required,kind});
  const F = field;
  const COMMON = [
    F('referencia','Referencia / convocatoria',true),
    F('fecha','Fecha de emisión (AAAA-MM-DD)',true,'date'),
    F('asunto','Asunto / título',true),
  ];
  const career = F('carrera','Carrera',true);
  const date = (key,label) => F(key,label,true,'date');
  const site = F('sede','Sede');
  const notes = F('contenido','Contenido / observaciones',false,'textarea');
  const timetable = [
    F('inicioTeorico','Inicio teórico (HH:MM)',false,'time'),
    F('inicioPractico','Inicio práctico (HH:MM)',false,'time'),
    F('inicioDefensa','Inicio defensa (HH:MM)',false,'time'),
    F('finDefensa','Fin defensa (HH:MM)',false,'time')
  ];
  const definitions = {
    'plan-examen':[career,date('fechaInicio','Inicio planificación'),date('fechaFin','Fin planificación'),F('responsable','Responsable'),notes],
    'plan-trabajo':[career,date('fechaInicio','Inicio planificación'),date('fechaFin','Fin planificación'),F('responsable','Responsable'),notes],
    'plan-articulo':[career,date('fechaInicio','Inicio planificación'),date('fechaFin','Fin planificación'),F('responsable','Responsable'),notes],
    'informe-final':[F('modalidad','Modalidad'),F('totalEstudiantes','Total estudiantes',false,'number'),F('resultados','Resultados / conclusiones',false,'textarea'),notes],
    'acta-requisitos':[career,date('fechaReunion','Fecha de seguimiento'),F('responsable','Responsable'),F('hallazgos','Hallazgos',false,'textarea'),notes],
    'informe-individual':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('estadoRequisitos','Estado de requisitos'),notes],
    'reporte-final':[career,F('totalEstudiantes','Total estudiantes',false,'number'),F('cumplen','Estudiantes que cumplen',false,'number'),F('pendientes','Pendientes',false,'number'),notes],
    'solicitud-ingreso':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('modalidad','Modalidad'),notes],
    'cron-examen':[career,date('fechaExamen','Fecha del examen'),site,F('lugar','Ubicación / enlace'),...timetable,notes],
    'plan-nucleo':[career,F('nucleo','Núcleo',true),F('docente','Docente'),F('evaluaciones','Evaluaciones previstas',false,'textarea'),notes],
    'com-examen':[career,date('fechaExamen','Fecha del examen'),site,F('ubicacion','Enlace de ubicación'),F('entregaCaso','Entrega de caso práctico',false,'choice:En el examen|48 horas antes|Personalizada'),...timetable,notes],
    'acta-examen':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('teorica','Nota teórica',false,'number'),F('practica','Nota práctica',false,'number'),F('resultado','Resultado'),notes],
    'cron-trabajo':[career,F('actividad','Actividad',true),date('fechaInicio','Inicio actividad'),date('fechaFin','Fin actividad'),F('responsable','Responsable'),notes],
    'designar-tutor':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('tutor','Docente tutor',true),F('tema','Tema'),notes],
    'plagio-trabajo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('porcentaje','Porcentaje de similitud',false,'number'),notes],
    'com-trabajo':[career,date('fechaEvento','Fecha del evento'),site,F('lugar','Lugar / enlace'),F('hora','Hora (HH:MM)',false,'time'),notes],
    'acta-trabajo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('notaEscrita','Nota escrita',false,'number'),F('notaDefensa','Nota defensa',false,'number'),notes],
    'cron-articulo':[career,F('actividad','Actividad',true),date('fechaInicio','Inicio actividad'),date('fechaFin','Fin actividad'),F('responsable','Responsable'),notes],
    'designar-metodologico':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('docente','Docente metodológico',true),F('tema','Tema'),notes],
    'com-articulo':[career,date('fechaEvento','Fecha del evento'),site,F('lugar','Lugar / enlace'),F('hora','Hora (HH:MM)',false,'time'),notes],
    'plagio-articulo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('porcentaje','Porcentaje de similitud',false,'number'),notes],
    'acta-articulo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('notaEscrita','Nota escrita',false,'number'),F('notaDefensa','Nota defensa',false,'number'),notes],
    'asistencia-induccion':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('asistio','Asistió',false,'choice:Sí|No'),F('firma','Firma / evidencia (referencia)'),notes],
    'informe-induccion':[career,date('fechaInduccion','Fecha de inducción'),F('convocados','Convocados',false,'number'),F('asistentes','Asistentes',false,'number'),F('observaciones','Observaciones',false,'textarea'),notes]
  };
  const allIds = Object.keys(definitions);
  const schema = id => definitions[id] ? [...COMMON,...definitions[id]] : null;
  const headers = id => (schema(id) || []).map(f=>f.label);
  const empty = id => Object.fromEntries((schema(id)||[]).map(f=>[f.key,'']));
  const trim = v => v===null || v===undefined ? '' : String(v).trim();
  function normalize(id, raw) {
    const result=empty(id);
    for (const field of schema(id)||[]) result[field.key]=trim(raw && raw[field.key]);
    return result;
  }
  const isDate = val => {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(val))return false;
    const [y,m,d] = val.split('-').map(Number);
    const t=new Date(Date.UTC(y,m-1,d));
    return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;
  };
  function validate(id, raw) {
    const row=normalize(id,raw),errors=[];
    for(const f of schema(id)||[]){
      const val=row[f.key];
      if(f.required&&!val) errors.push(f.label+': dato obligatorio.');
      if(!val) continue;
      if(f.kind==='date'&&!isDate(val)) errors.push(f.label+': usar AAAA-MM-DD.');
      if(f.kind==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) errors.push(f.label+': usar HH:MM.');
      if(f.kind==='number'&&(!/^\d+([.,]\d+)?$/.test(val)||Number(val.replace(',','.'))>1000000)) errors.push(f.label+': valor numérico inválido.');
      if(f.kind==='choice:'+'' ){} // La validación de opciones se realiza debajo.
      if(f.kind.startsWith('choice:')&&!f.kind.slice(7).split('|').includes(val)) errors.push(f.label+': opción no permitida.');
      if(val.length>5000) errors.push(f.label+': máximo 5000 caracteres.');
    }
    if(id.startsWith('plagio-') && row.porcentaje && Number(row.porcentaje.replace(',','.'))>100) errors.push('Porcentaje de similitud: máximo 100.');
    return errors;
  }
  function uniqueKey(id,raw){
    const row=normalize(id,raw);
    // El identificador de referencia diferencia convocatorias y registros del mismo período.
    return [id,row.referencia.toLocaleLowerCase('es'),row.cedula||row.carrera||''].join('|').toLocaleLowerCase('es');
  }
  function toEditor(row,type,periodId,base) {
    const schemaFields=schema(type.id)||[];
    const lines=schemaFields.filter(f=>!['asunto','fecha','contenido','referencia','carrera'].includes(f.key) && row[f.key])
      .map(f=>f.label+': '+row[f.key]);
    const txt=[...lines,row.contenido||''].filter(Boolean).join('\n');
    const now=new Date().toISOString();
    const data={
      ...base,
      id:'registro_'+Date.now()+'_'+Math.random().toString(36).slice(2,9),
      tipoId:type.id,periodId,
      asunto:row.asunto||type.nombre,fecha:row.fecha,carrera:row.carrera||'',
      contenido:txt,observaciones:'Referencia: '+row.referencia,
      createdAt:now,updatedAt:now,estado:'Borrador'
    };
    if(type.id==='asistencia-induccion')data.asistentes=[row.cedula,row.estudiante,row.carrera,row.firma].join(';');
    return data;
  }
  window.UTET_RECORDS=Object.freeze({definitions,allIds,schema,headers,empty,normalize,validate,uniqueKey,toEditor});
})();