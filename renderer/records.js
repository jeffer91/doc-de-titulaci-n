'use strict';
/* Campos de captura, alcance y salida de cada documento del catálogo. */
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
  const student = [F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career];
  const modality = F('modalidad','Modalidad');
  const group = F('grupo','Grupo o cohorte');
  const evidence = F('evidencia','Referencia de evidencia');
  const start = date('fechaInicio','Inicio planificación');
  const end = date('fechaFin','Fin planificación');
  const responsible = F('responsable','Responsable');
  const requirementState = 'choice:CUMPLE|NO CUMPLE|PENDIENTE|SIN DATO';
  const requirementFields = [
    ['Academico','Académico'], ['Documentacion','Documentación'], ['Financiero','Financiero'],
    ['PracticasVinculacion','Prácticas preprofesionales'], ['Vinculacion','Vinculación'],
    ['SeguimientoGraduados','Seguimiento a graduados'], ['Ingles','Inglés'],
    ['ActualizacionDatos','Actualización de datos'], ['Titulacion','Titulación']
  ].map(([key,label])=>F(key,label,false,requirementState));
  const reportFields = [
    ['introduccion','Introducción'], ['baseLegal','Base legal'], ['metodologia','Metodología'],
    ['resultados','Resultados / conclusiones'], ['resumenEjecutivo','Resumen ejecutivo'],
    ['conclusiones','Conclusiones'], ['recomendaciones','Recomendaciones'], ['referencias','Referencias']
  ].map(([key,label])=>F(key,label,false,'textarea'));
  const timetable = [
    F('inicioTeorico','Inicio teórico (HH:MM)',false,'time'),
    F('inicioPractico','Inicio práctico (HH:MM)',false,'time'),
    F('inicioDefensa','Inicio defensa (HH:MM)',false,'time'),
    F('finDefensa','Fin defensa (HH:MM)',false,'time')
  ];
  const definitions = {
    'plan-examen':[career,{...start,required:false},{...end,required:false},responsible,notes,group,
      F('actividad','Actividad'),F('etapa','Etapa'),F('entregable','Entregable'),site,evidence,F('ordenEtapa','Orden de la etapa',false,'number')],
    'plan-trabajo':[career,start,end,responsible,notes,group,F('actividad','Actividad'),F('etapa','Etapa'),F('entregable','Entregable'),F('tutoria','Tutoría o revisión'),evidence],
    'plan-articulo':[career,start,end,responsible,notes,group,F('actividad','Actividad'),F('etapa','Etapa'),F('entregable','Entregable'),F('hito','Hito metodológico'),evidence],
    'informe-final':[modality,F('totalEstudiantes','Total estudiantes',false,'number'),reportFields[3],notes,
      F('fuenteInforme','Referencia del informe o corte de Requisitos'),...reportFields.filter(f=>f.key!=='resultados')],
    'acta-requisitos':[career,date('fechaReunion','Fecha de seguimiento'),responsible,F('hallazgos','Hallazgos',false,'textarea'),notes,
      F('unidadResponsable','Unidad responsable'),F('requisito','Requisito revisado'),F('compromiso','Compromiso'),F('fechaCompromiso','Fecha de cumplimiento',false,'date'),
      F('participantes','Participantes',false,'textarea'),evidence],
    'informe-individual':[...student,F('estadoRequisitos','Estado de requisitos'),notes,modality,
      F('fechaCorte','Fecha de corte',false,'date'),...requirementFields,evidence],
    'reporte-final':[career,F('totalEstudiantes','Total estudiantes',false,'number'),F('cumplen','Estudiantes que cumplen',false,'number'),F('pendientes','Pendientes',false,'number'),notes,
      modality,F('fechaCorte','Fecha de corte',false,'date'),F('estudiante','Estudiante'),F('cedula','Cédula',false,'id'),
      F('estadoRequisitos','Estado de requisitos',false,requirementState),...requirementFields,evidence],
    'solicitud-ingreso':[...student,modality,notes,F('folioSisacad','N.º de oficio en SISACAD'),F('fechaSolicitud','Fecha de solicitud',false,'date'),evidence],
    'cron-examen':[career,date('fechaExamen','Fecha del examen'),site,F('lugar','Ubicación / enlace'),...timetable,notes,
      group,F('convocatoria','Convocatoria'),F('actividad','Actividad o evaluación'),F('laboratorio','Aula o laboratorio'),responsible,evidence],
    'plan-nucleo':[career,F('nucleo','Núcleo',true),F('docente','Docente'),F('evaluaciones','Evaluaciones previstas',false,'textarea'),notes,
      F('folioSisacad','Referencia en SISACAD'),F('fechaInicio','Inicio del núcleo',false,'date'),F('fechaFin','Fin del núcleo',false,'date'),
      F('resultadosAprendizaje','Resultados de aprendizaje',false,'textarea'),F('contenidos','Contenidos y actividades',false,'textarea'),
      F('casoEstudio','Caso de estudio',false,'textarea'),F('recursos','Recursos',false,'textarea')],
    'com-examen':[career,date('fechaExamen','Fecha del examen'),site,F('ubicacion','Enlace de ubicación'),F('entregaCaso','Entrega de caso práctico',false,'choice:En el examen|48 horas antes|Personalizada'),...timetable,notes,
      group,F('convocatoria','Convocatoria'),F('referenciaCronograma','Referencia del cronograma'),F('instrucciones','Instrucciones de evaluación',false,'textarea')],
    'acta-examen':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('teorica','Nota teórica',false,'number'),F('practica','Nota práctica',false,'number'),F('resultado','Resultado'),notes],
    'cron-trabajo':[career,F('actividad','Actividad',true),date('fechaInicio','Inicio actividad'),date('fechaFin','Fin actividad'),responsible,notes,
      group,F('etapa','Etapa'),F('entregable','Entregable'),F('canal','Canal o aula virtual'),evidence],
    'designar-tutor':[...student,F('tutor','Docente tutor',true),F('tema','Tema'),notes,
      group,F('fechaAsignacion','Fecha de asignación',false,'date'),F('validacionUii','Referencia de coordinación con UII'),evidence],
    'plagio-trabajo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('porcentaje','Porcentaje de similitud',false,'number'),notes],
    'com-trabajo':[career,date('fechaEvento','Fecha del evento'),site,F('lugar','Lugar / enlace'),F('hora','Hora (HH:MM)',false,'time'),notes,
      group,F('convocatoria','Convocatoria'),F('referenciaCronograma','Referencia del cronograma'),F('instrucciones','Instrucciones de evaluación',false,'textarea')],
    'acta-trabajo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('notaEscrita','Nota escrita',false,'number'),F('notaDefensa','Nota defensa',false,'number'),notes],
    'cron-articulo':[career,F('actividad','Actividad',true),date('fechaInicio','Inicio actividad'),date('fechaFin','Fin actividad'),F('responsable','Responsable'),notes],
    'designar-metodologico':[F('cedula','Cédula',false,'id'),F('estudiante','Estudiante'),career,F('docente','Docente metodológico',true),F('tema','Tema'),notes,
      group,F('fechaAsignacion','Fecha de asignación',false,'date'),F('validacionUii','Referencia de coordinación con UII'),evidence],
    'com-articulo':[career,date('fechaEvento','Fecha del evento'),site,F('lugar','Lugar / enlace'),F('hora','Hora (HH:MM)',false,'time'),notes,
      group,F('convocatoria','Convocatoria'),F('referenciaCronograma','Referencia del cronograma'),F('instrucciones','Instrucciones de evaluación',false,'textarea')],
    'plagio-articulo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('porcentaje','Porcentaje de similitud',false,'number'),notes],
    'acta-articulo':[F('cedula','Cédula',true,'id'),F('estudiante','Estudiante',true),career,F('notaEscrita','Nota escrita',false,'number'),F('notaDefensa','Nota defensa',false,'number'),notes],
    'asistencia-induccion':[...student,F('asistio','Asistió',false,'choice:Sí|No'),F('firma','Firma / evidencia (referencia)'),notes,
      group,F('tema','Tema de inducción'),F('capacitador','Capacitador'),F('jefeInmediato','Jefe inmediato'),site,evidence],
    'informe-induccion':[career,date('fechaInduccion','Fecha de inducción'),F('convocados','Convocados',false,'number'),F('asistentes','Asistentes',false,'number'),F('observaciones','Observaciones',false,'textarea'),notes,
      group,F('tema','Tema de inducción'),F('capacitador','Capacitador'),F('referenciaAsistencia','Referencia del registro de asistencia'),F('resultados','Resultados y acuerdos',false,'textarea'),evidence]
  };
  const profile = (scope,source,output,options={}) => ({scope,source,output,...options});
  const column = (label,...keys) => ({label,keys});
  const dates = column('Fechas','fechaInicio','fechaFin');
  const schedule = column('Horarios','inicioTeorico','inicioPractico','inicioDefensa','finDefensa');
  const destination = column('Ubicación','sede','laboratorio','lugar');
  const participant = column('Estudiante','estudiante','cedula');
  const cohort = column('Carrera / grupo','carrera','grupo');
  const activity = column('Actividad','actividad','etapa');
  const support = column('Referencias','referenciaCronograma','evidencia');
  const workflows = Object.freeze({
    'plan-examen':profile('Una planificación por período y referencia','Planificación UTET, cronograma y asignaciones confirmadas','PDF con programación, gráficos y análisis del período',
      {table:'Planificación del Examen Complexivo',columns:[cohort,column('Actividad','actividad','etapa','ordenEtapa'),dates,'responsable','entregable',destination,support]}),
    'plan-trabajo':profile('Una planificación por período y referencia','Planificación UTET, tutorías y entregables coordinados con UII','Registro con actividades, tutorías, entregables y responsables',
      {table:'Planificación de Trabajo de Titulación',columns:[cohort,activity,dates,column('Tutoría y entregable','tutoria','entregable'),'responsable',support]}),
    'plan-articulo':profile('Una planificación por período y referencia','Planificación UTET y cronograma de Artículo Académico','Registro con hitos metodológicos, entregas y revisiones',
      {table:'Planificación de Artículo Académico',columns:[cohort,column('Actividad e hito','actividad','etapa','hito'),dates,'entregable','responsable',support]}),
    'informe-final':profile('Un informe por período y corte','Requisitos → Inf y evidencias de ejecución del período','Informe con ocho capítulos y referencia al corte utilizado',
      {single:true,details:['modalidad','totalEstudiantes','fuenteInforme'],text:reportFields.map(f=>f.key)}),
    'acta-requisitos':profile('Una reunión por período, referencia y fecha','Corte de requisitos y acuerdos de las unidades responsables','Acta con participantes, hallazgos y tabla de compromisos',
      {group:['referencia','fechaReunion'],details:['fechaReunion'],text:['participantes','hallazgos'],
        table:'Compromisos de seguimiento',columns:[column('Requisito / carrera','requisito','carrera'),'compromiso',column('Responsable','responsable','unidadResponsable'),'fechaCompromiso','evidencia']}),
    'informe-individual':profile('Un estudiante por período y corte','Matrícula del período y verificación de requisitos','Informe individual con estado por requisito y fecha de corte',
      {single:true,student:true,details:['cedula','estudiante','carrera','modalidad','fechaCorte','estadoRequisitos','evidencia'],requirements:true}),
    'reporte-final':profile('Un reporte por período, modalidad y corte','Corte de requisitos del período por carrera y estudiante','Reporte consolidado y detalle individual cuando se registra',
      {group:['referencia','modalidad','fechaCorte'],student:true,table:'Cierre de requisitos por carrera',
        columns:['carrera','totalEstudiantes','cumplen','pendientes','evidencia'],requirementsReport:true}),
    'solicitud-ingreso':profile('Un estudiante por período y modalidad','Solicitud registrada por el estudiante en SISACAD y matrícula del período','Ficha de control con número y fecha del oficio de SISACAD',
      {single:true,student:true,recipient:'Unidad de Titulación y Eficiencia Terminal',details:['cedula','estudiante','carrera','modalidad','folioSisacad','fechaSolicitud','evidencia']}),
    'cron-examen':profile('Un cronograma por período, referencia y convocatoria','Agenda de UTET, sedes y laboratorios confirmados','Memorando con programación por carrera, sede, aula y turno',
      {group:['referencia','convocatoria'],recipient:'Estudiantes de Examen Complexivo',table:'Programación de Examen Complexivo',
        columns:[cohort,'actividad','fechaExamen',schedule,destination,'responsable',support]}),
    'plan-nucleo':profile('Un plan por período, carrera y núcleo','Plan registrado por el docente en SISACAD','Ficha con resultados de aprendizaje, contenidos, evaluaciones y caso de estudio',
      {single:true,details:['carrera','nucleo','docente','folioSisacad','fechaInicio','fechaFin'],text:['resultadosAprendizaje','contenidos','evaluaciones','casoEstudio','recursos']}),
    'com-examen':profile('Un comunicado por período y convocatoria','Cronograma de Complexivo y condiciones de evaluación aprobadas','Comunicado con horarios, sede, entrega del caso e instrucciones',
      {group:['referencia','convocatoria'],recipient:'Estudiantes de Examen Complexivo',table:'Convocatoria y evaluación',
        columns:[cohort,'fechaExamen',schedule,column('Ubicación','sede','ubicacion'),'entregaCaso',support],text:['instrucciones']}),
    'acta-examen':profile('Un acta CX por estudiante y período','Matrícula, requisitos y modalidad en Firebase. Calificaciones gestionadas en Ncomplex','Acta de titulación CX, PDF carta de tres páginas',{route:'acta'}),
    'cron-trabajo':profile('Un cronograma por período y referencia','Agenda de UTET y coordinación con UII','Memorando con etapas, tutorías, entregas y fechas por grupo',
      {recipient:'Estudiantes de Trabajo de Titulación y Unidad de Investigación e Innovación',table:'Cronograma de Trabajo de Titulación',
        columns:[cohort,activity,dates,'entregable','responsable',column('Canal / evidencia','canal','evidencia')]}),
    'designar-tutor':profile('Una designación por período y referencia','Matrícula y asignaciones de tutoría coordinadas con UII','Registro de tutores, estudiantes y temas asignados',
      {student:true,table:'Designación de tutores',
        columns:[cohort,participant,'tutor','tema','fechaAsignacion',column('Referencias','validacionUii','evidencia')]}),
    'plagio-trabajo':profile('Un memorando por estudiante y período','Matrícula y resultado de similitud del Trabajo de Titulación','Memorando y anexo individual de similitud, PDF A4',{route:'similitud'}),
    'com-trabajo':profile('Un comunicado por período y convocatoria','Agenda de defensas y condiciones de evaluación confirmadas','Comunicado con convocatoria, sede, horario e instrucciones',
      {group:['referencia','convocatoria'],recipient:'Estudiantes de Trabajo de Titulación',table:'Convocatoria de Trabajo de Titulación',
        columns:[cohort,column('Fecha y hora','fechaEvento','hora'),destination,support],text:['instrucciones']}),
    'acta-trabajo':profile('Un acta TT por estudiante y período','Matrícula, requisitos, notas y similitud de Trabajo en Firebase','Acta de titulación TT, PDF carta de tres páginas',{route:'acta'}),
    'cron-articulo':profile('Un memorando por período con anexos por grupo','Excel de cronogramas por hoja, período y subgrupo','Memorando de Artículo Académico con anexos, PDF A4',{route:'cronograma'}),
    'designar-metodologico':profile('Una designación por período y referencia','Asignaciones UTET y UII por carrera o grupo','Registro de docentes metodológicos y grupos asignados',
      {student:true,table:'Designación de docentes metodológicos de Artículo Académico',
        columns:[cohort,'docente',participant,'tema','fechaAsignacion',column('Referencias','validacionUii','evidencia')]}),
    'com-articulo':profile('Un comunicado por período y convocatoria','Cronograma de Artículo y agenda de evaluación o defensa','Comunicado con grupos, fechas, sedes e instrucciones',
      {group:['referencia','convocatoria'],recipient:'Estudiantes de Artículo Académico',table:'Convocatoria de Artículo Académico',
        columns:[cohort,column('Fecha y hora','fechaEvento','hora'),destination,support],text:['instrucciones']}),
    'plagio-articulo':profile('Un memorando por estudiante y período','Matrícula y resultado de similitud del Artículo Académico','Memorando y anexo individual de similitud, PDF A4',{route:'similitud'}),
    'acta-articulo':profile('Un acta AA por estudiante y período','Matrícula, requisitos, notas y similitud de Artículo en Firebase','Acta de titulación AA, PDF carta de tres páginas',{route:'acta'}),
    'asistencia-induccion':profile('Un registro por período, referencia y jornada','Nómina de convocados y evidencia de asistencia','Registro firmado por asistentes confirmados, con numeración continua',
      {group:['referencia','fecha','grupo','sede'],student:true,attendance:true}),
    'informe-induccion':profile('Un informe por período, fecha y sesión','Registro de asistencia, convocatoria y evidencias de inducción','Informe con cobertura, resultados y acuerdos',
      {group:['referencia','fechaInduccion','grupo'],details:['fechaInduccion','grupo','tema','capacitador','referenciaAsistencia'],
        table:'Cobertura de la inducción',columns:['carrera','convocados','asistentes','evidencia'],text:['resultados','observaciones']})
  });
  const allIds = Object.keys(definitions);
  const workflow = id => workflows[id] || null;
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
      if(f.kind==='id'&&!/^[a-zA-Z0-9]{6,20}$/.test(val)) errors.push(f.label+': identificador inválido.');
      if(f.kind==='number'&&(!/^\d+([.,]\d+)?$/.test(val)||Number(val.replace(',','.'))>1000000)) errors.push(f.label+': valor numérico inválido.');
      if(f.kind.startsWith('choice:')&&!f.kind.slice(7).split('|').includes(val)) errors.push(f.label+': opción no permitida.');
      if(val.length>5000) errors.push(f.label+': máximo 5000 caracteres.');
    }
    if(id.startsWith('plagio-') && row.porcentaje && Number(row.porcentaje.replace(',','.'))>100) errors.push('Porcentaje de similitud: máximo 100.');
    if(row.fechaInicio&&row.fechaFin&&row.fechaFin<row.fechaInicio) errors.push('La fecha final precede a la fecha inicial.');
    if(id==='plan-examen'&&row.ordenEtapa&&!/^[1-9]\d{0,2}$/.test(row.ordenEtapa)) errors.push('El orden de la etapa debe ser un entero de 1 a 999.');
    if(row.fechaReunion&&row.fechaCompromiso&&row.fechaCompromiso<row.fechaReunion) errors.push('El compromiso vence antes de la reunión.');
    if(row.inicioDefensa&&row.finDefensa&&row.finDefensa<row.inicioDefensa) errors.push('La defensa termina antes de su hora de inicio.');
    const counts=['totalEstudiantes','cumplen','pendientes','convocados','asistentes'];
    for(const key of counts) if(row[key]&&!/^\d+$/.test(row[key])) errors.push('Usa un número entero para '+schema(id).find(f=>f.key===key).label.toLowerCase()+'.');
    if(row.totalEstudiantes&&Number(row.cumplen||0)+Number(row.pendientes||0)>Number(row.totalEstudiantes)) errors.push('Cumplen y pendientes superan el total de estudiantes.');
    if(row.convocados&&row.asistentes&&Number(row.asistentes)>Number(row.convocados)) errors.push('La asistencia supera el número de convocados.');
    if(id==='reporte-final'&&Boolean(row.cedula)!==Boolean(row.estudiante)) errors.push('Completa la cédula y el nombre del estudiante para registrar el detalle individual.');
    return errors;
  }
  const keyPart = value => trim(value).replace(/\s+/g,' ').toLocaleLowerCase('es');
  function groupKey(id,raw){
    return JSON.stringify((workflow(id)?.group||['referencia']).map(k=>keyPart(raw[k])));
  }
  function uniqueKey(id,raw){
    const row=normalize(id,raw);
    const keys=['cedula','carrera','grupo','actividad','nucleo','fechaInicio','fechaExamen','fechaEvento',
      'fechaInduccion','sede','laboratorio','inicioTeorico','inicioDefensa','hora','requisito','compromiso'];
    return JSON.stringify([id,groupKey(id,row),...keys.map(k=>keyPart(row[k]))]);
  }

  const shown = (field,value) => field?.kind==='date'&&isDate(value)?value.split('-').reverse().join('/'):value;
  function tableSection(title,columns,rows,fields) {
    const specs=columns.map(c=>typeof c==='string'?column(fields.get(c)?.label||c,c):c);
    const visible=specs.filter(c=>rows.some(row=>c.keys.some(k=>row[k])));
    if(!visible.length) return null;
    return {
      title,headers:visible.map(c=>c.label),
      rows:rows.map(row=>visible.map(c=>{
        const populated=c.keys.filter(k=>row[k]);
        return populated.map(k=>{
          const field=fields.get(k),value=shown(field,row[k]);
          return c.keys.length===1?value:(field?.label||k)+': '+value;
        }).join('\n');
      }))
    };
  }
  function toDocument(rawRows,type,periodId,base) {
    const spec=workflow(type.id);
    if(!spec||spec.route||!rawRows.length) throw Error('No hay registros de preparación para este documento.');
    const rows=rawRows.map(row=>normalize(type.id,row)),row=rows[0];
    if((spec.single&&rows.length!==1)||rows.some(value=>groupKey(type.id,value)!==groupKey(type.id,row)))
      throw Error('Selecciona registros de una sola convocatoria o corte para preparar el PDF.');
    const fieldMap=new Map(schema(type.id).map(field=>[field.key,field]));
    const sections=[];
    if(!spec.attendance) {
      const details=[...new Set(['referencia','convocatoria','modalidad','fechaCorte',...(spec.details||[])])];
      const facts=details.flatMap(key=>[...new Set(rows.map(r=>r[key]).filter(Boolean))]
        .map(value=>[fieldMap.get(key)?.label||key,shown(fieldMap.get(key),value)]));
      if(facts.length) sections.push({title:'Datos del documento',headers:['Campo','Detalle'],rows:facts});
    }
    if(spec.table){
      const tableRows=spec.requirementsReport?rows.filter(r=>!r.cedula):rows;
      const section=tableSection(spec.table,spec.columns,tableRows,fieldMap);
      if(section)sections.push(section);
    }
    if(spec.requirements) sections.push({
      title:'Verificación de requisitos',headers:['Requisito','Estado registrado'],
      rows:requirementFields.map(f=>[f.label,row[f.key]||'SIN DATO'])
    });
    if(spec.requirementsReport){
      const students=rows.filter(r=>r.cedula);
      if(students.length){
        const byCareer=new Map();
        for(const student of students){
          const totals=byCareer.get(student.carrera)||[0,0,0,0];
          const state=student.estadoRequisitos;
          totals[0]++;
          if(state==='CUMPLE')totals[1]++;
          else if(state==='NO CUMPLE'||state==='PENDIENTE')totals[2]++;
          else totals[3]++;
          byCareer.set(student.carrera,totals);
        }
        sections.push({
          title:'Resumen de los registros individuales incluidos',
          headers:['Carrera','Registros','Cumplen','Pendientes o no cumplen','Sin dato'],
          rows:[...byCareer].map(([carrera,totals])=>[carrera,...totals])
        },{
          title:'Detalle de requisitos por estudiante',headers:['Carrera','Identificación','Estado','Requisitos'],
          rows:students.map(r=>[r.carrera,r.estudiante+'\n'+r.cedula,r.estadoRequisitos||'SIN DATO',
            requirementFields.map(f=>f.label+': '+(r[f.key]||'SIN DATO')).join('\n')])
        });
      }
    }
    for(const key of spec.text||[]){
      const contents=[...new Set(rows.map(r=>r[key]).filter(Boolean))];
      if(contents.length||type.id==='informe-final')sections.push({title:fieldMap.get(key).label,text:contents.join('\n')});
    }
    if(type.id==='informe-induccion'){
      const counts=rows.map(r=>[r.convocados,r.asistentes]);
      if(counts.every(([total,assisted])=>total&&assisted)){
        const total=counts.reduce((sum,[value])=>sum+Number(value),0);
        const assisted=counts.reduce((sum,[,value])=>sum+Number(value),0);
        const metric=total?new Intl.NumberFormat('es-EC',{style:'percent',maximumFractionDigits:1}).format(assisted/total):'Sin convocados registrados';
        sections.push({title:'Cobertura general',headers:['Convocados','Asistentes','Asistencia'],rows:[[total,assisted,metric]]});
      }
    }
    const now=new Date().toISOString();
    const careers=[...new Set(rows.map(r=>r.carrera).filter(Boolean))];
    const data={
      ...base,
      id:'registro_'+Date.now()+'_'+Math.random().toString(36).slice(2,9),
      tipoId:type.id,periodId,
      asunto:row.asunto||type.nombre,fecha:row.fechaReunion||row.fecha,carrera:careers.length===1?careers[0]:'',
      contenido:[...new Set(rows.map(r=>r.contenido).filter(Boolean))].join('\n'),
      documentSections:sections,
      createdAt:now,updatedAt:now,estado:'Borrador'
    };
    if(type.id==='plan-examen'){
      const periodLabel=window.UTET_DATA?.periodos.find(period=>period.id===periodId)?.label||periodId;
      data.planExamen=window.UTET_PLAN_EXAMEN.create(rows,periodLabel);
    }
    if(spec.recipient){
      data.destinatario=spec.recipient;
      data.remitenteNombre=type.id==='solicitud-ingreso'?row.estudiante:base.nombreElaborado;
      data.remitenteCargo=type.id==='solicitud-ingreso'?'Estudiante':base.cargoElaborado;
    }
    if(spec.attendance){
      const confirmed=rows.filter(value=>value.asistio==='Sí');
      data.tema=row.tema;data.capacitador=row.capacitador;data.jefeInmediato=row.jefeInmediato;
      data.asistentes=confirmed.map(r=>[r.cedula,r.estudiante,r.carrera,r.firma||r.evidencia]
        .map(value=>value.replace(/[;\r\n]/g,' ')).join(';')).join('\n');
    }
    return data;
  }
  const toEditor = (row,type,periodId,base) => toDocument([row],type,periodId,base);
  window.UTET_RECORDS=Object.freeze({definitions,allIds,workflow,schema,headers,empty,normalize,validate,groupKey,uniqueKey,toDocument,toEditor});
})();
