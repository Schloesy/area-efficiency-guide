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
 let seen=new Set(),areas=[],rings=[];for(let i=0;i<half.length;i++){if(seen.has(i))continue;let h=i,ring=[],limit=0;while(!seen.has(h)&&limit++<=half.length){seen.add(h);let e=half[h];ring.push(verts[e.from]);let arr=outgoing[e.to],idx=arr.indexOf(e.twin);h=arr[(idx-1+arr.length)%arr.length]}if(h!==i||ring.length<3)continue;let a=0;for(let j=0;j<ring.length;j++)a+=cross(ring[j],ring[(j+1)%ring.length]);a/=2;if(a>0.00001){areas.push(a);rings.push(ring)}}return {area:areas.reduce((a,b)=>a+b,0),faces:areas.length,rings,faceAreas:areas};
}
function evaluate(name,xml){let seg=readGpx(xml),points=seg.flat(),length=0;for(let s of seg)for(let i=1;i<s.length;i++)length+=distance(s[i-1],s[i]);let closure=distance(seg[0][0],seg[seg.length-1].at(-1));for(let i=1;i<seg.length;i++)if(distance(seg[i-1].at(-1),seg[i][0])>30)throw Error('DISCONNECTED');if(closure>30)throw Error('OPEN_ROUTE:'+Math.round(closure));
 let lon0=points.reduce((a,p)=>a+p[0],0)/points.length*rad,lat0=points.reduce((a,p)=>a+p[1],0)/points.length*rad;let xy=points.map(p=>{let lon=p[0]*rad,lat=p[1]*rad,d=lon-lon0,cosc=Math.sin(lat0)*Math.sin(lat)+Math.cos(lat0)*Math.cos(lat)*Math.cos(d),k=Math.sqrt(2/(1+cosc));return [R*k*Math.cos(lat)*Math.sin(d),R*k*(Math.cos(lat0)*Math.sin(lat)-Math.sin(lat0)*Math.cos(lat)*Math.cos(d))]});xy.push(xy[0]);let result=facesArea(xy),km=length/1000,area=result.area/1e6,circle=km*km/(4*Math.PI),square=km*km/16;return {Datei:name,Strecke_km:round(km,4),Flaeche_km2:round(area,4),Kreis_ideal_km2:round(circle,4),Kreis_Effizienz_Prozent:round(area/circle*100,2),Quadrat_ideal_km2:round(square,4),Quadrat_Effizienz_Prozent:round(area/square*100,2),Start_Ziel_Abstand_m:round(closure,2),Teilflaechen:result.faces,_faceAreas:result.faceAreas,Status:result.faces?'OK':'Keine geschlossene Teilfläche erkannt',_xy:xy,_rings:result.rings,_geo:points,_projection:[lon0,lat0]};}

function faceLabel(i){let result='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;}
function signedDoubleArea(a,b,c){return cross(sub(b,a),sub(c,a));}
function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;}
function interiorLabelPoint(ring){
 // Centroid of polygon, then centroids of consecutive triangles, then an interior edge midpoint.
 let a2=0,cx=0,cy=0;
 for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],v=cross(p,q);a2+=v;cx+=(p[0]+q[0])*v;cy+=(p[1]+q[1])*v;}
 if(Math.abs(a2)>1e-8){const c=[cx/(3*a2),cy/(3*a2)];if(pointInPolygon(c,ring))return c;}
 for(let i=1;i<ring.length-1;i++){const a=ring[0],b=ring[i],c=ring[i+1];const p=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];if(pointInPolygon(p,ring))return p;}
 return ring[0];
}
function renderFaceDetails(row,lang,fmt,unit,onUnitChange){
 const section=document.createElement('section');section.className='face-details';
 const head=document.createElement('div');head.className='face-header';
 const heading=document.createElement('h4');heading.textContent=lang.faceBreakdown;head.append(heading);
 const control=document.createElement('div');control.className='unit-control';control.setAttribute('role','group');control.setAttribute('aria-label',lang.areaUnit);
 for(const [value,label] of [['km2','km²'],['m2','m²']]){
  const button=document.createElement('button');button.type='button';button.className='unit-button'+(unit===value?' active':'');button.textContent=label;button.setAttribute('aria-pressed',String(unit===value));
  button.dataset.unit=value;button.addEventListener('click',()=>onUnitChange(value));
  control.append(button);
 }
 head.append(control);section.append(head);
 const table=document.createElement('table');table.className='face-table';const tbody=document.createElement('tbody');
 (row._faceAreas||[]).forEach((area,i)=>{
  const tr=document.createElement('tr'),name=document.createElement('th'),value=document.createElement('td');
  name.textContent=lang.face+' '+faceLabel(i);value.dataset.areaM2=String(area);tr.append(name,value);tbody.append(tr);
 });
 const tr=document.createElement('tr'),name=document.createElement('th'),value=document.createElement('td');
 name.textContent=lang.faceSum;value.dataset.areaM2=String((row._faceAreas||[]).reduce((a,b)=>a+b,0));tr.append(name,value);tbody.append(tr);
 table.append(tbody);section.append(table);
 const note=document.createElement('p');note.className='small';note.textContent=lang.faceNote;section.append(note);
 updateFaceUnits(section,unit,fmt);return section;
}
function updateFaceUnits(section,unit,fmt){
 for(const cell of section.querySelectorAll('[data-area-m2]')){
  const area=Number(cell.dataset.areaM2);cell.textContent=unit==='km2'?fmt(area/1e6,2)+' km²':fmt(area,2)+' m²';
 }
 for(const button of section.querySelectorAll('.unit-button')){
  const selected=button.dataset.unit===unit;
  button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
 }
}

