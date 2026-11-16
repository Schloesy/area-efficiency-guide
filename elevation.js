'use strict';
/* Elevation Layout Preview (v1.1.0.4)
 * Isolated from the original GPX geometry, areas and Area Factor calculations.
 * The 20 m resampling / 40 m Gaussian sigma is provisional, not a Komoot or
 * Samsung Health algorithm and not validated for every terrain / device.
 */
(function () {
 const STEP=20, SIGMA=40, EARTH=6371008.8, RAD=Math.PI/180;
 const haversine=(a,b)=>{
  const dlat=(b.lat-a.lat)*RAD,dlon=(b.lon-a.lon)*RAD;
  const v=Math.sin(dlat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dlon/2)**2;
  return 2*EARTH*Math.asin(Math.min(1,Math.sqrt(v)));
 };
 function segmentsFromXml(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('INVALID_XML');
  const nodes=Array.from(doc.getElementsByTagName('*'));
  const children=(node,tag)=>Array.from(node.children).filter(n=>n.localName===tag);
  let groups=nodes.filter(n=>n.localName==='trkseg').map(n=>children(n,'trkpt')).filter(g=>g.length>1);
  if(!groups.length)groups=nodes.filter(n=>n.localName==='rte').map(n=>children(n,'rtept')).filter(g=>g.length>1);
  return groups.map(group=>group.map(node=>{
   const lat=Number(node.getAttribute('lat')),lon=Number(node.getAttribute('lon'));
   const tag=children(node,'ele')[0],raw=tag?tag.textContent.trim():'';
   const elevation=raw===''?null:Number(raw);
   return {lat,lon,elevation:Number.isFinite(elevation)?elevation:null};
  }));
 }
 function interpolate(samples,x){
  if(x<=samples[0].d)return samples[0].z;
  if(x>=samples[samples.length-1].d)return samples[samples.length-1].z;
  let lo=0,hi=samples.length-1;
  while(hi-lo>1){const mid=(hi+lo)>>1;if(samples[mid].d<=x)lo=mid;else hi=mid}
  const a=samples[lo],b=samples[hi];
  return a.z+(b.z-a.z)*(x-a.d)/(b.d-a.d);
 }
 function smoothed(input){
  const range=Math.ceil(3*SIGMA/STEP),result=[];
  for(let i=0;i<input.length;i++){
   let total=0,weightSum=0;
   for(let j=Math.max(0,i-range);j<=Math.min(input.length-1,i+range);j++){
    const dx=input[j].d-input[i].d;
    if(Math.abs(dx)>3*SIGMA)continue;
    const weight=Math.exp(-.5*(dx/SIGMA)**2);
    total+=weight*input[j].z;weightSum+=weight;
   }
   result.push({d:input[i].d,z:total/weightSum});
  }
  return result;
 }
 function analyzeElevationGpx(xml){
  const groups=segmentsFromXml(xml);
  const count=groups.reduce((n,s)=>n+s.length,0);
  const complete=groups.length>0&&groups.every(g=>g.every(p=>p.elevation!==null));
  if(!complete)return {available:false,count,validCount:groups.reduce((n,s)=>n+s.filter(p=>p.elevation!==null).length,0)};
  let total=0,ascent=0,descent=0;
  const profile=[];
  for(const group of groups){
   // Only sum within each track segment: never invent vertical movement across a recording gap.
   const raw=[{d:0,z:group[0].elevation}];
   let d=0;
   for(let i=1;i<group.length;i++){
    const step=haversine(group[i-1],group[i]);
    if(!Number.isFinite(step)||step<.001)continue;
    d+=step;raw.push({d,z:group[i].elevation});
   }
   if(raw.length<2||d<=0)continue;
   const uniform=[];
   for(let at=0;at<d;at+=STEP)uniform.push({d:at,z:interpolate(raw,at)});
   uniform.push({d,z:raw[raw.length-1].z});
   const filtered=smoothed(uniform);
   for(let i=1;i<filtered.length;i++){
    const change=filtered[i].z-filtered[i-1].z;
    if(change>0)ascent+=change;else descent-=change;
   }
   for(let i=0;i<filtered.length;i++){
    // Segment breaks are not counted as climb or descent.
    if(profile.length&&i===0)continue;
    profile.push({d:total+filtered[i].d,z:filtered[i].z});
   }
   total+=d;
  }
  if(profile.length<2)return {available:false,count,validCount:count};
  // Raw starting height is stable across unit switches; reported differences use a
  // consistently smoothed profile, matching the displayed line.
  const start=profile[0].z;
  for(const point of profile)point.relative=point.z-start;
  return {available:true,count,validCount:count,ascent,descent,profile,distanceMeters:total};
 }
 let infoSequence=0;
 function closeInfo(button){
  button.setAttribute('aria-expanded','false');
  const note=document.getElementById(button.getAttribute('aria-controls'));
  if(note)note.hidden=true;
 }
 document.addEventListener('pointerdown',event=>{
  if(event.target.closest('.elevation-info-button,.elevation-info-note'))return;
  for(const button of document.querySelectorAll('.elevation-info-button[aria-expanded="true"]'))closeInfo(button);
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  for(const button of document.querySelectorAll('.elevation-info-button[aria-expanded="true"]')){
   closeInfo(button);button.focus();
  }
 });
 const ns='http://www.w3.org/2000/svg';
 function svgElement(tag,attrs,text){
  const n=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs||{}))n.setAttribute(key,String(value));
  if(text!==undefined)n.textContent=text;
  return n;
 }
 function make(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n}
 // All stored elevation values remain metres; conversion is for display only.
 const displayHeight=(metres,unit,fmt)=>fmt(Math.round(Math.abs(metres)*(unit==='mi'?3.280839895013123:1)),0)+' '+(unit==='mi'?'ft':'m');
 function renderElevationSummary(data,t,lang,unit,fmt){
  if(!data||!data.available)return null;
  const card=make('div','stat elevation-summary');
  const heading=make('div','elevation-info-head');
  heading.append(make('span','elevation-summary-label',t.elevationCombined));
  const infoButton=make('button','elevation-info-button','i');
  infoButton.type='button';
  infoButton.setAttribute('aria-label',t.elevationInfo);
  infoButton.setAttribute('title',t.elevationInfo);
  infoButton.setAttribute('aria-expanded','false');
  heading.append(infoButton);
  card.append(heading);
  const values=make('div','elevation-summary-values');
  for(const [label,value,kind,arrow] of [[t.elevationAscent,data.ascent,'up','↑'],[t.elevationDescent,data.descent,'down','↓']]){
   const item=make('div','elevation-summary-item '+kind);
   item.setAttribute('aria-label',label+': '+(kind==='up'?'+':'−')+displayHeight(value,unit,fmt));
   item.append(make('span','elevation-summary-arrow',arrow));
   item.append(make('strong','elevation-summary-value',(kind==='up'?'+':'−')+displayHeight(value,unit,fmt)));
   values.append(item);
  }
  card.append(values);
  const note=make('p','small elevation-info-note',t.elevationEstimate);
  note.hidden=true;
  note.id='elevation-estimate-note-'+(++infoSequence);
  infoButton.setAttribute('aria-controls',note.id);
  infoButton.addEventListener('click',()=>{
   const shouldOpen=note.hidden;
   for(const other of document.querySelectorAll('.elevation-info-button[aria-expanded="true"]')){
    if(other!==infoButton)closeInfo(other);
   }
   note.hidden=!shouldOpen;
   infoButton.setAttribute('aria-expanded',String(shouldOpen));
  });
  card.append(note);
  return card;
 }
 function renderElevationProfile(data,t,lang,unit,fmt){
  const section=make('section','elevation-section');
  if(!data||!data.available){
   section.append(make('p','small elevation-unavailable',t.elevationUnavailable));return section;
  }
  const box=make('div','elevation-chart-box');
  const summary=make('div','elevation-chart-header'),reading=make('div','elevation-reading'),position=make('div','elevation-position');
  reading.append(make('span','elevation-reading-caption',t.elevationRelative));
  const relativeValue=make('strong','elevation-reading-value');reading.append(relativeValue);
  position.append(make('span','elevation-position-caption',t.elevationPosition));
  const positionValue=make('strong','elevation-position-value');position.append(positionValue);
  summary.append(reading,position);box.append(summary);
  const profile=data.profile,mobile=window.matchMedia('(max-width:600px)').matches;
  const W=mobile?380:850,H=mobile?115:128,L=mobile?49:57,R=mobile?13:19,T=10,B=34,plotW=W-L-R,plotH=H-T-B;
  const total=profile[profile.length-1].d||1;
  let minZ=Infinity,maxZ=-Infinity;for(const point of profile){if(point.z<minZ)minZ=point.z;if(point.z>maxZ)maxZ=point.z}
  // Provide usable visual scale even on very flat tracks.
  const span=Math.max(maxZ-minZ,8),pad=Math.max(span*.14,2);
  const bottom=minZ-pad,top=maxZ+pad;
  const x=d=>L+d/total*plotW;
  const y=z=>T+(top-z)/(top-bottom)*plotH;
  const distanceDisplay=meters=>meters/(unit==='mi'?1609.344:1000);
  // The chart itself replaces the former visible range input as the accessible control.
  const svg=svgElement('svg',{viewBox:`0 0 ${W} ${H}`,role:'slider',tabindex:0,
   'aria-label':t.elevationChartAria+' – '+t.elevationSelectPoint,
   'aria-orientation':'horizontal','aria-valuemin':0,'aria-valuemax':profile.length-1,
   'aria-valuenow':0,class:'elevation-chart'});
  for(let i=0;i<=4;i++){
   const v=bottom+(top-bottom)*i/4,yp=y(v);
   svg.append(svgElement('line',{x1:L,x2:W-R,y1:yp,y2:yp,class:'elevation-grid'}));
   svg.append(svgElement('text',{x:L-9,y:yp+4,'text-anchor':'end',class:'elevation-axis-text'},fmt(Math.round(v*(unit==='mi'?3.280839895013123:1)),0)));
  }
  for(let i=0;i<=4;i++){
   const v=total*i/4,xp=x(v);
   svg.append(svgElement('text',{x:xp,y:H-19,'text-anchor':i===0?'start':i===4?'end':'middle',class:'elevation-axis-text'},fmt(distanceDisplay(v),1)));
  }
  svg.append(svgElement('text',{x:(L+W-R)/2,y:H-2,'text-anchor':'middle',class:'elevation-axis-caption'},t.elevationDistance+' ('+unit+')'));
  svg.append(svgElement('text',{x:W-R,y:T+7,'text-anchor':'end',class:'elevation-axis-caption'},unit==='mi'?'ft':'m'));
  // Keep DOM size bounded while retaining the actual resampled points for selection.
  const stride=Math.max(1,Math.ceil(profile.length/1200)),samples=[];
  for(let i=0;i<profile.length;i+=stride)samples.push(profile[i]);
  if(samples[samples.length-1]!==profile[profile.length-1])samples.push(profile[profile.length-1]);
  const stroke=samples.map((p,i)=>(i?'L':'M')+x(p.d).toFixed(2)+' '+y(p.z).toFixed(2)).join(' ');
  const area=stroke+' L'+x(total).toFixed(2)+' '+(H-B)+' L'+L+' '+(H-B)+' Z';
  svg.append(svgElement('path',{d:area,class:'elevation-fill'}));
  svg.append(svgElement('path',{d:stroke,class:'elevation-line'}));
  const marker=svgElement('circle',{r:6,class:'elevation-marker'});
  const guide=svgElement('line',{class:'elevation-guide',y1:T,y2:H-B});
  svg.append(guide,marker);
  const overlay=svgElement('rect',{x:L,y:T,width:plotW,height:plotH,fill:'transparent',class:'elevation-hit-area'});
  svg.append(overlay);box.append(svg);
  section.append(box);
  let selectedIndex=0;
  function select(index){
   const i=Math.max(0,Math.min(profile.length-1,Math.round(index))),p=profile[i];
   selectedIndex=i;
   const delta=p.relative,roundedDelta=Math.round(Math.abs(delta)*(unit==='mi'?3.280839895013123:1));
   // Suppress misleading '+0 ft' or '−0 ft' after rounding near the start height.
   relativeValue.textContent=(roundedDelta===0?'':delta>0?'+':'−')+fmt(roundedDelta,0)+' '+(unit==='mi'?'ft':'m');
   positionValue.textContent=fmt(distanceDisplay(p.d),2)+' '+unit;
   marker.setAttribute('cx',x(p.d));marker.setAttribute('cy',y(p.z));
   guide.setAttribute('x1',x(p.d));guide.setAttribute('x2',x(p.d));
   svg.setAttribute('aria-valuenow',String(i));
   svg.setAttribute('aria-valuetext',positionValue.textContent+', '+relativeValue.textContent);
   data.selectedFraction=i/(profile.length-1);
  }
  function indexAt(event){
   const bounds=svg.getBoundingClientRect();
   if(!bounds.width)return 0;
   const chartX=(event.clientX-bounds.left)/bounds.width*W;
   const d=Math.max(0,Math.min(1,(chartX-L)/plotW))*total;
   let lo=0,hi=profile.length-1;
   while(hi-lo>1){const mid=(lo+hi)>>1;if(profile[mid].d<d)lo=mid;else hi=mid}
   return Math.abs(profile[lo].d-d)<Math.abs(profile[hi].d-d)?lo:hi;
  }
  // Capture *all* pointer types, including touch, to keep Android dragging
  // stable when the finger briefly leaves the plotted region. touch-action:none
  // on the SVG avoids browser gesture cancellation; page scroll works elsewhere.
  let draggingPointer=null;
  overlay.addEventListener('pointerdown',e=>{
   if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
   draggingPointer=e.pointerId;select(indexAt(e));
   try{overlay.setPointerCapture(e.pointerId)}catch(_){}
  });
  overlay.addEventListener('pointermove',e=>{
   if(draggingPointer===e.pointerId)select(indexAt(e));
  });
  overlay.addEventListener('pointerup',e=>{
   if(draggingPointer!==e.pointerId)return;
   select(indexAt(e));draggingPointer=null;
   if(overlay.hasPointerCapture(e.pointerId))overlay.releasePointerCapture(e.pointerId);
  });
  for(const type of ['pointercancel','lostpointercapture'])
   overlay.addEventListener(type,e=>{if(draggingPointer===e.pointerId)draggingPointer=null});
  // Keyboard access without another visible slider (arrows, Page Up/Down, Home/End).
  svg.addEventListener('keydown',e=>{
   const step=Math.max(1,Math.round((profile.length-1)/100));
   const largeStep=Math.max(1,Math.round((profile.length-1)/10));
   let next;
   switch(e.key){
    case 'ArrowRight':case 'ArrowUp':next=selectedIndex+step;break;
    case 'ArrowLeft':case 'ArrowDown':next=selectedIndex-step;break;
    case 'PageUp':next=selectedIndex+largeStep;break;
    case 'PageDown':next=selectedIndex-largeStep;break;
    case 'Home':next=0;break;
    case 'End':next=profile.length-1;break;
    default:return;
   }
   e.preventDefault();select(next);
  });
  select(Math.round((data.selectedFraction||0)*(profile.length-1)));
  return section;
 }
 window.INTVLElevation={analyzeElevationGpx,renderElevationProfile,renderElevationSummary};
})();
