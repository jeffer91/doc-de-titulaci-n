'use strict';
/* Modelo determinista de PRO-164: datos verificados -> tablas + gráficas -> HTML A4.
   Ningún porcentaje o fuente se deduce automáticamente de otras cifras. */
(function(root){
  const SOURCE_TYPES=[
    {key:'google',label:'Google',symbol:'G'},
    {key:'web',label:'Sitios web',symbol:'WWW'},
    {key:'repositorios',label:'Repositorios académicos',symbol:'R'},
    {key:'publicaciones',label:'Publicaciones',symbol:'P'},
    {key:'documentos',label:'Documentos',symbol:'D'},
    {key:'trabajos',label:'Trabajos académicos',symbol:'T'}
  ];
  const E=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t=x=>String(x==null?'':x).trim();
  const number=x=>{
    if(x===null||x===undefined||t(x)==='')return null;
    const s=t(x).replace(',','.');
    if(!/^\d{1,3}(\.\d{1,2})?$/.test(s))return null;
    const n=Number(s);
    return Number.isFinite(n)&&n>=0&&n<=100?n:null;
  };
  const pformat=x=>number(x)===null?'Sin registro':number(x).toLocaleString('es-EC',{maximumFractionDigits:2})+' %';
  const isDate=x=>{
    const s=t(x);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const [y,m,d]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
  };
  const day=x=>isDate(x)?t(x).split('-').reverse().join('/'):'Sin fecha';
  function createRow(student){
    return {estudianteId:t(student.estudianteId),cedula:t(student.cedula),
      nombres:t(student.nombres),carreraId:t(student.carreraId),
      carreraNombre:t(student.carreraNombre),
      retirado:student.retirado===true, similitud:'',fechaReporte:'',referencia:'',
      herramienta:'',confirmado:false,fuentes:Object.fromEntries(SOURCE_TYPES.map(x=>[x.key,'unknown']))};
  }
  function rowState(r){
    const n=number(r.similitud);
    return n===null?'Sin registro':n<=19?'En rango operativo':'Fuera del rango operativo';
  }
  function validate(rows,meta){
    const errors=[];
    if(!rows.length)errors.push('Selecciona al menos un estudiante de Firebase.');
    if(!t(meta.codigo))errors.push('Ingresa el código real del memorando.');
    else if(/0X|20XX|AÑO|MES|XXX|\[|\]/i.test(t(meta.codigo)))
      errors.push('El código del memorando contiene marcadores de plantilla.');
    if(!t(meta.destinatario))errors.push('Indica el nombre de la autoridad destinataria.');
    if(!t(meta.cargoDestinatario))errors.push('Indica el cargo de la autoridad.');
    if(!t(meta.fecha)||day(meta.fecha)==='Sin fecha')errors.push('Indica la fecha del memorando.');
    if(!t(meta.fechaCorte)||day(meta.fechaCorte)==='Sin fecha')errors.push('Indica la fecha de corte.');
    const ids=new Set(),cedulas=new Set();
    rows.forEach((r,i)=>{
      const name=t(r.nombres)||'Fila '+(i+1);
      if(!t(r.estudianteId)||ids.has(r.estudianteId))errors.push('Identidad Firebase duplicada o faltante: '+name);
      ids.add(r.estudianteId);
      if(!t(r.cedula)||cedulas.has(r.cedula))errors.push('Cédula duplicada o faltante: '+name);
      cedulas.add(r.cedula);
      if(!t(r.nombres)||!t(r.carreraNombre))errors.push('Datos de identificación incompletos: '+name);
      if(number(r.similitud)===null)errors.push('Porcentaje ausente o inválido (0–100): '+name);
      else if(number(r.similitud)>19)errors.push('El resultado real supera el rango operativo de emisión (19 %): '+name);
      if(!t(r.fechaReporte)||day(r.fechaReporte)==='Sin fecha')errors.push('Fecha de evidencia pendiente: '+name);
      if(r.confirmado!==true)errors.push('Debes confirmar la consulta de la evidencia real: '+name);
    });
    return errors;
  }
  function group(rows){
    const groups=new Map();
    rows.forEach(r=>{const name=t(r.carreraNombre)||'Carrera no informada';
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push(r);
    });
    return [...groups].sort((a,b)=>a[0].localeCompare(b[0],'es'))
      .map(([name,items])=>({name,items:items.slice().sort((a,b)=>a.nombres.localeCompare(b.nombres,'es'))}));
  }
  function summary(rows){
    const present=rows.filter(r=>number(r.similitud)!==null);
    const nums=present.map(r=>number(r.similitud));
    const inRange=nums.filter(n=>n<=19).length,outRange=nums.filter(n=>n>19).length;
    const bands=[{label:'0–4,99 %',from:0,to:5},{label:'5–9,99 %',from:5,to:10},
      {label:'10–14,99 %',from:10,to:15},{label:'15–19 %',from:15,to:20},
      {label:'Más de 19 %',from:20,to:101}];
    // El rango 19,01–19,99 también está fuera del rango operativo.
    const counts=[0,0,0,0,0];
    for(const n of nums){if(n<5)counts[0]++;else if(n<10)counts[1]++;
      else if(n<15)counts[2]++;else if(n<=19)counts[3]++;else counts[4]++;}
    return {total:rows.length,present:present.length,missing:rows.length-present.length,
      inRange,outRange,minimum:nums.length?Math.min(...nums):null,
      maximum:nums.length?Math.max(...nums):null,
      average:nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null,
      bands:bands.map((b,i)=>({...b,count:counts[i]})),
      careers:group(rows).map(g=>{
        const values=g.items.map(r=>number(r.similitud)).filter(v=>v!==null);
        return {name:g.name,count:g.items.length,withResult:values.length,
          average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};
      }),
      sources:SOURCE_TYPES.map(s=>({...s,detected:rows.filter(r=>r.fuentes?.[s.key]==='detected').length,
        evaluated:rows.filter(r=>['detected','not-detected'].includes(r.fuentes?.[s.key])).length}))};
  }
  const escapeFilename=x=>t(x).replace(/[^\p{L}\p{N}_.-]/gu,'_').slice(0,85);
  // Gráficos vectoriales autocontenidos: colores activos únicamente con evidencia.
  const glyphs={
    google:'<svg viewBox="0 0 48 48"><path fill="#4285F4" d="M43 24.5c0-1.4-.1-2.8-.4-4.1H24v7.9h10.6c-.5 2.5-1.9 4.7-4 6.1v5h6.5C40.9 35.9 43 30.8 43 24.5Z"/><path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.1-4.6l-6.5-5c-1.8 1.2-4.1 1.9-6.6 1.9-5.1 0-9.4-3.5-11-8.2H6.3v5.2C9.5 39.2 16.2 44 24 44Z"/><path fill="#FBBC05" d="M13 28.1c-.4-1.2-.6-2.6-.6-4.1s.2-2.9.6-4.1v-5.2H6.3A20 20 0 0 0 4 24c0 3.3.8 6.5 2.3 9.3l6.7-5.2Z"/><path fill="#EA4335" d="M24 11.7c2.9 0 5.5 1 7.6 3l5.7-5.7A19.6 19.6 0 0 0 24 4C16.2 4 9.5 8.8 6.3 15.7l6.7 5.2c1.6-4.7 5.9-9.2 11-9.2Z"/></svg>',
    web:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 6-6 12 0 18M12 3c6 6 6 12 0 18"/></svg>',
    repositorios:'<svg viewBox="0 0 24 24"><path d="m2 9 10-5 10 5-10 5-10-5Zm4 3v5c4 4 8 4 12 0v-5M22 9v8"/></svg>',
    publicaciones:'<svg viewBox="0 0 24 24"><path d="M12 6c-4-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-6-1-10 2Zm0 0v15"/></svg>',
    documentos:'<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6V2Zm9 0v5h5M9 12h8M9 16h8"/></svg>',
    trabajos:'<svg viewBox="0 0 24 24"><path d="M8 4h11v16H8zM5 8H3v14h12v-2M11 9h5M11 13h5"/></svg>'
  };
  const glyph=key=>glyphs[key]||'';
  const spans=(s)=>SOURCE_TYPES.filter(k=>s?.[k.key]==='detected'||s?.[k.key]==='not-detected')
    .map(k=>'<span class="ap-src ap-src-'+k.key+' '+(s[k.key]==='detected'?'ap-src-on':'ap-src-off')+'" title="'+E(k.label)+'">'+glyph(k.key)+'</span>').join('');
  const sourceLegend=()=>'<div class="ap-source-legend">'+SOURCE_TYPES.map(k=>'<span>'+
    '<span class="ap-src ap-src-on ap-src-'+k.key+'">'+glyph(k.key)+'</span>'+E(k.label)+'</span>').join('')+'</div>';
  function metaBlock(meta,period){
    return '<dl class="ap-details">'+
      '<div><dt>Período académico</dt><dd>'+E(period)+'</dd></div>'+
      '<div><dt>Fecha de corte</dt><dd>'+E(day(meta.fechaCorte))+'</dd></div>'+
      '<div><dt>Herramienta</dt><dd>'+E(meta.herramienta||'Según evidencia individual')+'</dd></div>'+
      '<div><dt>Rango operativo</dt><dd>0–19 % (no equivale a una aprobación académica)</dd></div>'+
      '<div><dt>Memorando</dt><dd>'+E(meta.codigo||'Pendiente de asignación')+'</dd></div></dl>';
  }
  function metrics(data){
    return '<div class="ap-metrics">'+[
      ['Estudiantes incluidos',data.total],
      ['Con resultado registrado',data.present],
      ['En rango operativo',data.inRange],
      ['Fuera del rango',data.outRange]
    ].map(x=>'<div class="ap-metric"><strong>'+x[1]+'</strong><span>'+E(x[0])+'</span></div>').join('')+'</div>';
  }
  function tableHead(){return '<thead><tr><th>N.º</th><th>Cédula</th><th>Apellidos y nombres</th><th>Similitud</th><th>Condición</th><th>Reporte / fecha</th></tr></thead>';}
  function tableRows(items,offset){
    return items.map((r,i)=>'<tr><td>'+(offset+i+1)+'</td><td>'+E(r.cedula)+'</td>'+
      '<td>'+E(r.nombres)+'</td><td class="ap-number">'+E(pformat(r.similitud))+'</td>'+
      '<td>'+E(rowState(r))+'</td><td>'+E(r.referencia||'Sin referencia')+'<br>'+E(day(r.fechaReporte))+'</td></tr>').join('');
  }
  function tableGroups(rows,firstCapacity=11,otherCapacity=19){
    const groups=group(rows),parts=[],flat=[];
    let order=0;
    groups.forEach(g=>g.items.forEach((r,index)=>flat.push({career:g.name,row:r,n:++order,first:index===0})));
    let current=[],limit=firstCapacity,previous='';
    for (let i=0;i<flat.length;i++){
      const x=flat[i];
      // Un cambio de carrera consume espacio adicional por su cabecera.
      const used=current.length+current.filter(z=>z.career!==z.prior).length;
      const extra=x.career!==previous?2:1;
      if(current.length && used+extra>limit){parts.push(current);current=[];limit=otherCapacity;previous='';}
      current.push({...x,prior:previous});
      previous=x.career;
    }
    if(current.length)parts.push(current);
    if(!parts.length)parts.push([]);
    return parts.map(items=>{
      let html='',previous='';
      for(const x of items){
        if(x.career!==previous){
          if(previous)html+='</tbody></table>';
          html+='<h3 class="ap-career">'+E(x.career)+(x.first?'':' (continuación)')+'</h3><table class="ap-result-table">'+tableHead()+'<tbody>';
          previous=x.career;
        }
        html+=tableRows([x.row],x.n-1);
      }
      if(previous)html+='</tbody></table>';
      return html || '<p class="ap-empty">Todavía no se han seleccionado estudiantes.</p>';
    });
  }
  function bar(label,value,max,extra=''){
    const pct=max>0?Math.min(100,100*value/max):0;
    return '<div class="ap-bar-row"><div class="ap-bar-label">'+E(label)+'</div><div class="ap-track">'+
      '<span class="ap-fill" style="width:'+pct.toFixed(2)+'%"></span>'+
      '<strong class="ap-bar-number">'+E(extra||String(value))+'</strong></div></div>';
  }
  function graphBands(data){
    const max=Math.max(1,...data.bands.map(b=>b.count));
    return '<h2>Distribución por rangos de similitud</h2><div class="ap-chart">'+
      data.bands.map(b=>bar(b.label,b.count,max,b.count+' estudiantes')).join('')+'</div>';
  }
  function graphCareers(items){
    const vals=items.filter(x=>x.average!==null),max=100;
    return '<h2>Promedio de similitud por carrera</h2><div class="ap-chart">'+
      (vals.length?vals.map(x=>bar(x.name,x.average,max,pformat(x.average))).join('')
        :'<p>Sin resultados verificables para la comparación.</p>')+'</div>'+
      '<p class="ap-caption">Los promedios son descriptivos; no sustituyen la evaluación académica.</p>';
  }
  function graphSources(data){
    const measured=data.sources.filter(s=>s.evaluated>0),max=Math.max(1,...measured.map(s=>s.detected));
    return '<h2>Fuentes identificadas en las evidencias</h2><div class="ap-chart">'+
      (measured.length?measured.map(x=>bar(x.label,x.detected,max,x.detected+' de '+x.evaluated+' evaluados')).join('')
        :'<p>Los reportes registrados no contienen información verificable sobre fuentes de coincidencia.</p>')+
      '</div><p class="ap-caption">Una persona puede presentar varias fuentes. Las frecuencias no deben sumarse como si fueran estudiantes distintos.</p>';
  }
  function graphConditions(data){
    const max=Math.max(1,data.total);
    return '<h2>Situación general del lote</h2><div class="ap-chart">'+
      bar('En rango operativo',data.inRange,max,data.inRange+' estudiantes')+
      bar('Fuera del rango',data.outRange,max,data.outRange+' estudiantes')+
      bar('Sin registro',data.missing,max,data.missing+' estudiantes')+
      '</div>'+graphShare(data);
  }
  function graphShare(data){
    if(!data.present)return '<p class="ap-caption">No se calcula proporción sin resultados registrados.</p>';
    const ratio=(100*data.inRange/data.present),pct=ratio.toFixed(1);
    return '<div class="ap-share"><div class="ap-donut" style="--ap-value:'+ratio.toFixed(2)+'%">'+
      '<span>'+pct+' %</span></div><p><strong>Proporción dentro del rango operativo</strong><br>'+
      data.inRange+' de '+data.present+' resultados registrados. Este indicador es descriptivo, no una declaración de aprobación.</p></div>';
  }
  function page(body,css=''){return {body,css};}
  function reportPage(body,meta,period,first){
    return '<header class="ap-report-header"><img src="assets/logo-itsqmet.png" alt="ITSQMET"/>'+
      '<span>Unidad de Titulación y Eficiencia Terminal</span></header>'+
      (first?'<h1>REPORTE DE PORCENTAJE DE ANTIPLAGIO</h1>'+
        '<p class="ap-subtitle">ÍNDICES DE SIMILITUD | TRABAJOS DE TITULACIÓN</p>'+metaBlock(meta,period)
        :'<h1 class="ap-cont-title">REPORTE DE SIMILITUD · CONTINUACIÓN</h1>')+body;
  }
  function memo(meta,period,count){
    const subject='Remisión del reporte de antiplagio (porcentajes de similitud) de trabajos de titulación';
    return '<header class="ap-memo-header"><img src="assets/logo-itsqmet.png" alt="ITSQMET"/>'+
      '<span>UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</span></header>'+
      '<h1 class="ap-memo-title">Memorando No. '+E(meta.codigo||'[CÓDIGO INSTITUCIONAL]')+'</h1>'+
      '<table class="ap-memo-fields"><tbody>'+
      '<tr><th>PARA</th><td>'+E(meta.destinatario)+'<br>'+E(meta.cargoDestinatario)+'</td></tr>'+
      '<tr><th>DE</th><td>MSc. Jefferson Edgar Villarreal Enríquez<br>Coordinador de Titulación</td></tr>'+
      '<tr><th>ASUNTO</th><td>'+E(subject)+'</td></tr>'+
      '<tr><th>FECHA</th><td>'+E(day(meta.fecha))+'</td></tr></tbody></table>'+
      '<div class="ap-memo-body"><p>De mi consideración:</p>'+
      '<p>Por medio del presente, remito el reporte consolidado de los porcentajes de similitud correspondientes a los trabajos de titulación de los '+count+
      ' estudiantes seleccionados del período académico <strong>'+E(period)+'</strong>.</p>'+
      '<p>El detalle, que inicia en la segunda página, presenta la identificación de los estudiantes, la carrera, el resultado registrado y, cuando corresponda, la referencia del reporte que respalda cada porcentaje.</p>'+
      '<p>El porcentaje de similitud identifica coincidencias de contenido y no constituye, por sí solo, una determinación de plagio. La interpretación académica de los resultados corresponde a la instancia competente conforme a los lineamientos institucionales aplicables.</p>'+
      '<p>Remito la presente información para su conocimiento y los fines pertinentes.</p></div>'+
      '<div class="ap-signature"><p>Atentamente,</p><div class="ap-sign-space"></div>'+
      '<strong>MSc. Jefferson Edgar Villarreal Enríquez</strong><span>COORDINADOR DE TITULACIÓN</span></div>'+
      '<p class="ap-annex">Anexo: Reporte consolidado de resultados de similitud.</p>';
  }
  function renderPDF(meta,rows,periodLabel){
    const data=summary(rows),groups=tableGroups(rows),pages=[page(memo(meta,periodLabel,rows.length),'ap-memo-page')];
    groups.forEach((html,index)=>{
      let intro=index===0?'<h2>RESUMEN DEL LOTE GENERADO</h2>'+metrics(data)+'<h2>DETALLE DE RESULTADOS POR CARRERA</h2>':'';
      pages.push(page(reportPage(intro+html,meta,periodLabel,index===0),'ap-report-page'));
    });
    const compact=rows.length===1 && data.careers.length===1;
    if(compact){
      // Caso de aceptación: 1 estudiante = memorando y reporte en exactamente 2 páginas.
      pages[1].body += graphBands(data)+graphSources(data)+
        '<h2>Fuentes verificadas para el estudiante</h2>'+sourceLegend()+'<div class="ap-source-index">'+
        '<div><strong>'+E(rows[0].nombres)+'</strong><span>'+spans(rows[0].fuentes)+'</span></div></div>';
    }else{
      pages.push(page(reportPage(graphBands(data)+graphConditions(data)+
        '<p class="ap-caption">La distribución utiliza únicamente porcentajes registrados. Un 0 % real no es un dato ausente.</p>',meta,periodLabel,false),'ap-chart-page'));
      const careers=data.careers;
      for(let i=0;i<careers.length;i+=9){
        pages.push(page(reportPage(graphCareers(careers.slice(i,i+9)),meta,periodLabel,false),'ap-chart-page'));
      }
      const indexed=rows.filter(r=>spans(r.fuentes));
      if(indexed.length){
        for(let i=0;i<indexed.length;i+=16){
          const group=indexed.slice(i,i+16);
          pages.push(page(reportPage((i===0?graphSources(data):'')+
            '<h2>Indicadores de fuentes por estudiante'+(i?' (continuación)':'')+'</h2>'+
            '<p class="ap-caption">Activo: fuente detectada en evidencia. Gris: no detectada según evidencia. Sin información: no se presume ausente.</p>'+
            sourceLegend()+'<div class="ap-source-index">'+group.map(r=>'<div><strong>'+E(r.nombres)+'</strong><span>'+spans(r.fuentes)+'</span></div>').join('')+
            '</div>',meta,periodLabel,false),'ap-chart-page'));
        }
      }else{
        pages.push(page(reportPage(graphSources(data),meta,periodLabel,false),'ap-chart-page'));
      }
    }
    const html=pages.map((p,i)=>'<section class="inst-page ap-page '+p.css+'">'+p.body+
      '<footer class="ap-footer"><span>ITSQMET · UTET · Reporte de similitud</span>'+
      '<span>Página '+(i+1)+' de '+pages.length+'</span></footer></section>').join('');
    return '<div class="institutional-document inst-antiplagio">'+html+'</div>';
  }
  root.UTET_ANTIPLAGIO_MODEL=Object.freeze({
    SOURCE_TYPES,E,number,pformat,day,createRow,rowState,validate,group,summary,renderPDF,escapeFilename
  });
})(typeof window!=='undefined'?window:globalThis);
