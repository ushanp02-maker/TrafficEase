import React, { useEffect, useRef, useState } from 'react';
import { GeographicMap, LocationSearch, request } from './RoutePlanner.jsx';
import useArSensors from './ar/useArSensors.js';
import { DepartureControls, useJourney, journeyPayload } from './JourneyContext.jsx';
import { alignment, angleDelta, bearing, recommendation } from './ar/geometry.js';

export default function ArNavigation() {
  const { journey } = useJourney();
  const video = useRef(); const sensors = useArSensors(video);
  const [safe, setSafe] = useState(false), [mode, setMode] = useState('gps');
  const [destination, setDestination] = useState(null), [origin, setOrigin] = useState(null);
  const [data, setData] = useState(null), [anchor, setAnchor] = useState(null), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [now, setNow] = useState(Date.now());
  const active = useRef();
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => { clearInterval(timer); active.current?.abort(); }; }, []);
  function clear() { active.current?.abort(); setBusy(false); setData(null); setAnchor(null); setSelected(''); setError(''); }
  async function calculate(event) {
    event.preventDefault();
    if (!destination || (mode === 'gps' ? !gpsFresh : !origin)) { setError('Choose a destination and a fresh GPS fix or manual starting point.'); return; }
    clear(); const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      let result, snapshot = null;
      if (mode === 'gps') {
        snapshot = sensors.gps;
        result = await request('/ar/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ origin: { latitude: snapshot.latitude, longitude: snapshot.longitude, accuracyMeters: snapshot.accuracy, timestamp: snapshot.timestamp }, destinationId: destination.id, ...journeyPayload(journey) }) });
      } else {
        const routing = await request('/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ originId: origin.id, destinationId: destination.id, ...journeyPayload(journey) }) });
        result = { routing, destination, candidates: [], originSource: 'MANUAL' };
      }
      if (controller.signal.aborted) return;
      setData(result); setAnchor(snapshot); setSelected(result.routing.routes.find(r => r.fastestAvailable)?.id || result.routing.routes[0].id);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const gpsFresh = sensors.gps && now - sensors.gps.timestamp <= 10000 && sensors.gps.accuracy > 0 && sensors.gps.accuracy <= 30;
  const match = journey.mode !== 'LEAVE_NOW' ? { reliable: false, reason: 'Scheduled journeys use map planning only. Current sensors cannot establish future conditions or departure-specific camera recommendations.' } : alignment({ gps: sensors.gps, heading: (window.screen.orientation?.angle ?? window.orientation ?? Number.NaN) === 0 ? sensors.heading : null,
    rearCamera: journey.mode === 'LEAVE_NOW' && safe && sensors.camera === 'on' && sensors.rear, routeAnchor: anchor, generatedAt: data?.routing.generatedAt, candidates: data?.candidates, now });
  const better = recommendation(match, data?.routing);
  const direction = match.reliable && sensors.gps && destination ? angleDelta(bearing(sensors.gps, destination), sensors.heading.degrees) : null;
  return <section className="ar-page" aria-label="Smartphone AR navigation">
    <div className="notice"><b>STATIONARY USERS OR PASSENGERS ONLY</b><span>Never operate this camera interface while driving. This is an approximate compass overlay, not visual road recognition or turn-by-turn guidance.</span></div>
    <label className="checkbox-label safety-check"><input type="checkbox" checked={safe} onChange={event => { setSafe(event.target.checked); if (!event.target.checked) sensors.stop(); }}/><span>I am stationary or a passenger, not the driver.</span></label>
    <div className="ar-permissions">
      <button type="button" className="primary" disabled={!safe || sensors.camera === 'requesting'} onClick={sensors.startCamera}>Start rear camera</button>
      <button type="button" className="secondary-light" disabled={!safe} onClick={sensors.startGps}>Enable GPS</button>
      <button type="button" className="secondary-light" disabled={!safe} onClick={sensors.startCompass}>Enable compass</button>
      <button type="button" className="secondary-light" onClick={sensors.stop}>Stop camera and sensors</button>
    </div>
    <div className="sensor-status" role="status"><p>Camera: {sensors.camera}</p><p>GPS: {sensors.gpsStatus}{sensors.gps ? ` · reported accuracy ${Math.round(sensors.gps.accuracy)} m` : ''}</p><p>Compass: {sensors.compassStatus}{sensors.heading ? ` · ${Math.round(sensors.heading.degrees)}° · ${sensors.heading.accuracy === null ? 'error not reported' : `reported error ±${sensors.heading.accuracy}°`}` : ''}</p></div>
    <div className="camera-stage">
      <video ref={video} autoPlay muted playsInline aria-label="Live rear-camera view"/>
      {sensors.camera !== 'on' && <p className="camera-placeholder">Rear camera is off or unavailable. The map and manual origin remain usable.</p>}
      <div className={`ar-overlay ${match.reliable ? 'aligned' : ''}`} role="status" aria-label="AR alignment status">
        {match.reliable ? <><span className="pill">APPROXIMATE · NOT VISUALLY RECOGNIZED</span><h3>Candidate road: {match.candidate.name}</h3><p>Estimated route bearing {Math.round(match.candidate.bearing)}° · heading difference {Math.round(match.candidate.headingError)}°</p>
          <div className="direction-display"><span aria-hidden="true" style={{ transform: `rotate(${direction}deg)` }}>↑</span><p>Destination {Math.round(Math.abs(direction))}° {direction < 0 ? 'left' : 'right'} of camera heading{Math.abs(direction) > 90 ? ' (behind you)' : ''}. Straight-line direction, not a turn instruction.</p></div>
          {better ? <p>Returned {better.routeId} has {better.seconds} seconds less baseline duration than the direction-associated route. Compare it on the map; not live traffic savings.</p> : <p>No better directional alternative is established by comparable returned routes.</p>}
          <p>Compass error may remain even when stable. Check the map before relying on direction.</p></> : <><h3>Map fallback · alignment uncertain</h3><p>{match.reason}</p></>}
      </div>
    </div>
    <form className="planner ar-plan" onSubmit={calculate}>
      <h2>Choose a destination and route</h2><p className="form-note">Departure context is shared with Route Planner. Scheduled journeys use baseline map routes only; camera alignment is paused because present sensors cannot establish future road conditions. Precise GPS coordinates are sent to Nominatim (country check) and OSRM only when you calculate a route; camera frames stay on your device.</p>
      <DepartureControls onChange={clear}/>
      {journey.mode !== 'LEAVE_NOW' && <p role="status">Scheduled departure · map planning only. Future traffic, camera route alignment and departure-specific ETAs are unsupported.</p>}
      <label><span>STARTING POINT SOURCE</span><select value={mode} onChange={event => { clear(); setMode(event.target.value); }}><option value="gps">GPS fix</option><option value="manual">Manual location (map fallback)</option></select></label>
      {mode === 'manual' && <LocationSearch title="MANUAL STARTING POINT" location={origin} onEdit={() => { clear(); setOrigin(null); }} onSelect={value => { clear(); setOrigin(value); }}/>}
      <LocationSearch title="DESTINATION" location={destination} onEdit={() => { clear(); setDestination(null); }} onSelect={value => { clear(); setDestination(value); }}/>
      <button className="primary" type="submit" disabled={busy || !destination || (mode === 'gps' ? !gpsFresh : !origin)}>{busy ? 'Calculating baseline routes…' : 'Calculate AR/map routes'}</button>
      <p className="map-credit">Search and country check: Nominatim · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Leave at least one second between searches/calculations; no automatic routing or reverse-geocoding loop.</p>
    </form>
    {busy && <p role="status">Loading genuine road geometry…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="route-layout"><section className="map-panel"><div className="section-title"><h2>Map fallback · always available</h2><span className="pill">GENUINE GEOMETRY</span></div><GeographicMap data={data?.routing} selected={selected}/></section>
      <section className="results"><h2>Baseline route comparison</h2>
        {!data && <p className="empty-state">Select two locations manually if sensors are unreliable. No road, congestion or route recommendation is fabricated.</p>}
        {data && <><p className="comparison-note">Source: {data.routing.source}. Calculated {new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(data.routing.generatedAt))} (Sri Lanka). Fastest/shortest among returned routes only; not true shortest-distance optimization. No live traffic.</p>
          {data.routing.routes.map((route, index) => <button key={route.id} className={`route-card ${selected === route.id ? 'selected' : ''}`} aria-pressed={selected === route.id} onClick={() => setSelected(route.id)}><h3>Road route {index + 1}</h3><span className="route-tag">{[route.fastestAvailable && 'Fastest available', route.shortestAvailable && 'Shortest available'].filter(Boolean).join(' · ') || 'Returned alternative'}</span><div className="metrics"><strong>{Math.round(route.durationSeconds / 60)}<small> min</small></strong><span>{(route.distanceMeters / 1000).toFixed(1)} km</span></div><p>OSRM baseline estimate · map selection does not establish camera alignment.</p></button>)}
          <p className="form-note">Nearby candidates use the first returned route steps only; parallel/unreturned roads may be missing. Accuracy gates reduce risk but cannot establish real-world alignment without field validation. Recalculate if GPS moves more than 25 m or the route is older than two minutes.</p></>}
      </section></div>
  </section>;
}
