import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { colomboLocal, journeyPayload, validateDeparture } from './journeyTime.js';
const Context = createContext();
export function JourneyProvider({ children }) {
  const [journey, setJourney] = useState({ mode: 'LEAVE_NOW', local: '' });
  return <Context.Provider value={{ journey, setJourney }}>{children}</Context.Provider>;
}
export const useJourney = () => useContext(Context);
export function DepartureControls({ onChange }) {
  const { journey, setJourney } = useJourney();
  const [capabilities, setCapabilities] = useState(null), [error, setError] = useState(''), [tick, setTick] = useState(Date.now());
  const loaded = useRef(0);
  async function load(signal) {
    try {
      const base = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/journeys/capabilities`, { signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.timeZone !== 'Asia/Colombo' || !Number.isFinite(Date.parse(data.now))) throw new Error();
      if (signal?.aborted) return;
      loaded.current = Date.now(); setTick(loaded.current); setCapabilities(data); setError('');
    } catch (e) { if (e.name !== 'AbortError') setError('Server clock unavailable. Leave Now remains available; refresh before scheduling.'); }
  }
  useEffect(() => { const controller = new AbortController(); load(controller.signal); const timer = setInterval(() => setTick(Date.now()), 30_000); return () => { controller.abort(); clearInterval(timer); }; }, []);
  const now = capabilities ? Date.parse(capabilities.now) + tick - loaded.current : Date.now();
  const change = patch => { onChange?.(); setJourney(previous => ({ ...previous, ...patch })); };
  const validation = validateDeparture(journey.mode, journey.local, now);
  return <fieldset className="departure-controls"><legend>Departure · Asia/Colombo</legend>
    <label><span>JOURNEY MODE</span><select value={journey.mode} onChange={e => change({ mode: e.target.value })}>
      <option value="LEAVE_NOW">Leave Now</option><option value="LATER_TODAY" disabled={!capabilities}>Later Today</option><option value="FUTURE_DATE" disabled={!capabilities}>Future Date</option>
    </select></label>
    {journey.mode !== 'LEAVE_NOW' && <label><span>DEPARTURE DATE AND TIME · SRI LANKA</span><input type="datetime-local" required value={journey.local} min={colomboLocal(now)} max={colomboLocal(now + 7 * 86400_000)} onChange={e => change({ local: e.target.value })}/></label>}
    {validation && <p role="status">{validation}</p>}
    {error && <p role="status">{error} <button type="button" className="text-button" onClick={() => load()}>Refresh departure clock</button></p>}
    <p className="form-note">Now through seven days ahead. Departure is planning context only: genuine OSRM baseline routes remain available, but traffic-aware and future journey estimates are unsupported. No departure-specific ETA is calculated.</p>
  </fieldset>;
}
export { journeyPayload };
