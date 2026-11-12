'use strict';

window.UTET_PLAN_EXAMEN_UI=Object.freeze({create({state,render,refreshPreview}){
  const Plan=window.UTET_PLAN_EXAMEN;
  const labels={gantt:'Gantt',flujo:'Flujo de etapas',sedes:'Esquema de sedes'};
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let request=null,notice=null;

  function renderHere(){
    const top=window.scrollY;
    render();
    window.scrollTo(0,top);
  }

  function section(draft){
    const plan=draft.planExamen;
    if(!plan)return '';
    const summary=Plan.summarize(plan.rows),options=Plan.available(summary);
    const chosen=[...new Set(Object.values(plan.figures))].filter(type=>options.includes(type));
    const busy=request?.draft===state.draft;
    const message=notice?.id===draft.id?`<p class="plan-notice" role="${notice.error?'alert':'status'}">${E(notice.text)}</p>`:'';
    const select=(key,label)=>`<div class="field"><label for="plan-${key}">${label}</label><select class="select" id="plan-${key}" data-plan-figure="${key}"><option value="">Sin figura</option>${options.map(type=>`<option value="${type}" ${plan.figures[key]===type?'selected':''}>${labels[type]}</option>`).join('')}</select></div>`;
    const area=(key,label,value,max,attr)=>`<div class="field full"><label for="plan-${key}">${E(label)}</label><textarea class="textarea" id="plan-${key}" ${attr}="${key}" maxlength="${max}" rows="3">${E(value)}</textarea></div>`;
    const details=summary.total?`${summary.total} actividades · ${summary.dated.length} con fechas completas`:'Carga actividades en Registros para preparar el contexto y las figuras.';
    const source=plan.model?'Redacción asistida por '+plan.model:'Redacción automática a partir de los registros';
    return `<section class="inst-fields-group plan-assistant">
      <h3>Análisis de la planificación</h3>
      <p class="plan-status">${E(details)} · Plantilla ${E(plan.template.version)}</p>
      <div class="inst-fields-grid">
        ${options.length?select('principal','Figura principal')+select('complementaria','Figura complementaria'):''}
        ${chosen.map(type=>area(type,'Pie de figura · '+labels[type],plan.captions[type],500,'data-plan-caption')).join('')}
        ${Object.entries(Plan.textLabels).map(([key,label])=>area(key,label,plan.text[key],1800,'data-plan-text')).join('')}
        <div class="field full"><label for="plan-local-model">Modelo de Ollama (opcional)</label><input id="plan-local-model" class="input" data-plan-model maxlength="120" value="${E(plan.preferredModel)}" placeholder="Usar un modelo instalado" /></div>
      </div>
      <div class="plan-actions">
        <button class="btn btn-primary" data-action="plan-ai" ${!summary.total||request?'disabled':''}>${busy?'Redactando…':'Redactar con IA local'}</button>
        <button class="btn" data-action="plan-reset">Restaurar redacción automática</button>
      </div>
      <p class="plan-status">${E(source)}</p>
      ${message}
    </section>`;
  }

  function input(event){
    const draft=state.draft,plan=draft?.planExamen;
    if(!plan||state.view!=='editor')return false;
    const target=event.target,{planText,planCaption,planFigure}=target.dataset||{};
    if(planText&&Object.hasOwn(Plan.textLabels,planText)){
      draft.planExamen={...plan,text:{...plan.text,[planText]:target.value.slice(0,1800)}};
      refreshPreview();
    }else if(planCaption&&Object.hasOwn(Plan.figureLabels,planCaption)){
      draft.planExamen={...plan,captions:{...plan.captions,[planCaption]:target.value.slice(0,500)}};
      refreshPreview();
    }else if(target.id==='plan-local-model'){
      draft.planExamen={...plan,preferredModel:target.value.slice(0,120)};
    }else if(planFigure&&['principal','complementaria'].includes(planFigure)){
      if(event.type==='input')return true;
      const options=Plan.available(Plan.summarize(plan.rows)),value=options.includes(target.value)?target.value:'';
      const other=planFigure==='principal'?'complementaria':'principal';
      const figures={...plan.figures,[planFigure]:value};
      if(value&&figures[other]===value)figures[other]='';
      draft.planExamen={...plan,figures};
      renderHere();
    }else return false;
    return true;
  }

  async function redact(draft){
    if(request||!draft.planExamen.rows.length)return;
    const plan=draft.planExamen;
    const {contenido,observaciones}=draft;
    const isCurrent=()=>state.view==='editor'&&state.draft===draft;
    request={draft};
    notice=null;
    renderHere();
    try{
      if(!window.utetDesktop?.redactPlanExamen)throw Error('Abre el documento en la aplicación de escritorio para usar la IA local.');
      const reply=await window.utetDesktop.redactPlanExamen({
        rows:plan.rows,periodo:plan.periodo,modelo:plan.preferredModel,
        observaciones:[contenido,observaciones].filter(Boolean).map(text=>text.slice(0,440)).join('\n')
      });
      if(!isCurrent())return;
      if(draft.planExamen!==plan||draft.contenido!==contenido||draft.observaciones!==observaciones){
        notice={id:draft.id,text:'El borrador cambió durante la redacción. Puedes solicitarla de nuevo.'};
        return;
      }
      draft.planExamen={...plan,...reply,captions:{...plan.captions,...reply.captions}};
      notice={id:draft.id,text:'Textos y figuras sugeridos. Revísalos en la vista previa.'};
    }catch(error){
      if(isCurrent())notice={id:draft.id,error:true,text:String(error.message||error).replace(/^Error invoking remote method '[^']+': Error: /,'')};
    }finally{
      request=null;
      if(state.view==='editor')renderHere();
    }
  }

  function handleAction(action){
    const draft=state.draft,plan=draft?.planExamen;
    if(state.view!=='editor'||!plan)return false;
    if(action==='plan-ai')redact(draft);
    else if(action==='plan-reset'){
      const automatic=Plan.create(plan.rows,plan.periodo);
      draft.planExamen={...plan,text:automatic.text,model:''};
      notice=null;
      renderHere();
    }else return false;
    return true;
  }

  return {render:section,input,handleAction};
}});
