'use strict';
window.UTET_RECORD_UI = Object.freeze({create: function createRecordsUI(ctx) {
  const {data,records,state,period,getType,go,render,draftDefault,showToast,logAction}=ctx;
  const KEY='utet-tablas-documentales-v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let entries=[];
  try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(v))entries=v;}catch{}
  let selected=null,form=null,editId=null,pending=null,query='';
  const current=()=>entries.filter(r=>r.tipoId===selected&&r.periodId===state.periodId);
  const schema=()=>records.schema(selected)||[];
  const now=()=>new Date().toISOString();
  function persist(next){
    try{localStorage.setItem(KEY,JSON.stringify(next));entries=next;return true;}
    catch {showToast('No se pudo guardar localmente: revise el espacio disponible.');return false;}
  }
  function spec(){
    const t=getType(selected);
    return {typeId:selected,title:t.nombre,periodId:state.periodId,periodLabel:period().label,columns:schema()};
  }
  const btn=(action,label,cls='btn',id='')=>'<button type="button" class="'+cls+'" data-action="'+action+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+label+'</button>';
  function field(f){
    const label='<label for="ut-re-'+esc(f.key)+'">'+esc(f.label)+(f.required?' *':'')+'</label>';
    const val=esc(form?.[f.key]||'');
    let el;
    if(f.kind==='textarea')el='<textarea id="ut-re-'+esc(f.key)+'" data-record-field="'+esc(f.key)+'">'+val+'</textarea>';
    else if(f.kind?.startsWith('choice:')){
      el='<select data-record-field="'+esc(f.key)+'" id="ut-re-'+esc(f.key)+'"><option value="">Seleccionar</option>'+f.kind.slice(7).split('|').map(x=>'<option value="'+esc(x)+'" '+(val===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>';
    }else{
      const type=['date','time','number'].includes(f.kind)?f.kind:'text';
      el='<input type="'+type+'" id="ut-re-'+esc(f.key)+'" data-record-field="'+esc(f.key)+'" value="'+val+'" '+(f.key==='carrera'?'list="ut-careers"':'')+'/>';
    }
    return '<div class="records-field'+(f.kind==='textarea'?' wide':'')+'">'+label+el+'</div>';
  }
  function renderForm(){
    if(!form)return '';
    const choices=(period().porCarrera||[]).map(c=>'<option value="'+esc(c.nombre)+'"></option>').join('');
    return '<div class="records-panel"><div class="records-panel-head"><strong>'+(editId?'Editar registro':'Agregar registro por formulario')+'</strong><small>Los campos * son obligatorios</small></div><div class="records-form"><datalist id="ut-careers">'+choices+'</datalist><div class="records-form-grid">'+schema().map(field).join('')+'</div><div class="records-form-foot">'+btn('rec-cancel','Cancelar')+btn('rec-save','Guardar en tabla','btn btn-primary')+'</div></div></div>';
  }
  function renderPending(){
    if(!pending)return '';
    const items=pending.rows,err=items.filter(x=>x.status==='Error').length+pending.errors.length,repeat=items.filter(x=>x.status==='Duplicado').length;
    const preview=items.slice(0,75).map(x=>'<tr><td>'+x.line+'</td><td>'+esc(x.data.referencia||'—')+'</td><td>'+esc(x.data.carrera||x.data.estudiante||'—')+'</td><td>'+esc(x.status)+' '+esc(x.problem||'')+'</td></tr>').join('');
    return '<section class="records-import-preview"><div class="records-import-summary"><strong>Vista previa: '+esc(pending.fileName)+'</strong><span>'+items.filter(x=>x.status==='Nuevo').length+' nuevos</span><span>'+repeat+' duplicados</span><span>'+err+' errores</span></div>'+(pending.errors.length?'<p class="records-error records-form">'+pending.errors.slice(0,10).map(x=>'Fila '+x.line+': '+esc(x.message)).join(' · ')+'</p>':'')+'<div class="records-table-wrap"><table class="records-table"><thead><tr><th>Fila</th><th>Referencia</th><th>Carrera / estudiante</th><th>Validación</th></tr></thead><tbody>'+preview+'</tbody></table></div><div class="records-form-foot records-form"><label for="rec-duplicate">Duplicados:</label><select id="rec-duplicate" class="records-filter"><option value="skip">Omitir</option><option value="update">Actualizar existentes</option></select>'+btn('rec-cancel-import','Cancelar')+btn('rec-confirm-import','Confirmar carga','btn btn-primary')+'</div></section>';
  }
  function renderView(){
    const t=getType(selected);
    if(!t)return '<p>Selecciona un documento para abrir su tabla.</p>';
    const all=current(),cols=['referencia','carrera','estudiante','cedula','fecha','fechaExamen','fechaEvento','actividad','tutor'].filter(k=>schema().some(f=>f.key===k)).slice(0,5);
    const shown=all.filter(r=>!query||schema().some(f=>String(r.values[f.key]||'').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))));
    const titleFields=cols.map(k=>schema().find(f=>f.key===k));
    const rows=shown.map(r=>'<tr>'+titleFields.map(f=>'<td>'+esc(r.values[f.key]||'—')+'</td>').join('')+'<td class="records-status-ok">Guardado local</td><td><div class="records-actions">'+btn('rec-edit','Editar','btn btn-small',r.id)+btn('rec-document','Documento','btn btn-small',r.id)+btn('rec-remove','Eliminar','btn btn-small',r.id)+'</div></td></tr>').join('');
    return '<div class="records-workspace"><div class="records-title"><div><h1>'+esc(t.nombre)+'</h1><small>UTET-'+esc(t.proceso)+' · '+esc(t.codigo)+'</small></div>'+btn('rec-back','← Catálogo')+'</div><div class="records-period">Período académico: '+esc(period().label)+' · '+all.length+' registro(s)</div><div class="records-toolbar">'+btn('rec-new','＋ Formulario','btn btn-primary')+btn('rec-template','↓ Descargar plantilla Excel')+btn('rec-import','↑ Cargar Excel')+btn('rec-collect','Preparar documento con tabla')+'</div>'+renderForm()+renderPending()+'<section class="records-panel"><div class="records-panel-head"><strong>Tabla de registros</strong><div class="records-toolbar"><input id="rec-search" class="records-filter" placeholder="Buscar en tabla" value="'+esc(query)+'"/>'+btn('rec-search','Buscar','btn btn-small')+'<span class="records-counter">'+shown.length+' fila(s)</span></div></div><div class="records-table-wrap"><table class="records-table"><thead><tr>'+titleFields.map(f=>'<th>'+esc(f.label)+'</th>').join('')+'<th>Estado</th><th>Acciones</th></tr></thead><tbody>'+(rows||'<tr><td colspan="'+(titleFields.length+2)+'" class="records-empty"><strong>Sin registros</strong>Agrega un formulario o importa Excel.</td></tr>')+'</tbody></table></div></section><p class="records-note">Los registros son locales y no se sincronizan con Firebase. Los documentos siguen siendo borradores de maqueta.</p></div>';
  }
  function open(id){if(!getType(id))return;selected=id;form=null;editId=null;pending=null;query='';go('records');}
  function input(event){if(event.target.dataset?.recordField&&form)form[event.target.dataset.recordField]=event.target.value;}
  function save(){
    const value=records.normalize(selected,form),problems=records.validate(selected,value);
    if(problems.length){showToast(problems[0]);return;}
    if(current().some(r=>r.id!==editId&&records.uniqueKey(selected,r.values)===records.uniqueKey(selected,value))){showToast('Registro repetido: cambie la referencia o el identificador.');return;}
    const prev=entries.find(r=>r.id===editId),id=editId||'registro_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
    const row={id,tipoId:selected,periodId:state.periodId,values:value,source:prev?.source||'formulario',createdAt:prev?.createdAt||now(),updatedAt:now()};
    if(!persist(entries.filter(r=>r.id!==id).concat(row)))return;
    form=null;editId=null;logAction('Registro guardado',getType(selected).nombre+' · '+value.referencia);render();showToast('Guardado en la tabla local.');
  }
  function prepare(row){
    const t=getType(selected);
    state.draft=records.toEditor(row.values,t,state.periodId,draftDefault(t));
    go('editor');showToast('Vista previa de maqueta preparada.');
  }
  function collect(){
    const list=current(),t=getType(selected);
    if(!list.length){showToast('No hay datos en la tabla.');return;}
    const d=records.toEditor(list[0].values,t,state.periodId,draftDefault(t));
    d.asunto=t.nombre+' · Consolidado';
    if(selected==='asistencia-induccion'){
      const yes=list.filter(r=>r.values.asistio==='Sí');
      d.asistentes=yes.map(r=>[r.values.cedula,r.values.estudiante,r.values.carrera,r.values.firma].join(';')).join('\n');
      d.contenido='Total registrados: '+list.length+'. Asistencia confirmada: '+yes.length+'.';
    }else{
      d.contenido=list.map((r,i)=>(i+1)+'. '+schema().map(f=>f.label+': '+String(r.values[f.key]||'—')).join(' | ')).join('\n');
    }
    state.draft=d;go('editor');showToast('Consolidado de maqueta preparado.');
  }
  async function download(){
    if(!window.utetDesktop?.downloadExcelTemplate){showToast('Disponible solamente al abrir Electron.');return;}
    try{const x=await window.utetDesktop.downloadExcelTemplate(spec());if(!x?.canceled)showToast('Plantilla Excel descargada.');}
    catch(e){showToast('Error de Excel: '+e.message);}
  }
  async function upload(){
    if(!window.utetDesktop?.importExcel){showToast('Disponible solamente al abrir Electron.');return;}
    try{
      const x=await window.utetDesktop.importExcel(spec());
      if(x?.canceled)return;
      const known=new Set(current().map(r=>records.uniqueKey(selected,r.values))),seen=new Set();
      const rows=(x.rows||[]).map(item=>{
        const data=records.normalize(selected,item.data),key=records.uniqueKey(selected,data),p=records.validate(selected,data);
        if(seen.has(key))p.push('Duplicado dentro del Excel.');seen.add(key);
        return {line:item.line,data,key,status:p.length?'Error':known.has(key)?'Duplicado':'Nuevo',problem:p.join(' ')};
      });
      pending={fileName:x.fileName,rows,errors:x.errors||[]};form=null;render();
    }catch(e){showToast('Error al leer Excel: '+e.message);}
  }
  function commit(){
    if(!pending)return;
    const mode=$('rec-duplicate')?.value||'skip',next=entries.slice(),stamp=now();let added=0,updated=0;
    for(const item of pending.rows){
      if(item.status==='Error')continue;
      const i=next.findIndex(r=>r.tipoId===selected&&r.periodId===state.periodId&&records.uniqueKey(selected,r.values)===item.key);
      if(i<0){
        next.push({id:'registro_'+Date.now()+'_'+Math.random().toString(36).slice(2,10),tipoId:selected,periodId:state.periodId,values:item.data,source:'excel',createdAt:stamp,updatedAt:stamp});added++;
      }else if(mode==='update'){next[i]={...next[i],values:item.data,source:'excel',updatedAt:stamp};updated++;}
    }
    if(!added&&!updated){showToast('No hay filas nuevas o actualizables.');return;}
    if(!persist(next))return;
    pending=null;render();logAction('Excel importado',added+' nuevos; '+updated+' actualizados');showToast(added+' nuevos, '+updated+' actualizados.');
  }
  function handleAction(a,id){
    if(a==='rec-open'){open(id);return true;}
    if(!a.startsWith('rec-'))return false;
    if(a==='rec-back')go('documentos');
    else if(a==='rec-new'){form=records.empty(selected);form.fecha=new Date().toLocaleDateString('en-CA');form.asunto=getType(selected).nombre;editId=null;pending=null;render();}
    else if(a==='rec-save')save();
    else if(a==='rec-edit'){const row=current().find(r=>r.id===id);if(row){form={...row.values};editId=id;pending=null;render();}}
    else if(a==='rec-cancel'){form=null;editId=null;render();}
    else if(a==='rec-remove'){if(confirm('¿Eliminar este registro local?')){if(persist(entries.filter(r=>r.id!==id))){render();showToast('Registro eliminado.');}}}
    else if(a==='rec-document'){const row=current().find(r=>r.id===id);if(row)prepare(row);}
    else if(a==='rec-collect')collect();
    else if(a==='rec-template')download();
    else if(a==='rec-import')upload();
    else if(a==='rec-cancel-import'){pending=null;render();}
    else if(a==='rec-confirm-import')commit();
    else if(a==='rec-search'){query=$('rec-search')?.value.trim()||'';render();}
    return true;
  }
  return {open,render:renderView,handleAction,input,getRows:current};
}});
