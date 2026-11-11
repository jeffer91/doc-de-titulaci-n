'use strict';
/* Plantilla única de Acta de Titulación (tres hojas carta) para las modalidades
 * Artículo Académico (AA), Trabajo de Titulación (TT) y Examen Complexivo (CX). */
(function(root){
 const Modalidades=root?root.UTET_ACTA_MODALIDADES:require('./acta-titulacion.modalidades.js');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=x=>{const m=String(x||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(x||'');};
 const text=v=>String(v??'').trim();
 const config=r=>{try{return Modalidades.get(r&&r.modalidad);}catch{return null;}};
 const valid=r=>{
  const cfg=config(r);
  return !!(cfg&&
   Modalidades.numberPattern(cfg).test(r.numeroActa||'')&&
   /^AT-ITSQMET-UTET-\d{4}-(0[1-9]|1[0-2])$/.test(r.codigoDocumento||'')&&
   Array.isArray(r.requisitos)&&r.requisitos.length===9&&r.requisitos.every(x=>x.status==='CUMPLE')&&
   Array.isArray(r.aprobaciones)&&r.aprobaciones.length===2&&r.aprobaciones.every(x=>x.status==='CUMPLE')&&
   cfg.checks.every(k=>r.comprobaciones?.[k]==='CUMPLE')&&
   /^\d{10}$/.test(r.cedula||'')&&!!text(r.nombre)&&!!text(r.carrera)&&!!r.fechaEmision);
 };
 function header(r,cfg,page){
  return '<header class="aa-head"><div class="aa-head-top">'+
   '<div class="aa-head-logo"><img src="assets/logo-itsqmet.png" alt="ITSQMET"></div>'+
   '<div class="aa-head-unit">Unidad de Titulación y<br>Eficiencia Terminal</div>'+
   '<div class="aa-head-doc"><div>Código:<br>'+esc(r.codigoDocumento)+'</div><div>Versión: 1.0</div></div>'+
   '</div><div class="aa-head-bottom"><div>Fecha de emisión: '+esc(date(r.fechaEmision))+'</div>'+
   '<div><strong>'+esc(cfg.title)+'</strong></div>'+
   '<div>Página '+page+' de 3</div></div></header>';
 }
 function footer(r){return '<footer class="aa-footer">Acta N.º '+esc(r.numeroActa)+' · '+esc(r.codigoDocumento)+'</footer>';}
 function tableRows(rows){
  return '<table class="aa-states"><tbody>'+rows.map(x=>'<tr><td>'+esc(x.label)+'</td><td class="aa-yes">'+esc(x.status)+'</td></tr>').join('')+'</tbody></table>';
 }
 function section(title,contents){
  return '<section class="aa-section"><h2>'+esc(title)+'</h2>'+contents+'</section>';
 }
 function render(r,periodLabel){
  if(!valid(r))throw Error('No se puede generar un acta definitiva sin los nueve requisitos, ambas aprobaciones y controles académicos cumplidos.');
  const cfg=config(r);
  const a='<section class="aa-page aa-cover">'+header(r,cfg,1)+
   '<div class="aa-cover-content"><h1>'+cfg.titleLines.map(esc).join('<br>')+'</h1>'+
   '<h2>Período académico: '+esc(periodLabel)+'</h2></div>'+
   '<table class="aa-signatures"><thead><tr><th>ELABORADO</th><th>REVISADO</th><th>APROBADO</th></tr></thead>'+
   '<tbody><tr class="aa-signature-space"><td></td><td></td><td></td></tr>'+
   '<tr><td>MSc. Jefferson Villarreal</td><td>Ing. Martha Tomalá</td><td>Dr. Alex León T.</td></tr>'+
   '<tr><td>Coordinador de Titulación y Eficiencia Terminal</td><td>Coordinadora General de Carreras</td><td>Vicerrector</td></tr></tbody></table>'+
   footer(r)+'</section>';
  const details=[
   ['Estudiante',r.nombre],
   ['Cédula',r.cedula],
   ['Carrera',r.carrera],
   ['Modalidad de estudios',r.modalidadEstudios||'No registrada'],
   ['Modalidad de titulación',cfg.label]
  ];
  const b='<section class="aa-page aa-content-page">'+header(r,cfg,2)+
   '<div class="aa-constancia"><strong>CONSTANCIA DE CULMINACIÓN Y TITULACIÓN</strong>'+
   '<strong>N.º DE ACTA: '+esc(r.numeroActa)+'</strong>'+
   '<span>Fecha de registro: '+esc(date(r.fechaRegistro))+'</span></div>'+
   '<table class="aa-identity"><tbody>'+details.map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join('')+'</tbody></table>'+
   section('1. Culminación de la malla curricular',
    '<p>El requisito Académico registra CUMPLE según el expediente institucional. La culminación curricular se acredita conforme a los documentos académicos correspondientes.</p>'+
    tableRows([{label:'Requisito Académico',status:r.requisitos[0].status}]))+
   section('2. Verificación de los nueve requisitos institucionales',
    '<p>Se presentan los estados documentales verificados para el estudiante y su período académico; no se incluyen calificaciones numéricas.</p>'+
    tableRows(r.requisitos.map((x,i)=>({...x,label:(i+1)+'. '+x.label}))))+
   section('3. Modalidad y estado del proceso de titulación','<p>'+esc(cfg.section3)+'</p>')+
   footer(r)+'</section>';
  const statuses=cfg.checks.map(k=>({label:cfg.statusLabels[k],status:r.comprobaciones[k]}));
  const academic=cfg.requiresNotes||cfg.requiresSimilarity;
  let n=4;
  const c='<section class="aa-page aa-content-page">'+header(r,cfg,3)+
   section((n++)+'. Aprobaciones institucionales',tableRows(r.aprobaciones))+
   (academic?section((n++)+'. Verificación de las condiciones académicas',tableRows(statuses)):'')+
   section((n++)+'. Constancia documental','<p>'+esc(cfg.constancia)+'</p>')+
   '<div class="aa-final">REQUISITOS Y APROBACIONES INSTITUCIONALES CUMPLIDOS</div>'+
   '<p class="aa-end-note">'+esc(cfg.endNote)+'</p>'+
   footer(r)+'</section>';
  return '<div class="institutional-document aa-document">'+a+b+c+'</div>';
 }
 function filename(r){
  if(!valid(r))throw Error('Acta inválida.');
  return 'ACTA_'+config(r).fileTag+'_'+r.cedula+'_'+r.numeroActa+'.pdf';
 }
 const api=Object.freeze({render,valid,filename,esc,date,config});
 if(root)root.UTET_ACTA_ARTICULO_MODEL=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
