'use strict';
(() => {
  const DATA = window.UTET_DATA;
  const INST = window.UTET_INSTITUTIONAL;
  const PLANNING = window.UTET_PLANIFICACION;
  const PROCESOS = DATA.procesos;
  const TIPOS = PROCESOS.flatMap(p => p.documentos.map(d => ({ ...d, procesoNombre: p.nombre, categoria: p.categoria })));
  const REQUISITOS = DATA.requisitos;
  const STORAGE = 'utet-maqueta-documentos-v1';
  const LOG_STORAGE = 'utet-maqueta-historial-v1';
  const readStored = (key) => { try { const val = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(val) ? val : []; } catch { return []; } };
  const state = {
    view: 'inicio', periodId: DATA.periodos[0].id, proceso: 'todos', requisito: 'todos', estado: 'todos',
    selectedReq: 'Documentacion', search: '', carreraSearch: '',
    documents: readStored(STORAGE), log: readStored(LOG_STORAGE), draft: null, expandedProcess: null
  };
  const $ = id => document.getElementById(id);
  const escape = val => String(val ?? '').replace(/[&<>"']/g, x => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[x]));
  const fmt = val => Number(val || 0).toLocaleString('es-EC');
  const percent = (a,b) => b ? Math.round(100*a/b) : 0;
  const period = () => DATA.periodos.find(p=>p.id===state.periodId) || DATA.periodos[0];
  const reqName = id => REQUISITOS.find(r=>r.id===id)?.nombre || id;
  const typeById = id => TIPOS.find(d=>d.id===id);
  const procById = id => PROCESOS.find(p=>p.id===id);
  const docsPeriod = () => state.documents.filter(d=>d.periodId===state.periodId);
  const getStats = () => {
    const vals = Object.values(period().indicadores);
    const cumple = vals.reduce((a,v)=>a+v.cumple,0), total = vals.reduce((a,v)=>a+v.cumple+v.noCumple,0);
    return { cumple, total, pct:percent(cumple,total) };
  };
  const niceDate = iso => { try { return new Date(iso).toLocaleString('es-EC', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return iso; } };
  const statusClass = st => st==='En revisión'?'review':st==='Aprobado (demo)'?'approved':'';
  const showToast = msg => { const node=$('toast'); node.textContent=msg;node.classList.add('show'); clearTimeout(showToast.t);showToast.t=setTimeout(()=>node.classList.remove('show'),3200); };
  const logAction = (accion, detalle) => {
    state.log.unshift({ id: 'log_'+Date.now(), at: new Date().toISOString(), periodoId:state.periodId, accion, detalle });
    state.log=state.log.slice(0,120);localStorage.setItem(LOG_STORAGE,JSON.stringify(state.log));
  };
  const persist = () => localStorage.setItem(STORAGE,JSON.stringify(state.documents));
  const navItems = [ ['inicio','⌂','Inicio'],['procesos','▱','Procesos'],['documentos','▤','Documentos'],['requisitos','☑','Requisitos'],['configuracion','⚙','Configuración'] ];
  const heading = (eyebrow,title,desc,actions='') => `<div class="head-row"><div><div class="eyebrow">${escape(eyebrow)}</div><h1 class="page-title">${escape(title)}</h1><p class="page-desc">${escape(desc)}</p></div><div class="toolbar">${actions}</div></div>`;
  const button = (action,text,extra='',classes='btn') => `<button class="${classes}" data-action="${action}" ${extra}>${text}</button>`;
  const tiny = (key,value) => `<span class="mini-tag">${escape(key)}: ${escape(value)}</span>`;
  const reqBar = (key,interactive=true) => {
    const r=period().indicadores[key]||{cumple:0,noCumple:0}, pct=percent(r.cumple,r.cumple+r.noCumple);
    const cls=pct>=85?'is-high':pct<60?'is-low':'';
    return `<${interactive?'button':'div'} class="req-line" ${interactive?`data-action="req-pick" data-id="${escape(key)}"`:''}><div class="req-meta"><span>${escape(reqName(key))}</span><span>${pct}%</span></div><div class="bar"><span class="${cls}" style="width:${pct}%"></span></div></${interactive?'button':'div'}>`;
  };
  const metric = (label,value,detail,icon) => `<div class="metric"><div class="metric-top"><span class="metric-label">${escape(label)}</span><span class="metric-icon">${icon}</span></div><strong>${escape(value)}</strong><div class="metric-sub">${escape(detail)}</div></div>`;
  const accordionProcess = (p, index) => {
    const expanded = state.expandedProcess===p.id;
    const numero = String(index + 1).padStart(2, '0');
    return `<article class="accordion-process ${expanded?'expanded':''}"><button type="button" class="accordion-trigger" data-action="toggle-proc" data-id="${escape(p.id)}" aria-expanded="${expanded}" aria-controls="docs-${escape(p.id)}"><span class="accordion-number" aria-hidden="true">${numero}</span><span class="accordion-info"><span class="accordion-name">${escape(p.nombre)}</span><span class="accordion-code">UTET-${escape(p.id)}</span></span><span class="accordion-count">${p.documentos.length} ${p.documentos.length===1?'documento':'documentos'}</span><span class="accordion-chevron" aria-hidden="true">⌄</span></button>${expanded?`<div class="accordion-documents" id="docs-${escape(p.id)}">${p.documentos.map(d=>`<div class="accordion-document"><span class="doc-mark" aria-hidden="true">▤</span><div class="accordion-document-name"><strong>${escape(d.nombre)}</strong><small>${escape(d.codigo)}</small></div>${button('rec-open','Datos',`data-id="${escape(d.id)}"`,'btn btn-small')}</div>`).join('')}</div>`:''}</article>`;
  };
  const renderInicio = () => `<div class="minimal-home"><div class="minimal-summary"><div class="summary-tile"><span class="summary-symbol">▱</span><span>Procesos: <strong>${PROCESOS.length}</strong></span></div><div class="summary-tile"><span class="summary-symbol">▤</span><span>Documentos: <strong>${TIPOS.length}</strong></span></div></div><div class="process-heading"><h1>Procesos</h1><button type="button" class="subtle-link" data-action="go-requirements">Ver requisitos</button></div><div class="accordion-list">${PROCESOS.map(accordionProcess).join('')}</div></div>`;
  const docRows = docs => docs.map(d => `<div class="doc-item"><div class="doc-icon">▤</div><div class="doc-detail"><strong>${escape(d.nombre)}</strong><small>${escape(d.codigo)}</small><div style="margin-top:5px"><span class="inst-family-tag">${escape(INST.families[INST.familyFor(d)].label)}</span></div><div style="margin-top:8px"><span class="mini-tag purple">${escape(reqName(d.requisito))}</span></div></div><div class="doc-actions">${button('rec-open','Abrir tabla',`data-id="${d.id}"`,'btn btn-primary btn-small')}</div></div>`).join('');
  const docRelated = (d,key) => key==='todos'||d.requisito===key||d.proceso==='PRO-58';
  const renderDocumentos = () => {
    const options=(values,current)=>values.map(v=>`<option value="${escape(v[0])}" ${v[0]===current?'selected':''}>${escape(v[1])}</option>`).join('');
    const groups=PROCESOS.map(p=>({ ...p, documentos:p.documentos.filter(d=>(state.proceso==='todos'||d.proceso===state.proceso)&&docRelated(d,state.requisito)&&(!state.search|| (d.nombre+' '+d.codigo+' '+p.nombre).toLowerCase().includes(state.search.toLowerCase()))) })).filter(p=>p.documentos.length);
    const saved=docsPeriod().filter(d=>(state.estado==='todos'||d.estado===state.estado)&&(!state.search||(d.asunto+' '+typeById(d.tipoId)?.nombre).toLowerCase().includes(state.search.toLowerCase())));
    return heading('','Documentos','',button('go-history','Borradores guardados'))+
    `<div class="filter-row"><input class="input" id="doc-search" placeholder="Buscar nombre o código..." value="${escape(state.search)}" aria-label="Buscar documentos"/><button class="btn btn-small" data-action="apply-search">Buscar</button><select class="select" id="filter-process" aria-label="Filtrar proceso">${options([['todos','Todos los procesos'],...PROCESOS.map(p=>[p.id,p.id+' · '+p.nombre])],state.proceso)}</select><select class="select" id="filter-requirement" aria-label="Filtrar requisito">${options([['todos','Todos los requisitos'],...REQUISITOS.map(r=>[r.id,r.nombre])],state.requisito)}</select>${button('clear-filters','Limpiar filtros','','btn btn-small')}</div>`+

    `${groups.length?groups.map(p=>`<section class="catalog-group"><div class="catalog-title"><h3>${escape(p.nombre)} <small>· ${p.id}</small></h3><span class="mini-tag">${p.documentos.length} documento(s)</span></div>${docRows(p.documentos)}</section>`).join(''):'<div class="empty"><strong>No hay plantillas con estos filtros</strong><p>Cambia el proceso o el requisito.</p></div>'}`+
    `<h2 class="section-title">Documentos creados para este período (${saved.length})</h2><div class="panel">${saved.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Documento</th><th>Proceso</th><th>Estado local</th><th>Modificado</th><th>Acciones</th></tr></thead><tbody>${saved.map(d=>`<tr><td><strong>${escape(d.asunto)}</strong><br><small>${escape(typeById(d.tipoId)?.codigo||'')}</small></td><td>${escape(typeById(d.tipoId)?.proceso||'')}</td><td><span class="tag-status ${statusClass(d.estado)}">${escape(d.estado)}</span></td><td>${escape(niceDate(d.updatedAt))}</td><td>${button('edit-doc','Abrir',`data-id="${escape(d.id)}"`,'btn btn-small')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><span class="empty-icon">▤</span><strong>Todavía no hay borradores</strong><p>Elige cualquiera de los 24 tipos documentales y crea un primer borrador de prueba para este período.</p></div>'}</div>`;
  };
  const relatedDocs = key => TIPOS.filter(d=>docRelated(d,key));
  const renderRequisitos = () => {
    const p=period(), key=state.selectedReq, stat=p.indicadores[key]||{cumple:0,noCumple:0}, total=stat.cumple+stat.noCumple, pct=percent(stat.cumple,total), docs=relatedDocs(key);
    return heading('Control por período','Seguimiento de requisitos',`11 verificaciones del respaldo estadístico · ${p.label}. No son consultas en tiempo real.`)+
    `<div class="requirements-layout"><div class="req-categories"><div class="eyebrow" style="margin:10px 10px 13px">CATEGORÍAS DE REQUISITO</div>${REQUISITOS.map((r,i)=>`<button class="req-pick ${key===r.id?'active':''}" data-action="req-pick" data-id="${r.id}"><span>☑</span><span>${escape(r.nombre)}</span><span class="req-num">${i+1}</span></button>`).join('')}</div><div class="req-inspect"><div class="eyebrow">REQUISITO SELECCIONADO</div><h2 style="font-size:23px;margin:7px 0 7px">${escape(reqName(key))}</h2><p class="page-desc">Conteos del respaldo para ${escape(p.label)}. No equivalen a aprobación oficial del proceso de titulación.</p><div class="req-stat-line"><div class="req-stat"><strong>${fmt(total)}</strong><span>Fichas registradas</span></div><div class="req-stat"><strong style="color:var(--good)">${fmt(stat.cumple)}</strong><span>Cumple</span></div><div class="req-stat"><strong style="color:var(--danger)">${fmt(stat.noCumple)}</strong><span>No cumple</span></div></div><div style="margin-top:25px"><div class="req-meta"><span>Porcentaje de cumplimiento</span><span>${pct}%</span></div><div class="bar" style="height:11px"><span style="width:${pct}%" class="${pct>=85?'is-high':pct<60?'is-low':''}"></span></div></div><h3 class="section-title">Documentos relacionados (${docs.length})</h3><p class="page-desc">Vínculos de trabajo sugeridos para facilitar la navegación; pendientes de validar con tus formatos.</p>${docs.map(d=>`<div class="req-doc-row"><div><strong>${escape(d.nombre)}</strong><small>${escape(d.proceso)} · ${escape(d.codigo)}</small></div>${button('new-doc','Crear',`data-id="${d.id}"`,'btn btn-small')}</div>`).join('')}<div style="margin-top:20px">${button('filter-req-docs','Ver catálogo filtrado',`data-id="${key}"`,'btn btn-primary')}</div></div></div>`;
  };
  const renderPeriodos = () => heading('Organización institucional','Períodos académicos','Cada período mantiene sus propios borradores y filtros. Los seis períodos provienen del respaldo proporcionado.')+
    `<div class="period-grid">${DATA.periodos.map(p=>`<button class="period-card ${p.id===state.periodId?'selected':''}" data-action="select-period" data-id="${p.id}"><div class="eyebrow">${p.id===state.periodId?'● PERÍODO SELECCIONADO':'PERÍODO DISPONIBLE'}</div><div class="period-name">${escape(p.label)}</div><div class="period-data"><span>${fmt(p.matriculas)} matrículas</span><span>${fmt(p.carreras)} carreras</span></div></button>`).join('')}</div><div class="hint-box">Los seis períodos tienen <strong>activo: true</strong> en el respaldo. Por ello, en la maqueta se puede seleccionar cualquiera sin asumir que uno es el único oficialmente vigente.</div>`;
  const renderEstudiantes = () => {
    const p=period(), filtered=p.porCarrera.filter(c=>!state.carreraSearch||c.nombre.toLowerCase().includes(state.carreraSearch.toLowerCase())||c.codigo.toLowerCase().includes(state.carreraSearch.toLowerCase()));
    return heading('Datos académicos','Carreras y matrículas','Resumen agregado por carrera y período. Sin nombres, cédulas ni correos de personas reales.')+
    `<div class="grid-four">${metric('Matrículas',fmt(p.matriculas),'Activas en el respaldo','♙')}${metric('Carreras',fmt(p.carreras),'Con matrículas','▦')}${metric('Fichas de requisitos',fmt(p.requisitos),'Período seleccionado','☑')}${metric('Documentos generados',fmt(docsPeriod().length),'Solo guardados localmente','▤')}</div>`+
    `<div class="hint-box"><strong>Protección de datos.</strong> La maqueta utiliza únicamente conteos por carrera. Cuando se conecte Firebase, el listado individual estará protegido por autenticación y permisos.</div>`+
    `<div class="panel" style="margin-top:17px"><div class="panel-header"><div><h2>Matrículas por carrera</h2><p>La sede o modalidad no se infiere a partir del nombre de la carrera.</p></div><div class="toolbar"><input id="career-search" class="input" placeholder="Filtrar carrera o código" value="${escape(state.carreraSearch)}"/><button class="btn btn-small" data-action="apply-career-search">Buscar</button></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Carrera</th><th>Matrículas</th><th>Período</th></tr></thead><tbody>${filtered.map(c=>`<tr><td>${escape(c.codigo)}</td><td><strong>${escape(c.nombre)}</strong></td><td>${fmt(c.cantidad)}</td><td>${escape(p.label)}</td></tr>`).join('')}</tbody></table></div></div>`;
  };
  const renderHistorial = () => {
    const saved=docsPeriod().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)), log=state.log.filter(x=>x.periodoId===state.periodId);
    return heading('Trabajo local','Borradores e historial','Cambios guardados en este equipo. Ninguna acción genera una aprobación institucional real.',button('go-documents','＋ Nuevo documento','', 'btn btn-primary'))+
    `<div class="panels"><div class="panel"><div class="panel-header"><div><h2>Documentos guardados (${saved.length})</h2><p>Período: ${escape(period().label)}</p></div></div>${saved.length?`<div class="process-list">${saved.map(d=>`<div class="doc-item"><div class="doc-icon">▤</div><div class="doc-detail"><strong>${escape(d.asunto)}</strong><small>${escape(typeById(d.tipoId)?.proceso)} · ${escape(niceDate(d.updatedAt))}</small><div style="margin-top:7px"><span class="tag-status ${statusClass(d.estado)}">${escape(d.estado)}</span></div></div>${button('edit-doc','Abrir',`data-id="${escape(d.id)}"`,'btn btn-small')}</div>`).join('')}</div>`:'<div class="empty"><strong>Sin documentos guardados</strong><p>Comienza con una plantilla del catálogo.</p></div>'}</div><div class="panel"><div class="panel-header"><div><h2>Actividad reciente (${log.length})</h2><p>Eventos de demostración registrados localmente</p></div></div>${log.length?`<div class="activity-list">${log.map(x=>`<div class="activity-row"><span class="activity-dot"></span><div><strong>${escape(x.accion)}</strong><small>${escape(x.detalle)} · ${escape(niceDate(x.at))}</small></div></div>`).join('')}</div>`:'<div class="empty"><strong>Sin actividad en este período</strong><p>Las acciones de guardado y revisión aparecerán aquí.</p></div>'}</div></div>`;
  };
  const renderConfiguracion = () => heading('Normalización de formatos','Configuración institucional','Estándares tomados de las plantillas y de la Guía de portadas ITSQMET v1.1. Las emisiones siguen siendo demostrativas.')+
    `<div class="config-grid"><div class="config-card"><h3>Firebase · ${escape('utet-4387a')}</h3><p>Las fichas individuales pueden consultar matrícula y requisitos. Los documentos con emisión institucional usan el correlativo registrado en Firestore.</p><div class="kv"><span>Estado</span><strong>Consultas puntuales y emisión por módulo</strong></div><div class="kv"><span>Respaldo</span><strong>6 períodos / 11 requisitos</strong></div><div class="kv"><span>Escritura</span><strong>Folios de actas, similitud y cronograma de Artículo</strong></div></div><div class="config-card"><h3>Reglas de formato</h3><p>RGI, INF y ACT aplican el estándar maestro de portada.</p><div class="kv"><span>Papel</span><strong>A4 vertical · 21 × 29,7 cm</strong></div><div class="kv"><span>Márgenes de portada</span><strong>1,5 cm</strong></div><div class="kv"><span>Ancho de tablas</span><strong>18 cm · fijo</strong></div><div class="kv"><span>Fuente portada</span><strong>Arial</strong></div><div class="kv"><span>Firmas</span><strong>Solo primera hoja</strong></div><div class="kv"><span>Referencias</span><strong>Guía RGI/INF/ACT v1.1</strong></div></div><div class="config-card"><h3>Correspondencia institucional</h3><p>OFI, MEM y COM conservan la estructura de los modelos Word, con datos editables. Certificado CERT se reserva para una futura ampliación y no se suma a los 24 documentos.</p><div class="kv"><span>Oficio</span><strong>Número, destinatario, asunto y firma</strong></div><div class="kv"><span>Memorando</span><strong>PARA, DE, ASUNTO, FECHA</strong></div><div class="kv"><span>Comunicado</span><strong>Título, cuerpo, fecha y número</strong></div></div><div class="config-card"><h3>Control de plantillas</h3><p>La portada ACT es la de un acta de reunión. El acta de seguimiento reúne participantes, hallazgos y compromisos para revisión. Las actas AT (AA, TT y CX) usan la plantilla de tres hojas carta con numeración institucional; el plan de núcleo aún carece de modelo específico.</p><div class="kv"><span>Formatos disponibles</span><strong>RGI / INF / ACT / OFI / MEM / COM / AT</strong></div><div class="kv"><span>Actas AT</span><strong>Artículo, Trabajo y Complexivo</strong></div><div class="kv"><span>Plan de núcleo</span><strong>Pendiente de plantilla</strong></div><div class="kv"><span>PDF</span><strong>Exportación como borrador</strong></div><div class="kv"><span>DOCX / XLSX</span><strong>Fase posterior</strong></div></div><div class="config-card"><h3>Firmantes predeterminados</h3><p>Aplicables a RGI e INF. En actas ACT son variables.</p><div class="kv"><span>Elabora</span><strong>Mgs. Jefferson Villarreal</strong></div><div class="kv"><span>Revisa</span><strong>Ing. Martha Tomalá</strong></div><div class="kv"><span>Aprueba</span><strong>Dr. Alex León</strong></div></div><div class="config-card"><h3>Pruebas locales</h3><p>Elimina únicamente documentos y actividad de esta maqueta. No afecta a Firebase.</p>${button('reset-demo','Borrar borradores de prueba','','btn')}</div></div>`;
  const draftDefault = t => ({
    ...INST.defaultDraftFields(t),
    ...(PLANNING.supports(t.id)?{planificacion:PLANNING.create([],period().label,t.id)}:{}),
    id:'demo_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),tipoId:t.id,periodId:state.periodId,estado:'Borrador',
    asunto:t.nombre,carrera:'',fecha:new Date().toLocaleDateString('en-CA'),
    contenido:'',observaciones:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  });
  const previewHTML = d => {
    const t=typeById(d.tipoId);if(!t)return '';
    const label=DATA.periodos.find(p=>p.id===d.periodId)?.label||period().label;
    return INST.render(d,t,label);
  };
  const fInput=(key,label,val,full=false,opts='')=>`<div class="field ${full?'full':''}"><label for="f-${key}">${escape(label)}</label><input class="input" id="f-${key}" data-field="${key}" value="${escape(val||'')}" ${opts}/></div>`;
  const fArea=(key,label,val,full=true,hint='')=>`<div class="field ${full?'full':''}"><label for="f-${key}">${escape(label)}</label><textarea class="textarea" id="f-${key}" data-field="${key}">${escape(val||'')}</textarea>${hint?`<div class="field-hint">${escape(hint)}</div>`:''}</div>`;
  const detailsFor = (d,t) => {
    const fam=INST.familyFor(t);
    const letter=['OFI','MEM','COM'].includes(fam), signatures=['RGI','INF','ACT'].includes(fam);
    let markup=`<div class="inst-fields-group"><h3>Control documental</h3><div class="inst-fields-grid">${fInput('unidad','Unidad responsable',d.unidad,true)}${fInput('codigoEmitido','Código definitivo (asignado por control documental)',d.codigoEmitido,true)}${fInput('versionDocumento','Versión',d.versionDocumento)}</div><p class="inst-source-ref">Referencia en manual: ${escape(t.codigo)}. No se utilizará la referencia con 0X/AÑO/MES como folio definitivo.</p></div>`;
    if (letter) markup+=`<div class="inst-fields-group"><h3>Correspondencia ${fam}</h3><div class="inst-fields-grid">${fInput('destinatario','PARA / Destinatario',d.destinatario,true)}${fInput('cargoDestinatario','Cargo del destinatario',d.cargoDestinatario,true)}${fInput('remitenteNombre','DE / Nombre del remitente',d.remitenteNombre,true)}${fInput('remitenteCargo','Cargo del remitente',d.remitenteCargo,true)}${fam==='OFI'?fInput('destinatarioTratamiento','Saludo',d.destinatarioTratamiento,true):''}</div></div>`;
    if(signatures) markup+=`<div class="inst-fields-group"><h3>Firmas de portada · primera hoja</h3><div class="inst-fields-grid">${fInput('nombreElaborado','Elaborado por: nombre',d.nombreElaborado)}${fInput('cargoElaborado','Elaborado por: cargo',d.cargoElaborado)}${fInput('nombreRevisado','Revisado por: nombre',d.nombreRevisado)}${fInput('cargoRevisado','Revisado por: cargo',d.cargoRevisado)}${fInput('nombreAprobado','Aprobado por: nombre',d.nombreAprobado)}${fInput('cargoAprobado','Aprobado por: cargo',d.cargoAprobado)}</div></div>`;
    if(fam==='ACT'&&t.id==='acta-reunion')markup+=`<div class="inst-fields-group"><h3>Datos operativos de acta (modelo de reunión)</h3><div class="inst-fields-grid">${fInput('numeroActa','Número de acta',d.numeroActa)}${fInput('lugar','Lugar de la reunión',d.lugar)}${fInput('horaInicio','Hora de inicio',d.horaInicio,false,'type="time"')}${fInput('horaFin','Hora de fin',d.horaFin,false,'type="time"')}${fArea('participantes','Participantes',d.participantes,true,'Una línea por participante: nombre; cargo/unidad/carrera; firma (sin simular firma).')}${fArea('temas','Temas tratados',d.temas,true,'Un tema por línea.')}${fArea('compromisos','Compromisos',d.compromisos,true,'Una línea: actividad; responsable; AAAA-MM-DD.')}${fInput('proximaFecha','Fecha próxima reunión',d.proximaFecha,false,'type="date"')}${fInput('proximaLugar','Lugar próxima reunión',d.proximaLugar)}</div></div>`;
    if(fam==='ACT'&&t.id==='acta-requisitos'&&!Array.isArray(d.documentSections))markup+=`<div class="inst-example-note">Abre Datos en el catálogo para preparar el acta con participantes, hallazgos y compromisos.</div>`;
    if(fam==='RGI'&&t.id==='asistencia-induccion')markup+=`<div class="inst-fields-group"><h3>Registro de asistencia</h3><div class="inst-fields-grid">${fInput('tema','Tema de inducción',d.tema,true)}${fInput('capacitador','Capacitador',d.capacitador)}${fInput('jefeInmediato','Jefe inmediato',d.jefeInmediato)}${fArea('asistentes','Participantes verificados',d.asistentes,true,'Una línea por asistente: cédula; nombres completos; carrera; firma. Numeración continua y 22 participantes por página.')}</div></div>`;
    return markup;
  };
  const validationHTML=(d,t)=>{
    const v=INST.validate(d,t);
    return `<strong>Validación de datos · ${v.errors.length} faltantes / ${v.warnings.length} observaciones</strong>${(v.errors.length||v.warnings.length)?`<ul>${v.errors.map(x=>`<li class="issue">${escape(x)}</li>`).join('')}${v.warnings.map(x=>`<li class="advise">${escape(x)}</li>`).join('')}</ul>`:'<span>Campos básicos completos. Sigue siendo una maqueta sin autorización oficial.</span>'}`;
  };
  const renderEditor = () => {
    const saved=state.draft,t=typeById(saved?.tipoId);if(!saved||!t)return '<div class="empty">No se encuentra el documento solicitado.</div>';
    const d=INST.normalize(saved,t),family=INST.familyFor(t),info=INST.families[family];
    const plan=PLANNING.fromDraft(d);
    const careers=DATA.periodos.find(p=>p.id===d.periodId)?.porCarrera||[];
    return heading('Documentos / formato institucional',t.nombre,`${t.proceso} · ${t.codigo} · ${DATA.periodos.find(p=>p.id===d.periodId)?.label||''}`,((plan||Array.isArray(d.documentSections))?button('rec-open','← Registros',`data-id="${escape(t.id)}"`):button('go-documents','← Volver al catálogo')))+
    `<div class="two-col"><div class="form-card"><div class="eyebrow">DATOS DEL DOCUMENTO · <span class="inst-family-tag">${escape(info.label)}</span></div>${!info.authoritative?'<div class="inst-example-note">Solo hay referencia parcial del formato. No utilices esta vista como acta oficial ni como modelo definitivo del cuerpo del documento.</div>':''}<div class="inst-fields-grid">${fInput('asunto','Título o asunto',d.asunto,true)}${fInput('fecha','Fecha de elaboración / reunión',d.fecha,false,'type="date"')}<div class="field"><label for="f-carrera">Carrera</label><select class="select" id="f-carrera" data-field="carrera"><option value="">Todas / sin definir</option>${careers.map(c=>`<option value="${escape(c.nombre)}" ${d.carrera===c.nombre?'selected':''}>${escape(c.nombre)}</option>`).join('')}</select></div></div>${detailsFor(d,t)}${planUI.render(d)}<div class="inst-fields-group"><h3>Cuerpo y observaciones</h3>${fArea('contenido',plan?'Información adicional':'Contenido editable',d.contenido,true,plan?'Agrega contexto para la redacción y el PDF.':'Las tablas se preparan desde los registros del documento.')}${fArea('observaciones','Observaciones',d.observaciones)}</div><span class="tag-status ${statusClass(d.estado)}">${escape(d.estado)} · solo prueba</span><div class="inst-validation" id="institutional-validation">${validationHTML(d,t)}</div></div><div class="preview-card"><div class="inst-preview-toolbar"><span>VISTA PREVIA DE PÁGINAS A4</span><span>${escape(info.label)}</span></div><div class="inst-preview" id="print-preview">${previewHTML(d)}</div></div></div><div class="editor-footer"><small>Vista previa para revisión documental.</small>${button('save-doc','Guardar borrador')}${button('review-doc','Marcar en revisión')}${button('pdf-doc','↓ Exportar PDF de maqueta','','btn btn-primary')}</div>`;
  };
  function render() {
    $('nav-main').innerHTML=navItems.map(([id,icon,title])=>`<button type="button" class="nav-button ${state.view===id||((state.view==='editor'||state.view==='records')&&id==='documentos')?'active':''}" data-nav="${id}" title="${escape(title)}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${escape(title)}</span></button>`).join('');
    $('period-select').innerHTML=DATA.periodos.map(p=>`<option value="${escape(p.id)}" ${p.id===state.periodId?'selected':''}>${escape(p.label)}</option>`).join('');
    const contents={inicio:renderInicio,procesos:renderInicio,periodos:renderPeriodos,documentos:renderDocumentos,requisitos:renderRequisitos,estudiantes:renderEstudiantes,historial:renderHistorial,configuracion:renderConfiguracion,records:()=>recordsUI.render(),antiplagio:()=>antiplagioUI.render(),'acta-articulo':()=>actaUI.render(),cronograma:()=>cronUI.render(),editor:renderEditor};
    $('app-content').innerHTML=(contents[state.view]||renderInicio)();
    window.scrollTo(0,0);
  }
  function go(view) { state.view=view;render(); }
  function newDocument(id) { const type=typeById(id);if(!type){showToast('Plantilla no encontrada');return;}state.draft=draftDefault(type);go('editor'); }
  function saveEditor(targetStatus) {
    if(!state.draft)return;
    if(!state.draft.asunto.trim()){showToast('Escribe un asunto para guardar');return false;}
    const d={...state.draft,estado:targetStatus||state.draft.estado,updatedAt:new Date().toISOString()};
    const i=state.documents.findIndex(item=>item.id===d.id);
    if(i===-1)state.documents.push(d);else state.documents[i]=d;
    state.draft={...d};persist();logAction(targetStatus?'Estado de revisión actualizado':'Borrador guardado',`${typeById(d.tipoId)?.nombre||'Documento'} · ${d.estado}`);showToast('Guardado únicamente en este equipo');render();return true;
  }
  function handleClick(event) {
    const target=event.target.closest('button[data-action], button[data-nav]');if(!target)return;
    if(target.dataset.nav){state.proceso='todos';go(target.dataset.nav);return;}
    const a=target.dataset.action,id=target.dataset.id;
    if(actaUI.handleAction(a,id))return;
    if(antiplagioUI.handleAction(a,id))return;
    if(cronUI.handleAction(a,id))return;
    if(planUI.handleAction(a))return;
    if(recordsUI.handleAction(a,id))return;
    if(a==='go-documents'){state.proceso='todos';state.requisito='todos';go('documentos');}
    else if(a==='go-requirements')go('requisitos');
    else if(a==='toggle-proc'){const position=window.scrollY;state.expandedProcess=state.expandedProcess===id?null:id;render();window.scrollTo(0,position);}
    else if(a==='go-periodos')go('periodos');
    else if(a==='go-history')go('historial');
    else if(a==='set-proc'){state.proceso=id;state.requisito='todos';go('documentos');}
    else if(a==='req-pick'){state.selectedReq=id;go('requisitos');}
    else if(a==='filter-req-docs'){state.proceso='todos';state.requisito=id;go('documentos');}
    else if(a==='select-period'){
      const onAntiplagio=state.view==='antiplagio',onActa=state.view==='acta-articulo',onCronograma=state.view==='cronograma',changed=state.periodId!==id;
      state.periodId=id;state.proceso='todos';state.requisito='todos';
      if(onAntiplagio && changed)antiplagioUI.onPeriodChange();
      else if(onActa && changed)actaUI.onPeriodChange();
      else if(onCronograma && changed)cronUI.onPeriodChange();
      else{antiplagioUI.reset();actaUI.reset();go('inicio');}
      showToast('Período actualizado');
    }
    else if(a==='new-doc'){if(id==='cron-articulo')go('cronograma');else newDocument(id);}
    else if(a==='edit-doc'){const d=state.documents.find(x=>x.id===id);if(d){state.draft=INST.normalize({...d},typeById(d.tipoId));go('editor');}}
    else if(a==='save-doc')saveEditor();
    else if(a==='review-doc')saveEditor('En revisión');
    else if(a==='apply-search'){state.search=$('doc-search')?.value.trim()||'';render();}
    else if(a==='apply-career-search'){state.carreraSearch=$('career-search')?.value.trim()||'';render();}
    else if(a==='clear-filters'){state.search='';state.proceso='todos';state.requisito='todos';state.estado='todos';render();}
    else if(a==='reset-demo'){if(confirm('¿Eliminar los borradores y el historial de prueba guardados en este equipo?')){state.documents=[];state.log=[];persist();localStorage.setItem(LOG_STORAGE,'[]');render();showToast('Datos locales de prueba borrados');}}
    else if(a==='pdf-doc')exportPDF();
  }
  async function exportPDF(){
    if(!state.draft)return;
    const d=state.draft,t=typeById(d.tipoId),check=INST.validate(d,t,{forExport:true});
    // Cualquier PDF lleva el sello visible de maqueta, incluso con datos incompletos.
    if(check.errors.length && !confirm(`Hay ${check.errors.length} campos pendientes. ¿Exportar exclusivamente como maqueta?`))return;
    const output=$('print-preview')?.innerHTML;
    if(!output){showToast('Vista previa no disponible');return;}
    if(!window.utetDesktop?.exportPDF){showToast('La exportación PDF requiere Electron.');return;}
    const planName=t.id==='plan-trabajo'?'Planificacion-Trabajo':'Planificacion-Complexivo';
    const name='MAQUETA-'+t.proceso+'-'+(PLANNING.fromDraft(d)?planName+'-'+d.periodId+'-':'')+d.fecha;
    try {
      const r=await window.utetDesktop.exportPDF({ suggestedName:name, html:output });
      if(!r?.canceled)showToast('PDF de maqueta exportado. No es un documento aprobado.');
    }catch(err){showToast('No fue posible exportar el PDF: '+(err?.message||'Error'));}
  }
  $('period-select').addEventListener('change', e => {
    const next=e.target.value,changed=state.periodId!==next,onAntiplagio=state.view==='antiplagio',onActa=state.view==='acta-articulo',onCronograma=state.view==='cronograma';
    if(!changed)return;
    state.periodId=next;state.draft=null;state.proceso='todos';state.requisito='todos';
    if(onAntiplagio)antiplagioUI.onPeriodChange();
    else if(onActa)actaUI.onPeriodChange();
    else if(onCronograma)cronUI.onPeriodChange();
    else{antiplagioUI.reset();actaUI.reset();go('inicio');}
    showToast('Período actualizado');
  });
  document.addEventListener('click',handleClick);
  $('app-content').addEventListener('change',e=>{
    if(planUI.input(e))return;
    cronUI.input(e);
    recordsUI.input(e);
    antiplagioUI.input(e);
    actaUI.input(e);
    if(e.target.id==='filter-process'){state.proceso=e.target.value;render();}
    if(e.target.id==='filter-requirement'){state.requisito=e.target.value;render();}
    if(e.target.dataset.field&&state.draft){state.draft[e.target.dataset.field]=e.target.value;refreshPreview();}
  });
  $('app-content').addEventListener('input',e=>{
    if(planUI.input(e))return;
    cronUI.input(e);
    recordsUI.input(e);
    antiplagioUI.input(e);
    if(e.target.dataset.field&&state.draft){state.draft[e.target.dataset.field]=e.target.value;refreshPreview();}
  });
  $('app-content').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='rec-search'){e.preventDefault();recordsUI.handleAction('rec-search');}if(e.key==='Enter'&&e.target.id==='doc-search'){e.preventDefault();state.search=e.target.value.trim();render();}if(e.key==='Enter'&&e.target.id==='career-search'){e.preventDefault();state.carreraSearch=e.target.value.trim();render();}});
  function refreshPreview(){const el=$('print-preview');if(el&&state.draft)el.innerHTML=previewHTML(state.draft);const v=$('institutional-validation');if(v&&state.draft)v.innerHTML=validationHTML(state.draft,typeById(state.draft.tipoId));}
  const planUI=window.UTET_PLANIFICACION_UI.create({state,render,refreshPreview});
  const recordsUI=window.UTET_RECORD_UI.create({data:DATA,records:window.UTET_RECORDS,state,period,getType:typeById,go,render,draftDefault,showToast,logAction});
  const antiplagioUI=window.UTET_ANTIPLAGIO.create({state,period,go,render,showToast});
  const actaUI=window.UTET_ACTA_ARTICULO.create({state,period,go,render,showToast});
  const cronUI=window.UTET_CRONOGRAMA_UI.create({state,period,go,render,showToast,logAction});
  render();
})();
