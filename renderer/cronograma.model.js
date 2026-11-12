'use strict';
/* Cronogramas UTET-PRO-57: modelo puro para vista previa e impresión. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.UTET_CRONOGRAMA_MODEL=api;
})(typeof window!=='undefined'?window:null,function(){
  const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trim=(x,n=200)=>String(x==null?'':x).trim().slice(0,n);
  function validDate(x){
    if(!/^\d{4}-\d\d-\d\d$/.test(String(x||'')))return false;
    const [y,m,d]=x.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;
  }
  function prettyDate(s){return validDate(s)?s.split('-').reverse().join('/'):String(s||'—');}
  function longDate(s){
    if(!validDate(s))return 'fecha pendiente';
    const [y,m,d]=s.split('-').map(Number);
    return d+' de '+new Date(Date.UTC(y,m-1,1)).toLocaleString('es-EC',{month:'long',timeZone:'UTC'})+' de '+y;
  }
  function stage(actividad,assigned){
    if(trim(assigned))return trim(assigned,70);
    const s=trim(actividad).toLowerCase();
    if(/inducci[oó]n/.test(s))return 'Inducción';
    if(/supletorio/.test(s))return 'Supletorio';
    if(/defensa/.test(s))return 'Defensa';
    if(/evaluaci[oó]n|calificaci[oó]n/.test(s))return 'Evaluaciones';
    if(/entrega|revisi[oó]n|borrador/.test(s))return 'Entregas y revisiones';
    if(/clase|metodolog[ií]a|refuerzo|requisito/.test(s))return 'Clases';
    return 'Actividades académicas';
  }
  const months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const monthLabel=/^(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|agos|ago|septiembre|setiembre|sept|sep|set|octubre|oct|noviembre|nov|diciembre|dic)\.?(?:\s+de)?\s+(\d{4})$/;
  function periodKey(value){
    const text=trim(value,150).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—]/g,'-');
    const explicit=/^(\d{4})-(0[1-9]|1[0-2])__(\d{4})-(0[1-9]|1[0-2])$/.exec(text);
    const ends=explicit?[explicit[1]+'-'+explicit[2],explicit[3]+'-'+explicit[4]]:
      text.split(/\s*-\s*|\s+(?:a|al|hasta)\s+/).map(part=>{
        const match=monthLabel.exec(part.trim());
        if(!match)return '';
        const name=match[1].slice(0,3),month=months.indexOf(name==='set'?'sep':name)+1;
        return match[2]+'-'+String(month).padStart(2,'0');
      });
    return ends.length===2&&ends[0]&&ends[1]&&ends[0]<=ends[1]?ends.join('__'):'';
  }
  function validate(raw,{legacy=false}={}){
    if(!raw||typeof raw!=='object')throw Error('Faltan los datos del memorando.');
    const fecha=trim(raw.fecha,10),id=trim(raw.id,120),periodo=trim(raw.periodo,150);
    if(!validDate(fecha))throw Error('La fecha de emisión debe ser válida.');
    if(!/^[a-zA-Z0-9_-]{6,120}$/.test(id))throw Error('Identificador del memorando no válido.');
    const period=periodKey(periodo);
    if(!periodo||(!legacy&&!period))throw Error('Indica un período académico con meses y años en orden cronológico.');
    if(!Array.isArray(raw.cronogramas)||!raw.cronogramas.length||raw.cronogramas.length>24)throw Error('Selecciona entre 1 y 24 cronogramas.');
    let count=0;
    const cronogramas=raw.cronogramas.map((item,index)=>{
      const grupo=trim(item.grupo,100),hoja=trim(item.hoja,100);
      if(!grupo||/^por determinar$/i.test(grupo))throw Error('Indica el grupo real del anexo '+(index+1)+' antes de emitir.');
      const sourcePeriod=trim(item.periodo,150);
      if(!legacy&&periodKey(sourcePeriod)!==period)throw Error('El período del anexo '+(index+1)+' ('+grupo+') está incompleto o no coincide con el memorando.');
      if(!Array.isArray(item.actividades)||!item.actividades.length||item.actividades.length>250)throw Error('Cronograma sin actividades válidas o demasiado grande: '+grupo);
      const actividades=item.actividades.map((a,i)=>{
        const actividad=trim(a.actividad,350),inicio=trim(a.inicio,10),fin=trim(a.fin,10);
        if(!actividad||!validDate(inicio)||!validDate(fin)||fin<inicio)throw Error('Revisa la actividad '+(i+1)+' del grupo '+grupo+': fechas o descripción inválidas.');
        count++;
        return {etapa:stage(actividad,a.etapa),actividad,inicio,fin};
      });
      return {grupo,hoja,periodo:sourcePeriod||periodo,actividades};
    });
    if(count>1200)throw Error('Hay demasiadas actividades en los anexos.');
    return {id,fecha,periodo,cronogramas};
  }
  const logo='<img class="cron-logo" alt="ITSQMET" src="assets/logo-itsqmet.png"/>';
  const footer='<img class="cron-footer-art" alt="" src="assets/memorando-pie-itsqmet.svg"/>';
  function page(inner,cls){
    return '<section class="cron-pdf-page '+(cls||'')+'"><div class="cron-pdf-inner">'+inner+'</div>'+footer+'</section>';
  }
  function boundaries(rows){
    const dates=rows.flatMap(x=>[x.inicio,x.fin]).filter(validDate).sort();
    return {first:dates[0]||'',last:dates[dates.length-1]||''};
  }
  function chunks(rows){
    const out=[];let batch=[],units=0;
    for(const r of rows){
      const weight=1+Math.max(0,Math.ceil(r.actividad.length/44)-1)*0.65;
      if(batch.length && (units+weight>19 || batch.length>=20)){out.push(batch);batch=[];units=0;}
      batch.push(r);units+=weight;
    }
    if(batch.length)out.push(batch);
    return out;
  }
  function front(doc,code){
    const name=code||'PENDIENTE DE EMISIÓN';
    const groups=doc.cronogramas.map(x=>x.grupo);
    const recipient='ESTUDIANTES DE '+groups.join(', ').toUpperCase()+' Y UNIDAD DE INVESTIGACIÓN E INNOVACIÓN (UII)';
    return page('<header class="cron-first-head">'+logo+'<div class="cron-first-ident"><span>UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</span><strong>MEMORANDO INSTITUCIONAL</strong></div></header>'+
      '<h1>Memorando No. '+esc(name)+'</h1>'+
      '<div class="cron-meta"><div><b>PARA</b><span>'+esc(recipient)+'</span></div>'+
      '<div><b>DE</b><span>MGS. JEFFERSON VILLARREAL<br/>COORDINADOR DE TITULACIÓN Y EFICIENCIA TERMINAL</span></div>'+
      '<div><b>ASUNTO</b><span>SOCIALIZACIÓN DE CRONOGRAMA DE TITULACIÓN POR ARTÍCULO ACADÉMICO · '+esc(doc.periodo.toUpperCase())+'</span></div>'+
      '<div><b>FECHA</b><span>'+esc(prettyDate(doc.fecha))+'</span></div></div>'+
      '<div class="cron-body"><p>De conformidad con la planificación del proceso de titulación, se comunican los cronogramas correspondientes a la modalidad de <strong>artículo académico</strong> del período <strong>'+esc(doc.periodo)+'</strong>, dirigidos a los grupos indicados en este memorando.</p>'+
      '<p>Las actividades y sus fechas de inicio y finalización constan en los anexos adjuntos, organizados por grupo. Cada anexo integra la planificación comunicada y permite identificar las etapas de inducción, clases, entregas, revisiones, evaluaciones, defensas y actividades supletorias que correspondan.</p>'+
      '<p>Se solicita a los estudiantes revisar el cronograma asignado a su grupo, cumplir los plazos establecidos y atender las comunicaciones emitidas por los canales institucionales. La Unidad de Investigación e Innovación recibe este documento para conocimiento y coordinación en el ámbito de sus competencias.</p>'+
      '<p>Los ajustes que se aprueben posteriormente deberán comunicarse por los canales institucionales; este memorando no sustituye las disposiciones académicas vigentes.</p>'+
      '<p>Agradezco su atención y cumplimiento oportuno.</p></div>'+
      '<div class="cron-sign"><p>Atentamente,</p><div class="cron-sign-space"></div><strong>MGS. JEFFERSON VILLARREAL</strong><span>COORDINADOR DE TITULACIÓN Y EFICIENCIA TERMINAL<br/>ITSQMET</span></div>'+
      '<div class="cron-first-bottom">Anexos: '+doc.cronogramas.length+' cronograma(s) · UTET-PRO-57</div>', 'cron-first');
  }
  function annex(doc,item,number,part,totalParts){
    const dates=boundaries(item.actividades),n=item.actividades.length;
    const rows=chunks(item.actividades)[part];
    const stageNames=[...new Set(item.actividades.map(x=>x.etapa))];
    const title='ANEXO '+number+'. CRONOGRAMA DE TITULACIÓN · '+item.grupo.toUpperCase();
    const body='<div class="cron-annex-head">'+logo+'<span>UTET-PRO-57 · ARTÍCULO ACADÉMICO</span></div>'+
      '<div class="cron-annex-band"><div class="cron-small">CRONOGRAMA INSTITUCIONAL / '+esc(doc.periodo)+'</div><h2>'+esc(title)+'</h2><p>Actividades programadas para el grupo '+esc(item.grupo)+'. Los plazos de entregas, revisiones, evaluaciones, defensas y supletorios deben observarse conforme a su aplicación académica.</p></div>'+
      '<div class="cron-summary"><div><small>ACTIVIDADES</small><b>'+n+'</b></div><div><small>DESDE</small><b>'+esc(prettyDate(dates.first))+'</b></div><div><small>HASTA</small><b>'+esc(prettyDate(dates.last))+'</b></div><div><small>ETAPAS</small><b>'+stageNames.length+'</b></div></div>'+
      '<div class="cron-summary-context"><strong>Alcance:</strong> '+esc(stageNames.join(' · '))+'.'+(totalParts>1?' <span>Continuación '+(part+1)+' de '+totalParts+'.</span>':'')+'</div>'+
      '<table class="cron-table"><thead><tr><th>ETAPA</th><th>ACTIVIDAD</th><th>FECHA DE INICIO</th><th>FECHA DE FIN</th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr class="'+(i%2?'cron-row-alt':'')+'"><td><span class="cron-stage">'+esc(r.etapa)+'</span></td><td>'+esc(r.actividad)+'</td><td>'+esc(prettyDate(r.inicio))+'</td><td>'+esc(prettyDate(r.fin))+'</td></tr>').join('')+
      '</tbody></table><div class="cron-annex-note"><b>Observación.</b> Las actividades supletorias se aplican únicamente cuando correspondan. El período académico y la fecha de cierre de actividades pueden ser diferentes.</div>'+
      '<div class="cron-annex-page">Anexo '+number+' · Página '+(part+1)+' de '+totalParts+' · Memorando '+esc(doc.code||'pendiente')+'</div>';
    return page(body,'cron-annex');
  }
  function render(input,code){
    const doc=validate(input,{legacy:true}),folio=trim(code||input.code||'',80);
    doc.code=folio||'PENDIENTE DE EMISIÓN';
    let result=front(doc,folio);
    doc.cronogramas.forEach((item,index)=>{
      chunks(item.actividades).forEach((_,part,all)=>{result+=annex(doc,item,index+1,part,all.length);});
    });
    return '<div class="institutional-document cron-document">'+result+'</div>';
  }
  return Object.freeze({validate,render,stage,validDate,prettyDate,chunks,boundaries,periodKey});
});
