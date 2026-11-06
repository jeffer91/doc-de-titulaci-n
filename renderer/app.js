'use strict';
(() => {
  const DATA = window.UTET_DATA;
  const PROCESOS = DATA.procesos;
  const TIPOS = PROCESOS.flatMap(p => p.documentos.map(d => ({ ...d, procesoNombre: p.nombre, categoria: p.categoria })));
  const REQUISITOS = DATA.requisitos;
  const STORAGE = 'utet-maqueta-documentos-v1';
  const LOG_STORAGE = 'utet-maqueta-historial-v1';
  const readStored = (key) => { try { const val = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(val) ? val : []; } catch { return []; } };
  const state = {
    view: 'inicio', periodId: DATA.periodos[0].id, proceso: 'todos', requisito: 'todos', estado: 'todos',
    selectedReq: 'Documentacion', search: '', carreraSearch: '',
    documents: readStored(STORAGE), log: readStored(LOG_STORAGE), draft: null, bannerVisible: true
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
  const navItems = [ ['inicio','▦','Inicio'],['periodos','◫','Períodos'],['documentos','▤','Documentos'],['requisitos','☑','Requisitos'],['estudiantes','♙','Carreras y matrículas'],['historial','◷','Historial local'],['configuracion','⚙','Configuración'] ];
  const heading = (eyebrow,title,desc,actions='') => `<div class="head-row"><div><div class="eyebrow">${escape(eyebrow)}</div><h1 class="page-title">${escape(title)}</h1><p class="page-desc">${escape(desc)}</p></div><div class="toolbar">${actions}</div></div>`;
  const button = (action,text,extra='',classes='btn') => `<button class="${classes}" data-action="${action}" ${extra}>${text}</button>`;
  const tiny = (key,value) => `<span class="mini-tag">${escape(key)}: ${escape(value)}</span>`;
  const reqBar = (key,interactive=true) => {
    const r=period().indicadores[key]||{cumple:0,noCumple:0}, pct=percent(r.cumple,r.cumple+r.noCumple);
    const cls=pct>=85?'is-high':pct<60?'is-low':'';
    return `<${interactive?'button':'div'} class="req-line" ${interactive?`data-action="req-pick" data-id="${escape(key)}"`:''}><div class="req-meta"><span>${escape(reqName(key))}</span><span>${pct}%</span></div><div class="bar"><span class="${cls}" style="width:${pct}%"></span></div></${interactive?'button':'div'}>`;
  };
  const metric = (label,value,detail,icon) => `<div class="metric"><div class="metric-top"><span class="metric-label">${escape(label)}</span><span class="metric-icon">${icon}</span></div><strong>${escape(value)}</strong><div class="metric-sub">${escape(detail)}</div></div>`;
  const listProcess = p => `<button class="process-item" data-action="set-proc" data-id="${p.id}"><span class="process-symbol">▤</span><span class="process-text"><strong>${escape(p.nombre)}</strong><small>${p.id} · ${escape(p.categoria)}</small></span><span class="process-count">${p.documentos.length} docs</span><span class="process-chevron">›</span></button>`;
  const renderInicio = () => {
    const p=period(), stats=getStats(), local=docsPeriod(), reqKeys=['Documentacion','Academico','Financiero','Titulacion','AprobacionTitulacion'];
    return heading('Resumen del período','Panel de titulación',`Vista general de ${p.label}. Indicadores agregados del respaldo, no en tiempo real.`,button('go-documents','＋ Crear documento','', 'btn btn-primary'))+
    `<div class="grid-four">${metric('Matrículas del período',fmt(p.matriculas),'Registros activos del respaldo','♙')}${metric('Requisitos registrados',fmt(p.requisitos),'Fichas del período','☑')}${metric('Cumplimiento promedio',stats.pct+'%','Promedio de los 11 requisitos','◔')}${metric('Documentos locales',fmt(local.length),'Borradores y pruebas creadas','▤')}</div>`+
    `<div class="panels"><div class="panel"><div class="panel-header"><div><h2>Documentos por proceso</h2><p>9 procesos · 24 registros documentales disponibles</p></div>${button('go-documents','Ver catálogo →','','text-link')}</div><div class="process-list">${PROCESOS.map(listProcess).join('')}</div></div><div class="panel"><div class="panel-header"><div><h2>Estado de los requisitos</h2><p>Cumplimiento agregado por categoría</p></div>${button('go-requirements','Ver todos →','','text-link')}</div><div class="req-list">${reqKeys.map(key=>reqBar(key)).join('')}<div class="hint-box"><strong>Primero el período, después el requisito.</strong><br/>Al cambiar el período se actualizan automáticamente los indicadores, los documentos guardados y los filtros. Cada requisito muestra los generadores documentales relacionados.</div></div></div></div>`+
    `<h2 class="section-title">Accesos rápidos</h2><div class="toolbar">${button('go-requirements','☑ Revisar requisitos')}${button('go-documents','▤ Crear documento')}${button('go-periodos','◫ Cambiar período')}${button('go-history','◷ Ver historial local')}</div>`;
  };
  const docRows = docs => docs.map(d => `<div class="doc-item"><div class="doc-icon">▤</div><div class="doc-detail"><strong>${escape(d.nombre)}</strong><small>${escape(d.codigo)}</small><div style="margin-top:8px"><span class="mini-tag purple">${escape(reqName(d.requisito))}</span></div></div><div class="doc-actions">${button('new-doc','＋ Crear',`data-id="${d.id}"`,'btn btn-primary btn-small')}</div></div>`).join('');
  const docRelated = (d,key) => key==='todos'||d.requisito===key||d.proceso==='PRO-58';
  const renderDocumentos = () => {
    const options=(values,current)=>values.map(v=>`<option value="${escape(v[0])}" ${v[0]===current?'selected':''}>${escape(v[1])}</option>`).join('');
    const groups=PROCESOS.map(p=>({ ...p, documentos:p.documentos.filter(d=>(state.proceso==='todos'||d.proceso===state.proceso)&&docRelated(d,state.requisito)&&(!state.search|| (d.nombre+' '+d.codigo+' '+p.nombre).toLowerCase().includes(state.search.toLowerCase()))) })).filter(p=>p.documentos.length);
    const saved=docsPeriod().filter(d=>(state.estado==='todos'||d.estado===state.estado)&&(!state.search||(d.asunto+' '+typeById(d.tipoId)?.nombre).toLowerCase().includes(state.search.toLowerCase())));
    return heading('Biblioteca documental','Generadores de documentos','Selecciona el período, filtra por requisito o proceso y abre una plantilla editable. Los formatos son provisionales.',button('go-history','◷ Ver borradores'))+
    `<div class="filter-row"><input class="input" id="doc-search" placeholder="Buscar nombre o código..." value="${escape(state.search)}" aria-label="Buscar documentos"/><button class="btn btn-small" data-action="apply-search">Buscar</button><select class="select" id="filter-process" aria-label="Filtrar proceso">${options([['todos','Todos los procesos'],...PROCESOS.map(p=>[p.id,p.id+' · '+p.nombre])],state.proceso)}</select><select class="select" id="filter-requirement" aria-label="Filtrar requisito">${options([['todos','Todos los requisitos'],...REQUISITOS.map(r=>[r.id,r.nombre])],state.requisito)}</select>${button('clear-filters','Limpiar filtros','','btn btn-small')}</div>`+
    `<div class="hint-box" style="margin:0 0 17px">La relación documento–requisito es <strong>referencial para esta maqueta</strong>. Los tres documentos de seguimiento (PRO-58) se ofrecen para cualquiera de los 11 requisitos. Los contenidos definitivos se configurarán con las plantillas institucionales que entregues.</div>`+
    `${groups.length?groups.map(p=>`<section class="catalog-group"><div class="catalog-title"><h3>${escape(p.nombre)} <small>· ${p.id}</small></h3><span class="mini-tag">${p.documentos.length} documento(s)</span></div>${docRows(p.documentos)}</section>`).join(''):'<div class="empty"><strong>No hay plantillas con estos filtros</strong><p>Cambia el proceso o el requisito.</p></div>'}`+
    `<h2 class="section-title">Documentos creados para este período (${saved.length})</h2><div class="panel">${saved.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Documento</th><th>Proceso</th><th>Estado local</th><th>Modificado</th><th>Acciones</th></tr></thead><tbody>${saved.map(d=>`<tr><td><strong>${escape(d.asunto)}</strong><br><small>${escape(typeById(d.tipoId)?.codigo||'')}</small></td><td>${escape(typeById(d.tipoId)?.proceso||'')}</td><td><span class="tag-status ${statusClass(d.estado)}">${escape(d.estado)}</span></td><td>${escape(niceDate(d.updatedAt))}</td><td>${button('edit-doc','Abrir',`data-id="${escape(d.id)}"`,'btn btn-small')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><span class="empty-icon">▤</span><strong>Todavía no hay borradores</strong><p>Elige cualquiera de los 24 tipos documentales y crea un primer borrador de prueba para este período.</p></div>'}</div>`;
  };
  const relatedDocs = key => TIPOS.filter(d=>docRelated(d,key));
  const renderRequisitos = () => {
    const p=period(), key=state.selectedReq, stat=p.indicadores[key]||{cumple:0,noCumple:0}, total=stat.cumple+stat.noCumple, pct=percent(stat.cumple,total), docs=relatedDocs(key);
    return heading('Control por período','Seguimiento de requisitos',`11 verificaciones encontradas en Firebase · ${p.label}. Los valores son un resumen de respaldo.`)+
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
  const renderConfiguracion = () => heading('Preparación de integración','Configuración','Visualización de la futura integración; conexión real y permisos todavía no implementados.')+
    `<div class="config-grid"><div class="config-card"><h3>Proyecto Firebase</h3><p>La maqueta no inicializa el SDK ni realiza lecturas o escrituras de red.</p><div class="kv"><span>Proyecto</span><strong>utet-4387a</strong></div><div class="kv"><span>Entorno</span><strong>Maqueta local</strong></div><div class="kv"><span>Estado</span><strong style="color:var(--warn)">Sin conectar</strong></div><div class="kv"><span>Colecciones previstas</span><strong>7 existentes (lectura)</strong></div><div class="kv"><span>Documentos nuevos</span><strong>Por definir (escritura)</strong></div></div><div class="config-card"><h3>Formatos y firmas institucionales</h3><p>Aún faltan las plantillas de los documentos ya elaborados. Se usarán para definir márgenes, encabezados, tablas, numeración, firmas y automatizaciones.</p><div class="kv"><span>Procesos documentales</span><strong>9</strong></div><div class="kv"><span>Generadores en catálogo</span><strong>24</strong></div><div class="kv"><span>Formato del editor</span><strong>Provisional</strong></div><div class="kv"><span>DOCX</span><strong>Pendiente</strong></div><div class="kv"><span>PDF desde Electron</span><strong>Disponible</strong></div></div><div class="config-card"><h3>Datos del respaldo</h3><p>Resúmenes agregados del archivo recibido: 6 períodos, 11 verificaciones de requisitos, 36 carreras y sus matrículas. Sin datos personales guardados en el código fuente.</p><div class="kv"><span>Origen</span><strong>06-11-2026</strong></div><div class="kv"><span>Actualización en vivo</span><strong>No</strong></div></div><div class="config-card"><h3>Pruebas locales</h3><p>Elimina únicamente los borradores y actividades de prueba de esta maqueta. No se toca ninguna colección de Firebase.</p>${button('reset-demo','Borrar borradores de prueba','','btn')}</div></div>`;
  const draftDefault = t => ({id:'demo_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),tipoId:t.id,periodId:state.periodId,estado:'Borrador',asunto:t.nombre,responsable:'',carrera:'',fecha:new Date().toISOString().slice(0,10),contenido:'[Contenido pendiente de incorporar desde el formato oficial.]\n\nDescriba aquí el objetivo, las actividades, resultados y demás información institucional correspondiente.',observaciones:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  const previewHTML = d => {
    const t=typeById(d.tipoId);if(!t)return '';
    return `<div class="paper-head"><div class="paper-logo">ITSQMET</div><small>UNIDAD DE TITULACIÓN Y<br/>EFICIENCIA TERMINAL · UTET<br/>Documento de demostración</small></div><div class="paper-meta"><div><b>PERÍODO:</b> ${escape(DATA.periodos.find(p=>p.id===d.periodId)?.label||'')}</div><div><b>CÓDIGO:</b> ${escape(t.codigo)}</div><div><b>FECHA:</b> ${escape(d.fecha||'Pendiente')}</div><div><b>CARRERA:</b> ${escape(d.carrera||'No seleccionada / todas')}</div></div><div class="paper-title">${escape(d.asunto||t.nombre)}</div><div class="paper-section">1. DESARROLLO DEL DOCUMENTO</div><div class="paper-body">${escape(d.contenido||'Sin contenido')}</div><div class="paper-section">2. OBSERVACIONES</div><div class="paper-body" style="min-height:45px">${escape(d.observaciones||'Sin observaciones registradas.')}</div><div class="paper-sign"><strong>${escape(d.responsable||'Responsable por definir')}</strong><br/>Unidad de Titulación y Eficiencia Terminal<br/><span style="color:#a3acbc">Firma en primera hoja · propuesta</span></div><div class="paper-foot">MAQUETA — NO ES UN DOCUMENTO INSTITUCIONAL APROBADO</div>`;
  };
  const renderEditor = () => {
    const d=state.draft,t=typeById(d?.tipoId);if(!d||!t)return '<div class="empty">No se encuentra el documento solicitado.</div>';
    const careers=period().porCarrera;
    return heading('Edición documental',t.nombre,`${t.proceso} · ${t.codigo} · ${period().label}`,button('go-documents','← Volver al catálogo'))+
    `<div class="two-col"><div class="form-card"><div class="eyebrow">DATOS DEL DOCUMENTO</div><div class="field"><label for="f-asunto">Título o asunto</label><input class="input" id="f-asunto" data-field="asunto" value="${escape(d.asunto)}"/></div><div class="field"><label for="f-fecha">Fecha</label><input type="date" class="input" id="f-fecha" data-field="fecha" value="${escape(d.fecha)}"/></div><div class="field"><label for="f-carrera">Carrera</label><select class="select" id="f-carrera" data-field="carrera"><option value="">Todas / sin definir</option>${careers.map(c=>`<option value="${escape(c.nombre)}" ${d.carrera===c.nombre?'selected':''}>${escape(c.nombre)}</option>`).join('')}</select></div><div class="field"><label for="f-responsable">Responsable / firma</label><input class="input" id="f-responsable" data-field="responsable" value="${escape(d.responsable)}" placeholder="Nombre y cargo"/></div><div class="field"><label for="f-contenido">Contenido</label><textarea class="textarea" id="f-contenido" data-field="contenido" style="min-height:235px">${escape(d.contenido)}</textarea><div class="field-hint">Texto demostrativo editable. Se reemplazará por las secciones y tablas oficiales al incorporar tus archivos.</div></div><div class="field"><label for="f-observaciones">Observaciones</label><textarea class="textarea" id="f-observaciones" data-field="observaciones" style="min-height:95px">${escape(d.observaciones)}</textarea></div><span class="tag-status ${statusClass(d.estado)}">${escape(d.estado)} · solo prueba</span></div><div class="preview-card"><div class="preview-toolbar"><span>VISTA PREVIA · A4</span><span>Escala de pantalla referencial</span></div><article class="paper" id="print-preview">${previewHTML(d)}</article></div></div><div class="editor-footer"><small>Guardado local de demostración. Firebase no está conectado.</small>${button('save-doc','Guardar borrador')}${button('review-doc','Simular envío a revisión')}${button('approve-doc','Simular aprobación')}${button('pdf-doc','↓ Exportar PDF','','btn btn-primary')}</div>`;
  };
  const activeLabel = () => ({inicio:'Inicio',periodos:'Períodos académicos',documentos:'Documentos',requisitos:'Requisitos',estudiantes:'Carreras y matrículas',historial:'Historial local',configuracion:'Configuración',editor:'Editar documento'}[state.view]||'Inicio');
  function render() {
    $('nav-main').innerHTML=navItems.map(([id,icon,title])=>`<button class="nav-button ${state.view===id||(state.view==='editor'&&id==='documentos')?'active':''}" data-nav="${id}" title="${escape(title)}"><span class="nav-icon">${icon}</span><span class="nav-text">${escape(title)}</span>${id==='documentos'?'<span class="mini-count">24</span>':''}</button>`).join('');
    $('nav-processes').innerHTML=PROCESOS.map(p=>`<button class="nav-button ${state.view==='documentos'&&state.proceso===p.id?'active':''}" data-action="set-proc" data-id="${p.id}" title="${escape(p.nombre)}"><span class="nav-icon">·</span><span class="nav-text">${escape(p.nombre)}</span><span class="mini-count">${p.documentos.length}</span></button>`).join('');
    $('period-select').innerHTML=DATA.periodos.map(p=>`<option value="${p.id}" ${p.id===state.periodId?'selected':''}>${escape(p.label)}</option>`).join('');
    $('crumb').innerHTML=`Espacio de trabajo <span>/</span> <b>${escape(activeLabel())}</b>`;
    const contents={inicio:renderInicio,periodos:renderPeriodos,documentos:renderDocumentos,requisitos:renderRequisitos,estudiantes:renderEstudiantes,historial:renderHistorial,configuracion:renderConfiguracion,editor:renderEditor};
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
    state.draft={...d};persist();logAction(targetStatus?'Estado simulado actualizado':'Borrador guardado',`${typeById(d.tipoId)?.nombre||'Documento'} · ${d.estado}`);showToast('Guardado únicamente en este equipo');render();return true;
  }
  function handleClick(event) {
    const target=event.target.closest('button[data-action], button[data-nav]');if(!target)return;
    if(target.dataset.nav){state.proceso='todos';go(target.dataset.nav);return;}
    const a=target.dataset.action,id=target.dataset.id;
    if(a==='go-documents'){state.proceso='todos';state.requisito='todos';go('documentos');}
    else if(a==='go-requirements')go('requisitos');
    else if(a==='go-periodos')go('periodos');
    else if(a==='go-history')go('historial');
    else if(a==='set-proc'){state.proceso=id;state.requisito='todos';go('documentos');}
    else if(a==='req-pick'){state.selectedReq=id;go('requisitos');}
    else if(a==='filter-req-docs'){state.proceso='todos';state.requisito=id;go('documentos');}
    else if(a==='select-period'){state.periodId=id;state.proceso='todos';state.requisito='todos';go('inicio');showToast('Período actualizado');}
    else if(a==='new-doc')newDocument(id);
    else if(a==='edit-doc'){const d=state.documents.find(x=>x.id===id);if(d){state.draft={...d};go('editor');}}
    else if(a==='save-doc')saveEditor();
    else if(a==='review-doc')saveEditor('En revisión');
    else if(a==='approve-doc')saveEditor('Aprobado (demo)');
    else if(a==='apply-search'){state.search=$('doc-search')?.value.trim()||'';render();}
    else if(a==='apply-career-search'){state.carreraSearch=$('career-search')?.value.trim()||'';render();}
    else if(a==='clear-filters'){state.search='';state.proceso='todos';state.requisito='todos';state.estado='todos';render();}
    else if(a==='reset-demo'){if(confirm('¿Eliminar los borradores y el historial de prueba guardados en este equipo?')){state.documents=[];state.log=[];persist();localStorage.setItem(LOG_STORAGE,'[]');render();showToast('Datos locales de prueba borrados');}}
    else if(a==='pdf-doc')exportPDF();
  }
  async function exportPDF(){
    if(!state.draft)return;
    if(!window.utetDesktop?.exportPDF){window.print();return;}
    const name=(typeById(state.draft.tipoId)?.proceso||'UTET')+'-'+state.draft.fecha;
    try { const r=await window.utetDesktop.exportPDF(name);if(!r?.canceled)showToast('PDF exportado correctamente'); }
    catch(err){showToast('No fue posible exportar el PDF: '+(err?.message||'Error'));}
  }
  $('period-select').addEventListener('change', e => {state.periodId=e.target.value;state.draft=null;state.proceso='todos';state.requisito='todos';go('inicio');showToast('Período actualizado');});
  $('banner-close').addEventListener('click',()=>{$('banner-close').parentElement.classList.add('hidden');state.bannerVisible=false;});
  document.addEventListener('click',handleClick);
  $('app-content').addEventListener('change',e=>{
    if(e.target.id==='filter-process'){state.proceso=e.target.value;render();}
    if(e.target.id==='filter-requirement'){state.requisito=e.target.value;render();}
    if(e.target.dataset.field&&state.draft){state.draft[e.target.dataset.field]=e.target.value;refreshPreview();}
  });
  $('app-content').addEventListener('input',e=>{
    if(e.target.dataset.field&&state.draft){state.draft[e.target.dataset.field]=e.target.value;refreshPreview();}
  });
  $('app-content').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='doc-search'){e.preventDefault();state.search=e.target.value.trim();render();}if(e.key==='Enter'&&e.target.id==='career-search'){e.preventDefault();state.carreraSearch=e.target.value.trim();render();}});
  function refreshPreview(){const el=$('print-preview');if(el&&state.draft)el.innerHTML=previewHTML(state.draft);}
  render();
})();
