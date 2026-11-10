import React, { useEffect, useRef, useState } from 'react';
import { request } from './RoutePlanner.jsx';

export function HistoryControls({ save, onSave }) {
  const [status, setStatus] = useState(null), [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const active = useRef();
  useEffect(() => {
    const controller = new AbortController();
    request('/forecasts/history/status', { signal: controller.signal }).then(setStatus).catch(() => { if (!controller.signal.aborted) setError('History status unavailable; forecasts still work without saving.'); });
    return () => { controller.abort(); active.current?.abort(); };
  }, []);
  async function load() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try { const result = await request('/forecasts/history', { signal: controller.signal }); if (!controller.signal.aborted) setData(result); }
    catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="history-panel planner" aria-label="Optional synthetic prediction history"><h2>Optional shared coursework history</h2>
    <p className="form-note">Only fictional scenarios can be saved. No precise GPS, route endpoints or camera frames are stored. Saved scenarios are visible to everyone with demo access, retained for seven days and limited to 1,000 records. Expired records are purged on the next history read/save; there is no background service charge.</p>
    {status?.enabled ? <><label className="checkbox-label"><input type="checkbox" checked={save} onChange={e => onSave(e.target.checked)}/><span>Save my next synthetic scenario to shared demonstration history</span></label>
      <button className="secondary-light" type="button" disabled={busy} onClick={load}>{busy ? 'Loading history…' : 'View latest shared synthetic scenarios'}</button></> : <p role="status">{status ? 'Database profile disabled. Predictions are not persisted.' : 'Checking optional history availability…'}</p>}
    {error && <p role="status">{error}</p>}
    {data && <><p role="status">History: {data.status}. {data.records?.length || 0} recent scenarios.</p><ul>{data.records?.map(row => <li key={row.id}><b>EXPERIMENTAL · SYNTHETIC</b> {row.targetId}: {row.congestion} · {new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(row.forecastAt))} (Sri Lanka) · model {row.modelVersion}</li>)}</ul></>}
  </section>;
}
export function ModelDetails() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const active = useRef(); useEffect(() => () => active.current?.abort(), []);
  async function load() {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try { const response = await request('/forecasts/model', { signal: controller.signal }); if (!response.experimental || response.dataSource !== 'SYNTHETIC') throw new Error('Invalid model provenance.'); if (!controller.signal.aborted) setData(response); }
    catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="planner"><h2>Model evidence and limitations</h2><button className="secondary-light" type="button" disabled={busy} onClick={load}>{busy ? 'Loading model evidence…' : 'View synthetic model evaluation'}</button>
    {error && <p role="status">{error}</p>}
    {data && <><p>Model status: {data.modelStatus}. Synthetic-only evaluation cannot establish real Sri Lankan traffic accuracy.</p>{data.metadata && <><p>Version: {data.metadata.modelVersion} · source: SYNTHETIC · dataset: {data.metadata.datasetVersion}</p><p>Features: {data.metadata.features?.join(', ')}</p><details><summary>Training, validation and held-out test metrics</summary><pre className="model-metrics">{JSON.stringify(data.metadata.evaluation, null, 2)}</pre></details></>}</>}
  </section>;
}
