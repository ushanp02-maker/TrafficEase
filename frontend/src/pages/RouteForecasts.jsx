import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {PageTitle} from '../components/Layout.jsx';
import {GeographicMap,request} from '../RoutePlanner.jsx';
import {DepartureControls,useJourney,journeyPayload} from '../JourneyContext.jsx';
import {InlineError,LoadingCards,SourceInfo} from '../components/Feedback.jsx';
import {localTime} from '../government/api.js';
import Icon from '../components/Icon.jsx';

export default function RouteForecasts({embedded=false}){
 const {journey}=useJourney();
 const [catalog,setCatalog]=useState(null),[journeyId,setJourneyId]=useState('');
 const [dataMode,setDataMode]=useState(import.meta.env.VITE_DEMO_MODE==='true'||new URLSearchParams(window.location.search).get('simulation')==='1'?'SIMULATION':'LIVE');
 const [weatherMode,setWeatherMode]=useState('AUTO'),[manualWeather,setManualWeather]=useState('CLEAR');
 const [data,setData]=useState(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const active=useRef();
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');request('/route-forecasts/catalog',{signal:c.signal}).then(setCatalog).catch(()=>{if(!c.signal.aborted)setError('Journeys are temporarily unavailable. Please try again.');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[reload]);
 useEffect(()=>()=>active.current?.abort(),[]);
 function clear(){active.current?.abort();setBusy(false);setData(null);setSelected('');setError('');}
 async function predict(event){event?.preventDefault();clear();const c=new AbortController();active.current=c;setBusy(true);
  try{const result=await request('/route-forecasts',{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({journeyId,...journeyPayload(journey),dataMode,weatherMode,manualWeather:weatherMode==='MANUAL_SIMULATION'?manualWeather:null})});
   if(c.signal.aborted)return;setData(result);setSelected(result.forecast.result?.recommendation?.routeId||result.routing.routes.find(r=>r.fastestAvailable)?.id||result.routing.routes[0].id);
  }catch(e){if(!c.signal.aborted)setError(e.message);}finally{if(!c.signal.aborted)setBusy(false);}
 }
 const chosen=catalog?.journeys.find(j=>j.id===journeyId),result=data?.forecast.result;
 const [origin,setOrigin]=useState('');
 const destinations=catalog?.journeys.filter(j=>j.origin===origin)||[];
 const routes=data?.routing.routes||[];
 const current=routes.find(r=>r.id===selected),prediction=result?.routePredictions.find(p=>p.routeId===selected);
 const preference=result?.recommendation.status==='EXPERIMENTAL_PREFERENCE';
 const unavailable=data&&!result;
 const modeChange=next=>{clear();setDataMode(next);};
 const Heading=embedded?'h2':'h1';
 return <div className={embedded?'embedded-predictions':'consumer-page traffic-predictions'}>{!embedded&&<PageTitle title="Traffic Predictions"/>}
  <header className="consumer-heading"><div><p className="eyebrow">A LITTLE FORESIGHT. A BETTER JOURNEY.</p><Heading>{embedded?'Plan a little smarter.':'Know before you go.'}</Heading><p>Compare traffic insights for 30 Sri Lankan journeys.</p></div><div className="mode-switch" aria-label="Journey data mode"><button type="button" aria-pressed={dataMode==='LIVE'} onClick={()=>modeChange('LIVE')}>Online</button><button type="button" aria-pressed={dataMode==='SIMULATION'} onClick={()=>modeChange('SIMULATION')}>Simulation</button></div></header>
  <div className="journey-workbench prediction-workbench"><aside className="journey-sidebar planner">
   <div className="section-title"><h2>Your journey</h2><span className="compact-badge">{dataMode==='SIMULATION'?'SIMULATION':'EXPERIMENTAL TRAFFIC'}</span></div>
   {loading?<LoadingCards/>:catalog?<form onSubmit={predict} className="traffic-form">
    <label><span>FROM</span><select required value={origin} onChange={e=>{clear();setOrigin(e.target.value);setJourneyId('');}}><option value="">Choose starting location</option>{[...new Set(catalog.journeys.map(j=>j.origin))].map(id=><option key={id} value={id}>{catalog.places[id].name}</option>)}</select></label>
    <label><span>TO</span><select required disabled={!origin} value={journeyId} onChange={e=>{clear();setJourneyId(e.target.value);}}><option value="">Choose destination</option>{destinations.map(j=><option key={j.id} value={j.id}>{catalog.places[j.destination].name}</option>)}</select></label>
    <DepartureControls onChange={clear}/>
    <button className="primary" disabled={busy||!journeyId}>{busy?'Checking your journey…':embedded?'Find My Route':'Predict Traffic'}<Icon name="arrow" size={17}/></button>
    <details className="advanced-options"><summary>Advanced options</summary><p>Online mode fetches forecast weather automatically. Simulation uses recorded roads and repeatable weather scenarios.</p>{dataMode==='LIVE'&&<><label><span>WEATHER INPUT</span><select value={weatherMode} onChange={e=>{clear();setWeatherMode(e.target.value);}}><option value="AUTO">Automatic weather forecast</option><option value="MANUAL_SIMULATION">Manual weather simulation</option></select></label>{weatherMode==='MANUAL_SIMULATION'&&<label><span>SIMULATED WEATHER</span><select value={manualWeather} onChange={e=>{clear();setManualWeather(e.target.value);}}><option value="CLEAR">Dry</option><option value="RAIN">Rain</option><option value="HEAVY_RAIN">Heavy rain</option></select></label>}</>}</details>
   </form>:null}
   {error&&<InlineError onRetry={()=>catalog?predict():setReload(n=>n+1)}>{error}</InlineError>}
   {!data&&!busy&&<div className="journey-empty"><Icon name="route" size={38}/><b>A clearer picture of the road ahead.</b><p>Choose a journey to see routes and expected traffic category.</p>{dataMode==='SIMULATION'&&<small>Simulation · recorded roads, synthetic traffic.</small>}</div>}
   {busy&&<LoadingCards/>}
   {unavailable&&<InlineError onRetry={()=>predict()}>{data.forecast.status==='WEATHER_UNAVAILABLE'?'Weather is temporarily unavailable. Your routes are still shown.':'Traffic predictions are temporarily unavailable. Your routes are still shown.'}</InlineError>}
   {(error||unavailable)&&dataMode==='LIVE'&&<button className="secondary-light" onClick={()=>modeChange('SIMULATION')}>Try simulation instead</button>}
   <Link className="subtle-link" to="/navigation">Looking for another journey? Search anywhere →</Link>
  </aside><section className="journey-map map-panel"><div className="map-heading"><h2>{chosen?chosen.name:'Your next journey'}</h2><span>{dataMode==='SIMULATION'?'RECORDED ROADS':'ROUTE MAP'}</span></div><GeographicMap data={data?.routing} selected={selected} offline={dataMode==='SIMULATION'}/>{!data&&!busy&&<div className="map-invitation"><Icon name="pin" size={24}/><span>Your route will appear here</span></div>}</section></div>
  {data&&<section className="journey-dashboard" aria-label="Traffic prediction results">
   <div className="journey-summary"><div><span className="eyebrow">{chosen?.name}</span><h2>{prediction?.status==='SUPPORTED'?<><i className={`traffic-dot ${prediction.congestion.toLowerCase()}`}/>{prediction.congestion==='LOW'?'Low traffic':prediction.congestion==='MODERATE'?'Moderate traffic':'High traffic'}</>:'Your available routes'}</h2><span className="compact-badge">{dataMode==='SIMULATION'?'SIMULATION · SYNTHETIC':'EXPERIMENTAL · SYNTHETIC'}</span></div><div className="summary-metrics"><div><strong>{current?(current.distanceMeters/1000).toFixed(1):'–'}</strong><span>kilometres</span></div><div><strong>{current?Math.round(current.durationSeconds/60):'–'}</strong><span>min · {dataMode==='SIMULATION'?'recorded baseline':'baseline estimate'}</span></div><div className="weather-indicator"><Icon name="cloud" size={26}/><b>{data.weather.routes.find(w=>w.routeId===selected)?.category?.replaceAll('_',' ').toLowerCase()||'Unavailable'}</b><span>{dataMode==='SIMULATION'||data.weather.status==='MANUAL_SIMULATION'?'Weather scenario':'Forecast weather'}</span></div></div></div>
   <div className="comparison-heading"><div><h2>Choose your route</h2><p>{routes.length===1?'One available route. No verified alternative was returned.':`${routes.length} available routes · select one to highlight it on the map`}</p></div></div>
   <div className="route-comparison-grid">{routes.map((r,i)=>{const p=result?.routePredictions.find(p=>p.routeId===r.id);const recommended=preference&&result.recommendation.routeId===r.id;return <button type="button" key={r.id} className={`consumer-route-card ${selected===r.id?'selected':''}`} aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)} aria-label={`Select route ${i+1}`}><div className="route-top"><b>Route {i+1}</b><span className="route-tag">{recommended?'Suggested · experimental':r.fastestAvailable?'Fastest available':r.shortestAvailable?'Shortest available':'Alternative'}</span></div><div className="metrics"><strong>{Math.round(r.durationSeconds/60)}<small> min</small></strong><span>{(r.distanceMeters/1000).toFixed(1)} km</span></div><div className="traffic-indicator">{p?.status==='SUPPORTED'?<><i className={`traffic-dot ${p.congestion.toLowerCase()}`}/>{p.congestion.replaceAll('_',' ')}<small>Experimental</small></>:<small>Traffic insight unavailable</small>}</div><small>{dataMode==='SIMULATION'?'Recorded baseline time':'Baseline time'} · {selected===r.id?'Selected':'View on map'}</small></button>;})}</div>
   <div className="route-recommendation"><Icon name="route" size={23}/><div><b>{preference?'A lower-congestion option to explore':routes.length===1?'Your available route':'No clear congestion advantage'}</b><p>{preference?'The highlighted suggestion has lower synthetic congestion burden. It does not guarantee avoiding real traffic.':routes.length===1?'No alternative is available to compare.':'These routes cannot be meaningfully separated by the traffic model. Compare baseline time and distance.'}</p></div></div>
   <SourceInfo><p><b>Traffic:</b> Experimental model trained on synthetic targets, not observed Sri Lankan traffic. No guaranteed traffic avoidance or traffic-adjusted ETA.</p><p><b>Roads & duration:</b> {dataMode==='SIMULATION'?'Genuine recorded OSRM geometry and historical baseline times. No live provider request.':'Genuine OSRM geometry and baseline times. Not live traffic or departure-specific estimates.'} Shortest means shortest among returned alternatives only.</p><p><b>Weather:</b> {data.weather.status==='AVAILABLE'?`Open-Meteo hourly forecast. Retrieved ${localTime(data.weather.retrievedAt)}; valid ${localTime(data.weather.validFor)}. Issue time not supplied.`:data.weather.status==='UNAVAILABLE'?'Unavailable; no weather or traffic result was invented.':'Repeatable or user-selected scenario, not actual weather.'}</p>{result&&<p>Model {result.modelVersion}. Forecast context {localTime(result.forecastAt)} (Asia/Colombo). Road class, lanes and speed limits are unknown and excluded.</p>}<p>© OpenStreetMap contributors · OSRM · Weather by Open-Meteo (CC BY 4.0 when applicable).</p><Link to="/research/scenarios">Independent scenario tool →</Link></SourceInfo>
  </section>}
 </div>;
}
