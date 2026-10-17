'use strict';
const FIELDS=['Datei','Strecke_km','Flaeche_km2','Kreis_ideal_km2','Kreis_Effizienz_Prozent','Quadrat_ideal_km2','Quadrat_Effizienz_Prozent','Start_Ziel_Abstand_m','Teilflaechen','Status'];
const R=6371008.8, rad=Math.PI/180;
const round=(x,n)=>Math.round((x+Number.EPSILON)*10**n)/10**n;
const distance=(a,b)=>{let p1=a[1]*rad,p2=b[1]*rad,dlat=p2-p1,dl=(b[0]-a[0])*rad;let q=Math.sin(dlat/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)))};
function readGpx(xml){let doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('INVALID_XML');let all=Array.from(doc.getElementsByTagName('*'));const named=(parent,name)=>Array.from(parent.getElementsByTagName('*')).filter(e=>e.localName===name);let segments=all.filter(e=>e.localName==='trkseg').map(e=>named(e,'trkpt').map(p=>[Number(p.getAttribute('lon')),Number(p.getAttribute('lat'))])).filter(a=>a.length>1);if(!segments.length)segments=all.filter(e=>e.localName==='rte').map(e=>named(e,'rtept').map(p=>[Number(p.getAttribute('lon')),Number(p.getAttribute('lat'))])).filter(a=>a.length>1);if(!segments.length)throw Error('NO_POINTS');if(segments.some(s=>s.some(p=>p.some(x=>!Number.isFinite(x))||Math.abs(p[1])>90||Math.abs(p[0])>180)))throw Error('INVALID_COORDS');return segments;}
function cross(a,b){return a[0]*b[1]-a[1]*b[0]}
function sub(a,b){return [a[0]-b[0],a[1]-b[1]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]}
function facesArea(xy){
 const segs=[];for(let i=0;i<xy.length-1;i++){let a=xy[i],b=xy[i+1];if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-7)segs.push({a,b,ts:[0,1]})}
 if(segs.length>6000)throw Error('TOO_MANY_POINTS');
 const eps=1e-8;
 for(let i=0;i<segs.length;i++){let s=segs[i],r=sub(s.b,s.a),rr=dot(r,r);for(let j=i+1;j<segs.length;j++){let t=segs[j],v=sub(t.b,t.a),vv=dot(v,v),w=sub(t.a,s.a),den=cross(r,v);if(Math.abs(den)>eps){let u=cross(w,v)/den,z=cross(w,r)/den;if(u>=-eps&&u<=1+eps&&z>=-eps&&z<=1+eps){s.ts.push(Math.max(0,Math.min(1,u)));t.ts.push(Math.max(0,Math.min(1,z)))}}else if(Math.abs(cross(w,r))<eps*Math.sqrt(rr)){for(let p of [t.a,t.b]){let u=dot(sub(p,s.a),r)/rr;if(u>=-eps&&u<=1+eps)s.ts.push(Math.max(0,Math.min(1,u)))}for(let p of [s.a,s.b]){let u=dot(sub(p,t.a),v)/vv;if(u>=-eps&&u<=1+eps)t.ts.push(Math.max(0,Math.min(1,u)))}}}}
 const verts=[],ids=new Map(),edges=new Set();function vertex(p){let key=p.map(x=>Math.round(x*1e6)).join(',');if(!ids.has(key)){ids.set(key,verts.length);verts.push(p)}return ids.get(key)}
 for(let s of segs){let d=sub(s.b,s.a);s.ts.sort((a,b)=>a-b);for(let k=1;k<s.ts.length;k++){let t0=s.ts[k-1],t1=s.ts[k];if(t1-t0<1e-9)continue;let a=vertex([s.a[0]+d[0]*t0,s.a[1]+d[1]*t0]),b=vertex([s.a[0]+d[0]*t1,s.a[1]+d[1]*t1]);if(a!==b)edges.add([Math.min(a,b),Math.max(a,b)].join(':'))}}
 let outgoing=verts.map(()=>[]),half=[];for(let key of edges){let [a,b]=key.split(':').map(Number),i=half.length;half.push({from:a,to:b,twin:i+1},{from:b,to:a,twin:i});outgoing[a].push(i);outgoing[b].push(i+1)}
 for(let i=0;i<outgoing.length;i++)outgoing[i].sort((a,b)=>{let p=verts[i];return Math.atan2(verts[half[a].to][1]-p[1],verts[half[a].to][0]-p[0])-Math.atan2(verts[half[b].to][1]-p[1],verts[half[b].to][0]-p[0])});
 let seen=new Set(),areas=[],rings=[];for(let i=0;i<half.length;i++){if(seen.has(i))continue;let h=i,ring=[],limit=0;while(!seen.has(h)&&limit++<=half.length){seen.add(h);let e=half[h];ring.push(verts[e.from]);let arr=outgoing[e.to],idx=arr.indexOf(e.twin);h=arr[(idx-1+arr.length)%arr.length]}if(h!==i||ring.length<3)continue;let a=0;for(let j=0;j<ring.length;j++)a+=cross(ring[j],ring[(j+1)%ring.length]);a/=2;if(a>0.00001){areas.push(a);rings.push(ring)}}return {area:areas.reduce((a,b)=>a+b,0),faces:areas.length,rings};
}
function evaluate(name,xml){let seg=readGpx(xml),points=seg.flat(),length=0;for(let s of seg)for(let i=1;i<s.length;i++)length+=distance(s[i-1],s[i]);let closure=distance(seg[0][0],seg[seg.length-1].at(-1));for(let i=1;i<seg.length;i++)if(distance(seg[i-1].at(-1),seg[i][0])>30)throw Error('DISCONNECTED');if(closure>30)throw Error('OPEN_ROUTE:'+Math.round(closure));
 let lon0=points.reduce((a,p)=>a+p[0],0)/points.length*rad,lat0=points.reduce((a,p)=>a+p[1],0)/points.length*rad;let xy=points.map(p=>{let lon=p[0]*rad,lat=p[1]*rad,d=lon-lon0,cosc=Math.sin(lat0)*Math.sin(lat)+Math.cos(lat0)*Math.cos(lat)*Math.cos(d),k=Math.sqrt(2/(1+cosc));return [R*k*Math.cos(lat)*Math.sin(d),R*k*(Math.cos(lat0)*Math.sin(lat)-Math.sin(lat0)*Math.cos(lat)*Math.cos(d))]});xy.push(xy[0]);let result=facesArea(xy),km=length/1000,area=result.area/1e6,circle=km*km/(4*Math.PI),square=km*km/16;return {Datei:name,Strecke_km:round(km,4),Flaeche_km2:round(area,4),Kreis_ideal_km2:round(circle,4),Kreis_Effizienz_Prozent:round(area/circle*100,2),Quadrat_ideal_km2:round(square,4),Quadrat_Effizienz_Prozent:round(area/square*100,2),Start_Ziel_Abstand_m:round(closure,2),Teilflaechen:result.faces,Status:result.faces?'OK':'Keine geschlossene Teilfläche erkannt',_xy:xy,_rings:result.rings};}

