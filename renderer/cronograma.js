'use strict';
/* Módulo independiente cron-articulo, integrado en el catálogo PRO-57. */
window.UTET_CRONOGRAMA_UI=Object.freeze({create:function(ctx){
 const {state,period,go,render,showToast,logAction}=ctx,Model=window.UTET_CRONOGRAMA_MODEL;
 const KEY='utet-cronogramas-pro57-v1';
 const $=id=>document.getElementById(id);
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const nextId=()=> 'cr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 const blank=()=>({id:nextId(),fecha:today(),periodo:period().label,folio:''});
 let sheets=[],memo=blank(),active=0,showPreview=false;
 try{const old=JSON.parse(localStorage.getItem(KEY)||'{}');if(Array.isArray(old.sheets))sheets=old.sheets;if(old.memo&&typeof old.memo==='object')memo={...blank(),...old.memo};}catch{}
 function persist(){
  try{localStorage.setItem(KEY,JSON.stringify({sheets,memo}));return true;}
  catch(e){showToast('No se pudo guardar el cronograma: almacenamiento local lleno.');return false;}
 }
 function changed(){if(memo.folio){memo={...memo,id:nextId(),folio:''};showToast('Se abrió una nueva versión sin folio; el memorando emitido conserva su contenido original.');}showPreview=false;persist();}
 const selected=()=>sheets.filter(x=>x.selected&&x.tipo!=='trabajo'&&x.tipo!=='complexivo'&&x.actividades.length);
 function payload(){
  const picks=selected();
  if(!picks.length)throw Error('Selecciona un cronograma con actividades.');
  const labels=[...new Set(picks.map(x=>String(x.periodo||'').trim().toLowerCase()).filter(Boolean))];
  if(labels.length>1)throw Error('Seleccionaste cronogramas de distintos períodos. Genera un memorando por período.');
  return Model.validate({id:memo.id,fecha:memo.fecha,periodo:memo.periodo,cronogramas:picks.map(x=>({
   grupo:x.grupo,hoja:x.sheetName,periodo:x.periodo,actividades:x.actividades
  }))});
 }
 const btn=(a,t,cls='btn',extra='')=>'<button type="button" class="'+cls+'" data-action="'+a+'" '+extra+'>'+t+'</button>';
 const field=(key,label,value,type='text')=>'<div class="cron-field"><label>'+esc(label)+'</label><input data-cr-meta="'+key+'" type="'+type+'" value="'+esc(value)+'"/></div>';
 function editor(){
  const s=sheets[active];if(!s)return '';
  const rows=s.actividades.map((r,i)=>'<tr><td><input data-cr-row="'+i+'" data-cr-prop="etapa" value="'+esc(r.etapa||'')+'" placeholder="Automática"/></td>'+
   '<td><input class="cron-activity" data-cr-row="'+i+'" data-cr-prop="actividad" value="'+esc(r.actividad)+'"/></td>'+
   '<td><input type="date" data-cr-row="'+i+'" data-cr-prop="inicio" value="'+esc(r.inicio)+'"/></td>'+
   '<td><input type="date" data-cr-row="'+i+'" data-cr-prop="fin" value="'+esc(r.fin)+'"/></td>'+
   '<td>'+btn('cr-del-row','Quitar','btn btn-small','data-id="'+i+'"')+'</td></tr>').join('');
  return '<section class="cron-panel"><h2>Editar cronograma · '+esc(s.sheetName)+'</h2>'+
   '<div class="cron-field-grid"><div class="cron-field"><label>Grupo del anexo</label><input data-cr-sheet="grupo" value="'+esc(s.grupo)+'" placeholder="Superiores / Universitarios"/></div>'+
   '<div class="cron-field"><label>Período reconocido en esta hoja</label><input data-cr-sheet="periodo" value="'+esc(s.periodo)+'"/></div></div>'+
   '<p>Las fechas y actividades pueden corregirse antes de emitir. Etapa vacía = clasificación automática.</p>'+
   '<div class="cron-editor-table-wrap"><table class="cron-editor-table"><thead><tr><th>Etapa</th><th>Actividad</th><th>Fecha inicio</th><th>Fecha fin</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
   '<div class="cron-actions" style="margin-top:12px">'+btn('cr-add-row','＋ Añadir actividad','btn btn-primary')+'</div></section>';
 }
 function renderedPreview(){
  if(!showPreview)return '';
  try{return '<section class="cron-panel"><h2>Vista previa del memorando y anexos</h2><p>La previsualización no reserva ningún número institucional.</p><div class="cron-preview-surface">'+Model.render(payload(),memo.folio)+'</div><div class="cron-preview-note">Emisión oficial: solo cuando Firebase confirme el consecutivo mensual.</div></section>';}
  catch(err){return '<div class="cron-notice">'+esc(err.message)+'</div>';}
 }
 function view(){
  const pick=selected();
  const imported=sheets.map((s,i)=>'<div class="cron-import-item"><input type="checkbox" data-cr-select="'+i+'" '+(s.selected?'checked':'')+' '+(['trabajo','complexivo'].includes(s.tipo)?'disabled':'')+' aria-label="Incluir hoja '+esc(s.sheetName)+'"/>'+
   '<div><strong>'+esc(s.sheetName)+'</strong><small>'+esc(s.fileName)+' · '+s.actividades.length+' actividades · '+esc(s.periodo||'Período pendiente')+
   (s.error?' · '+esc(s.error):'')+(s.warnings?.length?' · '+esc(s.warnings.join('; ')):'')+'</small></div>'+
   '<span class="cron-tag '+(s.tipo==='articulo'?'':'warn')+'">'+esc(s.tipo==='articulo'?'Artículo académico':s.tipo==='trabajo'?'Trabajo de titulación':s.tipo==='complexivo'?'Complexivo':'Revisar tipo')+'</span>'+
   btn('cr-edit','Editar','btn btn-small','data-id="'+i+'"')+'</div>').join('');
  const groups=pick.map(s=>s.grupo).join(', ');
  return '<div class="cron-workspace"><div class="cron-panel"><h2>Cronograma de Artículo Académico · UTET-PRO-57</h2>'+
   '<p>Importa un Excel con varias hojas, un Excel de un solo cronograma o varios archivos a la vez. Se conservarán separados por hoja y período.</p>'+
   '<div class="cron-actions">'+btn('cr-import','↑ Importar uno o varios Excel','btn btn-primary')+btn('cr-manual','＋ Crear cronograma manual')+btn('cr-clear','Vaciar borradores','btn btn-small')+btn('cr-back','← Volver al catálogo','btn btn-small')+'</div>'+
   '<div class="cron-notice">Los cronogramas de Complexivo y Trabajo de Titulación se detectan y se excluyen del memorando PRO-57. Los Excel originales no se modifican.</div></div>'+
   '<section class="cron-panel"><h2>1. Hojas detectadas · '+sheets.length+'</h2>'+
   (sheets.length?'<div class="cron-import-list">'+imported+'</div>':'<p>No hay cronogramas importados. Puedes cargar el Excel que contiene todas las hojas o crear uno desde cero.</p>')+'</section>'+
   (sheets.length?editor():'')+
   '<section class="cron-panel"><h2>2. Datos del memorando</h2><div class="cron-field-grid">'+field('fecha','Fecha de emisión (define el mes del consecutivo)',memo.fecha,'date')+
   field('periodo','Período académico del memorando',memo.periodo)+'</div>'+
   '<p>Para: Estudiantes '+esc(groups||'del grupo seleccionado')+' y Unidad de Investigación e Innovación (UII). De: Mgs. Jefferson Villarreal.</p>'+
   '<div class="cron-notice"><strong>Número:</strong> '+esc(memo.folio||'Pendiente de emisión')+'. Correlativo compartido por mes de emisión. La numeración solo será oficial si Firestore confirma la operación; no se reserva al previsualizar.</div>'+
   '<div class="cron-actions">'+btn('cr-preview','Vista previa del PDF','btn btn-primary')+btn('cr-export',memo.folio?'Reimprimir PDF emitido':'Emitir memorando PDF')+btn('cr-new-memo','Nuevo memorando / otra edición','btn btn-small')+'</div></section>'+renderedPreview()+'</div>';
 }
 async function load(){
  if(!window.utetDesktop?.importCronogramaFiles){showToast('La importación requiere la aplicación Electron.');return;}
  try{
   const res=await window.utetDesktop.importCronogramaFiles();if(res.canceled)return;
   let added=0,duplicates=0;
   // En libros con muchos períodos, seleccionar inicialmente solo el primero
   // y sus grupos; nunca todos los períodos en un único memorando.
   const alreadySelected=selected().length>0;
   const firstNew=res.sheets.find(x=>x.tipo==='articulo'&&x.actividades?.length&&x.periodo);
   const autoPeriod=firstNew?.periodo||'';
   for(const item of res.sheets){
    if(sheets.some(x=>x.fileName===item.fileName&&x.sheetName===item.sheetName&&x.periodo===item.periodo)){duplicates++;continue;}
    const autoSelect=!alreadySelected&&item.tipo==='articulo'&&!!item.actividades?.length&&
      !!autoPeriod&&String(item.periodo||'').trim().toLowerCase()===String(autoPeriod).trim().toLowerCase();
    sheets.push({...item,selected:autoSelect,uid:nextId()});added++;
   }
   if(sheets.length>60){sheets=sheets.slice(0,60);showToast('Se alcanzó el límite de 60 hojas.');}
   const first=selected()[0];
   if(first&&(!memo.periodo||memo.periodo===period().label))memo.periodo=first.periodo||memo.periodo;
   if(memo.folio){memo={...memo,id:nextId(),folio:''};}
   persist();showPreview=false;render();
   showToast(added+' hojas importadas; '+duplicates+' duplicadas omitidas.');
   logAction('Cronogramas importados',res.files+' Excel; '+added+' hoja(s) nuevas.');
  }catch(err){showToast('Error al importar: '+String(err.message||err));}
 }
 async function exportPDF(){
  if(!window.utetDesktop?.exportCronogramaPDF){showToast('La emisión PDF requiere Electron.');return;}
  let data;try{data=payload();}catch(err){showToast(err.message);return;}
  try{
   const response=await window.utetDesktop.exportCronogramaPDF(data);
   if(response?.canceled)return;
   memo.folio=response.folio;memo.fecha=response.fecha||memo.fecha;
   persist();render();
   showToast('PDF generado: '+response.folio);
   logAction('Memorando de cronograma emitido',response.folio);
  }catch(err){showToast('No se emitió memorando: '+String(err.message||err).slice(0,190));}
 }
 function action(a,id){
  if(a==='rec-open'&&id==='cron-articulo'){go('cronograma');return true;}
  if(!a.startsWith('cr-'))return false;
  const ix=Number(id);
  if(a==='cr-import')load();
  else if(a==='cr-back')go('documentos');
  else if(a==='cr-manual'){
   changed();
   sheets.push({uid:nextId(),fileName:'Formulario',sheetName:'Cronograma manual '+(sheets.length+1),periodo:memo.periodo,grupo:'Por determinar',tipo:'articulo',selected:true,
     actividades:[{etapa:'',actividad:'',inicio:today(),fin:today()}]});
   active=sheets.length-1;persist();render();
  }
  else if(a==='cr-clear'){
   if(confirm('¿Eliminar únicamente los cronogramas y el borrador local? Los memorandos oficiales ya emitidos no se eliminarán de Firebase.')){
    sheets=[];memo=blank();active=0;showPreview=false;persist();render();
   }
  }
  else if(a==='cr-edit'){if(Number.isInteger(ix)&&sheets[ix]){active=ix;render();}}
  else if(a==='cr-add-row'){
   if(sheets[active]){changed();sheets[active].actividades.push({etapa:'',actividad:'',inicio:today(),fin:today()});persist();render();}
  }
  else if(a==='cr-del-row'){
   if(sheets[active]&&sheets[active].actividades.length>1&&Number.isInteger(ix)&&sheets[active].actividades[ix]){
    changed();sheets[active].actividades.splice(ix,1);persist();render();
   }else showToast('Cada cronograma debe conservar al menos una fila.');
  }
  else if(a==='cr-preview'){showPreview=true;render();}
  else if(a==='cr-export')exportPDF();
  else if(a==='cr-new-memo'){memo={...blank(),periodo:memo.periodo};showPreview=false;persist();render();}
  return true;
 }
 function input(e){
  const t=e.target;if(state.view!=='cronograma')return;
  if(t.hasAttribute('data-cr-select')){
   const i=Number(t.getAttribute('data-cr-select'));
   if(sheets[i]){changed();sheets[i].selected=t.checked;persist();render();}
  }
  else if(t.hasAttribute('data-cr-meta')){
   const key=t.getAttribute('data-cr-meta');if(!['fecha','periodo'].includes(key))return;
   changed();memo[key]=t.value;persist();
  }
  else if(t.hasAttribute('data-cr-sheet')){
   const key=t.getAttribute('data-cr-sheet');if(!['grupo','periodo'].includes(key)||!sheets[active])return;
   changed();sheets[active][key]=t.value;persist();
  }
  else if(t.hasAttribute('data-cr-row')){
   const i=Number(t.getAttribute('data-cr-row')),key=t.getAttribute('data-cr-prop');
   if(!['etapa','actividad','inicio','fin'].includes(key)||!sheets[active]?.actividades[i])return;
   changed();sheets[active].actividades[i][key]=t.value;persist();
  }
 }
 function onPeriodChange(){
  // La selección del período institucional no puede reutilizar en silencio
  // anexos de un período anterior.
  sheets.forEach(x=>{x.selected=false;});
  memo={...memo,periodo:period().label,id:nextId(),folio:''};
  showPreview=false;persist();render();
 }
 return {render:view,handleAction:action,input,onPeriodChange};
}});
