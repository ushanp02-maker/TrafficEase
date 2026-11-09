import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const sections = ['Dashboard', 'Route Planner', 'AI Predictions', 'AR Navigation'];
const routes = [
  { name: 'Via Marine Drive', time: 24, distance: '8.2', note: 'Demo recommendation', color: '#16845e' },
  { name: 'Via Galle Road', time: 32, distance: '7.4', note: 'Demo alternative', color: '#d69432' },
  { name: 'Via Baseline Road', time: 38, distance: '10.6', note: 'Demo alternative', color: '#9b7560' },
];
function DemoMap({ selected }) {
  return <div className="map" aria-label="Illustrative Colombo route diagram, not a geographic or live navigation map">
    <svg viewBox="0 0 720 440" role="img" aria-label="Schematic demo routes between Colombo Fort and Wellawatte">
      <rect width="720" height="440" fill="#e9eee6"/><path d="M0 0H170L145 80 160 160 130 260 145 340 100 440H0Z" fill="#c6e1df"/>
      <g stroke="#fafbf5" strokeWidth="15" fill="none"><path d="M200 0L180 130 230 260 190 440M330 0L310 130 370 270 330 440M490 0L440 180 500 320 480 440M650 0L600 200 650 440M145 90L720 150M155 220L720 270M130 350L720 390"/></g>
      <g fill="#cdddc9"><rect x="365" y="65" width="70" height="58" rx="12"/><rect x="520" y="285" width="80" height="65" rx="12"/><rect x="240" y="280" width="55" height="45" rx="10"/></g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">{['M220 85L185 150 204 240 178 325 230 370','M220 85L280 145 260 230 290 310 230 370','M220 85L420 150 440 260 350 345 230 370'].map((d,i)=><path key={d} d={d} stroke={i===selected?'#16845e':'#b1bcb0'} strokeWidth={i===selected?8:5} opacity={i===selected?1:.65}/>)}</g>
      <circle cx="220" cy="85" r="10" fill="#fff" stroke="#16845e" strokeWidth="5"/><circle cx="230" cy="370" r="10" fill="#16845e" stroke="#fff" strokeWidth="4"/>
      <g fill="#53665c" fontSize="14" fontFamily="system-ui"><text x="242" y="80">Colombo Fort</text><text x="250" y="400">Wellawatte</text><text x="370" y="215">COLOMBO</text><text x="28" y="240" transform="rotate(-90 28 240)">INDIAN OCEAN</text><text x="520" y="65">N ↑</text></g>
    </svg><span className="map-label">Illustration · not to scale · no live traffic</span>
  </div>;
}
function App() {
  const [page,setPage]=useState('Dashboard');
  const [origin,setOrigin]=useState('Colombo Fort');
  const [destination,setDestination]=useState('Wellawatte');
  const [selected,setSelected]=useState(0);
  const [message,setMessage]=useState('Showing the fixed Colombo Fort → Wellawatte demonstration.');
  function plan(e) { e.preventDefault(); setMessage(origin.trim().toLowerCase()==='colombo fort' && destination.trim().toLowerCase()==='wellawatte' ? 'Demo refreshed. These fixed illustrative times are not current traffic estimates.' : 'Routing is not connected yet. The illustration below remains Colombo Fort → Wellawatte; it does not represent your entered journey.'); }
  return <div className="shell">
    <aside><a className="brand" href="#" onClick={()=>setPage('Dashboard')}><span className="brand-icon">→</span>TrafficEase<span className="brand-dot">.</span></a><p className="sidebar-caption">A BETTER WAY FORWARD</p>
      <nav aria-label="Main navigation">{sections.map((s,i)=><button key={s} aria-current={page===s?'page':undefined} className={page===s?'active':''} onClick={()=>setPage(s)}><span aria-hidden="true">{['▦','→','◷','⌖'][i]}</span>{s}{s==='AR Navigation'&&<small>LAB</small>}</button>)}</nav>
      <div className="sidebar-bottom"><span className="country">🇱🇰 BUILT FOR SRI LANKA</span><p>Small detours.<br/>Better journeys.</p><small>HNDSE · Emerging Technologies</small></div>
    </aside>
    <main><header><span>YOUR DAILY COMMUTE, REIMAGINED</span><span className="pill"><i/> Foundation demo</span></header>
      <div className="heading"><div><p className="eyebrow">COLOMBO & BEYOND</p><h1>{page==='Dashboard'?'A little less traffic.':page==='Route Planner'?'Find your way forward.':page==='AI Predictions'?'Understand the road ahead.':'A new perspective.'}</h1><p className="subtitle">{page==='Dashboard'?'A little more time for what matters. Plan a smarter journey with TrafficEase.': 'Exploring smarter journeys for Sri Lankan roads.'}</p></div><span className="location">⌖ Colombo, Sri Lanka</span></div>
      <div className="notice"><b>Demonstration only</b><span>All route times and distances are placeholders. No live traffic provider is connected.</span></div>
      {(page==='Dashboard'||page==='Route Planner')&&<>
      <section className="planner"><div className="section-title"><h2>Where are you heading?</h2><span>01 / PLAN YOUR JOURNEY</span></div><form onSubmit={plan}><label><span>STARTING POINT</span><input required value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Enter starting location"/></label><div className="journey-arrow" aria-hidden="true">→</div><label><span>DESTINATION</span><input required value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Enter destination"/></label><button className="primary" type="submit">Explore demo routes →</button></form><p className="form-note">GPS detection is planned. This milestone uses typed locations only.</p></section>
      <div className="route-layout"><section className="map-panel"><div className="section-title"><h2>Your journey, at a glance</h2><span className="pill">SCHEMATIC MAP</span></div><DemoMap selected={selected}/></section>
      <section className="results"><div className="section-title"><h2>Demo alternatives</h2><span>3 ROUTES</span></div><p role="status" className="status">{message}</p>{routes.map((r,i)=><button className={'route-card '+(selected===i?'selected':'')} key={r.name} onClick={()=>setSelected(i)} aria-pressed={selected===i}><div className="route-top"><span className="route-tag">{r.note}</span><span>{selected===i?'●':'○'}</span></div><h3>{r.name}</h3><div className="metrics"><strong>{r.time}<small> min</small></strong><span>{r.distance} km</span></div><p>{i===0?'Illustrative saving: 8 min vs Galle Road':'Fixed sample · not a traffic observation'}</p></button>)}</section></div>
      </>}
      {(page==='Dashboard'||page==='AI Predictions'||page==='AR Navigation')&&<section className="feature-grid">{page!=='AR Navigation'&&<article className="feature"><span className="feature-icon">◷</span><span className="pill">EXPERIMENTAL · PLANNED</span><h2>Ahead of the rush.</h2><p>Future AI predictions will explore time, weather and road patterns using clearly labeled synthetic data. No trained model or real-world validation yet.</p><button className="text-button" onClick={()=>setPage('AI Predictions')}>Explore AI predictions →</button></article>}{page!=='AI Predictions'&&<article className="feature dark"><span className="feature-icon">⌖</span><span className="pill">AR LAB · PLANNED</span><h2>See another way.</h2><p>Future camera guidance will combine GPS, compass and road geometry, with a map fallback. Intended for stationary users or passengers.</p><button className="text-button" onClick={()=>setPage('AR Navigation')}>Explore AR navigation →</button></article>}</section>}
      <footer><span>TrafficEase · Smarter journeys, thoughtfully built.</span><span>AI + CLOUD + AR</span></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
