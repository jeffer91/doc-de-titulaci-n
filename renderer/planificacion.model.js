'use strict';

(function (root) {
  const examTemplate = Object.freeze({
    version: '1.0',
    introduccion: 'La Unidad de Titulación y Eficiencia Terminal organiza la Planificación del Examen Complexivo para orientar la preparación, la evaluación y el seguimiento de esta modalidad. El documento reúne las actividades previstas, sus fechas, los responsables y los entregables de las carreras y grupos que participan en el período académico.',
    baseLegal: 'La planificación toma como marco el Reglamento de Régimen Académico del Consejo de Educación Superior, en su texto aplicable al período. En el ámbito institucional, se articula con el Manual de Procesos de la Unidad de Titulación y Eficiencia Terminal, en particular con la planificación semestral, los seminarios complexivos y la ejecución del Examen Complexivo.',
    metodologia: 'Se parte del calendario académico y de la información coordinada con las carreras. Las actividades se organizan por etapa, carrera o grupo, con fechas previstas, responsables, entregables y evidencias de respaldo. La UTET consolida la programación, revisa la coherencia de los datos y remite la planificación a las instancias correspondientes para su validación.',
    referencias: 'Consejo de Educación Superior. Reglamento de Régimen Académico. Resolución RPC-SE-08-No.023-2022 y reformas aplicables al período.\nInstituto Superior Tecnológico Quito Metropolitano. Manual de Procesos de la Unidad de Titulación y Eficiencia Terminal, versión 2.0. Procesos UTET-PRO-56, UTET-PRO-88 y UTET-PRO-93.'
  });
  const workTemplate = Object.freeze({
    version: '1.0',
    introduccion: 'La Unidad de Titulación y Eficiencia Terminal organiza el Trabajo de Titulación como un proceso de investigación que culmina con la presentación y evaluación de un documento escrito. Esta planificación orienta el desarrollo del trabajo y reúne las etapas, tutorías, revisiones, entregables y actividades de evaluación que correspondan al período académico.',
    baseLegal: 'La planificación toma como marco el Reglamento de Régimen Académico del Consejo de Educación Superior, en su texto aplicable al período. En el ámbito institucional, se articula con el Manual de Procesos de la Unidad de Titulación y Eficiencia Terminal en lo relativo a la planificación semestral, el ingreso al Trabajo de Titulación y la ejecución de esta modalidad.',
    metodologia: 'La programación se construye a partir del calendario académico y de la coordinación con las carreras y la Unidad de Investigación e Innovación. Las actividades de formulación, desarrollo, tutoría, revisión, entrega y defensa se registran según el cronograma del período. La UTET revisa las fechas, los responsables y los entregables previstos para facilitar el seguimiento y la validación de la planificación.',
    referencias: 'Consejo de Educación Superior. Reglamento de Régimen Académico. Resolución RPC-SE-08-No.023-2022 y reformas aplicables al período.\nInstituto Superior Tecnológico Quito Metropolitano. Manual de Procesos de la Unidad de Titulación y Eficiencia Terminal, versión 2.0. Procesos UTET-PRO-56, UTET-PRO-96 y UTET-PRO-164.'
  });
  const types=Object.freeze({
    'plan-examen':{nombre:'Planificación del Examen Complexivo',template:examTemplate},
    'plan-trabajo':{nombre:'Planificación del Trabajo de Titulación',template:workTemplate}
  });
  const supports=id=>Object.hasOwn(types,id);
  function typeFor(id) {
    if(!supports(id))throw Error('El documento no tiene un formato de planificación disponible.');
    return types[id];
  }
  const fromDraft=draft=>draft?.planificacion||draft?.planExamen||null;
  const textLabels = Object.freeze({
    contexto: 'Contexto del período',
    conclusiones: 'Conclusiones',
    recomendaciones: 'Recomendaciones'
  });
  const figureLabels = Object.freeze({
    gantt: 'Cronograma de actividades programadas',
    flujo: 'Secuencia de etapas de la planificación',
    sedes: 'Esquema de actividades por sede'
  });
  const maxRecords = 2500;
  const dayMs = 86400000;
  const clean = (value, size=240) => typeof value==='string' ? value.trim().slice(0,size) : '';
  const unique = values => [...new Set(values.filter(Boolean))];
  const list = values => new Intl.ListFormat('es-EC',{type:'conjunction'}).format(values);
  const counted = (count,singular,plural) => count+' '+(count===1?singular:plural);
  const summaries = new WeakMap();

  function day(value) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date=new Date(value+'T00:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value ? date.getTime()/dayMs : null;
  }
  const shortDate=new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
  const fullDate=new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
  const dateLabel = (value,withYear=true) => (withYear?fullDate:shortDate).format(new Date(value*dayMs));

  function normalizeRows(rawRows) {
    if(!Array.isArray(rawRows)||rawRows.length>maxRecords) throw Error('La planificación admite hasta '+maxRecords+' actividades por documento.');
    return rawRows.map(row=>({
      actividad:clean(row?.actividad),etapa:clean(row?.etapa),carrera:clean(row?.carrera),grupo:clean(row?.grupo),
      sede:clean(row?.sede),fechaInicio:clean(row?.fechaInicio,24),fechaFin:clean(row?.fechaFin,24),
      ordenEtapa:clean(row?.ordenEtapa,12),tutoria:clean(row?.tutoria),entregable:clean(row?.entregable),
      tieneResponsable:typeof row?.tieneResponsable==='boolean'?row.tieneResponsable:Boolean(clean(row?.responsable)),
      tieneEntregable:typeof row?.tieneEntregable==='boolean'?row.tieneEntregable:Boolean(clean(row?.entregable))
    }));
  }

  function stepsFor(rows, dated, phases) {
    if(phases.length<2) return [];
    const ordered=new Map();
    for(const row of rows){
      const order=/^[1-9]\d{0,2}$/.test(row.ordenEtapa)?Number(row.ordenEtapa):0;
      if(!row.etapa||!order||ordered.has(row.etapa)&&ordered.get(row.etapa)!==order){
        ordered.clear();
        break;
      }
      ordered.set(row.etapa,order);
    }
    if(ordered.size===phases.length){
      const steps=[...new Set(ordered.values())].sort((a,b)=>a-b)
        .map(order=>({order,labels:[...ordered].filter(([,n])=>n===order).map(([name])=>name)}));
      if(steps.length>1)return steps;
    }
    // Fechas superpuestas no establecen un orden de etapas.
    if(dated.length!==rows.length||rows.some(row=>!row.etapa))return [];
    const ranges=new Map();
    for(const row of dated){
      const [first,last]=ranges.get(row.etapa)||[row.start,row.end];
      ranges.set(row.etapa,[Math.min(first,row.start),Math.max(last,row.end)]);
    }
    const series=[...ranges].sort((a,b)=>a[1][0]-b[1][0]);
    if(series.some((item,i)=>i>0&&series[i-1][1][1]>=item[1][0]))return [];
    return series.map(([label],i)=>({order:i+1,labels:[label]}));
  }

  function summarize(rows) {
    if(summaries.has(rows))return summaries.get(rows);
    const dated=rows.map((row,index)=>({...row,index,start:day(row.fechaInicio),end:day(row.fechaFin)}))
      .filter(row=>row.start!==null&&row.end!==null&&row.end>=row.start)
      .sort((a,b)=>a.start-b.start||a.end-b.end||a.index-b.index);
    const phases=unique(rows.map(row=>row.etapa));
    const careers=unique(rows.map(row=>row.carrera));
    const sites=new Map();
    for(const row of rows){
      if(!row.sede)continue;
      const key=row.sede.toLocaleLowerCase('es-EC');
      if(!sites.has(key))sites.set(key,{label:row.sede,activities:0,careers:new Set()});
      const site=sites.get(key);
      site.activities++;
      if(row.carrera)site.careers.add(row.carrera);
    }
    const summary={
      total:rows.length,dated,phases,careers,sites:[...sites.values()].sort((a,b)=>a.label.localeCompare(b.label,'es-EC')),
      steps:stepsFor(rows,dated,phases),
      pendingDates:rows.length-dated.length,
      pendingResponsible:rows.filter(row=>!row.tieneResponsable).length,
      pendingDeliverables:rows.filter(row=>!row.tieneEntregable).length,
      pendingActivities:rows.filter(row=>!row.actividad).length,
      start:dated.length?dated[0].start:null,
      end:dated.length?Math.max(...dated.map(row=>row.end)):null
    };
    summaries.set(rows,summary);
    return summary;
  }

  function available(summary) {
    return [
      ...(summary.dated.length?['gantt']:[]),
      ...(summary.steps.length?['flujo']:[]),
      ...(summary.sites.length>=2?['sedes']:[])
    ];
  }

  function compose(periodo, summary, rows, tipoId) {
    const {total,careers,phases,start,end,pendingDates,pendingResponsible,pendingDeliverables,pendingActivities}=summary;
    if(!total)return {
      contexto:'Las actividades del período se incorporan desde los registros de planificación.',
      conclusiones:'La planificación está pendiente de consolidar.',
      recomendaciones:'Cargar las actividades del período y revisar su programación con las coordinaciones de carrera.'
    };
    const careerText=careers.length>0&&careers.length<=4?' para '+list(careers):
      careers.length?' para '+counted(careers.length,'carrera','carreras'):'';
    const namedActivities=unique(rows.map(row=>row.actividad));
    const phaseText=phases.length&&phases.length<=6?' Las etapas registradas incluyen '+list(phases)+'.':
      phases.length?' La programación se organiza en '+counted(phases.length,'etapa','etapas')+'.':
        namedActivities.length?' Entre las actividades previstas se incluyen '+list(namedActivities.slice(0,4))+'.':'';
    const dateText=start===null?'':start===end?' La fecha consignada es el '+dateLabel(start)+'.':
      ' Las fechas completas registradas abarcan del '+dateLabel(start)+' al '+dateLabel(end)+'.';
    const pendiente=[
      pendingDates&&counted(pendingDates,'actividad sin fechas completas','actividades sin fechas completas'),
      pendingResponsible&&counted(pendingResponsible,'actividad sin responsable','actividades sin responsable'),
      pendingDeliverables&&counted(pendingDeliverables,'actividad sin entregable','actividades sin entregable'),
      pendingActivities&&counted(pendingActivities,'registro sin nombre de actividad','registros sin nombre de actividad')
    ].filter(Boolean);
    const recommendations=[
      pendingActivities&&'Precisar el nombre de las actividades pendientes de descripción.',
      pendingDates&&'Confirmar las fechas pendientes y actualizar el cronograma antes de socializarlo.',
      pendingResponsible&&'Completar las asignaciones de responsables con las coordinaciones de carrera.',
      pendingDeliverables&&'Registrar los entregables pendientes para facilitar el seguimiento de las actividades.'
    ].filter(Boolean);
    const trabajo=tipoId==='plan-trabajo';
    const tutorias=trabajo?rows.filter(row=>row.tutoria).length:0;
    const tutorText=tutorias?' La tutoría o revisión consta en '+counted(tutorias,'actividad','actividades')+'.':'';
    const followUp=trabajo?'Confirmar con las coordinaciones de carrera y la Unidad de Investigación e Innovación las tutorías y los plazos de revisión de los entregables antes de socializar el cronograma.':
      'Validar la programación con las coordinaciones de carrera y confirmar la disponibilidad de los espacios antes de socializar el cronograma.';
    return {
      contexto:'La planificación '+(trabajo?'del Trabajo de Titulación para el período ':'del período ')+periodo+' reúne '+counted(total,'actividad programada','actividades programadas')+careerText+'.'+phaseText+dateText+tutorText,
      conclusiones:pendiente.length?'La revisión de los registros de planificación identifica '+list(pendiente)+'.':
        'Las actividades registradas cuentan con fechas, responsables y entregables consignados para el seguimiento del período.',
      recomendaciones:recommendations.join('\n')||followUp
    };
  }

  function captionFor(type, summary) {
    if(type==='gantt')return 'La figura recoge '+counted(summary.dated.length,'actividad','actividades')+
      ' con fechas completas'+(summary.pendingDates?' de '+summary.total+' registradas':'')+'.';
    if(type==='flujo')return 'El flujo representa el orden documentado de las etapas de la planificación.';
    return 'La figura muestra la distribución de las actividades registradas en '+counted(summary.sites.length,'sede','sedes')+'.';
  }

  function create(rawRows, periodLabel, tipoId='plan-examen') {
    const periodo=clean(periodLabel,150)||'seleccionado',rows=normalizeRows(rawRows),summary=summarize(rows);
    const options=available(summary),primary=options[0]||'';
    return {
      tipoId,template:{...typeFor(tipoId).template},periodo,rows,
      text:compose(periodo,summary,rows,tipoId),
      figures:{principal:primary,complementaria:primary==='gantt'&&options.includes('sedes')?'sedes':''},
      captions:Object.fromEntries(options.map(type=>[type,captionFor(type,summary)])),
      model:''
    };
  }

  function aiInput(data) {
    const rows=normalizeRows(data?.rows);
    if(!rows.length)throw Error('Agrega actividades antes de redactar con IA local.');
    const periodo=clean(data.periodo,150)||'seleccionado';
    const tipoId=data.tipoId||'plan-examen';
    const summary=summarize(rows);
    return {
      documento:typeFor(tipoId).nombre,periodo,
      totalActividades:summary.total,
      actividadesConFechas:summary.dated.length,
      totalCarreras:summary.careers.length,
      totalEtapas:summary.phases.length,
      totalSedes:summary.sites.length,
      carreras:summary.careers.slice(0,15),
      etapas:summary.phases.slice(0,15),
      sedes:summary.sites.slice(0,15).map(site=>({sede:site.label,actividades:site.activities})),
      rangoCompleto:summary.start===null?null:{inicio:dateLabel(summary.start),fin:dateLabel(summary.end)},
      pendientes:{fechas:summary.pendingDates,responsables:summary.pendingResponsible,entregables:summary.pendingDeliverables,descripcion:summary.pendingActivities},
      muestraActividades:rows.slice(0,12).map(row=>Object.fromEntries(
        Object.entries(row).map(([key,value])=>[key,typeof value==='string'?value.slice(0,120):value])
      )),
      observaciones:clean(data.observaciones,900),
      figurasDisponibles:available(summary),
      borrador:compose(periodo,summary,rows,tipoId)
    };
  }

  const api=Object.freeze({supports,fromDraft,textLabels,figureLabels,maxRecords,dateLabel,create,summarize,available,aiInput});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.UTET_PLANIFICACION=api;
})(typeof window!=='undefined'?window:null);
