import React, { useEffect, useRef, useState } from 'react';
import { HistoryControls, ModelDetails } from './ForecastExtras.jsx';
import { useJourney } from './JourneyContext.jsx';

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
// Asia/Colombo is UTC+05:30. Do not use the browser's local timezone for the controls.
const localColombo = value => new Date(new Date(value).getTime() + 330 * 60_000).toISOString().slice(0, 16);
async function aiRequest(path, options) {
  let response;
  try { response = await fetch(`${apiBase}/api/forecasts${path}`, options); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the forecasting backend. Check that Spring Boot and FastAPI are running.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Forecasting service returned an unreadable response.'); }
  if (!response.ok) throw new Error(`${data.code || 'FORECAST_FAILED'}: ${data.message || 'Forecast unavailable.'}`);
  if (!data.experimental || data.dataSource !== 'SYNTHETIC') throw new Error('Forecast service returned invalid data-source labels. No result displayed.');
  return data;
}
export default function ForecastPanel() {
  const { journey } = useJourney();
  const [catalog, setCatalog] = useState(null), [catalogBusy, setCatalogBusy] = useState(true);
  const [targetId, setTargetId] = useState(''), [time, setTime] = useState(journey.local);
  const [now, setNow] = useState(journey.mode === 'LEAVE_NOW'), [weather, setWeather] = useState('CLEAR'), [holiday, setHoliday] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null);
  const [saveHistory, setSaveHistory] = useState(false);
  const active = useRef(), loading = useRef();
  function clear() { active.current?.abort(); setBusy(false); setResult(null); setError(''); }
  async function load() {
    clear(); loading.current?.abort(); const controller = new AbortController(); loading.current = controller;
    setCatalogBusy(true); setCatalog(null);
    try {
      const data = await aiRequest('/catalog', { signal: controller.signal });
      if (controller.signal.aborted) return;
      setCatalog(data); setTargetId(data.targets[0]?.id || '');
      setTime(journey.mode !== 'LEAVE_NOW' && journey.local ? journey.local : localColombo(new Date(new Date(data.now).getTime() + 5 * 60_000)));
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setCatalogBusy(false); }
  }
  useEffect(() => { load(); return () => { active.current?.abort(); loading.current?.abort(); }; }, []);
  async function forecast(event) {
    event.preventDefault(); clear(); const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      const data = await aiRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ targetId, forecastAt: now ? null : `${time}:00+05:30`, weather, isHoliday: holiday, saveHistory }) });
      if (!controller.signal.aborted) setResult(data);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const format = value => new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(value));
  return <section className="forecast-panel" aria-label="Experimental AI forecasts">
    <div className="notice"><b>EXPERIMENTAL · SYNTHETIC DATA</b><span>These are hypothetical scenarios, not measured or validated Sri Lankan traffic. They do not change OSRM journey estimates.</span></div>
    {journey.mode !== 'LEAVE_NOW' && <p className="coverage-note">Departure time copied from your journey in Asia/Colombo. No geographic route-to-scenario mapping is inferred; choose a hypothetical target explicitly.</p>}
    {catalogBusy && <p role="status">Loading hypothetical roads, regions and model status…</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {!catalogBusy && <button type="button" className="search-button" onClick={load}>Refresh model availability</button>}
    {catalog && <>
      <p className="coverage-note">{catalog.coverageNote}</p>
      {catalog.modelStatus !== 'ready' && <p role="alert" className="error-message">Experimental model unavailable ({catalog.modelStatus}). Run offline training and restart the AI service. No forecast has been generated.</p>}
      <form className="forecast-form planner" onSubmit={forecast}>
        <label><span>HYPOTHETICAL ROAD OR REGION</span><select value={targetId} required onChange={e => { clear(); setTargetId(e.target.value); }}>
          <option value="">Select a supported scenario</option>
          <optgroup label="Fictional road scenarios">{catalog.targets.filter(t => t.kind === 'ROAD_SCENARIO').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
          <optgroup label="Representative region scenarios (not aggregates)">{catalog.targets.filter(t => t.kind === 'REGION_SCENARIO').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
        </select></label>
        <label><span>WEATHER SCENARIO (NOT A WEATHER FORECAST)</span><select value={weather} onChange={e => { clear(); setWeather(e.target.value); }}>{catalog.weatherOptions.map(w => <option key={w} value={w}>{w.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="checkbox-label"><input type="checkbox" checked={now} onChange={e => { clear(); setNow(e.target.checked); }}/><span>Use current Sri Lankan time</span></label>
        <label><span>FORECAST DATE AND TIME · ASIA/COLOMBO</span><input type="datetime-local" required={!now} disabled={now} min={localColombo(catalog.now)} max={localColombo(catalog.maxForecastAt)} value={time} onChange={e => { clear(); setTime(e.target.value); }}/></label>
        <label className="checkbox-label"><input type="checkbox" checked={holiday} onChange={e => { clear(); setHoliday(e.target.checked); }}/><span>Hypothetical holiday (not an official calendar)</span></label>
        <p className="form-note">Now through seven days ahead. Server time is authoritative. Road characteristics come from the fictional scenario catalog; region choices represent hypothetical arterials, not whole-region traffic.</p>
        <button type="submit" className="primary" disabled={busy || !targetId || catalog.modelStatus !== 'ready'}>{busy ? 'Predicting scenario…' : 'Generate experimental forecast →'}</button>
      </form>
    </>}
    {busy && <p role="status">Running the synthetic-data congestion model…</p>}
    {!result && !busy && <p className="empty-state">No congestion scenario generated. Choose a supported fictional location and time. Unsupported locations are never extrapolated.</p>}
    <HistoryControls save={saveHistory} onSave={setSaveHistory}/>
    <ModelDetails/>
    {result && <article className="forecast-result" aria-label="Experimental forecast result">
      <span className="pill">EXPERIMENTAL · SYNTHETIC</span>
      <h2>{result.congestion} congestion scenario</h2>
      <p><strong>{result.target.name}</strong></p><p>Forecast time: {format(result.forecastAt)} (Asia/Colombo)</p>
      <dl><dt>Weather input</dt><dd>{result.features.weather.replaceAll('_', ' ')} · user scenario</dd><dt>Holiday input</dt><dd>{result.features.is_holiday ? 'Yes' : 'No'} · user scenario</dd><dt>Model version</dt><dd>{result.modelVersion}</dd><dt>Training source</dt><dd>{result.dataSource} · {result.datasetVersion}</dd></dl>
      {result.historyStatus && <p role="status">History: {({ SAVED: 'Synthetic scenario saved to shared history.', NOT_REQUESTED: 'Saving was not requested.', DISABLED: 'Database disabled; no scenario saved.', UNAVAILABLE: 'Storage unavailable; saving could not be confirmed.', REJECTED: 'Record rejected by provenance checks.', CAPACITY_REACHED: 'History full; no additional record saved.' })[result.historyStatus] || 'Unknown storage state.'}</p>}
      <p>No journey duration or road speed is estimated. This category cannot establish an accurate route ETA.</p>
      <ul>{result.limitations.map(text => <li key={text}>{text}</li>)}</ul>
    </article>}
  </section>;
}
