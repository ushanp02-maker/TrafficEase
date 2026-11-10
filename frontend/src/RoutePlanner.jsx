import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DepartureControls, useJourney, journeyPayload } from './JourneyContext.jsx';

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export async function request(path, options) {
  let response;
  try { response = await fetch(`${apiBase}/api${path}`, options); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the TrafficEase backend. Check that it is running and try again.');
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error('The backend returned an unreadable response. Check the API connection.'); }
  if (!response.ok) throw new Error(body.message || 'The request failed. Please try again.');
  return body;
}
export function LocationSearch({ title, location, onSelect, onEdit }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const active = useRef();
  useEffect(() => () => active.current?.abort(), []);
  async function search() {
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
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (query.trim().length >= 2 && !busy) search(); } }}/></label>
    <button className="search-button" type="button" onClick={search} disabled={busy || query.trim().length < 2}>{busy ? 'Searching…' : `Search ${title.toLowerCase()}`}</button>
    {busy && <p role="status">Searching Sri Lankan locations…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {searched && results.length === 0 && <p role="status">No matching Sri Lankan locations. Try a nearby town, street or landmark.</p>}
    {results.length > 0 && <ul className="place-results" aria-label={`${title} results`}>{results.map(result =>
      <li key={result.id}><button type="button" aria-pressed={location?.id === result.id} onClick={() => { onSelect(result); setQuery(result.name); setResults([]); setSearched(false); }}>{result.name}</button></li>
    )}</ul>}
    {location && <p className="selected-place">Selected: {location.name}</p>}
  </div>;
}
export function GeographicMap({ data, selected }) {
  const container = useRef(); const map = useRef(); const layer = useRef(); const tiles = useRef();
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    map.current = L.map(container.current, { scrollWheelZoom: false }).setView([7.85, 80.7], 7);
    const url = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    tiles.current = L.tileLayer(url, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current);
    tiles.current.on('tileerror', () => setTileError(true));
    layer.current = L.layerGroup().addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); map.current.remove(); map.current = null; };
  }, []);
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
    map.current.fitBounds(L.latLngBounds(points), { padding: [25, 25], maxZoom: 15 });
  }, [data, selected]);
  return <><div className="geographic-map" ref={container} aria-label="Interactive Sri Lankan road map"/>
    {tileError && <div className="map-warning" role="status">Map tiles are unavailable. Any route lines shown still come from OSRM; background geography cannot be verified here. <button type="button" onClick={() => { setTileError(false); tiles.current.redraw(); }}>Retry map</button></div>}
    <p className="map-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a></p>
  </>;
}
export default function RoutePlanner({ onExploreForecast }) {
  const { journey } = useJourney();
  const [origin, setOrigin] = useState(null), [destination, setDestination] = useState(null);
  const [data, setData] = useState(null), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef();
  useEffect(() => () => active.current?.abort(), []);
  function clear() { active.current?.abort(); setBusy(false); setData(null); setError(''); setSelected(''); }
  function choose(setter, value) { clear(); setter(value); }
  async function plan(event) {
    event.preventDefault(); if (!origin || !destination) return;
    clear(); const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      const result = await request('/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originId: origin.id, destinationId: destination.id, ...journeyPayload(journey) }), signal: controller.signal });
      if (controller.signal.aborted) return;
      setData(result); setSelected(result.routes.find(r => r.fastestAvailable)?.id || result.routes[0].id);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const sameWinner = data?.routes.some(r => r.fastestAvailable && r.shortestAvailable);
  return <>
    <section className="planner"><div className="section-title"><h2>Where are you heading?</h2><span>NATIONWIDE LOCATION SEARCH</span></div>
      <form onSubmit={plan} className="genuine-planner">
        <LocationSearch title="STARTING POINT" location={origin} onEdit={() => choose(setOrigin, null)} onSelect={value => choose(setOrigin, value)}/>
        <LocationSearch title="DESTINATION" location={destination} onEdit={() => choose(setDestination, null)} onSelect={value => choose(setDestination, value)}/>
        <DepartureControls onChange={clear}/>
        <button className="primary calculate-button" type="submit" disabled={!origin || !destination || busy}>{busy ? 'Calculating…' : 'Calculate road routes →'}</button>
      </form>
      <p className="form-note">Search explicitly, then select each location. No autocomplete. Place names in Sinhala, Tamil or English depend on available OpenStreetMap data. Searches go to Nominatim; routes go to OSRM. Do not submit confidential locations.</p>
      <p className="map-credit">Geocoding: Nominatim · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL). Please leave at least one second between new searches.</p>
    </section>
    <div className="route-layout"><section className="map-panel"><div className="section-title"><h2>Your journey, on the map</h2><span className="pill">OPENSTREETMAP</span></div><GeographicMap data={data} selected={selected}/></section>
      <section className="results" aria-label="Route results"><div className="section-title"><h2>Available road routes</h2><span>{data ? `${data.routes.length} RETURNED` : 'BASELINE ONLY'}</span></div>
        {busy && <p role="status" className="status">Calculating genuine driving routes with OSRM…</p>}
        {error && <p role="alert" className="error-message">{error}</p>}
        {!data && !busy && !error && <p className="empty-state">Search and select two Sri Lankan locations to calculate road routes. No sample routes are shown.</p>}
        {data && <>{data.departure && <div className="notice"><b>{data.departure.mode.replaceAll('_', ' ')} · {new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(data.departure.departureAt))} (Sri Lanka)</b><span>{data.departure.message}</span></div>}<p className="comparison-note">{sameWinner ? 'The same route is fastest and shortest among the returned routes.' : 'Fastest and shortest available routes differ.'} OSRM does not calculate a true shortest-distance route.</p>
          {data.routes.map((route, index) => <button key={route.id} className={`route-card ${route.id === selected ? 'selected' : ''}`} aria-pressed={route.id === selected} onClick={() => setSelected(route.id)}>
            <div className="route-top"><span className="route-tag">{[route.fastestAvailable && 'Fastest available', route.shortestAvailable && 'Shortest available'].filter(Boolean).join(' · ') || 'Available alternative'}</span></div>
            <h3>Road route {index + 1}</h3><div className="metrics"><strong>{Math.round(route.durationSeconds / 60)}<small> min</small></strong><span>{(route.distanceMeters / 1000).toFixed(1)} km</span></div><p>OSRM baseline estimate · not live traffic</p>
          </button>)}
          <div className="source-details"><p>Source: {data.source}</p><p>Calculated: {new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(data.generatedAt))} (Sri Lanka)</p><p>Road snapping: {data.snapping.map(s => `${s.endpoint} ${Math.round(s.distanceMeters)} m`).join(' · ')}</p>{data.limitations.map(text => <p key={text}>{text}</p>)}</div>
        </>}
      </section>
    </div>
    <section className="planner"><h2>Explore a separate experimental scenario</h2><p className="form-note">The synthetic AI catalog has fictional road/region scenarios, not mapped OSRM segments. You can reuse this departure time, then explicitly choose a hypothetical scenario. It cannot adjust these route times or identify real congestion.</p><button type="button" className="secondary-light" onClick={onExploreForecast}>Explore AI scenarios for this departure →</button></section>
  </>;
}
