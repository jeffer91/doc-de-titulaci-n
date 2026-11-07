'use strict';
/* PRO-164 · Módulo compacto de antiplagio. Datos estudiantiles en memoria.
   Firebase se consulta de forma directa, bajo demanda, sin pantalla de inicio de sesión. */
window.UTET_ANTIPLAGIO=Object.freeze({create:function createAntiplagio(ctx){
  const {state,period,go,render,showToast}=ctx;
  const M=window.UTET_ANTIPLAGIO_MODEL;
  const $=id=>document.getElementById(id);
  const esc=M.E;
  const today=()=>{
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const meta={codigo:'',destinatario:'',cargoDestinatario:'',fecha:today(),fechaCorte:today(),herramienta:''};
  const session={
    students:[],selected:new Map(),loadedPeriod:'',loadingPeriod:'',loading:false,loadRequest:0,
    query:'',career:'',showSources:'',status:'Sin consultar',error:'',
    preview:false,previewHTML:'',problems:[],busy:false,
    folio:null,folioStatus:'Pendiente',folioRequest:0
  };
  const chosen=()=>[...session.selected.values()];
  const filtered=()=>session.students.filter(s=>
    (!session.career||s.carreraNombre===session.career)&&
    (!session.query||norm(s.nombres+' '+s.cedula+' '+s.carreraNombre).includes(norm(session.query))));
  const button=(action,label,cls='btn btn-small',id='')=>
    '<button type="button" class="'+cls+'" data-action="'+action+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+label+'</button>';
  const input=(label,key,type='text',placeholder='')=>
    '<label class="ap-label">'+esc(label)+'<input data-ap-meta="'+key+'" type="'+type+'" value="'+esc(meta[key]||'')+
    '" placeholder="'+esc(placeholder)+'"></label>';
  const choices=()=>[...new Set(session.students.map(s=>s.carreraNombre).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'es'));

  function reset(){
    session.loadRequest++;
    session.students=[];session.selected.clear();
    session.loadedPeriod='';session.loadingPeriod='';session.loading=false;
    session.query='';session.career='';session.showSources='';
    session.error='';session.status='Sin consultar';
    session.problems=[];session.preview=false;session.previewHTML='';
  }
  function alertError(error){
    session.error=String(error?.message||error||'No se pudo completar la operación.');
    showToast(session.error.slice(0,140));
    render();
  }
  async function refreshFolio(){
    const date=meta.fecha,request=++session.folioRequest;
    meta.codigo='';session.folio=null;session.folioStatus='Consultando...';
    session.preview=false;render();
    try{
      if(!window.utetDesktop?.previewMemoNumber)throw new Error('Actualiza la aplicación.');
      const next=await window.utetDesktop.previewMemoNumber(date);
      if(request!==session.folioRequest||date!==meta.fecha)return;
      session.folio=next;meta.codigo=next.code;
      session.folioStatus='Provisional · se reserva al generar el PDF';
    }catch(error){
      if(request!==session.folioRequest)return;
      session.folioStatus=String(error?.message||error);
    }
    render();
  }
  function open(){
    if(session.loadedPeriod && session.loadedPeriod!==state.periodId)reset();
    go('antiplagio');
    refreshFolio();
    // Al abrir, consultar automáticamente. Si ya hay datos de la misma sesión,
    // conservarlos para no perder porcentajes ingresados.
    if(session.loadedPeriod!==state.periodId && !session.loading)load();
  }
  function onPeriodChange(){
    reset();
    go('antiplagio');
    load();
  }
  async function load(force=false){
    const target=state.periodId;
    if(session.loading && session.loadingPeriod===target)return;
    if(force && session.selected.size && !confirm('Actualizar descartará los resultados registrados. ¿Continuar?'))return;
    if(force||session.loadedPeriod!==target)reset();
    const request=++session.loadRequest;
    session.loading=true;session.loadingPeriod=target;
    session.status='Cargando estudiantes...';session.error='';
    render();
    try{
      if(!window.utetDesktop?.loadAntiplagioStudents)throw new Error('Se necesita la app Electron actualizada.');
      const data=await window.utetDesktop.loadAntiplagioStudents(target);
      if(request!==session.loadRequest||state.periodId!==target)return;
      if(!data||data.periodoId!==target||!Array.isArray(data.students))
        throw new Error('Firebase devolvió un período o listado inesperado.');
      session.students=data.students;
      session.loadedPeriod=target;
      session.status=data.students.length+' estudiantes · Firebase';
      session.error='';
    }catch(error){
      if(request!==session.loadRequest||state.periodId!==target)return;
      session.students=[];session.loadedPeriod='';
      session.status='No disponible';
      session.error=String(error?.message||error);
    }finally{
      if(request===session.loadRequest && state.periodId===target){
        session.loading=false;session.loadingPeriod='';render();
      }
    }
  }
  function tableBody(){
    return filtered().slice(0,80).map(s=>{
      const isChosen=session.selected.has(s.cedula);
      return '<tr><td class="ap-pick-cell">'+button('ap-add',isChosen?'✓':'＋',
        'ap-pick'+(isChosen?' selected':''),s.cedula)+'</td>'+
        '<td class="ap-name">'+esc(s.nombres||'Sin nombre')+
        (s.retirado?'<small class="ap-bad"> · Retirado</small>':'')+
        '<small>'+esc(s.cedula)+'</small></td><td>'+esc(s.carreraNombre||'Sin carrera')+'</td></tr>';
    }).join('');
  }
  function countLabel(){
    const count=filtered().length;
    return count+' encontrados'+(count>80?' · 80 visibles':'')+' · '+session.selected.size+' seleccionados';
  }
  function updateSearchResults(){
    const list=$('ap-search-body'),count=$('ap-search-count');
    if(list)list.innerHTML=tableBody();
    if(count)count.textContent=countLabel();
  }
  function results(){
    const careers=choices();
    const content=session.loadedPeriod===state.periodId?
      '<div class="ap-filterbar">'+
        '<input id="ap-query" class="ap-filter-input" aria-label="Buscar estudiantes" type="search" autocomplete="off" placeholder="Buscar nombre o cédula..." value="'+esc(session.query)+'">'+
        '<select id="ap-career" aria-label="Filtrar carrera"><option value="">Todas las carreras</option>'+
        careers.map(c=>'<option value="'+esc(c)+'" '+(session.career===c?'selected':'')+'>'+esc(c)+'</option>').join('')+
        '</select>'+button('ap-select-visible','Añadir filtrados')+'</div>'+
        '<div class="ap-results"><table><thead><tr><th></th><th>Estudiante</th><th>Carrera</th></tr></thead>'+
        '<tbody id="ap-search-body">'+tableBody()+'</tbody></table></div>'+
        '<div class="ap-inline ap-row-footer"><span id="ap-search-count">'+countLabel()+'</span>'+
        (session.selected.size?button('ap-clear','Vaciar selección','ap-link'):'')+'</div>'
      :'<p class="ap-empty">'+(session.loading?'Cargando estudiantes...':session.error?'No se pudo consultar el período.':'Sin estudiantes cargados.')+'</p>';
    return content;
  }
  function sources(row){
    return '<div class="ap-src-editor">'+M.SOURCE_TYPES.map(s=>
      '<label>'+esc(s.label)+'<select data-ap-id="'+esc(row.cedula)+'" data-ap-source="'+s.key+'">'+
      [['unknown','Sin datos'],['detected','Detectada'],['not-detected','No detectada']]
        .map(([value,name])=>'<option value="'+value+'" '+(row.fuentes[s.key]===value?'selected':'')+'>'+name+'</option>').join('')+
      '</select></label>').join('')+'</div>';
  }
  function editTable(){
    const rows=chosen();
    if(!rows.length)return '<div class="ap-empty ap-empty-selection">Selecciona estudiantes para registrar los resultados.</div>';
    return '<div class="ap-table-wrap"><table class="ap-edit-table"><thead><tr>'+
      '<th>Estudiante</th><th>Similitud</th><th>Fecha</th><th>Evidencia</th><th>Verificado</th><th>Fuentes</th><th></th>'+
      '</tr></thead><tbody>'+rows.map(row=>
      '<tr><td class="ap-identity"><strong>'+esc(row.nombres||'Sin nombre')+'</strong>'+
        '<small>'+esc(row.cedula)+' · '+esc(row.carreraNombre||'Sin carrera')+'</small></td>'+
      '<td><input aria-label="Similitud de '+esc(row.nombres)+'" type="text" inputmode="decimal" placeholder="0–19 %"'+
        ' data-ap-id="'+esc(row.cedula)+'" data-ap-field="similitud" value="'+esc(row.similitud)+'">'+
        '<small class="ap-status '+(M.number(row.similitud)!==null&&M.number(row.similitud)<=19?'ap-good':'ap-bad')+'">'+esc(M.rowState(row))+'</small></td>'+
      '<td><input aria-label="Fecha del reporte de '+esc(row.nombres)+'" type="date" data-ap-id="'+esc(row.cedula)+'" data-ap-field="fechaReporte" value="'+esc(row.fechaReporte)+'"></td>'+
      '<td><input aria-label="Referencia" placeholder="ID o enlace" data-ap-id="'+esc(row.cedula)+'" data-ap-field="referencia" value="'+esc(row.referencia)+'">'+
        '<input aria-label="Herramienta" placeholder="Herramienta" data-ap-id="'+esc(row.cedula)+'" data-ap-field="herramienta" value="'+esc(row.herramienta)+'"></td>'+
      '<td><input type="checkbox" aria-label="Resultado verificado de '+esc(row.nombres)+'" data-ap-id="'+esc(row.cedula)+'" data-ap-field="confirmado" '+(row.confirmado?'checked':'')+'></td>'+
      '<td>'+button('ap-sources',session.showSources===row.cedula?'Ocultar':'Fuentes','ap-link',row.cedula)+
      (session.showSources===row.cedula?sources(row):'')+'</td>'+
      '<td>'+button('ap-remove','Quitar','ap-link',row.cedula)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function configuration(){
    return '<div class="ap-form-grid ap-form-compact">'+
      input('Fecha de emisión','fecha','date')+
      '<div class="ap-label"><span>Memorando · consecutivo mensual</span>'+
        '<div class="ap-code-field"><strong>No. '+esc(meta.codigo||'Pendiente')+'</strong></div>'+
        '<small class="ap-mini">'+esc(session.folioStatus)+'</small></div>'+
      input('Fecha de corte','fechaCorte','date')+
      input('Destinatario','destinatario')+
      input('Cargo','cargoDestinatario')+
      input('Herramienta (opcional)','herramienta','text','Según evidencia')+
      '</div>';
  }
  function renderView(){
    const count=chosen().length,stats=M.summary(chosen());
    return '<div class="ap-workspace ap-compact">'+
      '<div class="ap-title"><div><h1>Antiplagio <span>· PRO-164</span></h1></div>'+
        '<div class="ap-actions"><span class="ap-connect'+(session.loadedPeriod===state.periodId?' ready':session.error?' failed':'')+'">'+
        (session.loading?'● Conectando':session.error?'● Sin conexión':session.loadedPeriod===state.periodId?'● Firebase listo':'● Firebase')+
        '</span>'+button('ap-back','Volver','ap-link')+'</div></div>'+
      '<section class="ap-panel ap-panel-main">'+
        '<div class="ap-section-head"><h2>Estudiantes <span>· '+esc(period().label)+'</span></h2>'+
        '<div class="ap-actions"><span class="ap-mini" aria-live="polite">'+esc(session.status)+'</span>'+
        button('ap-refresh','Actualizar')+'</div></div>'+
        (session.error?'<div class="ap-error ap-mini" role="alert">'+esc(session.error)+'</div>':'')+
        results()+
        '<div class="ap-section-head ap-subsection"><h2>Resultados</h2><span class="ap-pill">'+count+' seleccionados</span></div>'+
        editTable()+'</section>'+
      '<section class="ap-panel ap-panel-output"><div class="ap-section-head"><h2>Memorando y PDF</h2>'+
        '<div class="ap-mini">0–19 %: '+stats.inRange+' · Fuera de rango: '+stats.outRange+'</div></div>'+
        configuration()+
        (session.problems.length?'<div class="ap-validation ap-error" role="alert"><strong>Corrige '+session.problems.length+' observaciones</strong><ul>'+
        session.problems.slice(0,10).map(x=>'<li>'+esc(x)+'</li>').join('')+
        (session.problems.length>10?'<li>Y '+(session.problems.length-10)+' más.</li>':'')+'</ul></div>':'')+
        '<div class="ap-actions ap-exportbar">'+
        button('ap-preview','Vista previa','btn')+
        button('ap-export',session.busy?'Generando...':'Generar PDF','btn btn-primary')+
        '<span class="ap-mini">No. automático · PDF sin firma</span></div>'+
        (session.preview?'<div class="ap-preview-scroll">'+session.previewHTML+'</div>':'')+
      '</section></div>';
  }
  function addOne(id){
    const person=session.students.find(s=>s.cedula===id);
    if(!person)return;
    if(session.selected.has(id))session.selected.delete(id);
    else session.selected.set(id,M.createRow(person));
    session.preview=false;session.problems=[];render();
  }
  function showPreview(){
    const rows=chosen();
    session.problems=M.validate(rows,meta);
    if(!rows.length){render();return;}
    session.previewHTML=M.renderPDF(meta,rows,period().label);
    session.preview=true;render();
  }
  async function exportPDF(){
    if(session.busy)return;
    const rows=chosen(),errors=M.validate(rows,meta);
    session.problems=errors;
    if(errors.length){session.preview=false;render();showToast('Corrige '+errors.length+' observaciones.');return;}
    if(!window.utetDesktop?.exportPDF){showToast('Se requiere Electron para guardar el PDF.');return;}
    session.busy=true;render();
    try{
      // El número provisional no es el definitivo; Electron lo reserva al emitir.
      const html=M.renderPDF({...meta,codigo:'UTET_MEMO_CODE_PENDING'},rows,period().label);
      const filename='MEM_ANTIPLAGIO_'+M.escapeFilename(state.periodId)+'_'+
        M.escapeFilename(meta.fecha)+'_'+M.escapeFilename(meta.codigo);
      const out=await window.utetDesktop.exportPDF({html,suggestedName:filename,kind:'antiplagio',memoDate:meta.fecha});
      if(!out?.canceled){
        showToast('PDF generado · No. '+out.memoCode+'. Requiere firma válida.');
        session.preview=false;session.previewHTML='';
        await refreshFolio();
      }
    }catch(error){alertError(error)}
    finally{session.busy=false;render();}
  }
  function handleAction(action,id){
    if((action==='rec-open'||action==='new-doc')&&id==='plagio-trabajo'){open();return true;}
    if(!action?.startsWith('ap-'))return false;
    if(action==='ap-back')go('documentos');
    else if(action==='ap-refresh')load(true);
    else if(action==='ap-add')addOne(id);
    else if(action==='ap-remove'){session.selected.delete(id);session.preview=false;session.problems=[];render();}
    else if(action==='ap-select-visible'){
      session.query=$('ap-query')?.value||session.query;
      session.career=$('ap-career')?.value||'';
      const values=filtered();
      if(values.length>80 && !confirm('¿Añadir los '+values.length+' estudiantes filtrados?'))return true;
      values.forEach(s=>{if(!session.selected.has(s.cedula))session.selected.set(s.cedula,M.createRow(s));});
      session.preview=false;session.problems=[];render();
    }else if(action==='ap-clear'){
      if(!session.selected.size||confirm('¿Vaciar la selección?')){
        session.selected.clear();session.preview=false;session.problems=[];render();
      }
    }else if(action==='ap-sources'){session.showSources=session.showSources===id?'':id;render();}
    else if(action==='ap-preview')showPreview();
    else if(action==='ap-export')exportPDF();
    return true;
  }
  function inputChange(event){
    const target=event.target;
    if(!target)return;
    if(target.id==='ap-query'){
      session.query=target.value||'';updateSearchResults();return;
    }
    if(target.id==='ap-career'){
      session.career=target.value||'';updateSearchResults();return;
    }
    const key=target.dataset?.apMeta;
    if(key&&key!=='codigo'&&Object.prototype.hasOwnProperty.call(meta,key)){
      const changed=meta[key]!==target.value;
      meta[key]=target.value;session.preview=false;session.problems=[];
      if(key==='fecha'&&changed){refreshFolio();return;}
    }
    const id=target.dataset?.apId,row=session.selected.get(id);
    if(!row)return;
    if(target.dataset.apField){
      const field=target.dataset.apField;
      if(['similitud','fechaReporte','referencia','herramienta','confirmado'].includes(field))
        row[field]=field==='confirmado'?target.checked:target.value;
    }
    if(target.dataset.apSource&&M.SOURCE_TYPES.some(s=>s.key===target.dataset.apSource))
      row.fuentes[target.dataset.apSource]=target.value;
    session.preview=false;session.problems=[];
    if(target.dataset.apField==='similitud'){
      const status=target.closest?.('td')?.querySelector?.('.ap-status');
      if(status){status.textContent=M.rowState(row);
        status.className='ap-status '+(M.number(row.similitud)!==null&&M.number(row.similitud)<=19?'ap-good':'ap-bad');}
    }
  }
  return {open,onPeriodChange,reset,load,render:renderView,handleAction,input:inputChange,session};
}});
