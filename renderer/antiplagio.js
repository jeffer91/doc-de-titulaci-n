'use strict';
/* Interfaz exclusiva PRO-164. Los datos personales y los resultados viven en memoria,
   no en localStorage. Todos los demás documentos conservan sus propios formularios. */
window.UTET_ANTIPLAGIO = Object.freeze({create:function createAntiplagio(ctx){
  const {state,period,go,render,showToast}=ctx;
  const M=window.UTET_ANTIPLAGIO_MODEL;
  const $=id=>document.getElementById(id);
  const esc=M.E;
  const at=()=>new Date().toLocaleDateString('en-CA');
  const session={
    students:[],selected:new Map(),source:'',loadedPeriod:'',loading:false,
    query:'',career:'',showSources:'',preview:false,previewHTML:'',
    status:'Consulta no iniciada.',error:'',problems:[],busy:false,
    firebase:{authenticated:false,email:''}
  };
  const meta={codigo:'',destinatario:'',cargoDestinatario:'',
    fecha:at(),fechaCorte:at(),herramienta:''};
  const students=()=>session.students.filter(s=>{
    const q=session.query.toLocaleLowerCase('es');
    return (!session.career||s.carreraNombre===session.career)&&(!q||
      (s.nombres+' '+s.cedula+' '+s.carreraNombre).toLocaleLowerCase('es').includes(q));
  });
  const chosen=()=>[...session.selected.values()];
  function errorMessage(e){session.error=String(e?.message||e||'Error desconocido');showToast(session.error.slice(0,170));render();}
  function clearPeriod(){
    session.students=[];session.selected.clear();session.loadedPeriod='';
    session.query='';session.career='';session.preview=false;session.previewHTML='';
    session.error='';session.problems=[];session.status='Consulta no iniciada.';
  }
  function open(){
    if(session.loadedPeriod && session.loadedPeriod!==state.periodId)clearPeriod();
    go('antiplagio');
  }
  const button=(action,label,cls='btn',id='')=>'<button type="button" class="'+cls+'" data-action="'+action+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+label+'</button>';
  const input=(label,key,opts={})=>'<label class="ap-label">'+esc(label)+
    '<input data-ap-meta="'+key+'" type="'+(opts.type||'text')+'" value="'+esc(meta[key]||'')+'" placeholder="'+esc(opts.placeholder||'')+'"></label>';
  const careerOptions=()=>{
    const cs=[...new Set(session.students.map(s=>s.carreraNombre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    return '<option value="">Todas las carreras</option>'+cs.map(x=>'<option value="'+esc(x)+'" '+(x===session.career?'selected':'')+'>'+esc(x)+'</option>').join('');
  };
  function results(){
    if(session.loadedPeriod!==state.periodId)return '<p class="ap-empty">Consulta Firebase para ver a los estudiantes de este período.</p>';
    const matches=students(),show=matches.slice(0,80);
    return '<div class="ap-row"><div class="ap-inline"><label class="ap-label">Filtrar carrera<select id="ap-career">'+careerOptions()+
      '</select></label><label class="ap-label">Buscar<input id="ap-query" placeholder="Apellidos, nombres o cédula" value="'+esc(session.query)+'"></label>'+
      button('ap-search','Buscar','btn btn-small')+'</div><div class="ap-actions">'+
      button('ap-select-visible','Añadir resultados filtrados','btn btn-small')+
      button('ap-clear','Vaciar selección','btn btn-small')+'</div></div>'+
      '<p class="ap-status">'+matches.length+' coincidencias · mostrando '+show.length+' · '+session.selected.size+' seleccionados.</p>'+
      '<div class="ap-results"><table><thead><tr><th>Añadir</th><th>Cédula</th><th>Apellidos y nombres</th><th>Carrera</th></tr></thead><tbody>'+
      show.map(s=>'<tr><td>'+button('ap-add',session.selected.has(s.cedula)?'Quitar':'Añadir','btn btn-small',s.cedula)+'</td>'+
        '<td>'+esc(s.cedula)+'</td><td>'+esc(s.nombres||'Nombre no informado')+
        (s.retirado?' <span class="ap-bad">(retirado)</span>':'')+'</td><td>'+esc(s.carreraNombre||'Sin carrera')+'</td></tr>').join('')+
      '</tbody></table></div>';
  }
  function sources(r){
    return '<div class="ap-src-editor">'+M.SOURCE_TYPES.map(s=>'<label>'+esc(s.label)+
      '<select data-ap-id="'+esc(r.cedula)+'" data-ap-source="'+s.key+'">'+
      ['unknown','detected','not-detected'].map((v,i)=>'<option value="'+v+'" '+(r.fuentes[s.key]===v?'selected':'')+'>'+
        ['Sin información','Detectada','No detectada'][i]+'</option>').join('')+'</select></label>').join('')+'</div>';
  }
  function editTable(){
    const rows=chosen();
    if(!rows.length)return '<div class="ap-empty">Selecciona estudiantes para registrar sus índices de similitud.</div>';
    return '<p class="ap-note">Registra el porcentaje real (0–100), sin modificarlo. Para el PDF operativo solo se aceptan estudiantes con resultados de 0–19 % confirmados y fechados. Las fuentes se marcan únicamente a partir de la evidencia.</p>'+
      '<div class="ap-table-wrap"><table class="ap-edit-table"><thead><tr><th>Estudiante</th><th>Similitud</th>'+
      '<th>Fecha del reporte</th><th>Referencia / herramienta</th><th>Confirmación</th><th>Fuentes</th><th></th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td class="ap-identity"><strong>'+esc(r.nombres||'Nombre pendiente')+'</strong><br>'+
        esc(r.cedula)+'<br><small>'+esc(r.carreraNombre||'Carrera pendiente')+'</small></td>'+
        '<td><input aria-label="Similitud de '+esc(r.nombres)+'" type="text" inputmode="decimal" placeholder="0–100" data-ap-id="'+esc(r.cedula)+'" data-ap-field="similitud" value="'+esc(r.similitud)+'">'+
        '<div class="'+(M.number(r.similitud)!==null&&M.number(r.similitud)<=19?'ap-good':'ap-bad')+' ap-status">'+esc(M.rowState(r))+'</div></td>'+
        '<td><input type="date" data-ap-id="'+esc(r.cedula)+'" data-ap-field="fechaReporte" value="'+esc(r.fechaReporte)+'"></td>'+
        '<td><input placeholder="ID o enlace del reporte" data-ap-id="'+esc(r.cedula)+'" data-ap-field="referencia" value="'+esc(r.referencia)+'">'+
        '<input placeholder="Herramienta (según evidencia)" data-ap-id="'+esc(r.cedula)+'" data-ap-field="herramienta" value="'+esc(r.herramienta)+'"></td>'+
        '<td><label class="ap-mini"><input type="checkbox" data-ap-id="'+esc(r.cedula)+'" data-ap-field="confirmado" '+(r.confirmado?'checked':'')+'> Confirmo resultado real</label></td>'+
        '<td>'+button('ap-sources',session.showSources===r.cedula?'Ocultar fuentes':'Configurar fuentes','btn btn-small',r.cedula)+
          (session.showSources===r.cedula?sources(r):'')+'</td>'+
        '<td>'+button('ap-remove','Quitar','btn btn-small',r.cedula)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function configuration(){
    return '<div class="ap-form-grid">'+input('Código real del memorando','codigo',{placeholder:'MEM-ITSQMET-UTET-...'})+
      input('Autoridad destinataria','destinatario')+input('Cargo del destinatario','cargoDestinatario')+
      input('Fecha del memorando','fecha',{type:'date'})+input('Fecha de corte','fechaCorte',{type:'date'})+
      input('Herramienta común (si está documentada)','herramienta',{placeholder:'Opcional; según evidencia'})+'</div>'+
      '<p class="ap-mini">Remitente fijo: MSc. Jefferson Edgar Villarreal Enríquez — Coordinador de Titulación. El espacio de firma permanece sin firmar.</p>';
  }
  function renderView(){
    const rows=chosen(),sum=M.summary(rows);
    return '<div class="ap-workspace">'+
      '<div class="ap-title"><div><h1>Porcentaje de Antiplagio · PRO-164</h1>'+
      '<p>Memorando institucional y reporte visual. Un único PDF · datos reales · sin Excel.</p></div>'+
      button('ap-back','← Volver al catálogo','btn btn-small')+'</div>'+
      '<section class="ap-panel"><h2>1. Consultar estudiantes desde Firebase</h2>'+
      '<p class="ap-note">Origen: proyecto utet-4387a, colecciones <strong>matriculas</strong> y <strong>Estudiante</strong>. '+
      'Esta consulta no escribe ni modifica datos académicos. La app no guarda cédulas ni porcentajes en el almacenamiento local.</p>'+
      '<div class="ap-row" style="margin-top:12px"><div><strong>Período: '+esc(period().label)+'</strong>'+
      '<p class="ap-status">'+esc(session.status)+'</p></div>'+
      '<div class="ap-actions">'+button('ap-load',session.loading?'Consultando...':'Consultar estudiantes','btn btn-primary')+'</div></div>'+
      '<details><summary class="ap-mini">Iniciar sesión en Firebase (solo si el acceso lo requiere)</summary>'+
      '<div class="ap-inline" style="margin-top:10px">'+
      '<label class="ap-label">Correo institucional<input type="email" id="ap-email" autocomplete="off"></label>'+
      '<label class="ap-label">Contraseña<input type="password" id="ap-password" autocomplete="off"></label>'+
      button('ap-login','Iniciar sesión','btn btn-small')+
      (session.firebase.authenticated?button('ap-logout','Cerrar sesión','btn btn-small'):'')+
      '</div><p class="ap-mini">Sesión '+(session.firebase.authenticated?'iniciada: '+esc(session.firebase.email):'no iniciada')+
      '. La contraseña no se almacena.</p></details>'+
      (session.error?'<p class="ap-note ap-error">'+esc(session.error)+'</p>':'')+
      '<div style="margin-top:14px">'+results()+'</div></section>'+
      '<section class="ap-panel"><div class="ap-row"><h2>2. Resultados y evidencia</h2><span class="ap-pill">'+rows.length+' seleccionados</span></div>'+
      editTable()+'</section>'+
      '<section class="ap-panel"><h2>3. Configuración del memorando</h2>'+configuration()+'</section>'+
      '<section class="ap-panel"><h2>4. Validar y generar PDF</h2>'+
      '<div class="ap-inline"><span class="ap-pill">Seleccionados: '+sum.total+'</span>'+
      '<span class="ap-pill">Con resultado: '+sum.present+'</span>'+
      '<span class="ap-pill">0–19 %: '+sum.inRange+'</span>'+
      '<span class="ap-pill">Fuera de rango: '+sum.outRange+'</span></div>'+
      '<p class="ap-mini">La primera hoja es el memorando; la segunda comienza el reporte; siguen las tablas y los gráficos de distribución, comparación y fuentes verificadas.</p>'+
      (session.problems.length?'<div class="ap-note ap-error"><strong>No se puede emitir todavía:</strong><ul>'+
      session.problems.slice(0,20).map(p=>'<li>'+esc(p)+'</li>').join('')+
      (session.problems.length>20?'<li>Y '+(session.problems.length-20)+' observaciones adicionales.</li>':'')+
      '</ul></div>':'')+
      '<div class="ap-actions">'+button('ap-preview','Actualizar vista previa','btn')+
      button('ap-export',session.busy?'Generando...':'Generar PDF institucional','btn btn-primary')+'</div>'+
      (session.preview?'<div class="ap-preview-scroll">'+session.previewHTML+'</div>':'')+
      '</section></div>';
  }
  async function load(){
    if(session.loading)return;
    if(session.selected.size && !confirm('Volver a consultar descartará los resultados registrados en esta sesión. ¿Continuar?'))return;
    clearPeriod();session.loading=true;session.status='Consultando matrículas y estudiantes...';render();
    try{
      if(!window.utetDesktop?.loadAntiplagioStudents)throw new Error('Esta función requiere la aplicación Electron actualizada.');
      const out=await window.utetDesktop.loadAntiplagioStudents(state.periodId);
      if(out.periodoId!==state.periodId)throw new Error('Cambió el período durante la consulta. Vuelve a consultar.');
      session.students=out.students;session.loadedPeriod=state.periodId;session.source=out.source;
      session.status=out.students.length+' estudiantes disponibles. Fuente: '+out.source+' · consulta '+new Date(out.readAt).toLocaleString('es-EC');
      session.error='';render();
    }catch(e){errorMessage(e)}
    finally{session.loading=false;render();}
  }
  function addOne(id){
    const student=session.students.find(x=>x.cedula===id);
    if(!student)return;
    if(session.selected.has(id))session.selected.delete(id);
    else session.selected.set(id,M.createRow(student));
    session.preview=false;session.problems=[];render();
  }
  function showPreview(){
    const rows=chosen();
    session.problems=M.validate(rows,meta);
    session.previewHTML=M.renderPDF(meta,rows,period().label);
    session.preview=true;render();
  }
  async function exportPDF(){
    if(session.busy)return;
    const rows=chosen(),errors=M.validate(rows,meta);
    session.problems=errors;
    if(errors.length){session.preview=false;render();showToast('Corrige '+errors.length+' observaciones antes de generar el PDF.');return;}
    if(!window.utetDesktop?.exportPDF){showToast('Se requiere Electron para exportar el PDF.');return;}
    session.busy=true;render();
    try{
      const html=M.renderPDF(meta,rows,period().label);
      const name='MEM_ANTIPLAGIO_'+M.escapeFilename(state.periodId)+'_'+
        M.escapeFilename(meta.fecha)+'_'+M.escapeFilename(meta.codigo);
      const out=await window.utetDesktop.exportPDF({
        html,suggestedName:name,kind:'antiplagio'
      });
      if(!out?.canceled)showToast('PDF institucional generado. El archivo requiere tu firma válida.');
    }catch(e){errorMessage(e)}
    finally{session.busy=false;render();}
  }
  async function login(){
    const email=$('ap-email')?.value||'',password=$('ap-password')?.value||'';
    try{
      if(!window.utetDesktop?.antiplagioFirebaseLogin)throw new Error('Actualiza la aplicación Electron.');
      session.firebase=await window.utetDesktop.antiplagioFirebaseLogin({email,password});
      session.error='';showToast('Sesión de Firebase iniciada.');render();
    }catch(e){errorMessage(e)}
  }
  function handleAction(action,id){
    if(action==='rec-open' && id==='plagio-trabajo'){open();return true;}
    if(action==='new-doc' && id==='plagio-trabajo'){open();return true;}
    if(!action?.startsWith('ap-'))return false;
    if(action==='ap-back')go('documentos');
    else if(action==='ap-load')load();
    else if(action==='ap-login')login();
    else if(action==='ap-logout'){window.utetDesktop?.antiplagioFirebaseLogout?.().then(r=>{session.firebase=r;render();}).catch(errorMessage);}
    else if(action==='ap-search'){session.query=$('ap-query')?.value.trim()||'';session.career=$('ap-career')?.value||'';render();}
    else if(action==='ap-add')addOne(id);
    else if(action==='ap-remove'){session.selected.delete(id);session.preview=false;render();}
    else if(action==='ap-clear'){if(!session.selected.size||confirm('¿Vaciar toda la selección?')){session.selected.clear();session.preview=false;render();}}
    else if(action==='ap-select-visible'){
      const visible=students();
      if(visible.length>80&&!confirm('¿Incluir los '+visible.length+' estudiantes filtrados?'))return true;
      visible.forEach(s=>{if(!session.selected.has(s.cedula))session.selected.set(s.cedula,M.createRow(s));});
      session.preview=false;render();
    }
    else if(action==='ap-sources'){session.showSources=session.showSources===id?'':id;render();}
    else if(action==='ap-preview')showPreview();
    else if(action==='ap-export')exportPDF();
    return true;
  }
  function inputChange(e){
    const target=e.target;
    const key=target.dataset?.apMeta;
    if(key && Object.prototype.hasOwnProperty.call(meta,key)){meta[key]=target.value;session.preview=false;}
    const id=target.dataset?.apId,r=session.selected.get(id);
    if(r){
      if(target.dataset?.apField){
        const k=target.dataset.apField;
        if(['similitud','fechaReporte','referencia','herramienta','confirmado'].includes(k))
          r[k]=k==='confirmado'?target.checked:target.value;
      }
      if(target.dataset?.apSource && M.SOURCE_TYPES.some(s=>s.key===target.dataset.apSource))
        r.fuentes[target.dataset.apSource]=target.value;
      session.preview=false;session.problems=[];
    }
    if(target.id==='ap-career'){session.career=target.value;render();}
  }
  return {open,render:renderView,handleAction,input:inputChange,reset:clearPeriod,session};
}});
