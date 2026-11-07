'use strict';
/* Prueba de navegación PRO-164: lectura automática, cambio de período sin
   perder la pantalla, filtrado en vivo, actualización y permisos denegados. */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const root=path.join(__dirname,'..','renderer');
const elements=new Map(),listeners=new Map(),saved=new Map(),queries=[];
let allowRefresh=false;
const element=id=>({
  id,value:'',innerHTML:'',textContent:'',
  classList:{add(){},remove(){}},
  addEventListener(name,callback){listeners.set(id+':'+name,callback);}
});
const document={
  getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},
  addEventListener(name,callback){listeners.set('document:'+name,callback);}
};
const window={
  scrollY:0,scrollTo(x,y){this.scrollY=y;},
  utetDesktop:{
    loadAntiplagioStudents(periodoId){
      let resolve,reject;
      const promise=new Promise((a,b)=>{resolve=a;reject=b;});
      queries.push({periodoId,resolve,reject});
      return promise;
    },
    previewMemoNumber(date){
      return Promise.resolve({code:'01 MEM-ITSQMET-UTET-'+date,number:1,isProvisional:true});
    }
  }
};
const context=vm.createContext({
  window,document,Math,Date,console,Promise,
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
  confirm:()=>allowRefresh,setTimeout:()=>1,clearTimeout:()=>{}
});
for(const file of ['data.js','institutional.js','records.js','records-ui.js','antiplagio.model.js','antiplagio.js','app.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const contentNow=()=>document.getElementById('app-content').innerHTML;
const click=(action,id='')=>listeners.get('document:click')({target:{closest:()=>({dataset:{action,id}})}});
const changePeriod=p=>listeners.get('period-select:change')({target:{value:p}});
const input=(id,value,event='input')=>listeners.get('app-content:'+event)({target:{id,value,dataset:{}}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const periods=window.UTET_DATA.periodos;
const rows=(p,items)=>({periodoId:p,students:items.map(([id,name,career])=>({
  estudianteId:p+'__'+id,cedula:id,periodoId:p,
  nombres:name,carreraId:'TEST',carreraNombre:career,retirado:false
}))});
(async()=>{
  assert.ok(periods.length>=2,'se requieren al menos dos períodos en el catálogo');
  const [one,two]=periods.map(x=>x.id);
  click('rec-open','plagio-trabajo');
  assert.equal(queries.length,1,'Antiplagio inicia lectura automáticamente al abrir');
  assert.equal(queries[0].periodoId,one);
  assert.match(contentNow(),/Cargando estudiantes/);
  assert.doesNotMatch(contentNow(),/Iniciar sesión|Contraseña|ap-login|ap-load|Consultar estudiantes/);
  assert.equal((contentNow().match(/class="ap-panel ap-panel-/g)||[]).length,2,'interfaz de dos paneles');
  // Cambio mientras la primera consulta sigue pendiente.
  changePeriod(two);
  assert.equal(queries.length,2,'cambio de período genera nueva consulta');
  assert.ok(contentNow().includes('Antiplagio'),'permanece en el módulo');
  assert.equal(queries[1].periodoId,two);
  queries[0].resolve(rows(one,[['0101010101','Estudiante anterior','ADMINISTRACIÓN']]));
  await tick();
  assert.doesNotMatch(contentNow(),/Estudiante anterior/,'resultado tardío se descarta');
  queries[1].resolve(rows(two,[
    ['0202020202','Ana Rojas','CONTABILIDAD'],
    ['0303030303','Beto López','ENFERMERÍA'],
    ['0404040404','Andrea Pérez','ENFERMERÍA']
  ]));
  await tick();
  assert.match(contentNow(),/Ana Rojas/);
  assert.match(contentNow(),/Beto López/);
  assert.match(contentNow(),/Firebase listo/);
  assert.doesNotMatch(contentNow(),/ap-login|ap-logout|type="password"/);
  // Filtrado al escribir, sin re-render completo ni pérdida de foco.
  window.scrollY=112;
  input('ap-query','Ana');
  assert.match(document.getElementById('ap-search-body').innerHTML,/Ana Rojas/);
  assert.doesNotMatch(document.getElementById('ap-search-body').innerHTML,/Beto López/);
  assert.equal(window.scrollY,112,'la búsqueda no mueve la pantalla ni reemplaza el input');
  input('ap-query','');
  input('ap-career','ENFERMERÍA','change');
  assert.match(document.getElementById('ap-search-body').innerHTML,/Beto López/);
  assert.doesNotMatch(document.getElementById('ap-search-body').innerHTML,/Ana Rojas/);
  input('ap-career','','change');
  click('ap-add','0202020202');
  assert.match(contentNow(),/1 seleccionados/);
  assert.equal(queries.length,2,'seleccionar no vuelve a consultar Firebase');
  // Cancelar actualizar conserva datos.
  click('ap-refresh');
  assert.equal(queries.length,2,'cancelar actualización no descarta resultados');
  assert.match(contentNow(),/Ana Rojas/);
  // Confirmar descarta la selección e inicia una consulta limpia.
  allowRefresh=true;
  click('ap-refresh');
  assert.equal(queries.length,3);
  assert.match(contentNow(),/0 seleccionados/);
  queries[2].reject(new Error('PERMISSION_DENIED'));
  await tick();
  assert.match(contentNow(),/Sin conexión/);
  assert.match(contentNow(),/PERMISSION_DENIED/);
  assert.doesNotMatch(contentNow(),/Ana Rojas/,'no se presentan datos obsoletos después de un error');
  const backend=fs.readFileSync(path.join(__dirname,'..','electron','firebase-read.js'),'utf8');
  assert.doesNotMatch(backend,/accounts:signInWithPassword|Authorization.*Bearer/,'lectura sin contraseña ni credenciales incrustadas');
  console.log('OK Antiplagio UI: carga automática, períodos, búsqueda en vivo, selección y errores.');
})().catch(error=>{console.error(error);process.exitCode=1;});
