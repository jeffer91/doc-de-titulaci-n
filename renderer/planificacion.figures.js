'use strict';

(function (root) {
  const model=root.UTET_PLANIFICACION;
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const width=720,ink='#15334f',muted='#4e6178',blue='#2a618f',gold='#a66618',border='#dce5ee';
  const clip=(text,length)=>text.length>length?text.slice(0,length-1)+'…':text;
  const label=(x,y,text,{fill=ink,size=14,weight=400,anchor='start'}={})=>
    `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${E(text)}</text>`;
  const rect=(x,y,w,h,fill,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
  const line=(x1,y1,x2,y2,stroke=border)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}"/>`;
  const chunks=(rows,size)=>Array.from({length:Math.ceil(rows.length/size)},(_,i)=>rows.slice(i*size,(i+1)*size));
  function svg(title,height,markup){
    return `<svg class="inst-plan-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${E(title)}" xmlns="http://www.w3.org/2000/svg"><title>${E(title)}</title>${markup}</svg>`;
  }
  function gantt(summary){
    const x=275,endX=703,rowHeight=38,top=44,days=summary.end-summary.start+1;
    const position=offset=>x+offset*(endX-x)/days;
    const tickCount=Math.min(5,days);
    const ticks=Array.from({length:tickCount},(_,index)=>
      tickCount===1?0:Math.round(index*(days-1)/(tickCount-1)));
    const yearChanged=new Date(summary.start*86400000).getUTCFullYear()!==new Date(summary.end*86400000).getUTCFullYear();
    const phases=new Map(summary.phases.map((phase,i)=>[phase,i]));
    const palettes=[blue,'#526998','#287b76',gold];
    return chunks(summary.dated,10).map(rows=>{
      const bottom=top+rows.length*rowHeight;
      const background=rows.map((_,index)=>rect(1,top+index*rowHeight,width-2,rowHeight,index%2?'#f1f5f9':'#ffffff')).join('');
      const timeline=ticks.map((tick,index)=>{
        const px=position(tick);
        const anchor=index===0?'start':index===ticks.length-1?'end':'middle';
        return line(px,top,px,bottom)+label(px,29,model.dateLabel(summary.start+tick,yearChanged),{size:13,fill:muted,anchor});
      }).join('');
      const schedule=rows.map((row,index)=>{
        const y=top+index*rowHeight;
        const rowTitle=row.actividad||row.etapa||'Actividad sin descripción';
        const group=[row.carrera,row.grupo].filter(Boolean).join(' · ');
        const start=position(row.start-summary.start),finish=position(row.end-summary.start+1);
        const color=palettes[(phases.get(row.etapa)??0)%palettes.length];
        return label(10,y+16,clip(rowTitle,37),{size:13,weight:600})+
          label(10,y+32,clip(group,42),{size:11,fill:muted})+
          rect(start,y+11,Math.max(0.5,finish-start),15,color,3);
      }).join('');
      return svg(model.figureLabels.gantt,bottom+4,
        rect(1,1,width-2,top-1,'#eaf0f6',6)+label(10,29,'Actividad / carrera o grupo',{size:13,weight:700})+
        background+timeline+line(x,top,x,bottom)+schedule+line(1,bottom,width-1,bottom));
    });
  }
  function flow(summary){
    return chunks(summary.steps,8).map(steps=>{
      const boxes=steps.map((step,index)=>{
        const y=index*48+7;
        const arrow=index===steps.length-1?'':line(360,y+33,360,y+46,blue)+
          `<path d="M 356 ${y+42} L 360 ${y+46} L 364 ${y+42}" fill="none" stroke="${blue}"/>`;
        return rect(78,y,564,34,index%2?'#eaf0f6':'#e6edf8',8)+rect(90,y+5,45,24,blue,5)+
          label(112,y+22,step.order,{fill:'#fff',anchor:'middle',size:13,weight:700})+
          label(148,y+22,clip(step.labels.join(' / '),64),{size:14,weight:600})+arrow;
      }).join('');
      return svg(model.figureLabels.flujo,steps.length*48+2,boxes);
    });
  }
  function sites(summary){
    const max=Math.max(...summary.sites.map(site=>site.activities));
    return chunks(summary.sites,8).map(sites=>{
      const rows=sites.map((site,index)=>{
        const y=index*48+4;
        const careers=[...site.careers].join(' · ');
        return rect(1,y,width-2,44,index%2?'#f1f5f9':'#ffffff',5)+
          label(12,y+17,clip(site.label,36),{weight:600})+
          label(12,y+33,clip(careers,44),{size:11,fill:muted})+
          rect(305,y+12,330,18,'#e5edf5',4)+rect(305,y+12,330*site.activities/max,18,blue,4)+
          label(700,y+27,site.activities,{size:15,anchor:'end',weight:700});
      }).join('');
      return svg(model.figureLabels.sedes,sites.length*48+5,rows);
    });
  }

  const renderers={gantt,flujo:flow,sedes:sites};
  function render(plan,summary){
    const options=model.available(summary);
    const selected=[...new Set([plan.figures?.principal,plan.figures?.complementaria])].filter(type=>options.includes(type));
    return selected.flatMap((type,index)=>{
      const pages=renderers[type](summary);
      return pages.map((content,part)=>{
        const heading='Figura '+(index+1)+' · '+model.figureLabels[type];
        const continuation=pages.length>1?`<p class="inst-plan-continuation">Parte ${part+1} de ${pages.length}</p>`:'';
        const caption=part===0&&plan.captions?.[type]?`<figcaption>${E(plan.captions[type])}</figcaption>`:'';
        return `<figure class="inst-plan-figure" data-plan-figure="${type}"><h3>${E(heading)}</h3>${continuation}${content}${caption}</figure>`;
      });
    });
  }
  root.UTET_PLANIFICACION_FIGURES=Object.freeze({render});
})(window);
