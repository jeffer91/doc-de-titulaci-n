'use strict';
/* Acta de Titulación por Artículo Académico (PRO-57).
 * Listados, búsquedas, reimpresiones desde SQLite. Requisitos se consultan
 * exclusivamente al pulsar Verificar o Emitir.
 */
window.UTET_ACTA_ARTICULO=Object.freeze({create(ctx){
 const {state,period,go,render,showToast}=ctx;
 const M=window.UTET_ACTA_ARTICULO_MODEL;
 const esc=M.esc;
 const session={
  loadedPeriod:'',loading:false,busy:false,students:[],actas:new Map(),evidences:new Map(),
  selected:new Set(),query:'',career:'',error:'',notice:'',detail:'',syncedAt:null,emision:null,
  request:0
 };
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const byCedula=c=>session.students.find(s=>s.cedula===c);
 const button=(action,label,cedula='',type='')=>'<button type="button" class="aa-btn '+type+'" data-action="'+action+'"'+
   (cedula?' data-id="'+esc(cedula)+'"':'')+(session.busy?' disabled':'')+'>'+label+'</button>';
 const result=msg=>{session.notice=msg;session.error='';showToast(msg);render();};
 const approved=e=>e?.eligible===true;
 function reset(){
  session.request++;Object.assign(session,{loadedPeriod:'',loading:false,busy:false,students:[],actas:new Map(),
   evidences:new Map(),selected:new Set(),query:'',career:'',error:'',notice:'',detail:'',syncedAt:null,emision:null});
 }
 function open(){if(session.loadedPeriod!==state.periodId){reset();}go('acta-articulo');if(!session.loadedPeriod&&!session.loading)load();}
 function onPeriodChange(){reset();go('acta-articulo');load();}
 async function load(force=false){
  if(session.loading||session.busy)return;
  const p=state.periodId,ticket=++session.request;
  session.loading=true;session.error='';render();
  try{
   const api=force?window.utetDesktop?.refreshActaArticulo:window.utetDesktop?.openActaArticulo;
   if(!api)throw Error('Actualiza Electron para utilizar las actas de Artículo Académico.');
   const data=await api(p);
   if(ticket!==session.request||p!==state.periodId)return;
   if(!Array.isArray(data.students)||!Array.isArray(data.actas)||!Array.isArray(data.evidences))
    throw Error('No se pudo interpretar la información local de actas.');
   session.students=data.students;session.actas=new Map(data.actas.map(x=>[x.cedula,x]));
   session.evidences=new Map(data.evidences.map(x=>[x.cedula,x]));
   session.loadedPeriod=p;session.syncedAt=data.syncedAt;session.emision=data.emision;
   if(force)showToast('Información académica actualizada desde Firebase.');
  }catch(error){
   if(ticket!==session.request||p!==state.periodId)return;
   session.error=String(error?.message||error).slice(0,380);
  }finally{if(ticket===session.request){session.loading=false;render();}}
 }
 function filtered(){
  const q=norm(session.query),c=session.career;
  return session.students.filter(s=>(!c||s.carreraNombre===c)&&
    (!q||norm(s.nombres+' '+s.cedula+' '+s.carreraNombre).includes(q)));
 }
 function stateText(s){
  const acta=session.actas.get(s.cedula),e=session.evidences.get(s.cedula);
  return acta?'Acta emitida · '+esc(acta.numeroActa):!e?'Sin verificación':approved(e)?'Elegible · pendiente de emisión':'Pendiente de requisitos';
 }
 function evidenceDetails(cedula){
  const e=session.evidences.get(cedula),a=session.actas.get(cedula);
  if(a)return '<div class="aa-detail"><strong>Acta oficial:</strong> '+esc(a.numeroActa)+' · Fecha de emisión '+esc(M.date(a.fechaEmision))+
    ' · Registro '+esc(M.date(a.fechaRegistro))+'</div>';
  if(!e)return '<p class="aa-detail">Presiona «Verificar» para consultar exclusivamente los requisitos de este estudiante.</p>';
  return '<div class="aa-detail">'+
   '<strong>Requisitos:</strong> '+e.requirements?.filter(x=>x.status==='CUMPLE').length+'/9 · '+
   '<strong>Aprobaciones:</strong> '+e.approvals?.filter(x=>x.status==='CUMPLE').length+'/2 · '+
   '<strong>Artículo:</strong> '+esc(e.checks?.articulo||'SIN DATO')+' · '+
   '<strong>Defensa:</strong> '+esc(e.checks?.defensa||'SIN DATO')+' · '+
   '<strong>Similitud ≤20 %:</strong> '+esc(e.checks?.similitud||'SIN DATO')+
   (e.missing?.length?'<ul>'+e.missing.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':
    '<p>Condiciones documentales y académicas acreditadas. La emisión realizará una nueva verificación.</p>')+'</div>';
 }
 function renderView(){
  const careers=[...new Set(session.students.map(x=>x.carreraNombre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const list=filtered(),done=[...session.actas.values()].length;
  const status=session.loading?'Cargando información local...':
   (session.loadedPeriod?session.students.length+' estudiantes · '+done+' actas emitidas':'Sin consulta local');
  const date=session.emision?.date?M.date(session.emision.date):'Pendiente';
  return '<div class="aa-workspace">'+
   '<div class="aa-toolbar"><div><h1>Acta de Titulación por Artículo Académico</h1>'+
   '<p>UTET-PRO-57 · Período: '+esc(period().label)+'</p></div>'+
   '<div>'+button('aa-back','Volver')+button('aa-refresh','Actualizar Firebase')+'</div></div>'+
   '<div class="aa-summary"><span>Origen: SQLite local · '+esc(status)+'</span><span>Emisión programada: <b>'+esc(date)+'</b></span>'+
   '<span>Código documental: '+esc(session.emision?.documentCode||'Pendiente')+'</span></div>'+
   (session.error?'<p class="aa-error" role="alert">'+esc(session.error)+'</p>':'')+
   (session.notice?'<p class="aa-success">'+esc(session.notice)+'</p>':'')+
   '<div class="aa-panel"><div class="aa-filter"><input type="search" id="aa-search" placeholder="Buscar estudiante o cédula" value="'+esc(session.query)+'">'+
   '<select id="aa-career"><option value="">Todas las carreras</option>'+
   careers.map(c=>'<option value="'+esc(c)+'"'+(session.career===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
   '<span>'+list.length+' estudiantes</span></div>'+
   '<div class="aa-table"><table><thead><tr><th></th><th>Estudiante</th><th>Carrera</th><th>Estado del acta</th><th>Acciones</th></tr></thead><tbody>'+
   list.slice(0,250).map(s=>{
    const issued=session.actas.has(s.cedula),e=session.evidences.get(s.cedula);
    return '<tr><td><input type="checkbox" data-aa-select="'+esc(s.cedula)+'"'+(session.selected.has(s.cedula)?' checked':'')+'></td>'+
     '<td><strong>'+esc(s.nombres)+'</strong><small>'+esc(s.cedula)+'</small></td>'+
     '<td>'+esc(s.carreraNombre)+'</td><td>'+stateText(s)+'</td>'+
     '<td>'+button('aa-detail','Detalle',s.cedula)+
      (issued?button('aa-download','PDF',s.cedula,'primary'):
       button('aa-verify','Verificar',s.cedula)+button('aa-recover','Recuperar',s.cedula)+button('aa-issue','Emitir',s.cedula,approved(e)?'primary':''))+'</td></tr>'+
     (session.detail===s.cedula?'<tr><td colspan="5">'+evidenceDetails(s.cedula)+'</td></tr>':'');
   }).join('')+'</tbody></table></div>'+
   (list.length>250?'<p class="aa-info">Mostrando 250 estudiantes. Refina la búsqueda para encontrar más registros.</p>':'')+
   '<div class="aa-bottom"><span>'+session.selected.size+' seleccionados</span>'+button('aa-zip','Descargar ZIP de actas emitidas')+'</div>'+
   '</div><p class="aa-info">Las calificaciones numéricas no aparecen en el acta. La emisión exige nueve requisitos y dos aprobaciones CUMPLE, artículo y defensa ≥7/10, y similitud real ≤20 %.</p>'+
   '</div>';
 }
 async function verify(cedula){
  if(session.busy)return;
  session.busy=true;session.error='';render();
  try{
   const e=await window.utetDesktop.verifyActaArticulo(state.periodId,cedula);
   session.evidences.set(cedula,e);session.detail=cedula;
   session.notice=e.eligible?'Cumple las condiciones registradas.':'Se identificaron '+e.missing.length+' condiciones pendientes.';
  }catch(error){session.error=String(error.message||error).slice(0,480);}
  finally{session.busy=false;render();}
 }
 async function recover(cedula){
  if(session.busy)return;
  session.busy=true;session.error='';render();
  try{
   const item=await window.utetDesktop.recoverActaArticulo(state.periodId,cedula);
   if(!item)session.notice='No existe un acta AA emitida en el registro central para este estudiante.';
   else{session.actas.set(cedula,item);session.notice='Acta recuperada: '+item.numeroActa;session.detail=cedula;}
  }catch(error){session.error=String(error.message||error).slice(0,490);}
  finally{session.busy=false;render();}
 }
 async function issue(cedula){
  if(session.busy)return;
  session.busy=true;session.error='';render();
  try{
   const result=await window.utetDesktop.issueActaArticulo(state.periodId,cedula);
   session.actas.set(cedula,result);
   session.detail=cedula;
   session.notice='Acta emitida: '+result.numeroActa;
   await exportDocs([cedula],'pdfs');
  }catch(error){session.error=String(error.message||error).slice(0,760);}
  finally{session.busy=false;render();}
 }
 async function exportDocs(cedulas,mode){
  if(!cedulas.length)throw Error('No has seleccionado actas para descargar.');
  const result=await window.utetDesktop.exportActaArticulo({
   periodoId:state.periodId,periodLabel:period().label,cedulas,mode});
  if(result?.count)showToast(result.count+' acta(s) descargada(s) directamente en Descargas.');
 }
 async function exportExisting(cedulas,mode){
  if(session.busy)return;
  session.busy=true;session.error='';render();
  try{
   const available=cedulas.filter(x=>session.actas.has(x));
   if(!available.length)throw Error('Solo pueden descargarse actas oficiales ya emitidas.');
   await exportDocs(available,mode);
   if(available.length!==cedulas.length)session.notice='Se descargaron únicamente las '+available.length+' actas emitidas.';
  }catch(error){session.error=String(error.message||error).slice(0,480);}
  finally{session.busy=false;render();}
 }
 function handleAction(action,id){
  if((action==='rec-open'||action==='new-doc')&&id==='acta-articulo'){open();return true;}
  if(!String(action||'').startsWith('aa-'))return false;
  if(action==='aa-back')go('documentos');
  else if(action==='aa-refresh')load(true);
  else if(action==='aa-detail'){session.detail=session.detail===id?'':id;render();}
  else if(action==='aa-verify')verify(id);
  else if(action==='aa-issue')issue(id);
  else if(action==='aa-recover')recover(id);
  else if(action==='aa-download')exportExisting([id],'pdfs');
  else if(action==='aa-zip')exportExisting([...session.selected],'zip');
  return true;
 }
 function input(e){
  const t=e.target;
  if(t?.id==='aa-search'){session.query=t.value||'';render();return;}
  if(t?.id==='aa-career'){session.career=t.value||'';render();return;}
  if(t?.dataset?.aaSelect){
   if(t.checked)session.selected.add(t.dataset.aaSelect);else session.selected.delete(t.dataset.aaSelect);
   // No re-render hasta que el usuario termine de seleccionar varios.
  }
 }
 return {open,onPeriodChange,reset,render:renderView,handleAction,input,session};
}});
