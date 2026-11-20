import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {Link} from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import {InlineError,SourceInfo,LoadingCards,friendlyError} from './components/Feedback.jsx';
import { DepartureControls, useJourney, journeyPayload } from './JourneyContext.jsx';

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export async function request(path, options) {
  let response;
  try { response = await fetch(`${apiBase}/api${path}`, options); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Connection lost. Please try again.');
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error('This service is temporarily unavailable. Please try again.'); }
  if (!response.ok) { const error=new Error(friendlyError(body?.code,response.status));error.code=body?.code;error.status=response.status;throw error; }
  return body;
}
export function LocationSearch({ title, location, onSelect, onEdit }) {
  const [query, setQuery] = useState('');
  const validQuery = query.trim().length >= 2 && /\p{L}/u.test(query);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const active = useRef();
  useEffect(() => () => active.current?.abort(), []);
  async function search() {
    if (!validQuery) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setResults([]); setSearched(false);
    try {
      const data = await request(`/locations?query=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setResults(data.locations); setSearched(true);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function edit(value) {
    active.current?.abort(); setBusy(false); setQuery(value); setResults([]);
    setError(''); setSearched(false); onEdit();
  }
  return <div className="location-search">
    <label><span>{title}</span><input value={query} maxLength={160}
      placeholder="Search anywhere in Sri Lanka" onChange={e => edit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (validQuery && !busy) search(); } }}/></label>
    <button className="search-button" type="button" onClick={search} disabled={busy || !validQuery}>{busy ? 'Searching…' : `Search ${title.toLowerCase()}`}</button>
    {busy && <p role="status">Searching Sri Lankan locations…</p>}
    {error && <InlineError onRetry={search}>{error}</InlineError>}
    {searched && results.length === 0 && <p role="status">No matching Sri Lankan locations. Try a nearby town, street or landmark.</p>}
    {results.length > 0 && <ul className="place-results" aria-label={`${title} results`}>{results.map(result =>
      <li key={result.id}><button type="button" aria-pressed={location?.id === result.id} onClick={() => { onSelect(result); setQuery(result.name); setResults([]); setSearched(false); }}>{result.name}</button></li>
    )}</ul>}
    {location && <p className="selected-place">Selected: {location.name}</p>}
  </div>;
}
export function GeographicMap({ data, selected, offline=false }) {
  const container = useRef(); const map = useRef(); const layer = useRef(); const tiles = useRef();
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    map.current = L.map(container.current, { scrollWheelZoom: false }).setView([7.85, 80.7], 7);
    const url = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    setTileError(false);
    if (!offline) { tiles.current = L.tileLayer(url, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current);
    tiles.current.on('tileerror', () => setTileError(true)); } else {
      const grid=[];for(let lat=6;lat<=10;lat+=.05)grid.push([[79.5,lat],[82,lat]]);for(let lon=79.5;lon<=82;lon+=.05)grid.push([[lon,6],[lon,10]]);
      L.geoJSON({type:'MultiLineString',coordinates:grid},{style:{color:'#c9d6dd',weight:1,opacity:.5},interactive:false}).addTo(map.current);
    }
    layer.current = L.featureGroup().addTo(map.current);
    const observer = new ResizeObserver(() => {
      if (!map.current) return;
      map.current.invalidateSize();
      // Preserve a useful overview when rotating a phone or resizing a split map.
      const bounds = layer.current?.getBounds();
      if (bounds?.isValid()) map.current.fitBounds(bounds, { padding: [25, 25], maxZoom: 15, animate: false });
    }); observer.observe(container.current);
    return () => { observer.disconnect(); map.current.remove(); map.current = null; };
  }, [offline]);
  useEffect(() => {
    layer.current.clearLayers();
    if (!data) return;
    // Draw selected route last so that it remains visible above alternatives.
    [...data.routes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected)).forEach(route => {
      L.geoJSON(route.geometry, { style: { color: route.id === selected ? '#d49c00' : '#607d94', weight: route.id === selected ? 6 : 4, opacity: .9 } }).addTo(layer.current);
    });
    data.snapping.forEach((point, i) => {
      L.circleMarker([point.latitude, point.longitude], { radius: 7, color: '#102333', fillColor: '#ffca28', fillOpacity: 1 }).bindTooltip(i === 0 ? 'Routed start' : 'Routed destination').addTo(layer.current);
    });
    const points = data.routes.flatMap(r => r.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
    map.current.fitBounds(L.latLngBounds(points), { padding: [25, 25], maxZoom: 15, animate: false });
  }, [data, selected, offline]);
  return <><div className={`geographic-map ${offline?'offline-map':''}`} ref={container} aria-label="Interactive Sri Lankan road map"/>
    {tileError && <div className="map-warning" role="status">Map background unavailable. Your route is still shown. <button type="button" onClick={() => { setTileError(false); tiles.current.redraw(); }}>Retry map</button></div>}
    <p className="map-credit">{offline&&'Offline geographic grid · recorded road geometry · '}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
  </>;
}
export default function RoutePlanner({ home=false }) {
  const { journey } = useJourney();
  const [origin, setOrigin] = useState(null), [destination, setDestination] = useState(null);
  const [data, setData] = useState(null), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef();
  useEffect(() => () => active.current?.abort(), []);
  function clear() { active.current?.abort(); setBusy(false); setData(null); setError(''); setSelected(''); }
  function choose(setter, value) { clear(); setter(value); }
  async function plan(event) {
    event.preventDefault(); if (!origin || !destination || origin.id === destination.id) return;
    clear(); const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      const result = await request('/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originId: origin.id, destinationId: destination.id, ...journeyPayload(journey) }), signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(result?.routes) || result.routes.length === 0 ||
          result.routes.some(route =>
            !route || !route.id ||
            !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0 ||
            !Number.isFinite(route.durationSeconds) || route.durationSeconds < 0 ||
            route.geometry?.type !== 'LineString' ||
            !Array.isArray(route.geometry.coordinates) ||
            route.geometry.coordinates.length < 2 ||
            route.geometry.coordinates.some(point =>
              !Array.isArray(point) || point.length < 2 ||
              !Number.isFinite(point[0]) || Math.abs(point[0]) > 180 ||
              !Number.isFinite(point[1]) || Math.abs(point[1]) > 90))) {
        throw new Error('No valid road routes were returned. Please try different locations.');
      }
      setData(result);
      setSelected(result.routes.find(r => r.fastestAvailable)?.id || result.routes[0].id);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const sameLocation = Boolean(origin && destination && origin.id === destination.id);
  const sameWinner = data?.routes.some(r => r.fastestAvailable && r.shortestAvailable);
  return <div className="journey-workbench">
    <aside className="journey-sidebar planner"><div className="section-title"><h2>Where to?</h2><span>SRI LANKA</span></div>
      <form onSubmit={plan} className="genuine-planner">
        <LocationSearch title="STARTING POINT" location={origin} onEdit={() => choose(setOrigin, null)} onSelect={value => choose(setOrigin, value)}/>
        <LocationSearch title="DESTINATION" location={destination} onEdit={() => choose(setDestination, null)} onSelect={value => choose(setDestination, value)}/>
        <DepartureControls onChange={clear}/>
        {sameLocation && <p role="alert" className="form-note">Starting point and destination cannot be the same location.</p>}
        <button className="primary calculate-button" type="submit" disabled={!origin||!destination||sameLocation||busy}>{busy?'Finding routes…':home?'Find My Route':'Find routes →'}</button>
      </form>
      {error&&<><InlineError onRetry={()=>plan({preventDefault(){}})}>{error}</InlineError><Link className="secondary-light" to="/ai-predictions?simulation=1">Try a recorded journey simulation →</Link></>}
      <section className="results" aria-label="Route results">
        {busy&&<LoadingCards/>}
        {!data&&!busy&&!error&&<div className="journey-empty"><span aria-hidden="true">⌖</span><b>Every good journey starts here.</b><p>Search and choose your start and destination.</p></div>}
        {data&&<><div className="section-title"><h2>{data.routes.length} route{data.routes.length===1?'':'s'} available</h2></div>{data.routes.map((r,i)=><button type="button" key={r.id} className={`route-card ${selected===r.id?'selected':''}`} aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)}><div className="route-top"><b>Route {i+1}</b><span className="route-tag">{r.fastestAvailable?'Fastest available':r.shortestAvailable?'Shortest available':'Alternative'}</span></div><div className="metrics"><strong>{Math.round(r.durationSeconds/60)}<small> min</small></strong><span>{(r.distanceMeters/1000).toFixed(1)} km</span></div><small>Baseline estimate</small></button>)}
        <SourceInfo><p>Road geometry and baseline times: OSRM / OpenStreetMap. Not live traffic or a departure-specific ETA.</p><p>{sameWinner?'The same route is fastest and shortest among the returned routes.':'Fastest and shortest available routes differ.'} Shortest compares returned routes, not a true minimum-distance objective.</p><p>{data.generatedAt&&`Retrieved ${new Date(data.generatedAt).toLocaleString('en-LK',{timeZone:'Asia/Colombo'})}`}</p></SourceInfo></>}
      </section>
      <Link className="subtle-link" to="/ai-predictions">Check traffic for a supported journey →</Link>
      <details className="source-popover"><summary>Location search & privacy</summary><p>Choose a result after searching. Place names depend on OpenStreetMap coverage. Search uses Nominatim (no autocomplete); routes use OSRM. Do not submit confidential locations. © OpenStreetMap contributors, ODbL.</p><Link to="/research/scenarios">Research & scenarios</Link></details>
    </aside>
    <section className="journey-map map-panel"><div className="map-heading"><h2>Your journey</h2><span>Explore Sri Lanka</span></div><GeographicMap data={data} selected={selected}/></section>
  </div>;
}