function renderRoute(row){
 const NS='http://www.w3.org/2000/svg';
 const make=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e};
 const wrapper=document.createElement('div');wrapper.className='route-map';
 const xy=row._xy,rings=row._rings||[],faceAreas=row._faceAreas||[];
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
 for(let i=0;i<rings.length;i++){
  const ring=rings[i];svg.append(make('path',{d:path(ring)+' Z',fill:i%2?'#8fc9e4':'#82cfa0','fill-opacity':'0.58',stroke:'none'}));
  // An interior point, chosen from a triangle fan, avoids placing labels outside concave polygons.
  const labelPoint=interiorLabelPoint(ring);
  const [lx,ly]=point(labelPoint);
  const disk=make('circle',{cx:lx,cy:ly,r:12,fill:'#ffffff','fill-opacity':'0.92',stroke:'#176c51','stroke-width':1.4});
  const text=make('text',{x:lx,y:ly+4,'text-anchor':'middle','font-size':12,'font-weight':700,fill:'#176c51'});
  text.textContent=faceLabel(i);svg.append(disk,text);
 }
 svg.append(make('path',{d:path(xy),fill:'none',stroke:'#176c51','stroke-width':3.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
 const [sx,sy]=point(xy[0]);svg.append(make('circle',{cx:sx,cy:sy,r:7,fill:'#fefefe',stroke:'#176c51','stroke-width':3}));
 const [ex,ey]=point(xy[xy.length-2]||xy[0]);svg.append(make('circle',{cx:ex,cy:ey,r:3,fill:'#176c51'}));
 wrapper.append(svg);
 const legend=document.createElement('div');legend.className='map-legend';
 legend.textContent=`● ${LANG[document.documentElement.lang].start}  ·  ━ ${LANG[document.documentElement.lang].route}  ·  ■ ${LANG[document.documentElement.lang].filled} (${row.Teilflaechen})`;
 wrapper.append(legend);
 return wrapper;
}



// Native, dependency-free slippy-map renderer. No route coordinates are sent to the tile server.
// Shared map state must be visible to the OSM renderer as well as the UI.
let comparisonMapState=null;
let comparisonVisibilityMenuOpen=false;
function createOsmMap(row,language,comparison=null){
 const lang=LANG[language], host=document.createElement('div');host.className='osm-map';
 const viewport=document.createElement('div');viewport.className='osm-viewport';viewport.setAttribute('aria-label',lang.osmMap);
 const tiles=document.createElement('div');tiles.className='osm-tiles';
 const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('osm-overlay');
 viewport.append(tiles,overlay);host.append(viewport);
 const controls=document.createElement('div');controls.className='osm-controls';
 const addButton=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='osm-control';b.textContent=label;b.title=label;b.setAttribute('aria-label',label);b.addEventListener('click',action);controls.append(b);return b};
 const attribution=document.createElement('div');attribution.className='osm-attribution';
 const osmLink=document.createElement('a');osmLink.href='https://www.openstreetmap.org/copyright';osmLink.target='_blank';osmLink.rel='noopener noreferrer';osmLink.textContent='© OpenStreetMap contributors';attribution.append(osmLink);host.append(controls,attribution);
 const TILE=256,MAX=19,MIN=2;
 const merc=([lon,lat])=>{const y=Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180;return [(lon+180)/360,(1-Math.log(Math.tan(y)+1/Math.cos(y))/Math.PI)/2]};
 const geo=row._geo, coords=(comparison?comparison.routes.filter(r=>comparison.visible.has(r.Datei)).flatMap(r=>r._geo):geo).map(merc);let zoom=12,cx=0,cy=0,dead=false,request=0;
 const saved=comparison&&comparisonMapState&&comparisonMapState.kind==='osm'?comparisonMapState:null;
 const size=()=>[Math.max(1,viewport.clientWidth),Math.max(1,viewport.clientHeight)];
 const scale=()=>TILE*2**zoom;
 const project=p=>[(p[0]-cx)*scale()+size()[0]/2,(p[1]-cy)*scale()+size()[1]/2];
 const clamp=()=>{const half=size()[1]/2/scale();cy=Math.max(half,Math.min(1-half,cy));cx=((cx%1)+1)%1};
 function fit(){const visibleCoords=comparison?comparison.routes.filter(r=>comparison.visible.has(r.Datei)).flatMap(r=>r._geo).map(merc):coords;const xs=visibleCoords.map(p=>p[0]),ys=visibleCoords.map(p=>p[1]);const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);cx=(minx+maxx)/2;cy=(miny+maxy)/2;const [w,h]=size();zoom=Math.max(MIN,Math.min(17,Math.floor(Math.log2(Math.min((w-52)/(Math.max(maxx-minx,1e-8)*TILE),(h-52)/(Math.max(maxy-miny,1e-8)*TILE))))));clamp();draw()}
 function draw(){if(dead)return;const [w,h]=size(),s=scale();overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);overlay.replaceChildren();const frag=document.createDocumentFragment();const left=cx*s-w/2,top=cy*s-h/2,firstX=Math.floor(left/TILE),lastX=Math.floor((left+w)/TILE),firstY=Math.floor(top/TILE),lastY=Math.floor((top+h)/TILE),n=2**zoom;
 for(let x=firstX;x<=lastX;x++)for(let y=firstY;y<=lastY;y++){if(y<0||y>=n)continue;const img=document.createElement('img');img.alt='';img.draggable=false;img.loading='lazy';img.decoding='async';img.style.left=(x*TILE-left)+'px';img.style.top=(y*TILE-top)+'px';img.src=`https://tile.openstreetmap.org/${zoom}/${((x%n)+n)%n}/${y}.png`;frag.append(img)}tiles.replaceChildren(frag);
 const NS='http://www.w3.org/2000/svg',node=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e};
 const inverse=p=>{const [lon0,lat0]=row._projection,xx=p[0]/R,yy=p[1]/R,rho=Math.hypot(xx,yy);if(rho<1e-12)return [lon0*180/Math.PI,lat0*180/Math.PI];const c=2*Math.asin(Math.min(1,rho/2)),lat=Math.asin(Math.cos(c)*Math.sin(lat0)+yy*Math.sin(c)*Math.cos(lat0)/rho),lon=lon0+Math.atan2(xx*Math.sin(c),rho*Math.cos(lat0)*Math.cos(c)-yy*Math.sin(lat0)*Math.sin(c));return [lon*180/Math.PI,lat*180/Math.PI]};
 const pt=p=>project(merc(inverse(p)));const d=points=>points.map((p,i)=>{const q=pt(p);return (i?'L':'M')+q[0].toFixed(2)+' '+q[1].toFixed(2)}).join(' ');
 if(!comparison)for(let i=0;i<row._rings.length;i++){const ring=row._rings[i];overlay.append(node('path',{d:d(ring)+' Z',fill:i%2?'#8fc9e4':'#82cfa0','fill-opacity':'.34',stroke:'none'}));const [x,y]=pt(interiorLabelPoint(ring));overlay.append(node('circle',{cx:x,cy:y,r:12,fill:'#fff','fill-opacity':'.9',stroke:'#176c51','stroke-width':1.5}));const text=node('text',{x,y:y+4,'text-anchor':'middle','font-size':12,'font-weight':700,fill:'#176c51'});text.textContent=faceLabel(i);overlay.append(text)}
 if(comparison){for(const r of comparison.drawOrder){const i=comparison.routes.indexOf(r);
 if(!comparison.visible.has(r.Datei))continue;
 const xy=r._geo.map(p=>project(merc(p)));const path=xy.map((p,j)=>(j?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
 const color=COMPARISON_COLORS[i%COMPARISON_COLORS.length],selected=comparison.highlight===r.Datei;
 overlay.append(node('path',{d:path,fill:'none',stroke:'#fff','stroke-width':selected?7:5,'stroke-opacity':selected?1:.65,'stroke-linejoin':'round','stroke-linecap':'round'}));
 overlay.append(node('path',{d:path,fill:'none',stroke:color,'stroke-width':selected?4.5:2.8,'stroke-opacity':comparison.highlight&&!selected?.35:1,'stroke-linejoin':'round','stroke-linecap':'round'}));
 }}else{overlay.append(node('path',{d:d(row._xy),fill:'none',stroke:'#fff','stroke-width':5.5,'stroke-linejoin':'round','stroke-linecap':'round'}));overlay.append(node('path',{d:d(row._xy),fill:'none',stroke:'#176c51','stroke-width':3.3,'stroke-linejoin':'round','stroke-linecap':'round'}));const [sx,sy]=pt(row._xy[0]);overlay.append(node('circle',{cx:sx,cy:sy,r:6,fill:'#fff',stroke:'#176c51','stroke-width':3}));}
 }
 function zoomAt(next,x,y){const old=scale(),[w,h]=size();const anchor=[cx+(x-w/2)/old,cy+(y-h/2)/old];zoom=Math.max(MIN,Math.min(MAX,next));const s=scale();cx=anchor[0]-(x-w/2)/s;cy=anchor[1]-(y-h/2)/s;clamp();draw()}
 const fitButton=addButton('⛶',fit);fitButton.title=lang.fitRoute;fitButton.setAttribute('aria-label',lang.fitRoute);
 viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoomAt(zoom+(e.deltaY<0?1:-1),e.clientX-r.left,e.clientY-r.top)},{passive:false});
 const pointers=new Map();let lastPinch=null;
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);lastPinch=null});
 viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){cx-=(e.clientX-previous[0])/scale();cy-=(e.clientY-previous[1])/scale();clamp();draw()}else if(pointers.size===2){const a=[...pointers.values()],dist=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(lastPinch!==null&&dist>lastPinch*1.5){zoomAt(zoom+1,size()[0]/2,size()[1]/2);lastPinch=dist}else if(lastPinch!==null&&dist<lastPinch/1.5){zoomAt(zoom-1,size()[0]/2,size()[1]/2);lastPinch=dist}else if(lastPinch===null)lastPinch=dist}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,e=>{pointers.delete(e.pointerId);lastPinch=null});
 let fitted=false;const observer=new ResizeObserver(()=>{if(dead)return;if(viewport.clientWidth>1&&viewport.clientHeight>1){if(!fitted){fitted=true;if(saved){zoom=saved.zoom;cx=saved.cx;cy=saved.cy;clamp();draw()}else fit()}else draw()}});observer.observe(viewport);
 return {element:host,getState(){return {kind:'osm',zoom,cx,cy}},destroy(){dead=true;observer.disconnect();tiles.replaceChildren();overlay.replaceChildren()}};
}

