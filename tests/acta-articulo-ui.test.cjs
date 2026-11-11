'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'../renderer'),elements=new Map(),callbacks=new Map();
const element=id=>({id,innerHTML:'',value:'',classList:{add(){},remove(){}},addEventListener(type,cb){callbacks.set(id+':'+type,cb);}});
const document={getElementById:id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},
 addEventListener:(event,callback)=>callbacks.set('document:'+event,callback)};
const pending=[],calls={open:0,verify:0,issue:0,recover:0,export:[],modalities:[]};
const window={scrollY:0,scrollTo(x,y){this.scrollY=y;},utetDesktop:{
 openActaArticulo:(periodId,modalidad)=>{calls.open++;calls.modalities.push(modalidad);return new Promise((resolve,reject)=>pending.push({periodId,modalidad,resolve,reject}));},
 refreshActaArticulo:async()=>{throw Error('Actualizar solo ante solicitud explícita');},
 verifyActaArticulo:async(periodId,cedula,modalidad)=>{calls.verify++;calls.modalities.push(modalidad);
  const checks=modalidad==='EXAMEN_COMPLEXIVO'?{modalidad:'CUMPLE'}:{articulo:'CUMPLE',defensa:'CUMPLE',similitud:'CUMPLE',modalidad:'CUMPLE'};
  return {modalidad,eligible:true,missing:[],requirements:Array.from({length:9},(_,i)=>({label:'Requisito '+i,status:'CUMPLE'})),approvals:Array.from({length:2},()=>({status:'CUMPLE'})),checks};},
 issueActaArticulo:async(periodId,cedula,modalidad)=>{calls.issue++;calls.modalities.push(modalidad);const prefix=modalidad==='EXAMEN_COMPLEXIVO'?'CX':'AA';return {modalidad,periodoId:periodId,cedula,numeroActa:prefix+'-2026-0105-05-0001',codigoDocumento:'AT-ITSQMET-UTET-2026-05',fechaEmision:'2026-05-29',fechaRegistro:'2026-11-07'};},
 recoverActaArticulo:async()=>{calls.recover++;return null;},
 exportActaArticulo:async spec=>{calls.export.push(spec);return {count:spec.cedulas.length,location:'Descargas'};}
}};
const store=new Map();
const ctx=vm.createContext({window,document,Date,Math,Promise,console,setTimeout:()=>1,clearTimeout:()=>{},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},confirm:()=>true});
for(const file of ['data.js','institutional.js','records.js','records-ui.js','antiplagio.model.js','antiplagio.js','acta-titulacion.modalidades.js','acta-articulo.model.js','acta-articulo.js','app.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const click=(action,id='')=>callbacks.get('document:click')({target:{closest:()=>({dataset:{action,id}})}});
const html=()=>document.getElementById('app-content').innerHTML;
const tick=()=>new Promise(ok=>setImmediate(ok));
(async()=>{
 const periodId=window.UTET_DATA.periodos[0].id;
 click('rec-open','acta-articulo');
 assert.equal(calls.open,1);
 assert.equal(pending[0].periodId,periodId);
 assert.match(html(),/Cargando información local/);
 pending[0].resolve({periodoId:periodId,students:[{periodoId:periodId,cedula:'0105483465',nombres:'ESTUDIANTE EJEMPLO',carreraNombre:'ADMINISTRACIÓN',modalidad:'En línea'}],
  actas:[],evidences:[],emision:{date:'2026-05-29',documentCode:'AT-ITSQMET-UTET-2026-05'}});
 await tick();await tick();
 assert.match(html(),/Acta de Titulación por Artículo Académico/);
 assert.match(html(),/ESTUDIANTE EJEMPLO/);
 assert.match(html(),/Verificar/);
 assert.match(html(),/Emitir/);
 assert.match(html(),/Recuperar/);
 assert.match(html(),/29\/05\/2026/);
 click('aa-verify','0105483465');
 await tick();await tick();
 assert.equal(calls.verify,1);
 assert.match(html(),/Elegible/);
 click('aa-issue','0105483465');
 await tick();await tick();await tick();
 assert.equal(calls.issue,1);
 assert.equal(calls.export.length,1);
 assert.equal(calls.export[0].mode,'pdfs');
 assert.deepEqual([...calls.export[0].cedulas],['0105483465']);
 assert.match(html(),/Acta emitida/);
 click('aa-download','0105483465');
 await tick();await tick();
 assert.equal(calls.export.length,2);
 assert.equal(calls.issue,1,'Reimpresión no emite otro número ni consulta Firebase');
 click('rec-open','acta-articulo');
 assert.equal(calls.open,1,'Reingresar al período abierto conserva estado local');
 assert.deepEqual([...new Set(calls.modalities)],['ARTICULO_ACADEMICO'],'Toda la sesión AA viaja con su modalidad');
 assert.equal(calls.export[0].modalidad,'ARTICULO_ACADEMICO');
 // Examen Complexivo abre la misma pantalla con otra modalidad y datos locales propios.
 click('rec-open','acta-examen');
 assert.equal(calls.open,2,'Cambiar de modalidad vuelve a leer SQLite');
 assert.equal(pending[1].modalidad,'EXAMEN_COMPLEXIVO');
 pending[1].resolve({periodoId:periodId,modalidad:'EXAMEN_COMPLEXIVO',students:[{periodoId:periodId,cedula:'0106832819',nombres:'ESTUDIANTE COMPLEXIVO',carreraNombre:'CONTABILIDAD ONLINE',modalidad:'En línea'}],
  actas:[],evidences:[],emision:{date:'2026-05-29',documentCode:'AT-ITSQMET-UTET-2026-05'}});
 await tick();await tick();
 assert.match(html(),/Acta de Titulación por Examen Complexivo/);
 assert.match(html(),/UTET-PRO-93/);
 assert.match(html(),/ESTUDIANTE COMPLEXIVO/);
 assert.doesNotMatch(html(),/ESTUDIANTE EJEMPLO|Acta emitida/,'No arrastra actas ni estudiantes de la sesión AA');
 assert.match(html(),/Ncomplex/);
 click('aa-verify','0106832819');
 await tick();await tick();
 assert.equal(calls.modalities.at(-1),'EXAMEN_COMPLEXIVO');
 assert.match(html(),/Modalidad:<\/strong> CUMPLE/);
 assert.doesNotMatch(html(),/Artículo:<\/strong>/,'Complexivo no muestra controles de artículo');
 click('aa-issue','0106832819');
 await tick();await tick();await tick();
 assert.equal(calls.issue,2);
 assert.equal(calls.export.at(-1).modalidad,'EXAMEN_COMPLEXIVO');
 assert.match(html(),/Acta emitida · CX-2026-0105-05-0001/);
 // Trabajo de Titulación también es una modalidad propia.
 click('new-doc','acta-trabajo');
 assert.equal(pending[2].modalidad,'TRABAJO_TITULACION');
 pending[2].resolve({periodoId:periodId,modalidad:'TRABAJO_TITULACION',students:[],actas:[],evidences:[],emision:{date:'2026-05-29',documentCode:'AT-ITSQMET-UTET-2026-05'}});
 await tick();await tick();
 assert.match(html(),/Acta de Titulación por Trabajo de Titulación/);
 assert.match(html(),/UTET-PRO-164/);
 console.log('OK UI Actas AA/CX/TT: abrir, verificar, emitir, descargar, reimprimir y cambiar de modalidad sin mezclar sesiones.');
})().catch(e=>{console.error(e);process.exitCode=1;});
