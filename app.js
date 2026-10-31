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
 if(segs.length>150000)throw Error('TOO_MANY_POINTS');
 const eps=1e-8;
 // Sweep-line broad phase: only compare segments with overlapping bounding boxes.
 const bounds=segs.map((s,i)=>({i,minx:Math.min(s.a[0],s.b[0]),maxx:Math.max(s.a[0],s.b[0]),miny:Math.min(s.a[1],s.b[1]),maxy:Math.max(s.a[1],s.b[1])}));
 bounds.sort((a,b)=>a.minx-b.minx||a.i-b.i);
 let active=[];
 for(const box of bounds){
  active=active.filter(b=>b.maxx>=box.minx-eps);
  const s=segs[box.i],r=sub(s.b,s.a),rr=dot(r,r);
  for(const other of active){if(other.maxy<box.miny-eps||box.maxy<other.miny-eps)continue;
   const t=segs[other.i],v=sub(t.b,t.a),vv=dot(v,v),w=sub(t.a,s.a),den=cross(r,v);if(Math.abs(den)>eps){let u=cross(w,v)/den,z=cross(w,r)/den;if(u>=-eps&&u<=1+eps&&z>=-eps&&z<=1+eps){s.ts.push(Math.max(0,Math.min(1,u)));t.ts.push(Math.max(0,Math.min(1,z)))}}else if(Math.abs(cross(w,r))<eps*Math.sqrt(rr)){for(let p of [t.a,t.b]){let u=dot(sub(p,s.a),r)/rr;if(u>=-eps&&u<=1+eps)s.ts.push(Math.max(0,Math.min(1,u)))}for(let p of [s.a,s.b]){let u=dot(sub(p,t.a),v)/vv;if(u>=-eps&&u<=1+eps)t.ts.push(Math.max(0,Math.min(1,u)))}}}
  active.push(box);
 }
 const verts=[],ids=new Map(),edges=new Set();function vertex(p){let key=p.map(x=>Math.round(x*1e6)).join(',');if(!ids.has(key)){ids.set(key,verts.length);verts.push(p)}return ids.get(key)}
 for(let s of segs){let d=sub(s.b,s.a);s.ts.sort((a,b)=>a-b);for(let k=1;k<s.ts.length;k++){let t0=s.ts[k-1],t1=s.ts[k];if(t1-t0<1e-9)continue;let a=vertex([s.a[0]+d[0]*t0,s.a[1]+d[1]*t0]),b=vertex([s.a[0]+d[0]*t1,s.a[1]+d[1]*t1]);if(a!==b)edges.add([Math.min(a,b),Math.max(a,b)].join(':'))}}
 let outgoing=verts.map(()=>[]),half=[];for(let key of edges){let [a,b]=key.split(':').map(Number),i=half.length;half.push({from:a,to:b,twin:i+1},{from:b,to:a,twin:i});outgoing[a].push(i);outgoing[b].push(i+1)}
 for(let i=0;i<outgoing.length;i++)outgoing[i].sort((a,b)=>{let p=verts[i];return Math.atan2(verts[half[a].to][1]-p[1],verts[half[a].to][0]-p[0])-Math.atan2(verts[half[b].to][1]-p[1],verts[half[b].to][0]-p[0])});
 let seen=new Set(),areas=[],rings=[];for(let i=0;i<half.length;i++){if(seen.has(i))continue;let h=i,ring=[],limit=0;while(!seen.has(h)&&limit++<=half.length){seen.add(h);let e=half[h];ring.push(verts[e.from]);let arr=outgoing[e.to],idx=arr.indexOf(e.twin);h=arr[(idx-1+arr.length)%arr.length]}if(h!==i||ring.length<3)continue;let a=0;for(let j=0;j<ring.length;j++)a+=cross(ring[j],ring[(j+1)%ring.length]);a/=2;if(a>0.00001){areas.push(a);rings.push(ring)}}return {area:areas.reduce((a,b)=>a+b,0),faces:areas.length,rings,faceAreas:areas};
}
function evaluate(name,xml){let seg=readGpx(xml),points=seg.flat(),length=0;for(let s of seg)for(let i=1;i<s.length;i++)length+=distance(s[i-1],s[i]);let closure=distance(seg[0][0],seg[seg.length-1].at(-1));for(let i=1;i<seg.length;i++)if(distance(seg[i-1].at(-1),seg[i][0])>30)throw Error('DISCONNECTED');// The closing edge is only used for geometry, never for route distance.
 let lon0=points.reduce((a,p)=>a+p[0],0)/points.length*rad,lat0=points.reduce((a,p)=>a+p[1],0)/points.length*rad;let xy=points.map(p=>{let lon=p[0]*rad,lat=p[1]*rad,d=lon-lon0,cosc=Math.sin(lat0)*Math.sin(lat)+Math.cos(lat0)*Math.cos(lat)*Math.cos(d),k=Math.sqrt(2/(1+cosc));return [R*k*Math.cos(lat)*Math.sin(d),R*k*(Math.cos(lat0)*Math.sin(lat)-Math.sin(lat0)*Math.cos(lat)*Math.cos(d))]});xy.push(xy[0]);let result=facesArea(xy),km=length/1000,area=result.area/1e6,circle=km*km/(4*Math.PI),square=km*km/16;return {Datei:name,Strecke_km:round(km,4),Flaeche_km2:round(area,4),Kreis_ideal_km2:round(circle,4),Kreis_Effizienz_Prozent:round(area/circle*100,2),Quadrat_ideal_km2:round(square,4),Quadrat_Effizienz_Prozent:round(area/square*100,2),Start_Ziel_Abstand_m:round(closure,2),Teilflaechen:result.faces,_faceAreas:result.faceAreas,Status:result.faces?'OK':'Keine geschlossene Teilfläche erkannt',_xy:xy,_rings:result.rings,_geo:points,_closureMeters:closure>30?round(closure,2):0,_projection:[lon0,lat0]};}

