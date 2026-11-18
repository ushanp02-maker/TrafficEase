import './ar/hybrid.css';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {GeographicMap,LocationSearch,request} from './RoutePlanner.jsx';
import {InlineError,SourceInfo} from './components/Feedback.jsx';
import {DepartureControls,useJourney,journeyPayload} from './JourneyContext.jsx';
import useArSensors from './ar/useArSensors.js';
import {createRouteBudget,evaluateNavigation,initialTransition,mayRequest,prepareMapRoute,prepareNavigation,previewAt,requestFinished,requestStarted,transition} from './ar/hybrid.js';

const kilometres=n=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.max(0,Math.round(n))} m`;
export default function ArNavigation(){
 const {journey}=useJourney();const video=useRef();const destinationBox=useRef();const sensors=useArSensors(video);
 const [safe,setSafe]=useState(false),[running,setRunning]=useState(false),[destination,setDestination]=useState(null);
 const [routeRecord,setRouteRecord]=useState(null),[routeId,setRouteId]=useState(''),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false);
 const [manualOrigin,setManualOrigin]=useState(null),[manualData,setManualData]=useState(null),[manualId,setManualId]=useState(''),[manualBusy,setManualBusy]=useState(false),[manualError,setManualError]=useState('');
 const [mapOpen,setMapOpen]=useState(false),[now,setNow]=useState(Date.now()),[pausedAt,setPausedAt]=useState(null),[session,setSession]=useState(0);
 const destinationSelectedAt=useRef(0);const active=useRef(),manualActive=useRef(),budget=useRef(createRouteBudget()),serial=useRef(0),previewStart=useRef(Date.now());
 const [state,setState]=useState(initialTransition);const [retryTick,setRetryTick]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>{clearInterval(timer);active.current?.abort();active.current=null;manualActive.current?.abort();manualActive.current=null;};},[]);
 const stop=useCallback(()=>{
  active.current?.abort();active.current=null;manualActive.current?.abort();setBusy(false);setManualBusy(false);sensors.stop();setRunning(false);setPausedAt(Date.now());setRouteRecord(null);setFailed(false);setSession(s=>s+1);
 },[sensors.stop]);
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',hide);return()=>{window.removeEventListener('pagehide',stop);document.removeEventListener('visibilitychange',hide);};},[stop]);
 function start(){
  if(!safe)return;
  // A single gesture starts iOS orientation permission, GPS and camera; no source-mode chooser.
  sensors.startCompass();sensors.startGps();if(sensors.camera!=='on')sensors.startCamera();
  setRunning(true);setPausedAt(null);setRouteRecord(null);setRouteId('');previewStart.current=Date.now();setNow(Date.now());setSession(s=>s+1);
  budget.current.failures=0;budget.current.nextAt=Date.now();setFailed(false);setRetryTick(t=>t+1);
 }
 function editDestination(value){
  destinationSelectedAt.current=Date.now();
  active.current?.abort();active.current=null;manualActive.current?.abort();setDestination(value);setRouteRecord(null);setManualData(null);setRouteId('');setManualId('');setBusy(false);setManualBusy(false);setFailed(false);setManualError('');budget.current.failures=0;budget.current.nextAt=Date.now();
 }
 function departureChanged(){active.current?.abort();active.current=null;manualActive.current?.abort();setRouteRecord(null);setManualData(null);setBusy(false);setManualBusy(false);setFailed(false);}
 const gpsGood=sensors.gps&&sensors.gps.accuracy>0&&sensors.gps.accuracy<=30&&now-sensors.gps.timestamp<=5000&&sensors.gps.timestamp<=now+1000;
 useEffect(()=>{
  if(!running||!safe||!destination||now-destinationSelectedAt.current<1200||!gpsGood||journey.mode!=='LEAVE_NOW'||active.current||!mayRequest(budget.current,now))return;
  const age=routeRecord?now-Date.parse(routeRecord.response.routing.generatedAt):Infinity;
  if(routeRecord&&!failed&&age<60000)return;
  const controller=new AbortController();active.current=controller;const anchor={...sensors.gps};requestStarted(budget.current,now);setBusy(true);
  request('/ar/routes',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({origin:{latitude:anchor.latitude,longitude:anchor.longitude,accuracyMeters:anchor.accuracy,timestamp:anchor.timestamp},destinationId:destination.id,mode:'LEAVE_NOW',departureAt:null})})
   .then(response=>{
    if(controller.signal.aborted)return;
    const id=response.routing?.routes?.find(r=>r.fastestAvailable)?.id||response.routing?.routes?.[0]?.id;
    if(response.destination?.id!==destination.id||!prepareMapRoute(response,id,destination,anchor))throw new Error('Valid road geometry unavailable.');
    const complete=!!prepareNavigation(response,id,destination,anchor);setRouteRecord({response,anchor,serial:++serial.current});setRouteId(id);setFailed(!complete);requestFinished(budget.current,Date.now(),complete);
   }).catch(()=>{if(!controller.signal.aborted){setFailed(true);requestFinished(budget.current,Date.now(),false);}})
   .finally(()=>{if(active.current===controller){active.current=null;setBusy(false);}});
 },[now,running,safe,destination,gpsGood,sensors.gps,journey.mode,routeRecord,failed,retryTick]);
 const nav=useMemo(()=>routeRecord?prepareNavigation(routeRecord.response,routeId,destination,routeRecord.anchor):null,[routeRecord,routeId,destination]);
 const enabled=!!(safe&&running&&sensors.camera==='on'&&sensors.rear&&destination&&journey.mode==='LEAVE_NOW'&&(window.screen.orientation?.angle??window.orientation??Number.NaN)===0);
 const quality=evaluateNavigation({nav,gps:sensors.gps,heading:sensors.heading,now,enabled,failed});
 const holdQuality=evaluateNavigation({nav,gps:sensors.gps,heading:sensors.heading,now,enabled,failed,holding:true});
 const key=`${session}/${destination?.id||''}/${routeId}`;
 useEffect(()=>{setState(previous=>transition(previous,{key,quality,holdQuality,now}));},[key,now,quality.usable,holdQuality.usable]);
 const live=state.key===key&&state.phase==='LIVE'&&holdQuality.usable&&now>=state.lastAt&&now-state.lastAt<=1500;
 const preview=previewAt((pausedAt??now)-previewStart.current),guidance=live?holdQuality:preview;
 const compass=sensors.heading&&now-sensors.heading.timestamp<=2000&&sensors.heading.timestamp<=now+1000;
 const locating=running&&['Connecting GPS','Location uncertain','Waiting for a better location'].includes(sensors.gpsStatus);
 const source=live?'Live Route':locating?'Guided Preview · Connecting GPS':running&&(busy||state.stableSince!==null)?'Guided Preview · Aligning route':'Guided Preview';
 const routing=manualData||routeRecord?.response.routing,selected=manualData?manualId:routeId;
 async function planManual(event){
  event.preventDefault();if(!manualOrigin||!destination)return;
  manualActive.current?.abort();const c=new AbortController();manualActive.current=c;setManualBusy(true);setManualError('');setManualData(null);
  try{const data=await request('/routes',{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({originId:manualOrigin.id,destinationId:destination.id,...journeyPayload(journey)})});if(!c.signal.aborted){setManualData(data);setManualId(data.routes.find(r=>r.fastestAvailable)?.id||data.routes[0].id);}}
  catch(e){if(!c.signal.aborted)setManualError(e.message);}finally{if(!c.signal.aborted)setManualBusy(false);}
 }
 return <section className="hybrid-ar" aria-label="Hybrid AR navigation">
  <div className="safety-guidance"><b>Stationary or passengers only.</b> Never operate this view while driving.</div>
  <div className="hybrid-stage camera-stage" data-source={live?'LIVE':'PREVIEW'} data-paused={pausedAt!==null}>
   <video ref={video} autoPlay muted playsInline aria-label="Live rear-camera view"/>
   {sensors.camera!=='on'&&<div className="hybrid-camera-background" aria-hidden="true"><div className="hud-grid"/><span>{sensors.camera==='requesting'?'Opening camera…':pausedAt?'Camera paused':'Camera off · guidance preview'}</span></div>}
   <div className="hud-top"><span className={`hud-source ${live?'live':''}`} role="status" aria-label="Guidance data source">{source}</span><time aria-label="Actual device time">{new Date(now).toLocaleTimeString('en-GB',{hour12:false})}</time></div>
   <div className="hud-actions"><button type="button" onClick={()=>setMapOpen(v=>!v)}>Map</button><button type="button" aria-label="Choose navigation destination" onClick={()=>{destinationBox.current?.scrollIntoView({behavior:'smooth',block:'center'});destinationBox.current?.querySelector('input')?.focus({preventScroll:true});}}>{destination?'Destination set':'Add destination'}</button></div>
   <div className="hud-compass" aria-label="Measured compass">{compass?`${Math.round(sensors.heading.degrees)}° · ${sensors.heading.stable?'Compass (approx.)':'Compass settling'}`:'Compass —'}</div>
   <div className="hud-turn" key={`${live?'live':'preview'}-${live?guidance.instruction:preview.instruction}`}>
    <div className="hud-arrow" aria-hidden="true" style={{'--turn-angle':`${live?guidance.arrowDegrees:preview.turn==='left'?-45:preview.turn==='right'?45:0}deg`}}><svg viewBox="0 0 100 120"><path d="M42 111V42L21 63 8 49 50 7l42 42-13 14-21-21v69Z"/></svg><span/></div>
    <span className="hud-turn-distance">{kilometres(live?guidance.turnDistance:preview.turnDistance)} <small>{live?'to maneuver':'· preview'}</small></span>
    <h2>{guidance.instruction}</h2><p>{live?guidance.roadName:preview.road}</p>
   </div>
   <div className="hud-journey-progress"><div><span>{live?'Route progress':'Preview progress'}</span><b>{Math.round(guidance.progress*100)}%</b></div><div className="hud-progress-track"><span style={{width:`${guidance.progress*100}%`}}/></div></div>
   <div className="hud-metrics"><div><small>{live?'Remaining route':'Preview distance'}</small><strong>{kilometres(live?guidance.remainingMeters:preview.remaining)}</strong></div><div><small>{live?'Baseline time':'Preview time'}</small><strong>{live?Math.ceil(guidance.baselineSeconds/60):preview.minutes}<em> min</em></strong></div><div><small>{live?'Traffic':'Preview congestion'}</small><strong className={live?'traffic-unavailable':`preview-traffic ${preview.traffic.toLowerCase()}`}>{live?'Unavailable':preview.traffic}</strong></div></div>
   <div className="hud-footnote">{live?'GPS + provider directions · approximate alignment · no traffic-adjusted ETA':'Simulated guidance, distance, time and congestion · not current road conditions'}</div>
  </div>
  <div className="hybrid-controls"><label className="checkbox-label safety-check"><input type="checkbox" checked={safe} onChange={e=>{setSafe(e.target.checked);if(!e.target.checked)stop();}}/><span>I am stationary or a passenger, not the driver.</span></label><div><button type="button" className="primary" disabled={!safe||sensors.camera==='requesting'} onClick={start}>{running?'Reconnect sensors':'Start rear camera'}</button><button type="button" className="secondary-light" onClick={stop}>Stop camera and sensors</button><button type="button" className="text-button" onClick={()=>setMapOpen(v=>!v)}>{mapOpen?'Close map':'Open map & manual fallback'}</button></div></div>
  <div className="hybrid-destination planner" ref={destinationBox}><div><h2>{destination?'Your destination':'Where would you like to go?'}</h2><p>{destination?'We’ll connect a genuine route automatically when positioning is reliable.':'Preview continues until you choose a destination and usable positioning is available.'}</p></div><LocationSearch title="DESTINATION" location={destination} onEdit={()=>editDestination(null)} onSelect={editDestination}/></div>
  {failed&&<p className="hybrid-notice" role="status">Route connection paused. Guided preview continues while we retry within the connection limit.</p>}
  {!["off","on","requesting"].includes(sensors.camera)&&<p className="hybrid-notice" role="status">Camera unavailable. Guided preview remains interactive; you can retry or use the map.</p>}
  {journey.mode!=='LEAVE_NOW'&&<p className="hybrid-notice">Scheduled departure · map planning only. The camera stays in Guided Preview.</p>}
  {mapOpen&&<div className="hybrid-map-fallback"><form className="planner ar-plan" onSubmit={planManual}><h2>Plan on the map</h2><DepartureControls onChange={departureChanged}/><LocationSearch title="MANUAL STARTING POINT" location={manualOrigin} onEdit={()=>{manualActive.current?.abort();setManualOrigin(null);setManualData(null);setManualBusy(false);}} onSelect={setManualOrigin}/><button className="primary" disabled={!manualOrigin||!destination||manualBusy}>{manualBusy?'Finding routes…':'Calculate map route'}</button></form>{manualError&&<InlineError onRetry={()=>planManual({preventDefault(){}})}>{manualError}</InlineError>}<section className="map-panel"><h2>{manualData?'Manual map route':'GPS route map'}</h2><GeographicMap data={routing} selected={selected}/></section>{routing&&<div className="hybrid-route-cards">{routing.routes.map((r,i)=><button key={r.id} type="button" className={`route-card ${r.id===selected?'selected':''}`} aria-pressed={r.id===selected} onClick={()=>manualData?setManualId(r.id):setRouteId(r.id)}><b>Road route {i+1}</b><span>{(r.distanceMeters/1000).toFixed(1)} km · {Math.round(r.durationSeconds/60)} baseline min</span></button>)}</div>}</div>}
  <details className="ar-help"><summary>Camera & navigation help</summary><div className="sensor-status"><p>Camera: {sensors.camera}</p><p>GPS: {sensors.gpsStatus}{sensors.gps?` · reported accuracy ${Math.round(sensors.gps.accuracy)} m`:''}</p><p>Compass: {sensors.compassStatus}{sensors.heading?.accuracy===null?' · error not reported':''}</p></div><p>{quality.reason}</p><p>Camera and iOS compass permissions require the Start gesture. Keep the phone upright in portrait. Guided Preview is a predefined simulation, not camera road recognition, live traffic or an actual journey.</p><p>GPS uses at most three acquisition windows with 15/30-second backoff. Route refreshes are bounded to twelve requests per ten minutes, with up to four consecutive failed attempts. Reconnect sensors starts a new user-requested acquisition attempt; route-budget limits still apply.</p><p>Precise GPS is sent to geocoding and routing providers only when a destination is selected and a usable fix is available. Camera frames stay on this device. A manual map route cannot activate real camera guidance.</p></details>
  <SourceInfo><p>Guided Preview: predefined fictional journey, simulated distance/time/progress/congestion. Device clock and any displayed compass reading are real measurements, kept separate.</p><p>Live Route: genuine OSRM road geometry and validated provider maneuvers; current GPS/compass alignment is approximate. Remaining distance is projected along mapped geometry; baseline remaining duration uses provider step durations scaled within the current step, not measured delay or a traffic-aware ETA. Traffic is unavailable in live guidance.</p><p>Activation requires continuous confidence for three seconds. Quality loss immediately removes genuine instructions; reacquisition has a five-second cooldown and must qualify again. Stale instructions never remain labeled Live Route.</p></SourceInfo>
 </section>;
}