function renderRoute(row){
 const NS='http://www.w3.org/2000/svg';
 const make=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e};
 const wrapper=document.createElement('div');wrapper.className='route-map';
 const xy=row._xy,rings=row._rings||[];
 let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
 for(const [x,y] of xy){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}
 const w=640,h=390,pad=22,scale=Math.min((w-2*pad)/Math.max(maxx-minx,1),(h-2*pad)/Math.max(maxy-miny,1));
 const offsetX=(w-(maxx-minx)*scale)/2,offsetY=(h-(maxy-miny)*scale)/2;
 const point=p=>[(offsetX+(p[0]-minx)*scale),(h-offsetY-(p[1]-miny)*scale)];
 const path=pts=>pts.map((p,i)=>{const [x,y]=point(p);return (i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ');
 const svg=make('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':'GPX route and counted enclosed areas'});
 svg.style.width='100%';svg.style.height='auto';svg.style.display='block';
 svg.append(make('rect',{x:0,y:0,width:w,height:h,rx:14,fill:'#f3f8f3'}));
 for(let x=40;x<w;x+=40)svg.append(make('line',{x1:x,y1:0,x2:x,y2:h,stroke:'#e3eee4','stroke-width':1}));
 for(let y=30;y<h;y+=40)svg.append(make('line',{x1:0,y1:y,x2:w,y2:y,stroke:'#e3eee4','stroke-width':1}));
 for(const ring of rings)svg.append(make('path',{d:path(ring)+' Z',fill:'#82cfa0','fill-opacity':'0.55',stroke:'none'}));
 svg.append(make('path',{d:path(xy),fill:'none',stroke:'#176c51','stroke-width':3.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
 const [sx,sy]=point(xy[0]);svg.append(make('circle',{cx:sx,cy:sy,r:7,fill:'#fefefe',stroke:'#176c51','stroke-width':3}));
 const [ex,ey]=point(xy[xy.length-2]||xy[0]);svg.append(make('circle',{cx:ex,cy:ey,r:3,fill:'#176c51'}));
 wrapper.append(svg);
 const legend=document.createElement('div');legend.className='map-legend';
 legend.textContent=`● ${LANG[document.documentElement.lang].start}  ·  ━ ${LANG[document.documentElement.lang].route}  ·  ■ ${LANG[document.documentElement.lang].filled} (${row.Teilflaechen})`;
 wrapper.append(legend);
 return wrapper;
}


const LANG={
 de:{title:'GPX-Routen auswerten',intro:'Wähle eine oder mehrere GPX-Dateien. Die Daten bleiben auf deinem Gerät.',calc:'Routen berechnen',csv:'CSV speichern',results:'Ergebnisse',empty:'Noch keine Auswertung.',ready:'Bereit.',select:'Bitte GPX-Dateien auswählen.',processed:n=>`${n} Datei(en) verarbeitet. Alles bleibt lokal.`,distance:'Strecke',area:'Fläche',circle:'Kreis-Effizienz',square:'Quadrat-Effizienz',faces:'Teilflächen',start:'Start/Ziel',route:'Strecke',filled:'gezählte Fläche',update:'Neue Version verfügbar',updateAction:'Jetzt aktualisieren',updateNote:'Deine ausgewählten GPX-Dateien müssen danach gegebenenfalls erneut geöffnet werden.',upToDate:'Aktuelle Version',footer:'Lokale Berechnung · Die eingefärbten Teilflächen entsprechen der berechneten Fläche. Bei komplizierten GPS-Spuren die Ergebnisse mit Windows vergleichen.',errors:{INVALID_XML:'Ungültige GPX/XML-Datei',NO_POINTS:'Keine Track- oder Routenpunkte gefunden',INVALID_COORDS:'Ungültige GPS-Koordinaten',DISCONNECTED:'Getrennte Track-Segmente: Fläche nicht zuverlässig',TOO_MANY_POINTS:'Zu viele GPX-Punkte für diese Version',OPEN_ROUTE:'Offene Route (Start–Ziel: {n} m)'},error:'FEHLER',noFaces:'Keine geschlossene Teilfläche erkannt'},
 en:{title:'Analyze GPX routes',intro:'Select one or more GPX files. Your data stays on your device.',calc:'Analyze routes',csv:'Save CSV',results:'Results',empty:'No results yet.',ready:'Ready.',select:'Please select GPX files.',processed:n=>`${n} file(s) processed. Everything stays on your device.`,distance:'Distance',area:'Area',circle:'Circle efficiency',square:'Square efficiency',faces:'Enclosed regions',start:'Start/finish',route:'Route',filled:'counted area',update:'New version available',updateAction:'Update now',updateNote:'You may need to select your GPX files again after updating.',upToDate:'Current version',footer:'Local calculations · Highlighted regions are the areas counted by the algorithm. Compare complicated GPS tracks with the Windows version.',errors:{INVALID_XML:'Invalid GPX/XML file',NO_POINTS:'No track or route points found',INVALID_COORDS:'Invalid GPS coordinates',DISCONNECTED:'Disconnected track segments: area is unreliable',TOO_MANY_POINTS:'Too many GPX points for this version',OPEN_ROUTE:'Open route (start–finish: {n} m)'},error:'ERROR',noFaces:'No enclosed region detected'}
};
function translateError(message,lang){const t=LANG[lang],parts=String(message).split(':');return (t.errors[parts[0]]||message).replace('{n}',parts[1]||'');}
if(typeof module!=='undefined')module.exports={evaluate,facesArea,translateError};
if(typeof document!=='undefined'){
 const el=id=>document.getElementById(id);
 let language=localStorage.getItem('intvl-language')==='en'?'en':'de',rows=[],busy=false;
 const t=()=>LANG[language],fmt=(x,n)=>Number(x).toLocaleString(language==='de'?'de-DE':'en-GB',{minimumFractionDigits:n,maximumFractionDigits:n});
 const render=()=>{
  el('language').checked=language==='en';document.documentElement.lang=language;
  for(const [id,key] of Object.entries({heading:'title',intro:'intro',calc:'calc',export:'csv',resultHeading:'results',footerText:'footer'}))el(id).textContent=t()[key];
  el('results').dataset.empty=t().empty;
  if(!busy)el('status').textContent=rows.length?t().processed(rows.length):t().ready;
  el('updateTitle').textContent=t().update;el('updateButton').textContent=t().updateAction;el('updateNote').textContent=t().updateNote;
  const results=el('results');results.replaceChildren();
  for(const row of rows){const div=document.createElement('div');div.className='route';const title=document.createElement('h3');title.textContent=row.Datei;div.append(title);
   if(row.Strecke_km!==undefined){try{div.append(renderRoute(row))}catch(e){const warning=document.createElement('p');warning.className='small error';warning.textContent='Route display: '+e.message;div.append(warning)}const stats=document.createElement('div');stats.className='stats';for(const [label,value] of [[t().distance,fmt(row.Strecke_km,2)+' km'],[t().area,fmt(row.Flaeche_km2,4)+' km²'],[t().circle,fmt(row.Kreis_Effizienz_Prozent,2)+' %'],[t().square,fmt(row.Quadrat_Effizienz_Prozent,2)+' %']]){const box=document.createElement('div');box.className='stat',small=document.createElement('span'),strong=document.createElement('strong');small.textContent=label;strong.textContent=value;box.append(small,strong);stats.append(box)}div.append(stats)}
   const info=document.createElement('p');info.className=row.Strecke_km===undefined?'small error':'small';info.textContent=row.Strecke_km===undefined?t().error+': '+translateError(row._error,language):(row.Teilflaechen?'OK':t().noFaces)+' · '+t().faces+': '+row.Teilflaechen;div.append(info);results.append(div);
  }
 };
 el('language').addEventListener('change',e=>{language=e.target.checked?'en':'de';localStorage.setItem('intvl-language',language);render()});
 el('calc').onclick=async()=>{
  const files=Array.from(el('files').files);
  if(!files.length){el('status').textContent=t().select;return}
  rows=[];busy=true;el('calc').disabled=true;el('export').disabled=true;
  el('results').replaceChildren();
  el('status').textContent=language==='de'?'Berechnung läuft …':'Calculating …';
  try{
   for(const file of files){
    try{rows.push(evaluate(file.name,await file.text()))}
    catch(e){rows.push({Datei:file.name,_error:e.message||String(e)})}
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }catch(e){el('status').textContent=(language==='de'?'Unerwarteter Fehler: ':'Unexpected error: ')+(e.message||String(e))}
  finally{
   busy=false;el('calc').disabled=false;el('export').disabled=rows.length===0;
   try{render()}catch(e){
    console.error('Rendering failed',e);
    el('status').textContent=(language==='de'?'Anzeigefehler: ':'Display error: ')+(e.message||String(e));
   }
  }
 };
 el('export').onclick=()=>{const text='\ufeff'+FIELDS.join(';')+'\r\n'+rows.map(row=>FIELDS.map(k=>{let v=row[k]??(k==='Status'&&row._error?translateError(row._error,language):'');if(typeof v==='number')v=String(v).replace('.',',');if(k==='Status'&&row.Strecke_km===undefined)v=t().error+': '+translateError(row._error,language);v=String(v);return '"'+v.replaceAll('"','""')+'"'}).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='intvl_ergebnisse.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 let waitingWorker=null;
 const showUpdate=worker=>{waitingWorker=worker;el('updateBox').hidden=false};
 el('updateButton').onclick=()=>{if(waitingWorker)waitingWorker.postMessage({type:'SKIP_WAITING'})};
 if('serviceWorker' in navigator&&location.protocol==='https:'){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window.__intvlReloading){window.__intvlReloading=true;location.reload()}});
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
   if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg.waiting);
   reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate(worker)})});
   reg.update().catch(()=>{});
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});
  }).catch(()=>{});
 }
 render();
}
