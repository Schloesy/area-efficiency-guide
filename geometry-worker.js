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


self.onmessage=e=>{const {id,name,xml}=e.data;try{self.postMessage({id,result:evaluate(name,xml)})}catch(err){self.postMessage({id,error:err.message||String(err)})}};
