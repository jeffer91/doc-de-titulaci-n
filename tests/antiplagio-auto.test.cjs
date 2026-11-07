'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../renderer'),elements=new Map(),listeners=new Map(),pending=[];
const node=id=>({id,value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(a,fn){listeners.set(id+':'+a,fn);}});
const document={getElementById(id){if(!elements.has(id))elements.set(id,node(id));return elements.get(id);},addEventListener(a,fn){listeners.set('document:'+a,fn);}};
const saved=new Map();
const window={scrollY:0,scrollTo(x,y){this.scrollY=y;},utetDesktop:{
 loadAntiplagioStudents(p){return new Promise((resolve,reject)=>pending.push({p,resolve,reject}));},
 getAntiplagioRecords:async()=>[]
}};
const ctx=vm.createContext({window,document,Date,Math,Promise,console,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},setTimeout:()=>1,clearTimeout:()=>{}});
for(const name of ['data.js','institutional.js','records.js','records-ui.js','antiplagio.model.js','antiplagio.js','app.js'])
 vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const display=()=>document.getElementById('app-content').innerHTML;
const click=(action,id='')=>listeners.get('document:click')({target:{closest:()=>({dataset:{action,id}})}});
const tick=()=>new Promise(res=>setImmediate(res));
(async()=>{
 const p=window.UTET_DATA.periodos[0].id;
 click('rec-open','plagio-trabajo');
 assert.equal(pending.length,1);assert.equal(pending[0].p,p);
 assert.match(display(),/Cargando estudiantes/);
 pending[0].resolve({periodoId:p,students:[{estudianteId:p+'__0102030405',cedula:'0102030405',nombres:'Ana Pérez',carreraNombre:'ADMINISTRACIÓN ONLINE',modalidad:''}]});
 await tick();await tick();
 assert.match(display(),/Ana Pérez/);
 click('ap-add','0102030405');
 assert.match(display(),/PDF individuales/);
 assert.match(display(),/Descargar ZIP/);
 assert.doesNotMatch(display(),/Vista previa|Verificado/);
 assert.match(display(),/Simulación/);
 assert.match(display(),/En línea/);
 assert.equal(pending.length,1);
 console.log('OK UI Antiplagio: conexión automática, selección, simulación identificada y PDF/ZIP.');
})().catch(error=>{console.error(error);process.exitCode=1;});