const COMPARISON_COLORS=['#2563eb','#ea580c','#16a34a','#a21caf','#dc2626','#0891b2','#b45309','#4f46e5'];
const LANG={
 de:{compareButton:'Routen vergleichen',compareClose:'Vergleich schließen',compareSort:'Sortieren nach',compareEfficiency:'Kreis-Effizienz',compareAreaSort:'Gesamtfläche',compareTitle:'Routenvergleich',compareInfo:'Jede GPX-Datei wird einzeln berechnet. Vergleich auch ohne Internet möglich.',compareEmpty:'Mindestens zwei erfolgreich berechnete GPX-Routen erforderlich.',compareCircle:'Kreis',compareSquare:'Quadrat',compareRank:'Rang',compareRoute:'Route',compareShow:'Anzeigen',compareFocus:'Hervorheben',compareAll:'Alle Routen gleich hervorheben',compareMap:'Vergleichskarte',compareOffline:'Ohne OSM-Karte werden alle Routen weiterhin lokal verglichen. Aktiviere OSM für die gemeinsame Kartenansicht.',compareWinner:'Beste Effizienz',compareDetails:'Routendetails anzeigen',compareHideDetails:'Details schließen',compareFullName:'Dateiname',compareSquareValue:'Quadrat-Effizienz',compareFacesValue:'Teilflächen',osmMap:'OpenStreetMap-Karte',osmOn:'OSM-Karte anzeigen (Internet)',osmOff:'OSM-Karte ausschalten',fitRoute:'Gesamte Route anzeigen',osmInfo:'Beim Einschalten werden Kartenkacheln für den sichtbaren Bereich von OpenStreetMap geladen. GPX-Daten bleiben lokal.',chooseFiles:'Dateien auswählen',noFiles:'Keine Dateien ausgewählt',selectedFiles:n=>`${n} Datei(en) ausgewählt`,title:'GPX-Routen auswerten',intro:'Wähle eine oder mehrere GPX-Dateien. Die Daten bleiben auf deinem Gerät.',calc:'Routen berechnen',csv:'CSV speichern',results:'Ergebnisse',empty:'Noch keine Auswertung.',ready:'Bereit.',select:'Bitte GPX-Dateien auswählen.',processed:n=>`${n} Datei(en) verarbeitet. Alles bleibt lokal.`,distance:'Strecke',area:'Fläche',circle:'Kreis-Effizienz',square:'Quadrat-Effizienz',faces:'Teilflächen',faceBreakdown:'Einzelne Teilflächen',areaUnit:'Flächeneinheit',face:'Teilfläche',faceSum:'Summe der Teilflächen',faceNote:'Die Flächen stammen aus derselben Berechnung wie der Gesamtwert. Gerundete Einzelwerte können minimal abweichen.',start:'Start/Ziel',route:'Strecke',filled:'gezählte Fläche',update:'Neue Version verfügbar',updateAction:'Jetzt aktualisieren',updateNote:'Deine ausgewählten GPX-Dateien müssen danach gegebenenfalls erneut geöffnet werden.',upToDate:'Aktuelle Version',tabGpx:'GPX-Analyse',tabManual:'Manuell',manualHeading:'Manuelle Effizienzberechnung',manualIntro:'Streckenlänge und eingeschlossene Fläche eingeben. Die Berechnung erfolgt automatisch.',manualLength:'Streckenlänge (km)',manualArea:'Eingeschlossene Fläche (km²)',manualPrompt:'Bitte Länge und Fläche eingeben.',manualInvalid:'Bitte gültige Zahlen eingeben (Komma oder Punkt).',manualLengthInvalid:'Die Streckenlänge muss größer als 0 sein.',manualAreaInvalid:'Die Fläche darf nicht negativ sein.',manualCircleIdeal:'Ideale Kreisfläche',manualSquareIdeal:'Ideale Quadratfläche',manualWarning:'Die Fläche ist größer als die maximale Kreisfläche für diese Streckenlänge. Bitte die Eingaben und Messgrundlagen überprüfen.',themeLabel:'Design',themeSystem:'System',themeLight:'Hell',themeDark:'Dunkel',footer:'Lokale Berechnung · Die eingefärbten Teilflächen entsprechen der berechneten Fläche.',errors:{INVALID_XML:'Ungültige GPX/XML-Datei',NO_POINTS:'Keine Track- oder Routenpunkte gefunden',INVALID_COORDS:'Ungültige GPS-Koordinaten',DISCONNECTED:'Getrennte Track-Segmente: Fläche nicht zuverlässig',TOO_MANY_POINTS:'Zu viele GPX-Punkte für diese Version',OPEN_ROUTE:'Offene Route (Start–Ziel: {n} m)'},error:'FEHLER',noFaces:'Keine geschlossene Teilfläche erkannt'},
 en:{compareButton:'Compare routes',compareClose:'Close comparison',compareSort:'Sort by',compareEfficiency:'Circle efficiency',compareAreaSort:'Total area',compareTitle:'Route comparison',compareInfo:'Each GPX file is calculated independently. Comparison also works offline.',compareEmpty:'At least two successfully calculated GPX routes are required.',compareCircle:'Circle',compareSquare:'Square',compareRank:'Rank',compareRoute:'Route',compareShow:'Show',compareFocus:'Highlight',compareAll:'Highlight all routes equally',compareMap:'Comparison map',compareOffline:'All routes are compared locally even without OSM. Enable OSM for the combined map.',compareWinner:'Best efficiency',compareDetails:'Show route details',compareHideDetails:'Close details',compareFullName:'Filename',compareSquareValue:'Square efficiency',compareFacesValue:'Enclosed areas',osmMap:'OpenStreetMap map',osmOn:'Show OSM map (internet)',osmOff:'Turn off OSM map',fitRoute:'Fit entire route',osmInfo:'Enabling the map downloads visible map tiles from OpenStreetMap. GPX data stays on your device.',chooseFiles:'Browse files',noFiles:'No files selected',selectedFiles:n=>`${n} file(s) selected`,title:'Analyze GPX routes',intro:'Select one or more GPX files. Your data stays on your device.',calc:'Analyze routes',csv:'Save CSV',results:'Results',empty:'No results yet.',ready:'Ready.',select:'Please select GPX files.',processed:n=>`${n} file(s) processed. Everything stays on your device.`,distance:'Distance',area:'Area',circle:'Circle efficiency',square:'Square efficiency',faces:'Enclosed regions',faceBreakdown:'Individual enclosed areas',areaUnit:'Area unit',face:'Area',faceSum:'Sum of enclosed areas',faceNote:'These values come from the same calculation as the total. Rounded figures may differ slightly.',start:'Start/finish',route:'Route',filled:'counted area',update:'New version available',updateAction:'Update now',updateNote:'You may need to select your GPX files again after updating.',upToDate:'Current version',tabGpx:'GPX analysis',tabManual:'Manual',manualHeading:'Manual efficiency calculator',manualIntro:'Enter the route distance and enclosed area. Results update automatically.',manualLength:'Route distance (km)',manualArea:'Enclosed area (km²)',manualPrompt:'Enter distance and area.',manualInvalid:'Please enter valid numbers (comma or decimal point).',manualLengthInvalid:'Distance must be greater than 0.',manualAreaInvalid:'Area cannot be negative.',manualCircleIdeal:'Ideal circle area',manualSquareIdeal:'Ideal square area',manualWarning:'The area exceeds the maximum circular area for this distance. Please check the inputs and measurement methods.',themeLabel:'Theme',themeSystem:'System',themeLight:'Light',themeDark:'Dark',footer:'Local calculations · Highlighted regions are the areas counted by the algorithm.',errors:{INVALID_XML:'Invalid GPX/XML file',NO_POINTS:'No track or route points found',INVALID_COORDS:'Invalid GPS coordinates',DISCONNECTED:'Disconnected track segments: area is unreliable',TOO_MANY_POINTS:'Too many GPX points for this version',OPEN_ROUTE:'Open route (start–finish: {n} m)'},error:'ERROR',noFaces:'No enclosed region detected'}
};
function translateError(message,lang){const t=LANG[lang],parts=String(message).split(':');return (t.errors[parts[0]]||message).replace('{n}',parts[1]||'');}
if(typeof module!=='undefined')module.exports={evaluate,facesArea,translateError};
if(typeof document!=='undefined'){
 const el=id=>document.getElementById(id);
 let language=localStorage.getItem('intvl-language')==='en'?'en':'de',rows=[],busy=false,activeView='gpx',areaUnit='km2',osmEnabled=false,activeMaps=[],compareMetric='efficiency',compareVisible=new Set(),compareHighlight=null,compareOpen=false,compareAreaUnit='km2',comparisonMapInstance=null;
 function setAreaUnit(unit){
  if(unit!=='km2'&&unit!=='m2')return;
  areaUnit=unit;
  document.querySelectorAll('.face-details').forEach(section=>updateFaceUnits(section,areaUnit,fmt));
 }
 const themeSelect=el('themeMode');
 const storedTheme=localStorage.getItem('intvl-theme');
 themeSelect.value=['system','light','dark'].includes(storedTheme)?storedTheme:'system';
 const systemDark=window.matchMedia('(prefers-color-scheme: dark)');
 function applyTheme(){
  document.documentElement.dataset.theme=themeSelect.value==='system'?(systemDark.matches?'dark':'light'):themeSelect.value;
  const themeColor=document.querySelector('meta[name="theme-color"]');
  if(themeColor)themeColor.content=document.documentElement.dataset.theme==='dark'?'#111b1a':'#123b35';
 }
 themeSelect.addEventListener('change',()=>{localStorage.setItem('intvl-theme',themeSelect.value);applyTheme()});
 if(systemDark.addEventListener)systemDark.addEventListener('change',applyTheme);
 else if(systemDark.addListener)systemDark.addListener(applyTheme);
 applyTheme();
 const t=()=>LANG[language],fmt=(x,n)=>Number(x).toLocaleString(language==='de'?'de-DE':'en-GB',{minimumFractionDigits:n,maximumFractionDigits:n});
 const render=()=>{
  el('language').checked=language==='en';document.documentElement.lang=language;
  el('themeLabel').textContent=t().themeLabel;themeSelect.setAttribute('aria-label',t().themeLabel);
  for(const [value,key] of [['system','themeSystem'],['light','themeLight'],['dark','themeDark']])Array.from(themeSelect.options).find(option=>option.value===value).textContent=t()[key];
  for(const [id,key] of Object.entries({heading:'title',intro:'intro',calc:'calc',export:'csv',resultHeading:'results',footerText:'footer'}))el(id).textContent=t()[key];
  for(const [id,key] of Object.entries({tabGpx:'tabGpx',tabManual:'tabManual',manualHeading:'manualHeading',manualIntro:'manualIntro',manualLengthLabel:'manualLength',manualAreaLabel:'manualArea'}))el(id).textContent=t()[key];
  el('compareToggle').textContent=compareOpen?t().compareClose:t().compareButton;el('compareToggle').disabled=rows.filter(r=>r.Strecke_km!==undefined&&r.Teilflaechen>0).length<2;el('compareToggle').setAttribute('aria-expanded',String(compareOpen));
  el('osmToggle').textContent=osmEnabled?t().osmOff:t().osmOn;el('osmToggle').setAttribute('aria-pressed',String(osmEnabled));el('osmInfo').textContent=t().osmInfo;
  el('results').dataset.empty=t().empty;el('filePickerLabel').textContent=t().chooseFiles;updateFileSelection();
  renderManual();
  if(!busy)el('status').textContent=rows.length?t().processed(rows.length):t().ready;
  el('updateTitle').textContent=t().update;el('updateButton').textContent=t().updateAction;el('updateNote').textContent=t().updateNote;
  for(const m of activeMaps)m.destroy();activeMaps=[];const results=el('results');results.replaceChildren();
  try{renderComparison()}catch(error){console.error('Comparison map render failed:',error);comparisonMapInstance=null;const host=el('comparison');const notice=document.createElement('p');notice.className='small error';notice.textContent=language==='de'?'Vergleichskarte konnte nicht angezeigt werden. Die Einzelauswertungen bleiben erhalten.':'Comparison map could not be displayed. Individual results remain available.';host.append(notice)}
  for(const row of rows){const div=document.createElement('div');div.className='route';const title=document.createElement('h3');title.textContent=row.Datei;div.append(title);
   if(row.Strecke_km!==undefined){try{const mapSlot=document.createElement('div');if(osmEnabled){const m=createOsmMap(row,language);activeMaps.push(m);mapSlot.append(m.element)}else mapSlot.append(renderRoute(row));div.append(mapSlot)}catch(e){const warning=document.createElement('p');warning.className='small error';warning.textContent='Route display: '+e.message;div.append(warning)}const stats=document.createElement('div');stats.className='stats';for(const [label,value] of [[t().distance,fmt(row.Strecke_km,2)+' km'],[t().area,fmt(row.Flaeche_km2,2)+' km²'],[t().circle,fmt(row.Kreis_Effizienz_Prozent,2)+' %'],[t().square,fmt(row.Quadrat_Effizienz_Prozent,2)+' %']]){const box=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');box.className='stat';small.textContent=label;strong.textContent=value;box.append(small,strong);stats.append(box)}div.append(stats);if(row._faceAreas&&row._faceAreas.length)div.append(renderFaceDetails(row,t(),fmt,areaUnit,setAreaUnit))}
   const info=document.createElement('p');info.className=row.Strecke_km===undefined?'small error':'small';info.textContent=row.Strecke_km===undefined?t().error+': '+translateError(row._error,language):(row.Teilflaechen?'OK':t().noFaces)+' · '+t().faces+': '+row.Teilflaechen;div.append(info);results.append(div);
  }
 };

 function renderComparison(){
  const host=el('comparison');if(comparisonMapInstance&&comparisonMapInstance.getState)comparisonMapState=comparisonMapInstance.getState();comparisonMapInstance=null;host.replaceChildren();
  const valid=rows.filter(r=>r.Strecke_km!==undefined&&r.Teilflaechen>0);
  if(!compareOpen||valid.length<2)return;
  const title=document.createElement('h2');title.textContent=t().compareTitle;host.append(title);
  const intro=document.createElement('p');intro.className='small';intro.textContent=t().compareInfo;host.append(intro);
  const toolbar=document.createElement('div');toolbar.className='compare-toolbar';
  const sort=document.createElement('select');sort.className='compare-select';sort.setAttribute('aria-label',t().compareSort);
  for(const [value,label] of [['efficiency',t().compareEfficiency],['area',t().compareAreaSort]]){const o=document.createElement('option');o.value=value;o.textContent=label;sort.append(o)}
  sort.value=compareMetric;sort.addEventListener('change',()=>{compareMetric=sort.value;renderComparison()});toolbar.append(sort);
  const units=document.createElement('div');units.className='unit-control';units.setAttribute('aria-label',t().areaUnit);
  for(const [value,label] of [['km2','km²'],['m2','m²']]){const btn=document.createElement('button');btn.type='button';btn.className='unit-button'+(compareAreaUnit===value?' active':'');btn.textContent=label;btn.setAttribute('aria-pressed',String(compareAreaUnit===value));btn.addEventListener('click',()=>{compareAreaUnit=value;renderComparison()});units.append(btn)}
  toolbar.append(units);host.append(toolbar);
  const sorted=[...valid].sort((a,b)=>compareMetric==='area'?b.Flaeche_km2-a.Flaeche_km2:b.Kreis_Effizienz_Prozent-a.Kreis_Effizienz_Prozent);
  const drawOrder=[...sorted].reverse().sort((a,b)=>Number(a.Datei===compareHighlight)-Number(b.Datei===compareHighlight));
  const areaText=r=>compareAreaUnit==='km2'?fmt(r.Flaeche_km2,2)+' km²':fmt(r.Flaeche_km2*1e6,2)+' m²';
  const table=document.createElement('table');table.className='compare-table';const head=document.createElement('thead'),hr=document.createElement('tr');
  for(const label of ['#',t().compareRoute,t().distance+' (km)',t().area+' ('+(compareAreaUnit==='km2'?'km²':'m²')+')',t().compareEfficiency+' (%)']){const th=document.createElement('th');th.textContent=label;hr.append(th)}head.append(hr);table.append(head);
  const body=document.createElement('tbody');
  for(const [rank,r] of sorted.entries()){
   const tr=document.createElement('tr');const color=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];
   for(const [i,value] of [String(rank+1),r.Datei,fmt(r.Strecke_km,2),areaText(r),fmt(r.Kreis_Effizienz_Prozent,2)+' %'].entries()){
    const td=document.createElement('td');td.textContent=value;if(i===1){td.className='compare-name';td.style.borderLeft='5px solid '+color}if(i===4&&rank===0)td.classList.add('compare-best');tr.append(td)
   }body.append(tr);
  }table.append(body);const scroll=document.createElement('div');scroll.className='compare-scroll';scroll.append(table);host.append(scroll);
  const cards=document.createElement('div');cards.className='compare-cards';
  for(const [rank,r] of sorted.entries()){
   const card=document.createElement('article');card.className='compare-card';card.style.borderLeftColor=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];
   const name=document.createElement('strong');name.className='compare-card-name';name.textContent='#'+(rank+1)+' · '+r.Datei;card.append(name);
   const metrics=document.createElement('div');metrics.className='compare-card-metrics';
   for(const [label,value] of [[t().distance,fmt(r.Strecke_km,2)+' km'],[t().area,areaText(r)],[t().compareEfficiency,fmt(r.Kreis_Effizienz_Prozent,2)+' %']]){
    const item=document.createElement('div'),caption=document.createElement('span'),number=document.createElement('strong');caption.textContent=label;number.textContent=value;item.append(caption,number);metrics.append(item)
   }card.append(metrics);cards.append(card);
  }host.append(cards);
  const heading=document.createElement('h3');heading.textContent=t().compareMap;host.append(heading);
  const focus=document.createElement('select');focus.className='compare-select';focus.setAttribute('aria-label',t().compareFocus);
  let opt=document.createElement('option');opt.value='';opt.textContent=t().compareAll;focus.append(opt);
  for(const [rank,r] of sorted.entries()){
   opt=document.createElement('option');opt.value=r.Datei;
   const colorIndex=valid.indexOf(r)%COMPARISON_COLORS.length;
   const symbols=['🔵','🟠','🟢','🟣','🔴','🟡','🟤'];
   opt.textContent=symbols[colorIndex%symbols.length]+' #'+(rank+1)+' · '+r.Datei;focus.append(opt)
  }
  focus.value=compareHighlight||'';focus.addEventListener('change',()=>{compareHighlight=focus.value||null;renderComparison()});host.append(focus);
  const custom=document.createElement('div');custom.className='compare-focus-mobile';const trigger=document.createElement('button');trigger.type='button';trigger.className='compare-focus-trigger';trigger.setAttribute('aria-expanded','false');const chosen=sorted.find(r=>r.Datei===compareHighlight);const chosenRank=sorted.indexOf(chosen);const chosenColor=chosen?COMPARISON_COLORS[valid.indexOf(chosen)%COMPARISON_COLORS.length]:null;
  if(chosenColor){const dot=document.createElement('span');dot.className='compare-dot';dot.style.background=chosenColor;trigger.append(dot)}
  const chosenText=document.createElement('span');chosenText.className='compare-focus-label';chosenText.textContent=chosen?'#'+(chosenRank+1)+' · '+chosen.Datei:t().compareAll;trigger.append(chosenText);const chevron=document.createElement('span');chevron.textContent='⌄';trigger.append(chevron);
  const panel=document.createElement('div');panel.className='compare-focus-panel';panel.hidden=true;
  for(const [idx,r] of [[-1,null],...sorted.map((r,i)=>[i,r])]){const btn=document.createElement('button');btn.type='button';btn.className='compare-focus-option';if((r?r.Datei:null)===compareHighlight)btn.classList.add('selected');if(r){const dot=document.createElement('span');dot.className='compare-dot';dot.style.background=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];btn.append(dot)}const label=document.createElement('span');label.textContent=r?'#'+(idx+1)+' · '+r.Datei:t().compareAll;btn.append(label);if((r?r.Datei:null)===compareHighlight){const check=document.createElement('strong');check.textContent='✓';btn.append(check)}btn.addEventListener('click',()=>{compareHighlight=r?r.Datei:null;renderComparison()});panel.append(btn)}
  trigger.addEventListener('click',()=>{panel.hidden=!panel.hidden;trigger.setAttribute('aria-expanded',String(!panel.hidden))});custom.append(trigger,panel);host.append(custom);
  const legend=document.createElement('div');legend.className='compare-map-legend';legend.setAttribute('aria-label',t().compareRank);
  const toggleVisibility=(r)=>{if(compareVisible.has(r.Datei)){if(compareVisible.size===1)return;compareVisible.delete(r.Datei)}else compareVisible.add(r.Datei);comparisonVisibilityMenuOpen=!mobilePanel.hidden;renderComparison()};
  const makeLegendRow=(r,rank)=>{
   const item=document.createElement('button');item.type='button';item.className='compare-legend-item';
   const shown=compareVisible.has(r.Datei);if(!shown)item.classList.add('is-hidden');
   item.setAttribute('aria-pressed',String(shown));item.setAttribute('aria-label',(shown?t().compareShow+': ':t().compareShow+': ')+r.Datei);
   item.title=r.Datei;
   const dot=document.createElement('span');dot.className='compare-dot';dot.style.background=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];
   const label=document.createElement('strong');label.textContent='#'+(rank+1);
   item.append(dot,label);item.addEventListener('click',()=>toggleVisibility(r));return item
  };
  const desktopLegend=document.createElement('div');desktopLegend.className='compare-legend-desktop';
  sorted.forEach((r,rank)=>desktopLegend.append(makeLegendRow(r,rank)));legend.append(desktopLegend);
  const mobileButton=document.createElement('button');mobileButton.type='button';mobileButton.className='compare-legend-mobile-trigger';mobileButton.innerHTML='';const mobileTitle=document.createElement('span');mobileTitle.className='compare-legend-title';mobileTitle.textContent='⌄';const mobileRanks=document.createElement('span');mobileRanks.className='compare-legend-summary';sorted.forEach((r,i)=>{const d=document.createElement('span');d.className='compare-legend-mini';if(!compareVisible.has(r.Datei))d.classList.add('is-hidden');const dot=document.createElement('span');dot.className='compare-dot';dot.style.background=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];const n=document.createElement('b');n.textContent='#'+(i+1);d.append(dot,n);mobileRanks.append(d)});mobileButton.append(mobileRanks,mobileTitle);mobileButton.setAttribute('aria-label',t().compareRank+' – '+t().compareShow);mobileButton.setAttribute('aria-expanded',String(comparisonVisibilityMenuOpen));
  const mobilePanel=document.createElement('div');mobilePanel.className='compare-legend-mobile-panel';mobilePanel.hidden=!comparisonVisibilityMenuOpen;
  sorted.forEach((r,rank)=>mobilePanel.append(makeLegendRow(r,rank)));
  mobileButton.addEventListener('click',()=>{comparisonVisibilityMenuOpen=mobilePanel.hidden;mobilePanel.hidden=!comparisonVisibilityMenuOpen;mobileButton.setAttribute('aria-expanded',String(comparisonVisibilityMenuOpen))});
  legend.append(mobileButton,mobilePanel);
  // A tap outside the mobile visibility menu closes it without moving the map.
  const closeMobilePanel=e=>{if(!mobilePanel.hidden&&!legend.contains(e.target)){mobilePanel.hidden=true;comparisonVisibilityMenuOpen=false;mobileButton.setAttribute('aria-expanded','false')}};
  const visible=valid.filter(r=>compareVisible.has(r.Datei));
  if(visible.length){
   if(osmEnabled){const map=createOsmMap(visible[0],language,{routes:valid,drawOrder,visible:compareVisible,highlight:compareHighlight});comparisonMapInstance=map;activeMaps.push(map);map.element.classList.add('compare-map-with-legend');map.element.append(legend);map.element.addEventListener('pointerdown',closeMobilePanel,true);host.append(map.element)}
   else {const map=renderComparisonOffline(valid,compareVisible,compareHighlight,drawOrder);comparisonMapInstance=map._mapController;map.classList.add('compare-map-with-legend');map.append(legend);map.addEventListener('pointerdown',closeMobilePanel,true);host.append(map)}
  }
 }
 function renderComparisonOffline(routes,visible,highlight,drawOrder){
  const NS='http://www.w3.org/2000/svg',node=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e};
  const host=document.createElement('div');host.className='route-map compare-offline-map';
  const coords=routes.flatMap(r=>r._geo),rad=Math.PI/180,lat0=coords.reduce((sum,p)=>sum+p[1],0)/coords.length*rad;
  const project=p=>[p[0]*rad*6371000*Math.cos(lat0),p[1]*rad*6371000];
  const pts=coords.map(project),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const w=640,h=390,pad=24,scale=Math.min((w-2*pad)/Math.max(maxx-minx,1),(h-2*pad)/Math.max(maxy-miny,1));
  const x0=(w-(maxx-minx)*scale)/2,y0=(h-(maxy-miny)*scale)/2;
  const point=p=>{const q=project(p);return [x0+(q[0]-minx)*scale,h-y0-(q[1]-miny)*scale]};
  const svg=node('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':t().compareMap});svg.classList.add('compare-offline-svg');
  // Draw the grid in map coordinates so it pans and zooms together with the routes.
  // Its own SVG fills the complete viewport, including the space around the route drawing.
  const gridSvg=node('svg',{viewBox:`0 0 ${w} ${h}`,'preserveAspectRatio':'none','aria-hidden':'true'});
  gridSvg.classList.add('compare-offline-grid');
  const defs=node('defs'),pattern=node('pattern',{id:'comparison-moving-grid',width:32,height:32,patternUnits:'userSpaceOnUse'});
  pattern.append(node('path',{d:'M 32 0 L 0 0 0 32',fill:'none',stroke:'#dce9df','stroke-width':'.8'}));
  defs.append(pattern);gridSvg.append(defs);
  gridSvg.append(node('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'url(#comparison-moving-grid)'}));
  drawOrder.forEach(r=>{const i=routes.indexOf(r);if(!visible.has(r.Datei))return;const d=r._geo.map((p,j)=>{const q=point(p);return(j?'L':'M')+q[0].toFixed(2)+' '+q[1].toFixed(2)}).join(' ');
   const selected=highlight===r.Datei;svg.append(node('path',{d,fill:'none',stroke:COMPARISON_COLORS[i%COMPARISON_COLORS.length],'stroke-width':selected?5:3.3,'stroke-opacity':highlight&&!selected?.28:1,'stroke-linejoin':'round','stroke-linecap':'round'}));
  });
  let state=comparisonMapState&&comparisonMapState.kind==='offline'?{...comparisonMapState}:{kind:'offline',x:0,y:0,w,h};
  const apply=()=>{const view=`${state.x} ${state.y} ${state.w} ${state.h}`;svg.setAttribute('viewBox',view);gridSvg.setAttribute('viewBox',view)};
  const fit=()=>{state={kind:'offline',x:0,y:0,w,h};apply()};apply();
  const zoomAt=(factor,x,y)=>{const r=svg.getBoundingClientRect(),px=(x-r.left)/r.width,py=(y-r.top)/r.height;const newW=Math.max(10,Math.min(w*8,state.w*factor)),newH=newW*h/w;state.x+=(state.w-newW)*px;state.y+=(state.h-newH)*py;state.w=newW;state.h=newH;apply()};
  svg.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?.83:1.2,e.clientX,e.clientY)},{passive:false});
  const pointers=new Map();let lastPinch=null;
  svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;svg.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);lastPinch=null});
  svg.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){const r=svg.getBoundingClientRect();state.x-=(e.clientX-prev[0])/r.width*state.w;state.y-=(e.clientY-prev[1])/r.height*state.h;apply()}else if(pointers.size===2){const a=[...pointers.values()],dist=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(lastPinch)zoomAt(lastPinch/dist,(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2);lastPinch=dist}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,e=>{pointers.delete(e.pointerId);lastPinch=null});
  host.append(gridSvg,svg);const fitBtn=document.createElement('button');fitBtn.type='button';fitBtn.className='osm-control compare-offline-fit';fitBtn.textContent='⛶';fitBtn.title=t().fitRoute;fitBtn.setAttribute('aria-label',t().fitRoute);fitBtn.addEventListener('click',fit);host.append(fitBtn);
  host._mapController={getState:()=>({...state})};return host;
 }

 function updateFileSelection(){const n=el('files').files.length;el('selectedFiles').textContent=n?t().selectedFiles(n):t().noFiles}
 el('files').addEventListener('change',updateFileSelection);
 el('compareToggle').addEventListener('click',()=>{compareOpen=!compareOpen;render()});
 el('osmToggle').addEventListener('click',()=>{osmEnabled=!osmEnabled;comparisonMapState=null;comparisonMapInstance=null;render()});
 const numberInput=value=>{
  const s=String(value).trim().replace(/\s/g,'');
  if(!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s))return NaN;
  return Number(s.replace(',','.'));
 };
 function renderManual(){
  const lengthRaw=el('manualLength').value,areaRaw=el('manualArea').value;
  const result=el('manualResults'),msg=el('manualMessage'),warn=el('manualWarning');
  result.replaceChildren();warn.hidden=true;
  el('manualLength').removeAttribute('aria-invalid');el('manualArea').removeAttribute('aria-invalid');
  if(!lengthRaw.trim()||!areaRaw.trim()){msg.textContent=t().manualPrompt;return}
  const length=numberInput(lengthRaw),area=numberInput(areaRaw);
  if(!Number.isFinite(length)||!Number.isFinite(area)){msg.textContent=t().manualInvalid;return}
  if(length<=0){msg.textContent=t().manualLengthInvalid;el('manualLength').setAttribute('aria-invalid','true');return}
  if(area<0){msg.textContent=t().manualAreaInvalid;el('manualArea').setAttribute('aria-invalid','true');return}
  msg.textContent='';
  const circle=length*length/(4*Math.PI),square=length*length/16;
  for(const [label,value] of [[t().manualCircleIdeal,fmt(circle,2)+' km²'],[t().manualSquareIdeal,fmt(square,2)+' km²'],[t().circle,fmt(area/circle*100,2)+' %'],[t().square,fmt(area/square*100,2)+' %']]){
   const box=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');
   box.className='stat';small.textContent=label;strong.textContent=value;box.append(small,strong);result.append(box);
  }
  if(area>circle*(1+1e-10)){warn.textContent=t().manualWarning;warn.hidden=false}
 }
 function showView(view){
  activeView=view;
  el('viewGpx').hidden=view!=='gpx';el('viewManual').hidden=view!=='manual';
  for(const [id,value] of [['tabGpx','gpx'],['tabManual','manual']]){
   const selected=view===value;el(id).classList.toggle('active',selected);el(id).setAttribute('aria-selected',String(selected));
  }
 }
 el('tabGpx').addEventListener('click',()=>showView('gpx'));
 el('tabManual').addEventListener('click',()=>showView('manual'));
 for(const id of ['manualLength','manualArea'])el(id).addEventListener('input',renderManual);
 // Swipe between views only when starting on noninteractive page content.
 let touchStart=null;
 const swipeExcluded=target=>target.closest('input,button,select,textarea,a,.route-map,.osm-map,.face-details,.view-tabs,.comparison,.compare-toolbar,.compare-scroll,.compare-cards');
 for(const id of ['viewGpx','viewManual']){
  const panel=el(id);
  panel.addEventListener('touchstart',e=>{
   if(e.touches.length!==1||swipeExcluded(e.target)){touchStart=null;return}
   touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  // Prevent the browser's horizontal rubber-band while preserving vertical scroll.
  panel.addEventListener('touchmove',e=>{
   if(!touchStart||e.touches.length!==1)return;
   const dx=e.touches[0].clientX-touchStart.x;
   const dy=e.touches[0].clientY-touchStart.y;
   if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.6&&e.cancelable)e.preventDefault();
  },{passive:false});
  panel.addEventListener('touchend',e=>{
   if(!touchStart||!e.changedTouches.length)return;
   const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
   touchStart=null;
   if(Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*1.6)showView(dx<0?'manual':'gpx');
  },{passive:true});
  panel.addEventListener('touchcancel',()=>{touchStart=null},{passive:true});
 }
 el('language').addEventListener('change',e=>{language=e.target.checked?'en':'de';localStorage.setItem('intvl-language',language);render()});
 el('calc').onclick=async()=>{
  const files=Array.from(el('files').files);
  if(!files.length){el('status').textContent=t().select;return}
  rows=[];compareVisible=new Set();compareHighlight=null;compareOpen=false;comparisonVisibilityMenuOpen=false;comparisonMapState=null;comparisonMapInstance=null;busy=true;el('calc').disabled=true;el('export').disabled=true;
  el('results').replaceChildren();
  el('status').textContent=language==='de'?'Berechnung läuft …':'Calculating …';
  try{
   for(const file of files){
    try{{const result=evaluate(file.name,await file.text());rows.push(result);compareVisible.add(result.Datei)}}
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