function faceLabel(i){let result='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;}
// Presentation-only ordering: original ring geometry and calculated areas stay untouched.
function faceOrder(row){return (row._faceAreas||[]).map((_,i)=>i).sort((a,b)=>row._faceAreas[b]-row._faceAreas[a]||a-b)}
function faceNames(row){const names=[];faceOrder(row).forEach((index,rank)=>names[index]=faceLabel(rank));return names}
// Layout in screen pixels so zooming never shrinks labels or their leader lines.
// Screen-space label placement. The route and other leader lines are obstacles,
// while previous positions reduce distracting jumps during small map movements.
function segmentDistanceSquared(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
 const t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;
 return (px-ax-t*dx)**2+(py-ay-t*dy)**2;
}
function segmentsIntersect(a,b,c,d){
 const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
 return o1*o2<0&&o3*o4<0;
}
function placeFaceLabels(items,w,h,route=[],previous=new Map()){
 const result=new Map(),placed=[],leaders=[],margin=15,radius=12;
 const segments=[];
 // Discard route sections outside the viewport and skip very short subdivisions.
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i];
  if(Math.max(a[0],b[0]) < -45||Math.min(a[0],b[0])>w+45||Math.max(a[1],b[1]) < -45||Math.min(a[1],b[1])>h+45)continue;
  if((a[0]-b[0])**2+(a[1]-b[1])**2<.16)continue;
  segments.push([a,b]);
 }
 const routeDistance=(x,y)=>{let min=Infinity;for(const [a,b] of segments)min=Math.min(min,segmentDistanceSquared(x,y,...a,...b));return Math.sqrt(min)};
 const candidates=[[0,0],[0,-35],[-30,-27],[30,-27],[-38,0],[38,0],[-30,28],[30,28],[0,38],[-54,-20],[54,-20],[-54,20],[54,20],[0,-55],[0,55],[-68,0],[68,0],[-76,-30],[76,-30],[-76,30],[76,30]];
 for(const item of [...items].sort((a,b)=>b.area-a.area||a.index-b.index)){
  const {x,y,diameter}=item;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x < -85||x>w+85||y < -85||y>h+85)continue;
  const choices=[];
  const prev=previous.get(item.index);
  if(prev)choices.push([prev.x-x,prev.y-y]);
  choices.push(...candidates);
  let best=null;
  for(const [dx,dy] of choices){
   const px=x+dx,py=y+dy,dist=Math.hypot(dx,dy),external=dist>3;
   if(px<margin||px>w-margin||py<margin||py>h-margin)continue;
   if(placed.some(p=>Math.hypot(p.x-px,p.y-py)<30))continue;
   if(!external&&diameter<32)continue;
   // Do not place a circle on the actual route, including its white outline.
   const clearance=routeDistance(px,py);
   if(clearance<radius+4)continue;
   const edge=external?[px-dx/dist*radius,py-dy/dist*radius]:[px,py];
   const lead=external?[[x,y],edge]:null;
   if(lead&&leaders.some(l=>segmentsIntersect(...lead,...l)))continue;
   // Avoid a leader line passing through an existing label.
   if(lead&&placed.some(p=>segmentDistanceSquared(p.x,p.y,...lead[0],...lead[1])<(radius+3)**2))continue;
   // Crossing the route is possible at the attachment point, but strongly discouraged elsewhere.
   let crosses=0;
   if(lead)for(const seg of segments)if(segmentsIntersect(...lead,...seg))crosses++;
   const stability=prev?Math.hypot(prev.x-px,prev.y-py):0;
   const score=dist*.28+crosses*65+(external?3:0)+Math.max(0,24-clearance)*2+Math.min(80,stability)*.16;
   if(!best||score<best.score)best={x:px,y:py,external,edge,lead,score};
  }
  if(!best)continue;
  placed.push(best);if(best.lead)leaders.push(best.lead);
  result.set(item.index,{x:best.x,y:best.y,external:best.external,edge:best.edge});
 }
 return result;
}
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
// Anchor elongated polygons near their longitudinal midpoint rather than at an end.
// This affects label placement only; polygon geometry and area calculations stay intact.
function visualAreaAnchor(ring){
 if(!ring||ring.length<3)return interiorLabelPoint(ring);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const [x,y] of ring){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
 const midX=(minX+maxX)/2,midY=(minY+maxY)/2;
 // Dominant direction from the polygon's bounding dimensions. For a thin
 // diagonal strip, use covariance of vertices to align the cross-section.
 let xx=0,xy=0,yy=0;
 for(const [x,y] of ring){const dx=x-midX,dy=y-midY;xx+=dx*dx;xy+=dx*dy;yy+=dy*dy}
 const angle=.5*Math.atan2(2*xy,xx-yy);
 const ux=Math.cos(angle),uy=Math.sin(angle),vx=-uy,vy=ux;
 let low=Infinity,high=-Infinity;
 for(const [x,y] of ring){const t=(x-midX)*ux+(y-midY)*uy;low=Math.min(low,t);high=Math.max(high,t)}
 const mid=(low+high)/2;
 // Intersect the middle cross-section with the polygon, then use the widest
 // interior interval. This keeps the anchor inside even for concave strips.
 const hits=[];
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  const ta=(a[0]-midX)*ux+(a[1]-midY)*uy-mid;
  const tb=(b[0]-midX)*ux+(b[1]-midY)*uy-mid;
  if((ta<0&&tb>=0)||(tb<0&&ta>=0)){
   const f=ta/(ta-tb),x=a[0]+f*(b[0]-a[0]),y=a[1]+f*(b[1]-a[1]);
   hits.push((x-midX)*vx+(y-midY)*vy);
  }
 }
 hits.sort((a,b)=>a-b);
 let best=null;
 for(let i=0;i+1<hits.length;i+=2){
  const t=(hits[i]+hits[i+1])/2;
  const candidate=[midX+mid*ux+t*vx,midY+mid*uy+t*vy];
  const width=hits[i+1]-hits[i];
  if(width>0&&pointInPolygon(candidate,ring)&&(!best||width>best.width))best={point:candidate,width};
 }
 if(best)return best.point;
 return interiorLabelPoint(ring);
}
function renderFaceDetails(row,lang,fmt,unit,onUnitChange){
 const section=document.createElement('details');section.className='face-details';
 const head=document.createElement('summary');head.className='face-header';
 const heading=document.createElement('h4');heading.textContent=lang.faceBreakdown+' ('+row._faceAreas.length+')';head.append(heading);section.append(head);
 const content=document.createElement('div');content.className='face-content';
 const control=document.createElement('div');control.className='unit-control';control.setAttribute('role','group');control.setAttribute('aria-label',lang.areaUnit);
 for(const [value,label] of [['km2','km²'],['m2','m²']]){
  const button=document.createElement('button');button.type='button';button.className='unit-button'+(unit===value?' active':'');button.textContent=label;button.setAttribute('aria-pressed',String(unit===value));
  button.dataset.unit=value;button.addEventListener('click',()=>onUnitChange(value));
  control.append(button);
 }
 content.append(control);
 const table=document.createElement('table');table.className='face-table';const tbody=document.createElement('tbody');
 faceOrder(row).forEach((i,rank)=>{const area=row._faceAreas[i];
  const tr=document.createElement('tr'),name=document.createElement('th'),value=document.createElement('td');
  name.textContent=lang.face+' '+faceLabel(rank);value.dataset.areaM2=String(area);tr.append(name,value);tbody.append(tr);
 });
 const tr=document.createElement('tr'),name=document.createElement('th'),value=document.createElement('td');
 name.textContent=lang.faceSum;value.dataset.areaM2=String((row._faceAreas||[]).reduce((a,b)=>a+b,0));tr.append(name,value);tbody.append(tr);
 table.append(tbody);content.append(table);
 const note=document.createElement('p');note.className='small';note.textContent=lang.faceNote;content.append(note);section.append(content);
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
 for(let i=0;i<rings.length;i++)svg.append(make('path',{d:path(rings[i])+' Z',fill:i%2?'#8fc9e4':'#82cfa0','fill-opacity':'0.58',stroke:'none'}));
 svg.append(make('path',{d:path(xy.slice(0,-1)),fill:'none',stroke:'#176c51','stroke-width':3.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
 if(row._closureMeters)svg.append(make('path',{d:path([xy[xy.length-2],xy[0]]),fill:'none',stroke:'#df8a25','stroke-width':3,'stroke-dasharray':'7 5','stroke-linecap':'round'}));
 const [sx,sy]=point(xy[0]);svg.append(make('circle',{cx:sx,cy:sy,r:7,fill:'#fefefe',stroke:'#176c51','stroke-width':3}));
 const [ex,ey]=point(xy[xy.length-2]||xy[0]);svg.append(make('circle',{cx:ex,cy:ey,r:3,fill:'#176c51'}));
 const names=faceNames(row);
 const items=rings.map((ring,index)=>{const [x,y]=point(visualAreaAnchor(ring));const area=faceAreas[index]||0;return {index,x,y,area,diameter:2*Math.sqrt(area/Math.PI)*scale}});
 const routeScreen=xy.slice(0,-1).map(point);
 const positions=placeFaceLabels(items,w,h,routeScreen);
 for(const item of items){const pos=positions.get(item.index);if(!pos)continue;
  if(pos.external)svg.append(make('line',{x1:item.x,y1:item.y,x2:pos.edge[0],y2:pos.edge[1],stroke:'#176c51','stroke-width':1.25,'stroke-opacity':'.8'}));
  svg.append(make('circle',{cx:pos.x,cy:pos.y,r:12,fill:'#fff','fill-opacity':'.92',stroke:'#176c51','stroke-width':1.4}));
  const label=make('text',{x:pos.x,y:pos.y+4,'text-anchor':'middle','font-size':12,'font-weight':700,fill:'#176c51'});label.textContent=names[item.index];svg.append(label);
 }
 wrapper.append(svg);
 appendLineLegend(wrapper,row,document.documentElement.lang);
 return wrapper;
}



function appendLineLegend(parent,row,language,comparisonRoutes=null){
 const lang=LANG[language],legend=document.createElement('div');legend.className='map-legend line-key';
 const entry=(type,color,label)=>{const item=document.createElement('span');item.className='line-key-item';const sample=document.createElement('span');sample.className='line-key-sample';sample.classList.add('line-key-'+type);if(color)sample.style.setProperty('--line-color',color);const text=document.createElement('span');text.textContent=label;item.append(sample,text);legend.append(item)};
 if(comparisonRoutes){
  entry('solid',null,lang.route);
  if(comparisonRoutes.some(r=>r._closureMeters))entry('dashed',null,lang.closureLegend);
 }else{
  entry('start','#176c51',lang.start);
  entry('solid','#176c51',lang.route);
  if(row._closureMeters)entry('dashed','#df8a25',lang.closureLegend);
  entry('area','#82cfa0',`${row.Teilflaechen===1?lang.legendAreaSingle:lang.legendAreaPlural} (${row.Teilflaechen})`);
 }
 parent.append(legend);
}

// Native, dependency-free slippy-map renderer. No route coordinates are sent to the tile server.
// Shared map state must be visible to the OSM renderer as well as the UI.
let comparisonMapState=null;
let comparisonVisibilityMenuOpen=false;
function createOsmMap(row,language,comparison=null){
 const lang=LANG[language],host=document.createElement('div');host.className='osm-map';
 const viewport=document.createElement('div');viewport.className='osm-viewport';viewport.setAttribute('aria-label',lang.osmMap);
 const tiles=document.createElement('div');tiles.className='osm-tiles';
 const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('osm-overlay');
 overlay.setAttribute('preserveAspectRatio','none');viewport.append(tiles,overlay);host.append(viewport);
 const controls=document.createElement('div');controls.className='osm-controls';
 const addButton=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='osm-control';b.textContent=label;b.title=label;b.setAttribute('aria-label',label);b.addEventListener('click',action);controls.append(b);return b};
 const attribution=document.createElement('div');attribution.className='osm-attribution';const osmLink=document.createElement('a');osmLink.href='https://www.openstreetmap.org/copyright';osmLink.target='_blank';osmLink.rel='noopener noreferrer';osmLink.textContent='© OpenStreetMap';attribution.append(osmLink);host.append(controls,attribution);
 const TILE=256,MAX=19,MIN=2,NS='http://www.w3.org/2000/svg';
 const merc=([lon,lat])=>{const y=Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180;return [(lon+180)/360,(1-Math.log(Math.tan(y)+1/Math.cos(y))/Math.PI)/2]};
 const node=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e};
 const tileNodes=new Map(),geometryCache=new Map(),markers=[];let lastLabelOffsets=new Map();let frame=0,zoom=12,cx=0,cy=0,dead=false,drawnZoom=-1;
 const coords=(comparison?comparison.routes.filter(r=>comparison.visible.has(r.Datei)).flatMap(r=>r._geo):row._geo).map(merc);
 const saved=comparison&&comparisonMapState&&comparisonMapState.kind==='osm'?comparisonMapState:null;
 const size=()=>[Math.max(1,viewport.clientWidth),Math.max(1,viewport.clientHeight)];const scale=()=>TILE*2**zoom;
 const clamp=()=>{const half=size()[1]/2/scale();cy=Math.max(half,Math.min(1-half,cy));cx=((cx%1)+1)%1};
 // Ramer-Douglas-Peucker simplification affects ONLY pixels, never GPX calculations.
 // Endpoints are always retained. Geometry is cached per route and zoom level.
 function simplify(points,tolerance){if(points.length<=2)return points;const sq=tolerance*tolerance,keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],len=dx*dx+dy*dy;let best=-1,index=-1;
   for(let i=a+1;i<b;i++){const v=points[i];let t=len?((v[0]-p[0])*dx+(v[1]-p[1])*dy)/len:0;t=Math.max(0,Math.min(1,t));const x=p[0]+t*dx-v[0],y=p[1]+t*dy-v[1],d=x*x+y*y;if(d>best){best=d;index=i}}
   if(best>sq){keep[index]=1;stack.push([a,index],[index,b])}}
  return points.filter((_,i)=>keep[i]);}
 const inverse=p=>{const [lon0,lat0]=row._projection,xx=p[0]/R,yy=p[1]/R,rho=Math.hypot(xx,yy);if(rho<1e-12)return [lon0*180/Math.PI,lat0*180/Math.PI];const c=2*Math.asin(Math.min(1,rho/2)),lat=Math.asin(Math.cos(c)*Math.sin(lat0)+yy*Math.sin(c)*Math.cos(lat0)/rho),lon=lon0+Math.atan2(xx*Math.sin(c),rho*Math.cos(lat0)*Math.cos(c)-yy*Math.sin(lat0)*Math.sin(c));return [lon*180/Math.PI,lat*180/Math.PI]};
 const routePoints=new Map();if(comparison){for(const r of comparison.routes)routePoints.set(r,r._geo.map(merc))}else routePoints.set(row,row._geo.map(merc));
 const ringPoints=!comparison?row._rings.map(r=>r.map(p=>merc(inverse(p)))):[];
 const ringLabels=!comparison?row._rings.map(r=>merc(inverse(visualAreaAnchor(r)))):[];
 const ringNames=!comparison?faceNames(row):[];
 // Use route-local SVG coordinates to avoid subpixel jitter at high OSM zoom levels.
 const [originX,originY]=coords[0]||[0,0];
 // Fixed, pixel-sized SVG coordinates avoid microscopic path/viewBox values.
 const SVG_SCALE=TILE*2**MAX;
 const fmt=v=>v.toFixed(5);const path=points=>points.map((p,i)=>(i?'L':'M')+fmt((p[0]-originX)*SVG_SCALE)+' '+fmt((p[1]-originY)*SVG_SCALE)).join(' ');
 function routeGeometry(r){const key=(comparison?comparison.routes.indexOf(r):0)+'/'+zoom;if(geometryCache.has(key))return geometryCache.get(key);
  const pts=routePoints.get(r),reduced=simplify(pts,0.65/scale()),value=path(reduced);geometryCache.set(key,value);return value;}
 function paintGeometry(){if(dead||drawnZoom===zoom)return;drawnZoom=zoom;overlay.replaceChildren();markers.length=0;
  const addPath=(d,attrs)=>overlay.append(node('path',{d,fill:'none','vector-effect':'non-scaling-stroke',...attrs}));
  if(!comparison)for(let i=0;i<ringPoints.length;i++){const ring=ringPoints[i],reduced=simplify(ring,0.5/scale());overlay.append(node('path',{d:path(reduced)+' Z',fill:i%2?'#8fc9e4':'#82cfa0','fill-opacity':'.34',stroke:'none'}));}
  if(comparison){for(const r of comparison.drawOrder){if(!comparison.visible.has(r.Datei))continue;const i=comparison.routes.indexOf(r),color=COMPARISON_COLORS[i%COMPARISON_COLORS.length],selected=comparison.highlight===r.Datei,d=routeGeometry(r);
   addPath(d,{stroke:'#fff','stroke-width':selected?7:5,'stroke-opacity':selected?1:.65,'stroke-linejoin':'round','stroke-linecap':'round'});
   addPath(d,{stroke:color,'stroke-width':selected?4.5:2.8,'stroke-opacity':comparison.highlight&&!selected?.35:1,'stroke-linejoin':'round','stroke-linecap':'round'});
   if(r._closureMeters){const pts=routePoints.get(r),a=pts[pts.length-1],b=pts[0];addPath(path([a,b]),{stroke:color,'stroke-width':selected?3.5:2.5,'stroke-opacity':comparison.highlight&&!selected?.35:1,'stroke-dasharray':'7 5'});}
  }}else{const d=routeGeometry(row);addPath(d,{stroke:'#fff','stroke-width':5.5,'stroke-linejoin':'round','stroke-linecap':'round'});addPath(d,{stroke:'#176c51','stroke-width':3.3,'stroke-linejoin':'round','stroke-linecap':'round'});
   const pts=routePoints.get(row);if(row._closureMeters)addPath(path([pts[pts.length-1],pts[0]]),{stroke:'#df8a25','stroke-width':3,'stroke-dasharray':'7 5'});
   const [x,y]=[(pts[0][0]-originX)*SVG_SCALE,(pts[0][1]-originY)*SVG_SCALE],circle=node('circle',{cx:x,cy:y,fill:'#fff',stroke:'#176c51','stroke-width':3,'vector-effect':'non-scaling-stroke'});overlay.append(circle);markers.push({circle,r:6});}
  if(!comparison){
   const layer=node('g',{});overlay.append(layer);
   for(let i=0;i<ringLabels.length;i++){
    const [absoluteX,absoluteY]=ringLabels[i],x=(absoluteX-originX)*SVG_SCALE,y=(absoluteY-originY)*SVG_SCALE;
    const leader=node('line',{stroke:'#176c51','stroke-width':1.25,'stroke-opacity':'.85','vector-effect':'non-scaling-stroke'});
    const circle=node('circle',{fill:'#fff','fill-opacity':'.92',stroke:'#176c51','stroke-width':1.5,'vector-effect':'non-scaling-stroke'});
    const text=node('text',{'text-anchor':'middle','font-weight':700,fill:'#176c51'});text.textContent=ringNames[i];
    layer.append(leader,circle,text);
    markers.push({index:i,anchorX:x,anchorY:y,area:row._faceAreas[i],leader,circle,text,r:12});
   }
  }
 }
 function draw(){if(dead)return;const [w,h]=size(),s=scale(),left=cx*s-w/2,top=cy*s-h/2;
  // Pan only changes the SVG viewport. Thousands of route coordinates are not rebuilt.
  paintGeometry();overlay.setAttribute('viewBox',`${(cx-originX-w/(2*s))*SVG_SCALE} ${(cy-originY-h/(2*s))*SVG_SCALE} ${w/s*SVG_SCALE} ${h/s*SVG_SCALE}`);
  const pixelScale=s/SVG_SCALE,viewX=(cx-originX)*s-w/2,viewY=(cy-originY)*s-h/2;
  const labelItems=markers.filter(m=>m.text).map(m=>({index:m.index,x:m.anchorX*pixelScale-viewX,y:m.anchorY*pixelScale-viewY,area:m.area,diameter:2*Math.sqrt(m.area/Math.PI)*s/R})); 
  // Area is in square metres; Web Mercator pixel size depends on latitude.
  for(const item of labelItems){const lat=row._projection[1];item.diameter=2*Math.sqrt(item.area/Math.PI)*s/(R*2*Math.PI*Math.max(.01,Math.cos(lat)));}
  const routeScreen=!comparison?simplify(routePoints.get(row),1.5/s).map(p=>[(p[0]-cx)*s+w/2,(p[1]-cy)*s+h/2]):[];
  const prior=new Map(labelItems.filter(item=>lastLabelOffsets.has(item.index)).map(item=>{const [dx,dy]=lastLabelOffsets.get(item.index);return [item.index,{x:item.x+dx,y:item.y+dy}]}));
  const labelPositions=placeFaceLabels(labelItems,w,h,routeScreen,prior);
  lastLabelOffsets=new Map(labelItems.filter(item=>labelPositions.has(item.index)).map(item=>{const pos=labelPositions.get(item.index);return [item.index,[pos.x-item.x,pos.y-item.y]]}));
  for(const marker of markers){
   if(!marker.text){marker.circle.setAttribute('r',marker.r*SVG_SCALE/s);continue}
   const pos=labelPositions.get(marker.index),visible=!!pos;
   marker.circle.style.display=marker.text.style.display=visible?'':'none';marker.leader.style.display=visible&&pos.external?'':'none';
   if(!visible)continue;
   const lx=(pos.x+viewX)/pixelScale,ly=(pos.y+viewY)/pixelScale;
   marker.circle.setAttribute('cx',lx);marker.circle.setAttribute('cy',ly);marker.circle.setAttribute('r',12/pixelScale);
   marker.text.setAttribute('x',lx);marker.text.setAttribute('y',ly+4/pixelScale);marker.text.setAttribute('font-size',12/pixelScale);
   if(pos.external){marker.leader.setAttribute('x1',marker.anchorX);marker.leader.setAttribute('y1',marker.anchorY);marker.leader.setAttribute('x2',(pos.edge[0]+viewX)/pixelScale);marker.leader.setAttribute('y2',(pos.edge[1]+viewY)/pixelScale)}
  }
  const firstX=Math.floor(left/TILE),lastX=Math.floor((left+w)/TILE),firstY=Math.floor(top/TILE),lastY=Math.floor((top+h)/TILE),n=2**zoom,needed=new Set();
  for(let x=firstX-1;x<=lastX+1;x++)for(let y=firstY-1;y<=lastY+1;y++){if(y<0||y>=n)continue;const key=`${zoom}/${x}/${y}`;needed.add(key);let img=tileNodes.get(key);
   if(!img){img=document.createElement('img');img.alt='';img.draggable=false;img.loading='eager';img.decoding='async';img.src=`https://tile.openstreetmap.org/${zoom}/${((x%n)+n)%n}/${y}.png`;tileNodes.set(key,img);tiles.append(img)}
   img.style.left=(x*TILE-left)+'px';img.style.top=(y*TILE-top)+'px';}
  for(const [key,img] of tileNodes)if(!needed.has(key)){img.remove();tileNodes.delete(key)}
 }
 function scheduleDraw(){if(!frame&&!dead)frame=requestAnimationFrame(()=>{frame=0;draw()})}
 function fit(){const visibleCoords=comparison?comparison.routes.filter(r=>comparison.visible.has(r.Datei)).flatMap(r=>routePoints.get(r)):coords;if(!visibleCoords.length)return;let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;for(const [x,y] of visibleCoords){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}cx=(minx+maxx)/2;cy=(miny+maxy)/2;const [w,h]=size();zoom=Math.max(MIN,Math.min(17,Math.floor(Math.log2(Math.min((w-52)/(Math.max(maxx-minx,1e-8)*TILE),(h-52)/(Math.max(maxy-miny,1e-8)*TILE))))));clamp();scheduleDraw()}
 function zoomAt(next,x,y){const old=scale(),[w,h]=size(),anchor=[cx+(x-w/2)/old,cy+(y-h/2)/old];zoom=Math.max(MIN,Math.min(MAX,next));const s=scale();cx=anchor[0]-(x-w/2)/s;cy=anchor[1]-(y-h/2)/s;clamp();scheduleDraw()}
 const fitButton=addButton('⛶',fit);fitButton.title=lang.fitRoute;fitButton.setAttribute('aria-label',lang.fitRoute);
 viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoomAt(zoom+(e.deltaY<0?1:-1),e.clientX-r.left,e.clientY-r.top)},{passive:false});
 const pointers=new Map();let lastPinch=null;
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);lastPinch=null});
 viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){cx-=(e.clientX-previous[0])/scale();cy-=(e.clientY-previous[1])/scale();clamp();scheduleDraw()}else if(pointers.size===2){const a=[...pointers.values()],dist=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(lastPinch!==null&&dist>lastPinch*1.5){zoomAt(zoom+1,size()[0]/2,size()[1]/2);lastPinch=dist}else if(lastPinch!==null&&dist<lastPinch/1.5){zoomAt(zoom-1,size()[0]/2,size()[1]/2);lastPinch=dist}else if(lastPinch===null)lastPinch=dist}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,e=>{pointers.delete(e.pointerId);lastPinch=null});
 let fitted=false;const observer=new ResizeObserver(()=>{if(dead)return;if(viewport.clientWidth>1&&viewport.clientHeight>1){if(!fitted){fitted=true;if(saved){zoom=saved.zoom;cx=saved.cx;cy=saved.cy;clamp();scheduleDraw()}else fit()}else scheduleDraw()}});observer.observe(viewport);
 return {element:host,getState(){return {kind:'osm',zoom,cx,cy}},destroy(){dead=true;if(frame)cancelAnimationFrame(frame);observer.disconnect();tileNodes.clear();geometryCache.clear();tiles.replaceChildren();overlay.replaceChildren()}};
}

