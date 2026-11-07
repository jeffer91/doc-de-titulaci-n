'use strict';
/* PRO-164: memorandos individuales; almacenamiento Firebase y descarga sin vista previa. */
window.UTET_ANTIPLAGIO=Object.freeze({create:function createAntiplagio(ctx){
 const {state,period,go,render,showToast}=ctx,M=window.UTET_ANTIPLAGIO_MODEL;
 const esc=M.E, $=id=>document.getElementById(id);
 const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const session={students:[],selected:new Map(),saved:new Map(),loadedPeriod:'',loading:false,request:0,
  query:'',career:'',busy:false,error:'',saveError:'',status:'Sin consultar',problems:[],showSources:''};
 const selected=()=>[...session.selected.values()];
 const filtered=()=>session.students.filter(s=>(!session.career||s.carreraNombre===session.career)&&
  (!session.query||normal(s.nombres+' '+s.cedula+' '+s.carreraNombre).includes(normal(session.query))));
 const btn=(action,label,css='btn btn-small',id='')=>'<button type="button" class="'+css+'" data-action="'+action+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+label+'</button>';
 function reset(){
  session.request++;session.students=[];session.selected.clear();session.saved.clear();
  session.loadedPeriod='';session.loading=false;session.query='';session.career='';session.error='';
  session.saveError='';session.status='Sin consultar';session.problems=[];session.showSources='';
 }
 function open(){if(session.loadedPeriod&&session.loadedPeriod!==state.periodId)reset();go('antiplagio');if(session.loadedPeriod!==state.periodId&&!session.loading)load();}
 function onPeriodChange(){reset();go('antiplagio');load();}
 async function load(force=false){
  const target=state.periodId;
  if(session.loading)return;
  if(force&&session.selected.size)session.status='Actualizando; se perderán cambios no guardados.';
  const ticket=++session.request;session.loading=true;session.error='';session.status='Cargando estudiantes...';render();
  try{
   if(!window.utetDesktop?.loadAntiplagioStudents)throw Error('Actualiza Electron para consultar Firebase.');
   const data=await window.utetDesktop.loadAntiplagioStudents(target);
   if(ticket!==session.request||target!==state.periodId)return;
   if(data?.periodoId!==target||!Array.isArray(data.students))throw Error('Respuesta de estudiantes inválida.');
   session.students=data.students;session.loadedPeriod=target;
   // La lectura de memorandos se realiza en otra colección; las fichas académicas no se modifican.
   if(window.utetDesktop?.getAntiplagioRecords){
    try{
     const records=await window.utetDesktop.getAntiplagioRecords(target);
     if(ticket!==session.request||target!==state.periodId)return;
     session.saved=new Map(records.filter(x=>x?.cedula&&x.periodoId===target).map(x=>[x.cedula,x]));
    }catch(error){session.error='No fue posible recuperar memorandos guardados: '+String(error.message||error).slice(0,210);}
   }
   session.selected.clear();session.status=session.students.length+' estudiantes · '+session.saved.size+' memorandos guardados';
  }catch(error){
   if(ticket!==session.request||target!==state.periodId)return;
   session.students=[];session.loadedPeriod='';session.error=String(error?.message||error).slice(0,280);
   session.status='Consulta no disponible';
  }finally{if(ticket===session.request){session.loading=false;render();}}
 }
 function studentRow(s){
  const stored=session.saved.has(s.cedula),chosen=session.selected.has(s.cedula);
  const clean=M.normalizeCareer(s.carreraNombre,s.modalidad);
  return '<tr><td>'+btn('ap-add',chosen?'✓':'＋','ap-pick'+(chosen?' selected':''),s.cedula)+'</td>'+
   '<td class="ap-name">'+esc(s.nombres)+'<small>'+esc(s.cedula)+(stored?' · Memorando guardado':'')+'</small></td>'+
   '<td>'+esc(clean.carrera)+'<small>'+esc(clean.modalidad)+'</small></td></tr>';
 }
 function listRows(){return filtered().slice(0,100).map(studentRow).join('');}
 function refreshResults(){const a=$('ap-search-body'),b=$('ap-search-count');if(a)a.innerHTML=listRows();
  if(b)b.textContent=filtered().length+' encontrados · '+session.selected.size+' seleccionados';}
 function searchBlock(){
  if(session.loadedPeriod!==state.periodId)return '<p class="ap-empty">'+(session.loading?'Cargando...':session.error||'Sin datos')+'</p>';
  const careers=[...new Set(session.students.map(s=>s.carreraNombre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  return '<div class="ap-filterbar"><input id="ap-query" type="search" placeholder="Buscar por nombre o cédula" value="'+esc(session.query)+'">'+
   '<select id="ap-career"><option value="">Todas las carreras</option>'+careers.map(c=>'<option value="'+esc(c)+'"'+(session.career===c?' selected':'')+'>'+esc(M.normalizeCareer(c,'').carrera)+'</option>').join('')+'</select>'+
   btn('ap-add-filtered','Añadir filtrados')+'</div>'+
   '<div class="ap-results"><table><thead><tr><th></th><th>Estudiante</th><th>Carrera / modalidad</th></tr></thead><tbody id="ap-search-body">'+listRows()+'</tbody></table></div>'+
   '<div class="ap-row-footer"><small id="ap-search-count">'+filtered().length+' encontrados · '+session.selected.size+' seleccionados</small> '+btn('ap-clear','Vaciar selección','ap-link')+'</div>';
 }
 function sources(row){
  return '<div class="ap-src-editor">'+M.SOURCE_TYPES.map(s=>'<label>'+esc(s.label)+'<select data-ap-id="'+esc(row.cedula)+'" data-ap-source="'+s.key+'">'+
   [['unknown','Sin datos'],['detected','Coincidencia'],['not-detected','Sin coincidencia']].map(([k,v])=>
    '<option value="'+k+'"'+(row.fuentes?.[s.key]===k?' selected':'')+'>'+v+'</option>').join('')+'</select></label>').join('')+'</div>';
 }
 function editTable(){
  if(!session.selected.size)return '<p class="ap-empty">Selecciona uno o varios estudiantes.</p>';
  return '<div class="ap-table-wrap"><table class="ap-edit-table"><thead><tr><th>Estudiante</th><th>Similitud</th><th>Origen</th><th>Documento</th><th>Fuentes</th><th></th></tr></thead><tbody>'+
   selected().map(row=>{
    const norm=M.normalizeCareer(row.carreraNombre,row.modalidad);
    return '<tr><td class="ap-identity"><strong>'+esc(row.nombres)+'</strong><small>'+esc(row.cedula)+' · '+esc(norm.carrera)+' · '+esc(norm.modalidad)+'</small></td>'+
     '<td><input type="text" inputmode="decimal" data-ap-id="'+esc(row.cedula)+'" data-ap-field="similitud" value="'+esc(row.similitud)+'"><small class="ap-status">'+esc(M.number(row.similitud)!==null&&M.number(row.similitud)<20?'APROBADO':'NO APROBADO')+'</small></td>'+
     '<td><select data-ap-id="'+esc(row.cedula)+'" data-ap-field="origen"><option value="simulado"'+(row.origen==='simulado'?' selected':'')+'>Simulación</option><option value="real"'+(row.origen==='real'?' selected':'')+'>Dato real</option></select></td>'+
     '<td><small>'+esc(row.folio||'Sin emitir')+'</small><small>'+esc(row.referencia||'Referencia por asignar')+'</small></td>'+
     '<td>'+btn('ap-sources',session.showSources===row.cedula?'Ocultar':'Fuentes','ap-link',row.cedula)+(session.showSources===row.cedula?sources(row):'')+'</td>'+
     '<td>'+btn('ap-one','PDF','ap-link',row.cedula)+' '+btn('ap-remove','Quitar','ap-link',row.cedula)+'</td></tr>';
   }).join('')+'</tbody></table></div>';
 }
 function renderView(){
  const n=session.selected.size;
  return '<div class="ap-workspace ap-compact"><div class="ap-title"><h1>Antiplagio <span>· PRO-164</span></h1>'+
    '<div class="ap-actions"><span class="ap-connect'+(session.loadedPeriod===state.periodId?' ready':'')+'">'+esc(session.status)+'</span>'+btn('ap-back','Volver','ap-link')+'</div></div>'+
    '<section class="ap-panel"><div class="ap-section-head"><h2>Estudiantes · '+esc(period().label)+'</h2>'+btn('ap-refresh','Actualizar')+'</div>'+
    (session.error?'<p class="ap-error" role="alert">'+esc(session.error)+'</p>':'')+searchBlock()+
    '<div class="ap-section-head ap-subsection"><h2>Memorandos seleccionados</h2><span class="ap-pill">'+n+'</span></div>'+editTable()+'</section>'+
    '<section class="ap-panel ap-panel-output"><div class="ap-section-head"><h2>Descargas</h2><span class="ap-mini">Fecha de emisión: '+esc(M.day(M.periodDate(state.periodId)))+'</span></div>'+
    (session.saveError?'<p class="ap-error" role="alert">'+esc(session.saveError)+'</p>':'')+
    '<div class="ap-actions ap-exportbar">'+btn('ap-pdfs',session.busy?'Generando...':'PDF individuales','btn btn-primary')+
    btn('ap-zip',session.busy?'Generando...':'Descargar ZIP')+'</div>'+
    '<p class="ap-mini">Los registros simulados se identifican en el PDF. El guardado requiere permiso de escritura en Firebase.</p></section></div>';
 }
 function addOne(id){
  const student=session.students.find(s=>s.cedula===id);
  if(!student)return;
  if(session.selected.has(id))session.selected.delete(id);
  else{
   const stored=session.saved.get(id);
   const base=M.createRow(student);
   const specimen=M.example(student.estudianteId);
   session.selected.set(id,stored?{...base,...stored,fuentes:{...base.fuentes,...stored.fuentes}}:
     {...base,...student,...specimen,fecha:M.periodDate(state.periodId),periodoNombre:period().label,versionPlantilla:'2'});
  }
  session.saveError='';render();
 }
 async function exportDocs(rows,mode){
  if(session.busy||!rows.length)return;
  if(!window.utetDesktop?.saveAntiplagioRecord||!window.utetDesktop?.exportAntiplagioFiles){session.saveError='Actualiza Electron antes de generar memorandos.';render();return;}
  session.busy=true;session.saveError='';render();
  try{
   const files=[];
   for(const row of rows){
    if(M.number(row.similitud)===null)throw Error('Porcentaje inválido para '+row.nombres);
    const saved=await window.utetDesktop.saveAntiplagioRecord({...row,periodoId:state.periodId,
      estudianteId:state.periodId+'__'+row.cedula,periodoNombre:period().label,
      fecha:row.fecha||M.periodDate(state.periodId),versionPlantilla:'2'});
    row.folio=saved.folio;row.referencia=saved.referencia;row.fecha=saved.fecha;
    session.saved.set(row.cedula,{...row});
    const html=M.individualHTML(row,{},period().label);
    const name=('MEM_'+saved.folio.replace(/[^A-Za-z0-9._-]/g,'_')+'_'+row.cedula+'.pdf').slice(0,120);
    files.push({name,html});
   }
   const result=await window.utetDesktop.exportAntiplagioFiles({mode,files});
   if(!result?.canceled)showToast(result.count+' memorandos guardados en '+result.location);
  }catch(error){session.saveError=String(error?.message||error).slice(0,320);showToast('No se completó la operación.');}
  finally{session.busy=false;render();}
 }
 function handleAction(a,id){
  if((a==='rec-open'||a==='new-doc')&&id==='plagio-trabajo'){open();return true;}
  if(!a?.startsWith('ap-'))return false;
  if(a==='ap-back')go('documentos');
  else if(a==='ap-refresh')load(true);
  else if(a==='ap-add')addOne(id);
  else if(a==='ap-remove'){session.selected.delete(id);render();}
  else if(a==='ap-clear'){session.selected.clear();render();}
  else if(a==='ap-sources'){session.showSources=session.showSources===id?'':id;render();}
  else if(a==='ap-add-filtered'){filtered().forEach(s=>{
   if(!session.selected.has(s.cedula)){const old=session.saved.get(s.cedula),base=M.createRow(s),example=M.example(s.estudianteId);
    session.selected.set(s.cedula,old?{...base,...old,fuentes:{...base.fuentes,...old.fuentes}}:
      {...base,...s,...example,fecha:M.periodDate(state.periodId),periodoNombre:period().label,versionPlantilla:'2'});}
   });render();}
  else if(a==='ap-one'){const item=session.selected.get(id);if(item)exportDocs([item],'folder');}
  else if(a==='ap-pdfs')exportDocs(selected(),'folder');
  else if(a==='ap-zip')exportDocs(selected(),'zip');
  return true;
 }
 function input(event){
  const t=event.target;if(!t)return;
  if(t.id==='ap-query'){session.query=t.value||'';refreshResults();return;}
  if(t.id==='ap-career'){session.career=t.value||'';refreshResults();return;}
  const row=session.selected.get(t.dataset?.apId);
  if(!row)return;
  if(t.dataset.apField){
   if(t.dataset.apField==='similitud'||t.dataset.apField==='origen')row[t.dataset.apField]=t.value;
   if(t.dataset.apField==='similitud'){const label=t.closest('td')?.querySelector('.ap-status');
     if(label)label.textContent=M.number(row.similitud)!==null&&M.number(row.similitud)<20?'APROBADO':'NO APROBADO';}
  }
  if(t.dataset.apSource)row.fuentes[t.dataset.apSource]=t.value;
  session.saveError='';
 }
 return {open,onPeriodChange,reset,load,render:renderView,handleAction,input,session};
}});
