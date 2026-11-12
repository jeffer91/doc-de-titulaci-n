'use strict';
/* Portadas y cuerpo de los borradores documentales UTET. */
(() => {
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const UNIDAD = 'Unidad de Titulación y Eficiencia Terminal';
  const DEFAULT_SIGNERS = {
    elaborado: { nombre: 'Mgs. Jefferson Villarreal', cargo: 'Coordinador de Titulación y Eficiencia Terminal' },
    revisado: { nombre: 'Ing. Martha Tomalá', cargo: 'Coordinadora General de Carreras' },
    aprobado: { nombre: 'Dr. Alex León', cargo: 'Vicerrector' }
  };
  const families = {
    RGI: { label: 'Registro RGI', measure: '4,50 / 9,00 / 4,50 cm', columns: '45mm 90mm 45mm', cover: true, signed: true, authoritative: true },
    INF: { label: 'Informe INF', measure: '4,80 / 9,50 / 3,70 cm', columns: '48mm 95mm 37mm', cover: true, signed: true, authoritative: true },
    ACT: { label: 'Acta ACT (portada)', measure: '5,20 / 7,60 / 5,20 cm', columns: '52mm 76mm 52mm', cover: true, signed: true, authoritative: false },
    OFI: { label: 'Oficio', cover: false, signed: false, authoritative: true },
    MEM: { label: 'Memorando', cover: false, signed: false, authoritative: true },
    COM: { label: 'Comunicado', cover: false, signed: false, authoritative: true },
    AT:  { label: 'Acta de titulación', cover: false, signed: false, authoritative: false },
    PLAN:{ label: 'Plan de estudios (sin plantilla específica)', cover: false, signed: false, authoritative: false }
  };
  const familyFor = type => {
    if (!type) return 'PLAN';
    const c = type.codigo || '';
    if (c.includes('-RGI')) return 'RGI';
    if (c.includes('-INF')) return 'INF';
    if (c.includes('-ACT')) return 'ACT';
    return ['OFI','MEM','COM','AT'].find(x => c.startsWith(x+'-')) || 'PLAN';
  };
  const defaultDraftFields = type => {
    const family=familyFor(type), variableSign=family==='ACT';
    return {
      familia: family, unidad: UNIDAD, versionDocumento: '1.0', codigoEmitido: '',
      destinatario:'', cargoDestinatario:'', remitenteNombre:'', remitenteCargo:'',
      cargoRevisado: variableSign ? '' : DEFAULT_SIGNERS.revisado.cargo,
      nombreRevisado: variableSign ? '' : DEFAULT_SIGNERS.revisado.nombre,
      cargoAprobado: variableSign ? '' : DEFAULT_SIGNERS.aprobado.cargo,
      nombreAprobado: variableSign ? '' : DEFAULT_SIGNERS.aprobado.nombre,
      cargoElaborado: variableSign ? '' : DEFAULT_SIGNERS.elaborado.cargo,
      nombreElaborado: variableSign ? '' : DEFAULT_SIGNERS.elaborado.nombre,
      horaInicio:'', horaFin:'', lugar:'', numeroActa:'',
      participantes:'', temas:'', compromisos:'', proximaFecha:'', proximaLugar:'',
      asistentes:'', tema:'',capacitador:'',jefeInmediato:'', tituloCentral: type.nombre, destinatarioTratamiento:'De mi consideración:',
      estadoInstitucional:'BORRADOR DE MAQUETA'
    };
  };
  const normalize = (d,type) => ({...defaultDraftFields(type),...d, familia:familyFor(type)});
  const sourceCode = type => type?.codigo || 'No asignado en el manual';
  const shownCode = (d,type) => d.codigoEmitido?.trim() || 'Pendiente de control documental';
  const dateLong = iso => {
    if (!/^\d{4}-\d\d-\d\d$/.test(iso || '')) return 'Fecha pendiente';
    const [year,month,day] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(year,month-1,day));
    if (dt.getUTCFullYear()!==year || dt.getUTCMonth()!==month-1 || dt.getUTCDate()!==day) return 'Fecha pendiente';
    return `${day} de ${dt.toLocaleString('es-EC',{month:'long',timeZone:'UTC'})} de ${year}`;
  };
  const dateShort = iso => /^\d{4}-\d\d-\d\d$/.test(iso || '') ? iso.split('-').reverse().join('/') : '—';
  const lines = str => String(str || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const splitRows = str => lines(str).map(line=>line.split(';').map(x=>x.trim()));
  const paras = str => lines(str).map(s=>`<p>${E(s)}</p>`).join('') || '<p class="inst-pending">Contenido pendiente de completar.</p>';
  const seal = () => '<div class="inst-seal">MAQUETA · DOCUMENTO NO APROBADO</div>';
  const logo = () => '<img class="inst-logo" src="assets/logo-itsqmet.png" alt="Logo institucional ITSQMET"/>';
  const pagination = (page,total) => `Página ${page} de ${total}`;
  function coverHead(d,type,periodLabel,total) {
    const fam=familyFor(type),code=E(shownCode(d,type)),name=E(d.asunto||type.nombre),unit=E(d.unidad),version=E(d.versionDocumento||'1.0');
    if(fam==='RGI') return `<table class="inst-head inst-head-rgi"><colgroup><col style="width:45mm"/><col style="width:90mm"/><col style="width:45mm"/></colgroup><tbody><tr><td rowspan="2" class="inst-logo-cell">${logo()}</td><td class="inst-head-unit">${unit}</td><td rowspan="2" class="inst-head-code"><strong>Código:</strong><div>${code}</div></td></tr><tr><td class="inst-head-document"><strong>${name}</strong><br/>${E(periodLabel)}${d.carrera?'<br/>'+E(d.carrera):''}</td></tr></tbody></table>`;
    return `<table class="inst-head inst-head-${fam.toLowerCase()}"><colgroup><col style="width:${fam==='INF'?'48':'52'}mm"/><col style="width:${fam==='INF'?'95':'76'}mm"/><col style="width:${fam==='INF'?'37':'52'}mm"/></colgroup><tbody><tr><td rowspan="2" class="inst-logo-cell">${logo()}</td><td rowspan="2" class="inst-head-unit">${unit}</td><td class="inst-head-control"><strong>Código:</strong><div>${code}</div></td></tr><tr><td class="inst-head-control">Versión: ${version}</td></tr><tr><td class="inst-head-date">${fam==='ACT'?'Fecha de reunión':'Fecha de elaboración'}:<br/>${E(dateShort(d.fecha))}</td><td class="inst-head-document">${name}</td><td class="inst-head-page">${pagination(1,total)}</td></tr></tbody></table>`;
  }
  function signBlock(d) {
    const cols=[['ELABORADO POR',d.nombreElaborado,d.cargoElaborado],['REVISADO POR',d.nombreRevisado,d.cargoRevisado],['APROBADO POR',d.nombreAprobado,d.cargoAprobado]];
    return `<table class="inst-sign"><colgroup><col/><col/><col/></colgroup><tbody><tr>${cols.map(x=>`<td class="inst-sign-slot"><strong>${x[0]}:</strong></td>`).join('')}</tr><tr>${cols.map(x=>`<td><strong>NOMBRE:</strong> ${E(x[1]||'')}</td>`).join('')}</tr><tr>${cols.map(x=>`<td><strong>CARGO:</strong> ${E(x[2]||'')}</td>`).join('')}</tr></tbody></table>`;
  }
  function chunkText(text,limit=1200,maxRows=22) {
    const src=lines(text).flatMap(s => s.length>limit ? (s.match(new RegExp(`[\\s\\S]{1,${limit}}`,'g'))||[]) : [s]);
    if (!src.length) return [''];
    const chunks=[];let c='',rows=0;
    for (const x of src) {
      if(c && (c.length+x.length>limit || rows>=maxRows)){chunks.push(c);c='';rows=0;}
      c+=(c?'\n':'')+x; rows++;
    }
    if(c)chunks.push(c);
    return chunks;
  }
  const table = (headers, rows, className='') => `<table class="inst-data-table ${className}"><thead><tr>${headers.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${E(cell)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="inst-pending">Sin registros cargados</td></tr>`}</tbody></table>`;
  const printFigure=Symbol('figura generada por el documento');
  function documentBlocks(d,limit=32) {
    const blocks=[];
    let page='',used=0;
    const append=(html,weight)=>{
      if(page&&used+weight>limit){blocks.push(page);page='';used=0;}
      page+=html;used+=weight;
    };
    for(const section of d.documentSections){
      if(section?.[printFigure]){
        if(page){blocks.push(page);page='';used=0;}
        blocks.push(section[printFigure]);
        continue;
      }
      if(!section?.title)continue;
      const heading=title=>`<h3>${E(title)}</h3>`;
      if(!Array.isArray(section.headers)||!section.headers.length||!Array.isArray(section.rows)){
        for(const part of chunkText(section.text,Math.floor(limit*26),Math.floor(limit/3))){
          append(heading(section.title)+paras(part),4+lines(part).reduce((n,line)=>n+Math.max(2,Math.ceil(line.length/72)+1),0));
        }
        continue;
      }
      const width=Math.max(12,Math.floor(88/section.headers.length));
      const weight=row=>2+Math.max(...row.map(value=>lines(value).reduce((n,line)=>n+Math.ceil(line.length/width),0)));
      const printable=section.rows.flatMap(row=>{
        const maxLines=Math.floor((limit-8)/2);
        const cells=section.headers.map((_,i)=>chunkText(row[i],width*maxLines,maxLines));
        return Array.from({length:Math.max(...cells.map(c=>c.length))},(_,i)=>cells.map(c=>c[i]||''));
      });
      let batch=[],size=4;
      const flush=()=>{
        if(batch.length)append(heading(section.title)+table(section.headers,batch,'inst-workflow-table'),size);
        batch=[];size=4;
      };
      for(const row of printable){
        const cost=weight(row);
        if(batch.length&&size+cost>limit)flush();
        batch.push(row);size+=cost;
      }
      flush();
    }
    for(const [label,text] of [['Información adicional',d.contenido],['Observaciones',d.observaciones]]){
      if(!lines(text).length)continue;
      for(const part of chunkText(text,Math.floor(limit*26),Math.floor(limit/3))) append(`<h3>${label}</h3>${paras(part)}`,limit);
    }
    if(page)blocks.push(page);
    return blocks.length?blocks:['<p class="inst-pending">Sin datos documentales registrados.</p>'];
  }
  const planFor=(d,type)=>window.UTET_PLANIFICACION?.supports(type.id)?window.UTET_PLANIFICACION.fromDraft(d):null;
  function planBlocks(d,plan){
    const summary=window.UTET_PLANIFICACION.summarize(plan.rows);
    const figures=window.UTET_PLANIFICACION_FIGURES.render(plan,summary);
    const sections=[
      {title:'Introducción',text:plan.template.introduccion},
      {title:'Base legal',text:plan.template.baseLegal},
      {title:'Metodología',text:plan.template.metodologia},
      {title:'Planificación del período',text:plan.text.contexto},
      ...(d.documentSections||[]),
      ...figures.map(markup=>({[printFigure]:markup})),
      ...(d.contenido?[{title:'Información adicional',text:d.contenido}]:[]),
      ...(d.observaciones?[{title:'Observaciones',text:d.observaciones}]:[]),
      {title:'Conclusiones',text:plan.text.conclusiones},
      {title:'Recomendaciones',text:plan.text.recomendaciones},
      {title:'Referencias',text:plan.template.referencias}
    ];
    return documentBlocks({...d,documentSections:sections,contenido:'',observaciones:''});
  }
  function contentBlocks(d,type) {
    const fam=familyFor(type),result=[];
    const plan=planFor(d,type);
    if(plan)return planBlocks(d,plan);
    if(fam==='RGI' && type.id==='asistencia-induccion') {
      const r=splitRows(d.asistentes);
      const pieces=[];for(let i=0;i<r.length;i+=22)pieces.push(r.slice(i,i+22));
      if (!pieces.length)pieces.push([]);
      pieces.forEach((group,index)=>result.push(`<h2>Registro de asistencia · Inducción</h2><dl class="inst-meta-list"><div><dt>TEMA</dt><dd>${E(d.tema||'')}</dd></div><div><dt>FECHA</dt><dd>${E(dateShort(d.fecha))}</dd></div><div><dt>CAPACITADOR</dt><dd>${E(d.capacitador||'')}</dd></div><div><dt>JEFE INMEDIATO</dt><dd>${E(d.jefeInmediato||'')}</dd></div></dl>${table(['N.º','Cédula','Nombres y apellidos','Unidad / Cargo / Carrera','Firma'],group.map((r,j)=>[String(index*22+j+1),r[0]||'',r[1]||'',r[2]||'',r[3]||'']))}<p class="inst-note">Solo registrar asistentes verificados. La firma no se genera automáticamente.</p>`));
      return result;
    }
    if(Array.isArray(d.documentSections))return documentBlocks(d);
    if(fam==='ACT' && type.id==='acta-reunion') {
      const p=splitRows(d.participantes),todos=lines(d.temas),comp=splitRows(d.compromisos);
      result.push(`<h2>Datos de reunión / seguimiento</h2><dl class="inst-meta-list"><div><dt>Acta número</dt><dd>${E(d.numeroActa)}</dd></div><div><dt>Hora inicio / fin</dt><dd>${E(d.horaInicio)} / ${E(d.horaFin)}</dd></div><div><dt>Acta elaborada por</dt><dd>${E(d.nombreElaborado)}</dd></div><div><dt>Lugar</dt><dd>${E(d.lugar)}</dd></div><div><dt>Asunto</dt><dd>${E(d.asunto)}</dd></div></dl><h3>Participantes</h3>${table(['Nombres y apellidos','Cargo / Unidad / Carrera','Firma'],p.map(r=>[r[0]||'',r[1]||'',r[2]||'']))}<h3>Temas tratados</h3>${todos.length?'<ol>'+todos.map(x=>`<li>${E(x)}</li>`).join('')+'</ol>':'<p class="inst-pending">Sin temas registrados</p>'}<h3>Tareas o compromisos</h3>${table(['Actividad','Responsable','Fecha de cumplimiento'],comp.map(r=>[r[0]||'',r[1]||'',r[2]||'']))}<h3>Próxima reunión</h3><p>Fecha: ${E(dateShort(d.proximaFecha))} · Lugar: ${E(d.proximaLugar)}</p><h3>Observaciones</h3>${paras(d.observaciones)}`);
      return result;
    }
    const chunks=chunkText(d.contenido);
    chunks.forEach((chunk,i)=>result.push(`${fam==='ACT'?'<p class="inst-note">Portada ACT normalizada. El contenido particular del acta de seguimiento está pendiente de aportar y validar.</p>':''}<h2>${i===0?E(d.asunto||type.nombre):'Continuación del documento'}</h2>${paras(chunk)}${i===chunks.length-1&&d.observaciones?`<h3>Observaciones</h3>${paras(d.observaciones)}`:''}`));
    return result;
  }
  function contentPage(body,d,type,num,total) {
    const fam=familyFor(type);
    const numbered=['INF','ACT'].includes(fam)||planFor(d,type);
    return `<section class="inst-page inst-body-page" data-family="${fam}"><div class="inst-cont-header"><span>${E(d.unidad)}</span><span>${E(type.proceso)} · ${E(shownCode(d,type))}</span>${numbered?`<span>${pagination(num,total)}</span>`:''}</div><div class="inst-body-main">${body}</div><div class="inst-page-foot">Documento de maqueta · ${E(d.periodoLabel||'')} · No es una emisión oficial</div>${seal()}</section>`;
  }
  function structuredDoc(d,type) {
    const fam=familyFor(type);
    const body=contentBlocks(d,type),total=body.length+1;
    const cover=`<section class="inst-page inst-cover inst-cover-${fam.toLowerCase()}" data-family="${fam}">${coverHead(d,type,d.periodoLabel||'',total)}<div class="inst-cover-middle"><h1>${E(d.asunto||type.nombre)}</h1>${fam==='RGI'?`<h2>${E(d.periodoLabel||'')}</h2>${d.carrera?`<p>${E(d.carrera)}</p>`:''}`:''}</div>${signBlock(d)}${seal()}</section>`;
    return cover+body.map((b,i)=>contentPage(b,d,type,i+2,total)).join('');
  }
  function signature(d) {return `<div class="inst-letter-sign"><p>Atentamente,</p><div class="inst-letter-signspace"></div><strong>${E(d.remitenteNombre || 'Responsable pendiente')}</strong><div>${E(d.remitenteCargo || d.unidad)}</div></div>`;}
  function letterPage(d,type,fam,body,idx,total) {
    return `<section class="inst-page inst-letter inst-letter-${fam.toLowerCase()}"><header class="inst-letter-head">${logo()}<div><span>${E(d.unidad)}</span><br/>${E(type.proceso)} · Documento de trabajo</div></header>${idx===0?body:body}<div class="inst-page-foot">${E(d.unidad)} · ${E(d.periodoLabel||'')} · ${pagination(idx+1,total)}</div>${seal()}</section>`;
  }
  function letterDoc(d,type) {
    const fam=familyFor(type), code=E(shownCode(d,type)),when=E(dateLong(d.fecha)),subject=E(d.asunto||type.nombre);
    const prefix=`${fam==='OFI'?'Oficio':fam==='MEM'?'Memorando':fam==='COM'?'Comunicado':''} No. ${code}`;
    const configured=Array.isArray(d.documentSections);
    const sections=configured?documentBlocks(d,19):chunkText(d.contenido,1600).map(paras);
    const blocks=[];
    if(fam==='OFI'){
      blocks.push(`<div class="inst-letter-top"><strong>${prefix}</strong><span>Quito, D.M., ${when}</span></div><p class="inst-letter-subject"><b>Asunto:</b> ${subject}</p><div class="inst-letter-recipient"><strong>${E(d.destinatario||'Destinatario pendiente')}</strong><br/>${E(d.cargoDestinatario)}<br/>En su despacho</div><p>${E(d.destinatarioTratamiento||'De mi consideración:')}</p>${sections.shift()}`);
    } else if(fam==='MEM') {
      blocks.push(`<h1 class="inst-letter-title">${prefix}</h1><dl class="inst-memo"><div><dt>PARA</dt><dd>${E(d.destinatario||'Destinatario pendiente')}<br/>${E(d.cargoDestinatario)}</dd></div><div><dt>DE</dt><dd>${E(d.remitenteNombre||'Remitente pendiente')}<br/>${E(d.remitenteCargo)}</dd></div><div><dt>ASUNTO</dt><dd>${subject}</dd></div><div><dt>FECHA</dt><dd>${when}</dd></div></dl>${sections.shift()}`);
    } else {
      blocks.push(`<h1 class="inst-comm-title">COMUNICADO</h1><p>${E(d.destinatario||'Destinatarios pendientes')}</p>${sections.shift()}`);
    }
    blocks.push(...sections);
    if(fam==='COM')blocks[blocks.length-1]+= `<div class="inst-letter-sign"><strong>${E(d.remitenteCargo||d.unidad)}</strong><p>Quito, D.M., ${when}</p><p><strong>${prefix}</strong></p></div>`;
    else blocks[blocks.length-1]+=signature(d);
    return blocks.map((body,i)=>letterPage(d,type,fam,body,i,blocks.length)).join('');
  }
  function unverifiedDoc(d,type) {
    const code=shownCode(d,type);
    const parts=Array.isArray(d.documentSections)?documentBlocks(d,25):chunkText(d.contenido,1550).map(paras);
    return parts.map((part,i)=>`<section class="inst-page inst-provisional">${logo()}<p class="inst-unverified">ESTRUCTURA ESPECÍFICA PENDIENTE DE VALIDACIÓN</p><h1>${E(d.asunto||type.nombre)}</h1><p><strong>Proceso:</strong> ${E(type.proceso)} · <strong>Código:</strong> ${E(code)}</p><p><strong>Período:</strong> ${E(d.periodoLabel||'')}</p><div class="inst-body-main">${part}</div><div class="inst-page-foot">Maqueta · No constituye acta ni documento aprobado · ${pagination(i+1,parts.length)}</div>${seal()}</section>`).join('');
  }
  function render(d0,type,periodLabel) {
    if(!type)return '';
    const d=normalize({...d0,periodoLabel:periodLabel},type),fam=familyFor(type);
    return `<div class="institutional-document" data-template-family="${fam}">${['RGI','INF','ACT'].includes(fam)?structuredDoc(d,type):['OFI','MEM','COM'].includes(fam)?letterDoc(d,type):unverifiedDoc(d,type)}</div>`;
  }
  const allFields = ['asunto','fecha','carrera','versionDocumento','codigoEmitido','unidad','contenido','observaciones','nombreElaborado','cargoElaborado','nombreRevisado','cargoRevisado','nombreAprobado','cargoAprobado','destinatario','cargoDestinatario','remitenteNombre','remitenteCargo','destinatarioTratamiento','numeroActa','horaInicio','horaFin','lugar','participantes','temas','compromisos','proximaFecha','proximaLugar','asistentes'];
  function validate(d0,type,{forExport=false}={}) {
    const d=normalize(d0,type),fam=familyFor(type),errors=[],warnings=[];
    const needed=(key,label)=>{if(!String(d[key]||'').trim())errors.push(`Falta ${label}`);};
    needed('asunto','título o asunto'); needed('fecha','fecha'); needed('unidad','unidad responsable');
    if(!d.codigoEmitido?.trim())warnings.push('Código definitivo pendiente: se usa únicamente la referencia del manual.');
    if(d.codigoEmitido?.trim() && /\b(XXXX?|0X|20XX|AÑO|MES|XXX)\b/i.test(d.codigoEmitido))errors.push('El código asignado contiene marcadores de plantilla.');
    if(['RGI','INF','ACT'].includes(fam)) {
      if(fam!=='RGI')needed('versionDocumento','versión documental');
      for(const field of ['nombreElaborado','cargoElaborado','nombreRevisado','cargoRevisado','nombreAprobado','cargoAprobado'])needed(field,'datos de '+field);
    }
    if(['OFI','MEM','COM'].includes(fam)){
      needed('destinatario','destinatario');
      if(fam!=='COM')needed('remitenteNombre','nombre del remitente');
    }
    if(fam==='ACT' && type.id==='acta-reunion')for(const [key,label] of [['numeroActa','número de acta'],['lugar','lugar'],['horaInicio','hora de inicio'],['horaFin','hora de fin']])needed(key,label);
    if(fam==='RGI'&&type.id==='asistencia-induccion'&&!lines(d.asistentes).length)warnings.push('Todavía no se han registrado asistentes verificados.');
    const plan=planFor(d,type);
    if(plan){
      const summary=window.UTET_PLANIFICACION.summarize(plan.rows);
      for(const [count,label] of [
        [summary.pendingActivities,'sin descripción'],[summary.pendingDates,'con fechas pendientes'],
        [summary.pendingResponsible,'sin responsable'],[summary.pendingDeliverables,'sin entregable']
      ])if(count)warnings.push(count+' '+(count===1?'actividad':'actividades')+' '+label+'.');
    }
    if(!String(d.contenido||'').trim() && !d.documentSections?.length && fam!=='ACT' && !(fam==='RGI' && type.id==='asistencia-induccion'))warnings.push('No hay contenido institucional registrado.');
    if(!families[fam].authoritative)warnings.push(`Falta la plantilla específica de ${families[fam].label}; esta vista es solo referencial.`);
    if(forExport)warnings.push('La exportación se identificará como maqueta/borrador; no constituye emisión ni aprobación oficial.');
    return {errors,warnings,ready: errors.length===0 && !warnings.some(w=>w.startsWith('Código definitivo'))};
  }
  // Estilos autocontenidos para imprimir la misma vista que aparece en pantalla.
  const printCSS = `@page{size:A4;margin:0}html,body{margin:0;background:#fff}*{box-sizing:border-box}img{max-width:100%}`;
  window.UTET_INSTITUTIONAL=Object.freeze({E,UNIDAD,DEFAULT_SIGNERS,families,familyFor,defaultDraftFields,normalize,render,validate,sourceCode,printCSS});
})();
