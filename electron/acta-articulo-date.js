'use strict';
// Calendario de emisión basado en la política de Actas del sistema Requisitos.
// Calendarios confirmados: 2026 y 2027; otros años necesitan validación.
const OFFICIAL={
 2026:["2026-01-01","2026-01-02","2026-02-16","2026-02-17","2026-04-03","2026-05-01","2026-05-25","2026-08-10","2026-10-09","2026-11-02","2026-11-03","2026-12-25"],
 2027:["2027-01-01","2027-02-08","2027-02-09","2027-03-26","2027-04-30","2027-05-24","2027-08-09","2027-10-08","2027-11-01","2027-11-02","2027-12-25"]
};
const iso=d=>d.toISOString().slice(0,10);
function forPeriod(periodoId,extraHolidays=[]){
 const m=String(periodoId||'').match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);
 if(!m)throw Error('El período debe tener formato AAAA-MM__AAAA-MM.');
 const [sy,sm,y,month]=m.slice(1).map(Number);
 if(sm<1||sm>12||month<1||month>12||y*12+month<sy*12+sm||y*12+month>sy*12+sm+24)
  throw Error('Fechas del período fuera de rango.');
 const date=new Date(Date.UTC(y,month+2,0)),targetMonth=date.getUTCMonth(),official=OFFICIAL[date.getUTCFullYear()];
 const holidays=new Set([...(official||[]),...extraHolidays]);
 while(date.getUTCMonth()===targetMonth&&(date.getUTCDay()===0||date.getUTCDay()===6||holidays.has(iso(date)))){
  date.setUTCDate(date.getUTCDate()-1);
 }
 if(date.getUTCMonth()!==targetMonth)throw Error('No se encontró día laborable en el mes de emisión.');
 return {date:iso(date),month:iso(date).slice(0,7),calendarVerified:!!official,
  year:date.getUTCFullYear(),monthNumber:String(date.getUTCMonth()+1).padStart(2,'0'),
  documentCode:'AT-ITSQMET-UTET-'+iso(date).slice(0,7)};
}
function todayEcuador(now=new Date()){
 const items=new Intl.DateTimeFormat('en-US',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=k=>items.find(x=>x.type===k)?.value;
 return [get('year'),get('month'),get('day')].join('-');
}
function allowed(period,now=new Date()){
 const date=forPeriod(period);
 return {date:date.date,ready:date.calendarVerified&&todayEcuador(now)>=date.date,verified:date.calendarVerified};
}
module.exports={forPeriod,allowed,todayEcuador,OFFICIAL};