const COMPARISON_COLORS=['#2563eb','#ea580c','#16a34a','#a21caf','#dc2626','#0891b2','#b45309','#4f46e5'];
const LANG={
 de:{compareButton:'Routen vergleichen',compareClose:'Vergleich schließen',compareSort:'Sortieren nach',compareEfficiency:'Kreis-Effizienz',compareAreaSort:'Gesamtfläche',compareLengthSort:'Streckenlänge',compareTitle:'Routenvergleich',compareInfo:'Routen werden einzeln berechnet und gemeinsam verglichen.',compareEmpty:'Mindestens zwei erfolgreich berechnete GPX-Routen erforderlich.',compareCircle:'Kreis',compareSquare:'Quadrat',compareRank:'Rang',compareRoute:'Route',compareShow:'Anzeigen',compareFocus:'Hervorheben',compareAll:'Alle Routen gleich hervorheben',compareMap:'Vergleichskarte',compareOffline:'Ohne OSM-Karte werden alle Routen weiterhin lokal verglichen. Aktiviere OSM für die gemeinsame Kartenansicht.',compareWinner:'Beste Effizienz',compareDetails:'Routendetails anzeigen',compareHideDetails:'Details schließen',compareFullName:'Dateiname',compareSquareValue:'Quadrat-Effizienz',compareFacesValue:'Teilflächen',osmMap:'OpenStreetMap-Karte',osmOn:'OpenStreetMap anzeigen (Internet)',osmOff:'OpenStreetMap ausblenden',fitRoute:'Gesamte Route anzeigen',osmInfo:'OpenStreetMap benötigt Internet. GPX-Dateien werden lokal verarbeitet.',dropHint:'GPX-Dateien hier ablegen',dropInvalid:'Bitte nur GPX-Dateien ablegen.',chooseFiles:'Dateien auswählen',noFiles:'Keine Dateien ausgewählt',selectedFiles:n=>`${n} ${n===1?'Datei ausgewählt':'Dateien ausgewählt'}`,title:'GPX-Routen auswerten',intro:'Wähle eine oder mehrere GPX-Dateien. Die Daten bleiben auf deinem Gerät.',calc:'Routen berechnen',csv:'CSV speichern',results:'Ergebnisse',empty:'Noch keine Auswertung.',ready:'Bereit.',select:'Bitte GPX-Dateien auswählen.',processed:n=>`${n} ${n===1?'Datei verarbeitet':'Dateien verarbeitet'}.`,distance:'Strecke',area:'Fläche',circle:'Kreis-Effizienz',maxArea:'max.: ',square:'Quadrat-Effizienz',faces:'Teilflächen',faceBreakdown:'Einzelne Teilflächen',areaUnit:'Flächeneinheit',face:'Teilfläche',faceSum:'Summe der Teilflächen',faceNote:'Rundungsbedingt kann die Summe der angezeigten Teilflächen leicht abweichen.',start:'Start',route:'Route',filled:'gezählte Fläche',update:'Neue Version verfügbar',updateAction:'Jetzt aktualisieren',updateNote:'Deine ausgewählten GPX-Dateien müssen danach gegebenenfalls erneut geöffnet werden.',upToDate:'Aktuelle Version',tabGpx:'GPX-Analyse',tabManual:'Manuell',manualHeading:'Manuelle Effizienzberechnung',manualIntro:'Strecke und Fläche eingeben – Ergebnisse werden automatisch berechnet.',manualLength:'Streckenlänge (km)',manualArea:'Eingeschlossene Fläche (km²)',manualPrompt:'Bitte Länge und Fläche eingeben.',manualInvalid:'Bitte gültige Zahlen eingeben (Komma oder Punkt).',manualLengthInvalid:'Die Streckenlänge muss größer als 0 sein.',manualAreaInvalid:'Die Fläche darf nicht negativ sein.',manualCircleIdeal:'Ideale Kreisfläche',manualSquareIdeal:'Ideale Quadratfläche',manualWarning:'Die Fläche ist größer als die maximale Kreisfläche für diese Streckenlänge. Bitte die Eingaben und Messgrundlagen überprüfen.',themeLabel:'Design',themeSystem:'System',themeLight:'Hell',themeDark:'Dunkel',footer:'GPX-Auswertung erfolgt lokal auf deinem Gerät.',autoClosed:'Route rechnerisch geschlossen:',closureLegend:'Endverbindung',legendAreaSingle:'Fläche',legendAreaPlural:'Flächen',errors:{INVALID_XML:'Ungültige GPX/XML-Datei',NO_POINTS:'Keine Track- oder Routenpunkte gefunden',INVALID_COORDS:'Ungültige GPS-Koordinaten',DISCONNECTED:'Getrennte Track-Segmente: Fläche nicht zuverlässig',TOO_MANY_POINTS:'GPX-Datei überschreitet die Sicherheitsgrenze (150.000 Abschnitte)'},error:'FEHLER',noFaces:'Keine geschlossene Teilfläche erkannt'},
 en:{compareButton:'Compare routes',compareClose:'Close comparison',compareSort:'Sort by',compareEfficiency:'Circle efficiency',compareAreaSort:'Total area',compareLengthSort:'Route distance',compareTitle:'Route comparison',compareInfo:'Routes are calculated individually and compared together.',compareEmpty:'At least two successfully calculated GPX routes are required.',compareCircle:'Circle',compareSquare:'Square',compareRank:'Rank',compareRoute:'Route',compareShow:'Show',compareFocus:'Highlight',compareAll:'Highlight all routes equally',compareMap:'Comparison map',compareOffline:'All routes are compared locally even without OSM. Enable OSM for the combined map.',compareWinner:'Best efficiency',compareDetails:'Show route details',compareHideDetails:'Close details',compareFullName:'Filename',compareSquareValue:'Square efficiency',compareFacesValue:'Enclosed areas',osmMap:'OpenStreetMap map',osmOn:'Show OpenStreetMap (online)',osmOff:'Hide OpenStreetMap',fitRoute:'Fit entire route',osmInfo:'OpenStreetMap requires internet access. GPX files are processed locally.',dropHint:'Drop GPX files here',dropInvalid:'Please drop GPX files only.',chooseFiles:'Browse files',noFiles:'No files selected',selectedFiles:n=>`${n} ${n===1?'file selected':'files selected'}`,title:'Analyze GPX routes',intro:'Select one or more GPX files. Your data stays on your device.',calc:'Analyze routes',csv:'Save CSV',results:'Results',empty:'No results yet.',ready:'Ready.',select:'Please select GPX files.',processed:n=>`${n} ${n===1?'file processed':'files processed'}.`,distance:'Distance',area:'Area',circle:'Circle efficiency',maxArea:'max.: ',square:'Square efficiency',faces:'Enclosed regions',faceBreakdown:'Individual enclosed areas',areaUnit:'Area unit',face:'Area',faceSum:'Sum of enclosed areas',faceNote:'The sum of displayed enclosed areas may differ slightly due to rounding.',start:'Start',route:'Route',filled:'counted area',update:'New version available',updateAction:'Update now',updateNote:'You may need to select your GPX files again after updating.',upToDate:'Current version',tabGpx:'GPX analysis',tabManual:'Manual',manualHeading:'Manual efficiency calculator',manualIntro:'Enter distance and area – results are calculated automatically.',manualLength:'Route distance (km)',manualArea:'Enclosed area (km²)',manualPrompt:'Enter distance and area.',manualInvalid:'Please enter valid numbers (comma or decimal point).',manualLengthInvalid:'Distance must be greater than 0.',manualAreaInvalid:'Area cannot be negative.',manualCircleIdeal:'Ideal circle area',manualSquareIdeal:'Ideal square area',manualWarning:'The area exceeds the maximum circular area for this distance. Please check the inputs and measurement methods.',themeLabel:'Theme',themeSystem:'System',themeLight:'Light',themeDark:'Dark',footer:'GPX analysis is performed locally on your device.',autoClosed:'Route closed for calculation:',closureLegend:'Closing connection',legendAreaSingle:'Area',legendAreaPlural:'Areas',errors:{INVALID_XML:'Invalid GPX/XML file',NO_POINTS:'No track or route points found',INVALID_COORDS:'Invalid GPS coordinates',DISCONNECTED:'Disconnected track segments: area is unreliable',TOO_MANY_POINTS:'GPX exceeds safety limit (150,000 segments)'},error:'ERROR',noFaces:'No enclosed region detected'}
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
  if(!busy)el('status').textContent=rows.length?t().processed(rows.length):'';
  el('updateTitle').textContent=t().update;el('updateButton').textContent=t().updateAction;el('updateNote').textContent=t().updateNote;
  for(const m of activeMaps)m.destroy();activeMaps=[];const results=el('results');results.replaceChildren();
  try{renderComparison()}catch(error){console.error('Comparison map render failed:',error);comparisonMapInstance=null;const host=el('comparison');const notice=document.createElement('p');notice.className='small error';notice.textContent=language==='de'?'Vergleichskarte konnte nicht angezeigt werden. Die Einzelauswertungen bleiben erhalten.':'Comparison map could not be displayed. Individual results remain available.';host.append(notice)}
  // Match individual result order to the active comparison table when comparison is expanded.
  const comparisonEligible=rows.filter(r=>r.Strecke_km!==undefined&&r.Teilflaechen>0);
  const comparisonActive=compareOpen&&comparisonEligible.length>=2;
  const comparisonOrder=comparisonActive?[...comparisonEligible].sort((a,b)=>compareMetric==='area'?b.Flaeche_km2-a.Flaeche_km2:compareMetric==='length'?b.Strecke_km-a.Strecke_km:b.Kreis_Effizienz_Prozent-a.Kreis_Effizienz_Prozent):[];
  const orderedRows=comparisonActive?[...comparisonOrder,...rows.filter(r=>!comparisonEligible.includes(r))]:rows;
  for(const row of orderedRows){const div=document.createElement('div');div.className='route';div.dataset.rowIndex=String(rows.indexOf(row));const title=document.createElement('h3');title.textContent=row.Datei;
   if(comparisonActive&&comparisonEligible.includes(row)){title.classList.add('comparison-marked-title');title.style.setProperty('--route-color',COMPARISON_COLORS[comparisonEligible.indexOf(row)%COMPARISON_COLORS.length]);}
   div.append(title);
   if(row.Strecke_km!==undefined){try{const mapSlot=document.createElement('div');if(osmEnabled){const m=createOsmMap(row,language);activeMaps.push(m);const mapFrame=document.createElement('div');mapFrame.className='route-map osm-route-frame';mapFrame.append(m.element);appendLineLegend(mapFrame,row,language);mapSlot.append(mapFrame)}else mapSlot.append(renderRoute(row));div.append(mapSlot)}catch(e){const warning=document.createElement('p');warning.className='small error';warning.textContent='Route display: '+e.message;div.append(warning)}const stats=document.createElement('div');stats.className='stats';for(const [label,value] of [[t().distance,fmt(row.Strecke_km,2)+' km'],[t().area,fmt(row.Flaeche_km2,2)+' km²'],[t().circle,fmt(row.Kreis_Effizienz_Prozent,2)+' %'],[t().square,fmt(row.Quadrat_Effizienz_Prozent,2)+' %']]){const box=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');box.className='stat';small.textContent=label;strong.textContent=value;box.append(small,strong);if(label===t().circle||label===t().square){const max=document.createElement('span');const ideal=row.Strecke_km**2/(label===t().circle?4*Math.PI:16);max.textContent=t().maxArea+fmt(ideal,2)+' km²';box.append(max)}stats.append(box)}div.append(stats);if(row._closureMeters){const notice=document.createElement('p');notice.className='small closure-notice';notice.append(document.createTextNode(t().autoClosed+' '));const meters=document.createElement('strong');meters.className='closure-distance';meters.textContent=fmt(row._closureMeters,2)+' m';notice.append(meters);div.append(notice)}
   if(row._faceAreas&&row._faceAreas.length)div.append(renderFaceDetails(row,t(),fmt,areaUnit,setAreaUnit))}
   if(row.Strecke_km===undefined||!row.Teilflaechen){const info=document.createElement('p');info.className=row.Strecke_km===undefined?'small error':'small';info.textContent=row.Strecke_km===undefined?t().error+': '+translateError(row._error,language):t().noFaces;div.append(info)}results.append(div);
  }
 };

 function syncResultOrderAndColors(){
  const host=el('results');
  const valid=rows.filter(r=>r.Strecke_km!==undefined&&r.Teilflaechen>0);
  const active=compareOpen&&valid.length>=2;
  const ordered=active?[...valid].sort((a,b)=>compareMetric==='area'?b.Flaeche_km2-a.Flaeche_km2:compareMetric==='length'?b.Strecke_km-a.Strecke_km:b.Kreis_Effizienz_Prozent-a.Kreis_Effizienz_Prozent):[];
  const orderedRows=active?[...ordered,...rows.filter(r=>!valid.includes(r))]:rows;
  const cards=new Map(Array.from(host.children).map(card=>[Number(card.dataset.rowIndex),card]));
  for(const row of rows){
   const card=cards.get(rows.indexOf(row)),title=card?.querySelector('h3');
   if(!title)continue;
   const marked=active&&valid.includes(row);
   title.classList.toggle('comparison-marked-title',marked);
   if(marked)title.style.setProperty('--route-color',COMPARISON_COLORS[valid.indexOf(row)%COMPARISON_COLORS.length]);
   else title.style.removeProperty('--route-color');
  }
  for(const row of orderedRows){const card=cards.get(rows.indexOf(row));if(card)host.append(card)}
 }
 function renderComparison(){
  const host=el('comparison');if(comparisonMapInstance&&comparisonMapInstance.getState)comparisonMapState=comparisonMapInstance.getState();comparisonMapInstance=null;host.replaceChildren();
  const valid=rows.filter(r=>r.Strecke_km!==undefined&&r.Teilflaechen>0);
  if(!compareOpen||valid.length<2)return;
  const title=document.createElement('h2');title.textContent=t().compareTitle;host.append(title);
  const intro=document.createElement('p');intro.className='small';intro.textContent=t().compareInfo;host.append(intro);
  const toolbar=document.createElement('div');toolbar.className='compare-toolbar';
  const sortChoices=[['efficiency',t().compareEfficiency],['area',t().compareAreaSort],['length',t().compareLengthSort]];
  const sort=document.createElement('select');sort.className='compare-select compare-sort-native';sort.setAttribute('aria-label',t().compareSort);
  for(const [value,label] of sortChoices){const o=document.createElement('option');o.value=value;o.textContent=label;sort.append(o)}
  sort.value=compareMetric;sort.addEventListener('change',()=>{compareMetric=sort.value;renderComparison();syncResultOrderAndColors()});toolbar.append(sort);
  const mobileSort=document.createElement('div');mobileSort.className='compare-sort-mobile';
  const sortTrigger=document.createElement('button');sortTrigger.type='button';sortTrigger.className='compare-focus-trigger compare-sort-trigger';sortTrigger.setAttribute('aria-label',t().compareSort);sortTrigger.setAttribute('aria-expanded','false');
  const sortLabel=document.createElement('span');sortLabel.className='compare-focus-label';sortLabel.textContent=sortChoices.find(([value])=>value===compareMetric)[1];
  const sortChevron=document.createElement('span');sortChevron.textContent='⌄';sortTrigger.append(sortLabel,sortChevron);
  const sortPanel=document.createElement('div');sortPanel.className='compare-focus-panel compare-sort-panel';sortPanel.hidden=true;
  for(const [value,label] of sortChoices){const btn=document.createElement('button');btn.type='button';btn.className='compare-focus-option';if(value===compareMetric)btn.classList.add('selected');const txt=document.createElement('span');txt.textContent=label;btn.append(txt);if(value===compareMetric){const check=document.createElement('strong');check.textContent='✓';btn.append(check)}btn.addEventListener('click',()=>{compareMetric=value;renderComparison();syncResultOrderAndColors()});sortPanel.append(btn)}
  sortTrigger.addEventListener('click',()=>{sortPanel.hidden=!sortPanel.hidden;sortTrigger.setAttribute('aria-expanded',String(!sortPanel.hidden))});
  mobileSort.append(sortTrigger,sortPanel);toolbar.append(mobileSort);
  document.addEventListener('pointerdown',function closeSortOnOutside(e){if(!mobileSort.isConnected){document.removeEventListener('pointerdown',closeSortOnOutside);return}if(!mobileSort.contains(e.target)){sortPanel.hidden=true;sortTrigger.setAttribute('aria-expanded','false')}}, {passive:true});
  const units=document.createElement('div');units.className='unit-control';units.setAttribute('aria-label',t().areaUnit);
  for(const [value,label] of [['km2','km²'],['m2','m²']]){const btn=document.createElement('button');btn.type='button';btn.className='unit-button'+(compareAreaUnit===value?' active':'');btn.textContent=label;btn.setAttribute('aria-pressed',String(compareAreaUnit===value));btn.addEventListener('click',()=>{compareAreaUnit=value;renderComparison()});units.append(btn)}
  toolbar.append(units);host.append(toolbar);
  const sorted=[...valid].sort((a,b)=>compareMetric==='area'?b.Flaeche_km2-a.Flaeche_km2:compareMetric==='length'?b.Strecke_km-a.Strecke_km:b.Kreis_Effizienz_Prozent-a.Kreis_Effizienz_Prozent);
  const drawOrder=[...sorted].reverse().sort((a,b)=>Number(a.Datei===compareHighlight)-Number(b.Datei===compareHighlight));
  const areaText=r=>compareAreaUnit==='km2'?fmt(r.Flaeche_km2,2)+' km²':fmt(r.Flaeche_km2*1e6,2)+' m²';
  const table=document.createElement('table');table.className='compare-table';const head=document.createElement('thead'),hr=document.createElement('tr');
  for(const label of ['#',t().compareRoute,t().distance+' (km)',t().area+' ('+(compareAreaUnit==='km2'?'km²':'m²')+')',t().compareEfficiency+' (%)']){const th=document.createElement('th');th.textContent=label;hr.append(th)}head.append(hr);table.append(head);
  const body=document.createElement('tbody');
  for(const [rank,r] of sorted.entries()){
   const tr=document.createElement('tr');const color=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];
   for(const [i,value] of [String(rank+1),r.Datei,fmt(r.Strecke_km,2),areaText(r),fmt(r.Kreis_Effizienz_Prozent,2)+' %'].entries()){
    const td=document.createElement('td');td.textContent=value;if(i===1){td.className='compare-name';td.style.borderLeft='5px solid '+color}if(rank===0&&i===(compareMetric==='area'?3:compareMetric==='length'?2:4))td.classList.add('compare-best');tr.append(td)
   }body.append(tr);
  }table.append(body);const scroll=document.createElement('div');scroll.className='compare-scroll';scroll.append(table);host.append(scroll);
  const cards=document.createElement('div');cards.className='compare-cards';
  for(const [rank,r] of sorted.entries()){
   const card=document.createElement('article');card.className='compare-card';card.style.borderLeftColor=COMPARISON_COLORS[valid.indexOf(r)%COMPARISON_COLORS.length];
   const name=document.createElement('strong');name.className='compare-card-name';name.textContent='#'+(rank+1)+' · '+r.Datei;card.append(name);
   const metrics=document.createElement('div');metrics.className='compare-card-metrics';
   for(const [metricIndex,[label,value]] of [[t().distance,fmt(r.Strecke_km,2)+' km'],[t().area,areaText(r)],[t().compareEfficiency,fmt(r.Kreis_Effizienz_Prozent,2)+' %']].entries()){
    const item=document.createElement('div'),caption=document.createElement('span'),number=document.createElement('strong');caption.textContent=label;number.textContent=value;if(rank===0&&metricIndex===(compareMetric==='area'?1:compareMetric==='length'?0:2))number.classList.add('compare-best');item.append(caption,number);metrics.append(item)
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
   const mapFrame=document.createElement('div');mapFrame.className='route-map comparison-map-frame';host.append(mapFrame);
   if(osmEnabled){const map=createOsmMap(visible[0],language,{routes:valid,drawOrder,visible:compareVisible,highlight:compareHighlight});comparisonMapInstance=map;activeMaps.push(map);map.element.classList.add('compare-map-with-legend');map.element.append(legend);map.element.addEventListener('pointerdown',closeMobilePanel,true);mapFrame.append(map.element);appendLineLegend(mapFrame,visible[0],language,visible)}
   else {const map=renderComparisonOffline(valid,compareVisible,compareHighlight,drawOrder);comparisonMapInstance=map._mapController;map.classList.add('compare-map-with-legend');map.append(legend);map.addEventListener('pointerdown',closeMobilePanel,true);mapFrame.append(map);appendLineLegend(mapFrame,visible[0],language,visible)}
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
  const svg=node('svg',{viewBox:`0 0 ${w} ${h}`,'preserveAspectRatio':'none',role:'img','aria-label':t().compareMap});svg.classList.add('compare-offline-svg');
  // Draw the grid in map coordinates so it pans and zooms together with the routes.
  // Its own SVG fills the complete viewport, including the space around the route drawing.
  const gridSvg=node('svg',{viewBox:`0 0 ${w} ${h}`,'preserveAspectRatio':'none','aria-hidden':'true'});
  gridSvg.classList.add('compare-offline-grid');
  const defs=node('defs'),pattern=node('pattern',{id:'comparison-moving-grid',width:32,height:32,patternUnits:'userSpaceOnUse'});
  pattern.append(node('path',{d:'M 32 0 L 0 0 0 32',fill:'none',stroke:'#dce9df','stroke-width':'.8'}));
  defs.append(pattern);gridSvg.append(defs);
  gridSvg.append(node('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'url(#comparison-moving-grid)'}));
  drawOrder.forEach(r=>{const i=routes.indexOf(r);if(!visible.has(r.Datei))return;const d=r._geo.map((p,j)=>{const q=point(p);return(j?'L':'M')+q[0].toFixed(2)+' '+q[1].toFixed(2)}).join(' ');
   const selected=highlight===r.Datei,color=COMPARISON_COLORS[i%COMPARISON_COLORS.length],opacity=highlight&&!selected?.28:1;
   svg.append(node('path',{d,fill:'none',stroke:color,'stroke-width':selected?5:3.3,'stroke-opacity':opacity,'stroke-linejoin':'round','stroke-linecap':'round'}));
   if(r._closureMeters){const a=point(r._geo[r._geo.length-1]),b=point(r._geo[0]);svg.append(node('path',{d:`M${a[0].toFixed(2)} ${a[1].toFixed(2)} L${b[0].toFixed(2)} ${b[1].toFixed(2)}`,fill:'none',stroke:color,'stroke-width':selected?4:3,'stroke-opacity':opacity,'stroke-dasharray':'7 5','stroke-linecap':'round'}));}
  });
  // Use one aspect-correct viewport for BOTH SVG layers. A fixed 640x390
  // viewBox letterboxes the route on portrait phones while the grid stretches;
  // that caused rectangular cells and different vertical pan speeds.
  let state=comparisonMapState&&comparisonMapState.kind==='offline'?{...comparisonMapState}:{kind:'offline',x:0,y:0,w,h};
  let currentView=null;
  const viewportSize=()=>{const r=host.getBoundingClientRect();return [Math.max(r.width,1),Math.max(r.height,1)]};
  const viewForScreen=()=>{const [pw,ph]=viewportSize(),aspect=pw/ph;let vw=state.w,vh=state.h;
   if(vw/vh<aspect)vw=vh*aspect;else vh=vw/aspect;
   return {x:state.x+(state.w-vw)/2,y:state.y+(state.h-vh)/2,w:vw,h:vh};
  };
  const apply=()=>{currentView=viewForScreen();const v=currentView,view=`${v.x} ${v.y} ${v.w} ${v.h}`;svg.setAttribute('viewBox',view);gridSvg.setAttribute('viewBox',view)};
  const fit=()=>{state={kind:'offline',x:0,y:0,w,h};apply()};
  const zoomAt=(factor,x,y)=>{const r=svg.getBoundingClientRect(),px=(x-r.left)/r.width,py=(y-r.top)/r.height;
   const before=viewForScreen(),anchorX=before.x+px*before.w,anchorY=before.y+py*before.h;
   const newW=Math.max(10,Math.min(w*8,state.w*factor)),newH=state.h*newW/state.w;
   state.w=newW;state.h=newH;
   const [pw,ph]=viewportSize(),aspect=pw/ph;let vw=newW,vh=newH;if(vw/vh<aspect)vw=vh*aspect;else vh=vw/aspect;
   state.x=anchorX-px*vw-(newW-vw)/2;state.y=anchorY-py*vh-(newH-vh)/2;apply()};
  apply();
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>apply());observer.observe(host);host._mapResizeObserver=observer}
  svg.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?.83:1.2,e.clientX,e.clientY)},{passive:false});
  const pointers=new Map();let lastPinch=null;
  svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;svg.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);lastPinch=null});
  svg.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){const r=svg.getBoundingClientRect();const v=viewForScreen();state.x-=(e.clientX-prev[0])/r.width*v.w;state.y-=(e.clientY-prev[1])/r.height*v.h;apply()}else if(pointers.size===2){const a=[...pointers.values()],dist=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(lastPinch)zoomAt(lastPinch/dist,(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2);lastPinch=dist}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,e=>{pointers.delete(e.pointerId);lastPinch=null});
  host.append(gridSvg,svg);const fitBtn=document.createElement('button');fitBtn.type='button';fitBtn.className='osm-control compare-offline-fit';fitBtn.textContent='⛶';fitBtn.title=t().fitRoute;fitBtn.setAttribute('aria-label',t().fitRoute);fitBtn.addEventListener('click',fit);host.append(fitBtn);
  host._mapController={getState:()=>({...state}),destroy:()=>host._mapResizeObserver?.disconnect()};return host;
 }

 let droppedFiles=null;
 function selectedGpxFiles(){return droppedFiles||Array.from(el('files').files)}
 function updateFileSelection(){const n=selectedGpxFiles().length;el('selectedFiles').textContent=n?t().selectedFiles(n):t().noFiles}
 el('files').addEventListener('change',()=>{droppedFiles=null;updateFileSelection()});
 const dropZone=el('dropZone');
 let dragDepth=0;
 function isFileDrag(event){return Array.from(event.dataTransfer?.types||[]).includes('Files')}
 dropZone.addEventListener('dragenter',event=>{if(!isFileDrag(event))return;event.preventDefault();dragDepth++;dropZone.classList.add('is-dragover')});
 dropZone.addEventListener('dragover',event=>{if(!isFileDrag(event))return;event.preventDefault();event.dataTransfer.dropEffect='copy';dropZone.classList.add('is-dragover')});
 dropZone.addEventListener('dragleave',event=>{if(!isFileDrag(event))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)dropZone.classList.remove('is-dragover')});
 dropZone.addEventListener('drop',event=>{
  if(!isFileDrag(event))return;
  event.preventDefault();dragDepth=0;dropZone.classList.remove('is-dragover');
  const files=Array.from(event.dataTransfer.files);
  if(!files.length)return;
  if(files.some(file=>!/\.gpx$/i.test(file.name))){el('status').textContent=t().dropInvalid;return}
  droppedFiles=files;el('files').value='';updateFileSelection();el('status').textContent='';
 });
 // Prevent browser navigation when files are dropped outside the import area.
 document.addEventListener('dragover',event=>{if(isFileDrag(event))event.preventDefault()});
 document.addEventListener('drop',event=>{if(isFileDrag(event))event.preventDefault()});
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
  for(const [label,value] of [[t().circle,fmt(area/circle*100,2)+' %'],[t().square,fmt(area/square*100,2)+' %']]){
   const box=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');
   box.className='stat';small.textContent=label;strong.textContent=value;box.append(small,strong);if(label===t().circle||label===t().square){const max=document.createElement('span');max.textContent=t().maxArea+fmt(label===t().circle?circle:square,2)+' km²';box.append(max)}result.append(box);
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
 let geometryWorker=null,workerId=0;const pending=new Map();
 try{geometryWorker=new Worker('./geometry-worker.js?v=1081');geometryWorker.onmessage=e=>{const {id,result,error}=e.data;const p=pending.get(id);if(!p)return;pending.delete(id);error?p.reject(Error(error)):p.resolve(result)};geometryWorker.onerror=()=>{geometryWorker.terminate();geometryWorker=null;for(const p of pending.values())p.reject(Error('Geometry worker failed'));pending.clear()}}catch(e){geometryWorker=null}
 const evaluateAsync=(name,xml)=>geometryWorker?new Promise((resolve,reject)=>{const id=++workerId;pending.set(id,{resolve,reject});geometryWorker.postMessage({id,name,segments:readGpx(xml)})}):Promise.resolve().then(()=>evaluate(name,xml));
 el('calc').onclick=async()=>{
  const files=selectedGpxFiles();
  if(!files.length){el('status').textContent=t().select;return}
  rows=[];compareVisible=new Set();compareHighlight=null;compareOpen=false;comparisonVisibilityMenuOpen=false;comparisonMapState=null;comparisonMapInstance=null;busy=true;el('calc').disabled=true;el('export').disabled=true;
  el('results').replaceChildren();
  el('status').textContent=language==='de'?'Berechnung läuft …':'Calculating …';
  try{
   for(const file of files){
    try{{const result=await evaluateAsync(file.name,await file.text());rows.push(result);compareVisible.add(result.Datei)}}
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
