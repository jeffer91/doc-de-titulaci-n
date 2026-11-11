'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../renderer'),elements=new Map(),listeners=new Map(),pending=[];
const node=id=>({id,value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(a,fn){listeners.set(id+':'+a,fn);}});
const document={getElementById(id){if(!elements.has(id))elements.set(id,node(id));return elements.get(id);},addEventListener(a,fn){listeners.set('document:'+a,fn);}};
const saved=new Map(),calls={save:0,export:0,draft:0,modes:[],pdfs:[]};
const window={scrollY:0,scrollTo(x,y){this.scrollY=y;},utetDesktop:{
 openAntiplagioPeriod(p,tipo){return new Promise((resolve,reject)=>pending.push({method:'local',p,tipo,resolve,reject}));},
 refreshAntiplagioPeriod(p,tipo){return new Promise((resolve,reject)=>pending.push({method:'firebase',p,tipo,resolve,reject}));},
 async saveAntiplagioDraft(){calls.draft++;},
 async saveAntiplagioRecord(){calls.save++;throw Error('No se debería escribir en Firebase para descargar un documento sin cambios.');},
 async exportAntiplagioFiles(spec){calls.export++;calls.modes.push(spec.mode);calls.pdfs.push(spec.files[0]?.html||'');return {canceled:false,count:spec.files.length,location:'/local/Descargas'};}
}};
const ctx=vm.createContext({window,document,Date,Math,Promise,console,
 localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},setTimeout:()=>1,clearTimeout:()=>{}});
for(const name of ['data.js','institutional.js','records.js','records-ui.js','antiplagio.model.js','antiplagio.js','acta-titulacion.modalidades.js','acta-articulo.model.js','acta-articulo.js','cronograma.model.js','cronograma.js','app.js'])
 vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const display=()=>document.getElementById('app-content').innerHTML;
const click=(action,id='')=>listeners.get('document:click')({target:{closest:()=>({dataset:{action,id}})}});
const changePeriod=p=>listeners.get('period-select:change')({target:{value:p}});
const tick=()=>new Promise(res=>setImmediate(res));
const row=(p,c='0102030405',n='Ana Pérez')=>({estudianteId:p+'__'+c,periodoId:p,cedula:c,nombres:n,carreraId:'C01',carreraNombre:'ADMINISTRACIÓN ONLINE',modalidad:'En línea'});
const mem=p=>({...row(p),similitud:'12.34',origen:'simulado',fecha:'2026-04-15',folio:'01 MEM-ITSQMET-UTET-2026-04-15',referencia:'UTET-ANT-2026-04-0001',fuentes:{google:'detected'},syncStatus:'sincronizado'});
const packet=(p,students,records=[])=>({periodoId:p,students,records,hasCache:true,source:'SQLite local',syncedAt:'2026-11-07T13:00:00.000Z'});
(async()=>{
 const [p,two]=window.UTET_DATA.periodos.map(x=>x.id);
 click('rec-open','plagio-trabajo');
 assert.equal(pending.length,1);
 assert.equal(pending[0].method,'local');
 assert.match(display(),/Abriendo base local/);
 pending[0].resolve(packet(p,[row(p)],[mem(p)]));
 await tick();await tick();
 assert.match(display(),/Ana Pérez/);
 assert.match(display(),/SQLite local/);
 assert.match(display(),/Actualizar Firebase/);
 click('ap-add','0102030405');
 assert.match(display(),/PDF individuales/);
 assert.match(display(),/Descargar ZIP/);
 click('ap-one','0102030405');
 await tick();await tick();
 assert.equal(calls.export,1,'Debe exportar desde la copia local');
 assert.equal(calls.modes[0],'pdfs','Un PDF se descarga como archivo, no como carpeta');
 click('ap-zip');
 await tick();await tick();
 assert.equal(calls.modes[1],'zip','ZIP mantiene la descarga comprimida');
 assert.equal(calls.save,0,'Reimprimir NO escribe ni lee Firebase');
 click('ap-back');
 click('rec-open','plagio-trabajo');
 assert.equal(pending.length,1,'Volver al período cargado NO vuelve a consultar');
 click('ap-refresh');
 await tick();
 assert.equal(pending.length,2);
 assert.equal(pending[1].method,'firebase','Solo el botón explícito debe pedir actualización remota');
 pending[1].resolve(packet(p,[row(p,'0102030405','Ana Actualizada')],[mem(p)]));
 await tick();await tick();
 assert.match(display(),/Ana Actualizada/);
 changePeriod(two);
 assert.equal(pending.length,3);
 assert.equal(pending[2].method,'local','Cambiar de período primero comprueba la base local');
 pending[2].resolve(packet(two,[row(two,'0202020202','Nuevo Período')]));
 await tick();await tick();
 assert.match(display(),/Nuevo Período/);
 click('ap-refresh');
 await tick();
 assert.equal(pending[3].method,'firebase');
 pending[3].reject(new Error('Sin internet'));
 await tick();await tick();
 assert.match(display(),/Nuevo Período/,'Un error de red NO vacía los estudiantes locales');
 assert.match(display(),/Sin internet/);
 // PRO-57: la misma pantalla se abre desde el segundo proceso, con otro espacio
 // de memorandos y el mismo formato; no se mezclan registros.
 click('rec-open','plagio-articulo');
 assert.equal(pending.length,5);
 assert.equal(pending[4].tipo,'articulo');
 const articleMemo={...mem(two),...row(two,'0202020202','Nuevo Período'),
   tipoDocumento:'articulo',folio:'02 MEM-ITSQMET-UTET-2026-04-15',
   referencia:'UTET-ANT-2026-04-0002'};
 pending[4].resolve(packet(two,[row(two,'0202020202','Nuevo Período')],[articleMemo]));
 await tick();await tick();
 assert.match(display(),/Artículo Académico · PRO-57/);
 click('ap-add','0202020202');
 click('ap-one','0202020202');
 await tick();await tick();
 assert.equal(calls.save,0,'La reimpresión del artículo no debe llamar Firebase');
 assert.match(calls.pdfs.at(-1),/RESULTADO DEL ANÁLISIS DE SIMILITUD DEL ARTÍCULO ACADÉMICO/);
 assert.match(calls.pdfs.at(-1),/su artículo académico, presentado durante el período académico/);
 assert.doesNotMatch(calls.pdfs.at(-1),/su trabajo de titulación/);
 click('rec-open','plagio-trabajo');
 assert.equal(pending.length,6);
 assert.equal(pending[5].tipo,'trabajo');
 pending[5].resolve(packet(two,[row(two,'0202020202','Nuevo Período')],[]));
 await tick();await tick();
 assert.match(display(),/Trabajo de Titulación · PRO-164/);
 assert.doesNotMatch(display(),/Memorando guardado/,'El memorando de artículo no debe aparecer como trabajo');

 console.log('OK UI SQLite: apertura y cambios locales, refresh manual y reimpresión sin escritura Firebase.');
})().catch(e=>{console.error(e);process.exitCode=1;});
