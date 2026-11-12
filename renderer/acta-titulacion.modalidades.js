'use strict';
/* Modalidades de Acta de Titulación (misma plantilla de tres hojas carta).
 * Compartido por navegador (window.UTET_ACTA_MODALIDADES) y Electron (require).
 * No contiene datos de estudiantes; sólo textos institucionales y reglas de cada modalidad.
 */
(function(root){
 const MODALIDADES=Object.freeze({
  ARTICULO_ACADEMICO:Object.freeze({
   id:'ARTICULO_ACADEMICO',docId:'acta-articulo',prefix:'AA',proceso:'UTET-PRO-57',
   title:'Acta de Titulación por Artículo Académico',titleLines:['Acta de Titulación por Artículo','Académico'],
   label:'Artículo Académico',fileTag:'AA',zipName:'Actas_Articulo_Academico_UTET.zip',
   approvalLabel:'Aprobación del artículo académico',
   antiplagioDocId:'articulo__',antiplagioLabel:'Artículo Académico',
   writingFields:['notaArticulo','notaEscrito','Notart','Nart'],writingLabel:'Artículo académico',
   defenseFields:['notaDefensa','notaDefensaTrabajo','Notdef','Ndef'],
   modePattern:'articuloacademico',
   requiresNotes:true,requiresSimilarity:true,
   checks:['articulo','defensa','similitud','modalidad'],
   statusLabels:{articulo:'Artículo académico · mínimo 7/10 acreditado',defensa:'Defensa · mínimo 7/10 acreditado',
    similitud:'Similitud · máximo 20,00 % acreditado',modalidad:'Modalidad de titulación · Artículo Académico'},
   section3:'La modalidad registrada es Artículo Académico. Las evaluaciones del artículo y su defensa se han contrastado con los mínimos requeridos, pero sus calificaciones numéricas no se presentan en esta acta.',
   constancia:'Constan como CUMPLE los nueve requisitos institucionales y las dos aprobaciones finales, de acuerdo con el expediente académico verificado. También se acreditan las condiciones de artículo, defensa y similitud exigidas para esta modalidad.',
   endNote:'La presente acta deja constancia del cumplimiento documental y académico registrado para el proceso de titulación mediante Artículo Académico.',
   uiRule:'La emisión exige nueve requisitos y dos aprobaciones CUMPLE, artículo y defensa ≥7/10, y similitud real ≤20 %.'
  }),
  TRABAJO_TITULACION:Object.freeze({
   id:'TRABAJO_TITULACION',docId:'acta-trabajo',prefix:'TT',proceso:'UTET-PRO-164',
   title:'Acta de Titulación por Trabajo de Titulación',titleLines:['Acta de Titulación por Trabajo de','Titulación'],
   label:'Trabajo de Titulación',fileTag:'TT',zipName:'Actas_Trabajo_Titulacion_UTET.zip',
   approvalLabel:'Aprobación del trabajo de titulación',
   antiplagioDocId:'',antiplagioLabel:'Trabajo de Titulación',
   writingFields:['notaEscrito','notaTrabajo','notaEscrita','notaDocumento','Notesc','Nesc'],writingLabel:'Trabajo de titulación',
   defenseFields:['notaDefensa','notaDefensaTrabajo','Notdef','Ndef'],
   modePattern:'trabajo(de)?titulacion|proyectodetitulacion',
   requiresNotes:true,requiresSimilarity:true,
   checks:['trabajo','defensa','similitud','modalidad'],
   statusLabels:{trabajo:'Trabajo de titulación · mínimo 7/10 acreditado',defensa:'Defensa · mínimo 7/10 acreditado',
    similitud:'Similitud · inferior a 20,00 % acreditada',modalidad:'Modalidad de titulación · Trabajo de Titulación'},
   section3:'La modalidad registrada es Trabajo de Titulación. Las evaluaciones del documento escrito y su defensa se han contrastado con los mínimos requeridos, pero sus calificaciones numéricas no se presentan en esta acta.',
   constancia:'Constan como CUMPLE los nueve requisitos institucionales y las dos aprobaciones finales, de acuerdo con el expediente académico verificado. También se acreditan las condiciones de trabajo escrito, defensa y similitud exigidas para esta modalidad.',
   endNote:'La presente acta deja constancia del cumplimiento documental y académico registrado para el proceso de titulación mediante Trabajo de Titulación.',
   uiRule:'La emisión exige nueve requisitos y dos aprobaciones CUMPLE, trabajo escrito y defensa ≥7/10, y similitud real inferior a 20 %.'
  }),
  EXAMEN_COMPLEXIVO:Object.freeze({
   id:'EXAMEN_COMPLEXIVO',docId:'acta-examen',prefix:'CX',proceso:'UTET-PRO-93',
   title:'Acta de Titulación por Examen Complexivo',titleLines:['Acta de Titulación por Examen','Complexivo'],
   label:'Examen Complexivo',fileTag:'COMPLEX',zipName:'Actas_Examen_Complexivo_UTET.zip',
   approvalLabel:'Aprobación complexivo/proyecto',
   antiplagioDocId:null,antiplagioLabel:'',
   writingFields:[],writingLabel:'',defenseFields:[],
   modePattern:'examencomplexivo|complexivo',
   requiresNotes:false,requiresSimilarity:false,
   checks:['modalidad'],
   statusLabels:{modalidad:'Modalidad de titulación · Examen Complexivo'},
   section3:'La modalidad registrada es Examen Complexivo. Las calificaciones y oportunidades se administran exclusivamente en Ncomplex y no se presentan en esta acta.',
   constancia:'Constan como CUMPLE los nueve requisitos institucionales y las dos aprobaciones finales, de acuerdo con el expediente académico verificado.',
   endNote:'La presente acta registra el cumplimiento de los nueve requisitos y de las dos aprobaciones finales que constan en el expediente institucional.',
   uiRule:'La emisión exige nueve requisitos y dos aprobaciones CUMPLE y la modalidad Examen Complexivo acreditada. Las calificaciones del examen se administran en Ncomplex.'
  })
 });
 const IDS=Object.freeze(Object.keys(MODALIDADES));
 const byDoc=Object.freeze(Object.fromEntries(IDS.map(k=>[MODALIDADES[k].docId,MODALIDADES[k]])));
 function get(id){
  const cfg=MODALIDADES[String(id||'')];
  if(!cfg)throw Error('Modalidad de acta no reconocida: '+String(id||'(vacía)'));
  return cfg;
 }
 const fromDoc=docId=>byDoc[String(docId||'')]||null;
 const numberPattern=cfg=>new RegExp('^'+cfg.prefix+'-\\d{4}-\\d{4}-(0[1-9]|1[0-2])-\\d{4}$');
 const anyNumberPattern=new RegExp('^('+IDS.map(k=>MODALIDADES[k].prefix).join('|')+')-\\d{4}-\\d{4}-(0[1-9]|1[0-2])-\\d{4}$');
 const api=Object.freeze({MODALIDADES,IDS,get,fromDoc,numberPattern,anyNumberPattern,DEFAULT:'ARTICULO_ACADEMICO'});
 if(root)root.UTET_ACTA_MODALIDADES=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
