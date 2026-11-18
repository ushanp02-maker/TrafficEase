// Conservative geometry-based HUD guidance. No camera recognition or traffic-adjusted ETA.
import {angleDelta,bearing,distance,nearestOnSegment} from './geometry.js';
export const LIMITS={enterAccuracy:20,holdAccuracy:30,enterGpsAge:5000,holdGpsAge:10000,headingAge:2000,routeAge:120000,qualifyMs:3000,cooldownMs:5000};
export const PREVIEW_STEPS=[
 {instruction:'Continue straight',road:'Preview avenue',turn:'straight',distance:240,remaining:1400,minutes:6,traffic:'LOW'},
 {instruction:'Turn left',road:'Preview garden road',turn:'left',distance:120,remaining:1120,minutes:5,traffic:'MODERATE'},
 {instruction:'Keep right',road:'Preview lakeside road',turn:'right',distance:180,remaining:850,minutes:4,traffic:'LOW'},
 {instruction:'Take the next left',road:'Preview city loop',turn:'left',distance:90,remaining:520,minutes:3,traffic:'HIGH'},
 {instruction:'Destination ahead',road:'Preview destination',turn:'straight',distance:80,remaining:180,minutes:1,traffic:'LOW'},
];
export function previewAt(elapsed){const t=Math.max(0,elapsed)%40000;const index=Math.floor(t/8000);const step=PREVIEW_STEPS[index];return {...step,remaining:Math.round(step.remaining-(t%8000)/8000*(step.remaining-(PREVIEW_STEPS[index+1]?.remaining||0))),progress:t/40000,turnDistance:Math.max(20,Math.round(step.distance-(t%8000)/8000*60))};}
const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(finite)&&p[0]>=79.4&&p[0]<=82.1&&p[1]>=5.8&&p[1]<=10.1;
const place=p=>({latitude:p[1],longitude:p[0]});
export function prepareMapRoute(result,id,destination,anchor){
 try{
  const routing=result.routing,route=routing.routes.find(r=>r.id===id);
  if(result.originSource!=='GPS'||routing.estimateKind!=='BASELINE_ROUTING_ESTIMATE'||routing.source!=='OSRM / OpenStreetMap'||routing.comparisonScope!=='RETURNED_ROUTES_ONLY'||!route||routing.departure&&routing.departure.mode!=='LEAVE_NOW')return null;
  const points=route.geometry?.coordinates;
  if(route.geometry?.type!=='LineString'||!Array.isArray(points)||points.length<2||points.length>50000||!points.every(validPoint)||!finite(route.distanceMeters)||route.distanceMeters<=0||!finite(route.durationSeconds)||route.durationSeconds<=0||!anchor||!destination||distance(place(points[0]),anchor)>75||distance(place(points.at(-1)),destination)>75)return null;
  let length=0;const segments=[];
  for(let i=1;i<points.length;i++){const a=place(points[i-1]),b=place(points[i]);const size=distance(a,b);if(size>=1)segments.push({a,b,start:length,length:size,bearing:bearing(a,b)});length+=size;}
  if(!segments.length||Math.abs(length-route.distanceMeters)>Math.max(100,route.distanceMeters*.1))return null;
  return {route,segments,length,generatedAt:Date.parse(routing.generatedAt),anchor};
 }catch{return null;}
}
export function prepareNavigation(result,id,destination,anchor){
 try{
  const shape=prepareMapRoute(result,id,destination,anchor),directions=result.directions?.find(d=>d.routeId===id);
  if(!shape||!directions?.complete||!directions.steps?.length||directions.steps.length>2048)return null;
  let cursor=0,seconds=0;const steps=[];
  for(const step of directions.steps){
   if(!validPoint(step.location)||typeof step.type!=='string'||!finite(step.distanceMeters)||step.distanceMeters<0||!finite(step.durationSeconds)||step.durationSeconds<0)return null;
   steps.push({...step,start:cursor,end:cursor+step.distanceMeters});cursor+=step.distanceMeters;seconds+=step.durationSeconds;
  }
  if(Math.abs(cursor-shape.route.distanceMeters)>Math.max(5,shape.route.distanceMeters*.02)||Math.abs(seconds-shape.route.durationSeconds)>Math.max(5,shape.route.durationSeconds*.02))return null;
  return {...shape,steps};
 }catch{return null;}
}
export function projectRoute(nav,gps){
 const hits=[];
 for(const segment of nav.segments){
  // Cheap local bounding-box guard before segment projection, not geographic inference.
  if(gps.latitude<Math.min(segment.a.latitude,segment.b.latitude)-.001||gps.latitude>Math.max(segment.a.latitude,segment.b.latitude)+.001||gps.longitude<Math.min(segment.a.longitude,segment.b.longitude)-.001||gps.longitude>Math.max(segment.a.longitude,segment.b.longitude)+.001)continue;
  const hit=nearestOnSegment(gps,segment.a,segment.b);
  if(hit)hits.push({...hit,along:segment.start+Math.min(segment.length,distance(segment.a,hit))});
 }
 hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)return null;
 const best=hits[0];const competitor=hits.find(h=>Math.abs(h.along-best.along)>50&&h.distance-best.distance<Math.max(8,gps.accuracy));
 return {...best,ambiguous:!!competitor};
}
export function maneuverText(step){
 const road=step.roadName?.trim();const onto=road?` onto ${road}`:'';
 if(step.type==='arrive')return 'Destination nearby';
 if(step.modifier==='uturn')return `Make a U-turn${onto}`;
 if(['roundabout','rotary','roundabout turn'].includes(step.type))return step.exit?`At the roundabout, take exit ${step.exit}`:'Follow the roundabout';
 if(step.type==='turn'||step.type==='end of road')return `${step.modifier?.includes('left')?'Turn left':step.modifier?.includes('right')?'Turn right':step.modifier==='uturn'?'Make a U-turn':'Continue'}${onto}`;
 if(['fork','merge','on ramp','off ramp'].includes(step.type))return `Keep ${step.modifier?.includes('left')?'left':step.modifier?.includes('right')?'right':'on the route'}${onto}`;
 return road?`Continue on ${road}`:'Continue on the route';
}
export function evaluateNavigation({nav,gps,heading,now,enabled,failed=false,holding=false}){
 const fail=reason=>({usable:false,reason});
 if(!enabled)return fail('Start the rear camera and choose a destination to connect a route.');
 if(failed||!nav)return fail('Waiting for a complete, current road route.');
 const accuracy=holding?30:20,gpsAge=holding?10000:5000;
 if(!gps||![gps.latitude,gps.longitude,gps.accuracy,gps.timestamp].every(finite)||gps.accuracy<=0||gps.accuracy>accuracy||now-gps.timestamp>gpsAge||gps.timestamp>now+1000)return fail('Waiting for a reliable location.');
 if(!heading||!finite(heading.degrees)||!heading.stable||!finite(heading.timestamp)||now-heading.timestamp>(holding?2000:1500)||heading.timestamp>now+1000||heading.accuracy!=null&&(!finite(heading.accuracy)||heading.accuracy<0||heading.accuracy>(holding?20:15)))return fail('Hold the phone upright and wait for a steady compass.');
 if(!finite(nav.generatedAt)||now-nav.generatedAt>120000||nav.generatedAt>now+5000)return fail('Refreshing the road route.');
 const projection=projectRoute(nav,gps);
 if(!projection||projection.ambiguous||projection.distance>Math.min(holding?25:15,gps.accuracy+(holding?8:3))||Math.abs(angleDelta(projection.bearing,heading.degrees))>(holding?45:30))return fail('Your position or direction does not confidently match this route.');
 const progress=Math.max(0,Math.min(1,projection.along/nav.length));const along=progress*nav.route.distanceMeters;
 let index=nav.steps.findIndex(s=>s.end>along+.5);if(index<0)index=nav.steps.length-1;
 const current=nav.steps[index],next=nav.steps[index+1]||current;
 const fraction=current.distanceMeters>0?Math.max(0,Math.min(1,(along-current.start)/current.distanceMeters)):1;
 const seconds=current.durationSeconds*(1-fraction)+nav.steps.slice(index+1).reduce((sum,s)=>sum+s.durationSeconds,0);
 const turnBearing=next.modifier==='uturn'?180:next.modifier?.includes('left')?-45:next.modifier?.includes('right')?45:angleDelta(projection.bearing,heading.degrees);
 return {usable:true,reason:'Approximate GPS/compass route match, not camera recognition.',projection,progress,remainingMeters:Math.max(0,nav.route.distanceMeters-along),baselineSeconds:Math.max(0,seconds),turnDistance:Math.max(0,(next===current?current.end:next.start)-along),instruction:maneuverText(next),roadName:current.roadName||'Mapped road',arrowDegrees:Math.max(-180,Math.min(180,turnBearing))};
}
export const initialTransition=()=>({phase:'PREVIEW',key:null,stableSince:null,reenterAt:0,lastAt:0});
export function transition(previous,{key,quality,holdQuality,now}){
 let s={...previous};
 if(s.key!==key||now<s.lastAt||now-s.lastAt>1500)s={...initialTransition(),key,reenterAt:s.phase==='LIVE'?now+5000:s.reenterAt};
 s.lastAt=now;
 if(s.phase==='LIVE'){
  if(holdQuality.usable)return s;
  return {...s,phase:'PREVIEW',stableSince:null,reenterAt:now+LIMITS.cooldownMs};
 }
 if(!quality.usable)return {...s,stableSince:null};
 s.stableSince=s.stableSince??now;
 if(now-s.stableSince>=LIMITS.qualifyMs&&now>=s.reenterAt)return {...s,phase:'LIVE'};
 return s;
}
export function createRouteBudget(){return {times:[],failures:0,nextAt:0};}
export function mayRequest(budget,now){budget.times=budget.times.filter(t=>now-t<600000);return budget.failures<4&&budget.times.length<12&&now>=budget.nextAt;}
export function requestStarted(budget,now){budget.times.push(now);budget.nextAt=now+5000;}
export function requestFinished(budget,now,success){budget.failures=success?0:budget.failures+1;budget.nextAt=now+(success?30000:[5000,15000,30000,60000][Math.min(3,budget.failures-1)]);}
