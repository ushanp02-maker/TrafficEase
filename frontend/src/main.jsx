import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const sections = ['Dashboard', 'Route Planner', 'AI Predictions', 'AR Navigation'];
const routes = [
  { name: 'Via Marine Drive', time: 24, distance: '8.2', note: 'Demo recommendation', color: '#d49c00' },
  { name: 'Via Galle Road', time: 32, distance: '7.4', note: 'Demo alternative', color: '#d69432' },
  { name: 'Via Baseline Road', time: 38, distance: '10.6', note: 'Demo alternative', color: '#9b7560' },
];
function DemoMap({ selected }) {
  return <div className="map" aria-label="Illustrative Colombo route diagram, not a geographic or live navigation map">
    <svg viewBox="0 0 720 440" role="img" aria-label="Schematic demo routes between Colombo Fort and Wellawatte">
      <rect width="720" height="440" fill="#e8edf0"/><path d="M0 0H170L145 80 160 160 130 260 145 340 100 440H0Z" fill="#c7dbe4"/>
      <g stroke="#ffffff" strokeWidth="15" fill="none"><path d="M200 0L180 130 230 260 190 440M330 0L310 130 370 270 330 440M490 0L440 180 500 320 480 440M650 0L600 200 650 440M145 90L720 150M155 220L720 270M130 350L720 390"/></g>
      <g fill="#d4dfe3"><rect x="365" y="65" width="70" height="58" rx="12"/><rect x="520" y="285" width="80" height="65" rx="12"/><rect x="240" y="280" width="55" height="45" rx="10"/></g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">{['M220 85L185 150 204 240 178 325 230 370','M220 85L280 145 260 230 290 310 230 370','M220 85L420 150 440 260 350 345 230 370'].map((d,i)=><path key={d} d={d} stroke={i===selected?'#d49c00':'#9cabb5'} strokeWidth={i===selected?8:5} opacity={i===selected?1:.65}/>)}</g>
      <circle cx="220" cy="85" r="10" fill="#fff" stroke="#d49c00" strokeWidth="5"/><circle cx="230" cy="370" r="10" fill="#d49c00" stroke="#fff" strokeWidth="4"/>
      <g fill="#405b6b" fontSize="14" fontFamily="system-ui"><text x="242" y="80">Colombo Fort</text><text x="250" y="400">Wellawatte</text><text x="370" y="215">COLOMBO</text><text x="28" y="240" transform="rotate(-90 28 240)">INDIAN OCEAN</text><text x="520" y="65">N ↑</text></g>
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
    <div className="hero-wrap">
      <header className="topbar">
        <a className="brand" href="#" onClick={()=>setPage('Dashboard')}>TrafficEase<span className="brand-dot">→</span></a>
        <nav aria-label="Main navigation">{sections.map(s=><button key={s} aria-current={page===s?'page':undefined} className={page===s?'active':''} onClick={()=>setPage(s)}>{s}</button>)}</nav>
        <button className="primary nav-cta" onClick={()=>{setPage('Route Planner');document.getElementById('journey')?.scrollIntoView({behavior:'smooth'});}}>Plan a journey <span aria-hidden="true">→</span></button>
      </header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow"><span/> MADE FOR SRI LANKA</p>
          <h1>{page==='Dashboard'?<>A little less traffic.<br/><em>A lot more living.</em></>:page==='Route Planner'?<>Find your way<br/><em>forward.</em></>:page==='AI Predictions'?<>Understand the<br/><em>road ahead.</em></>:<>A whole new<br/><em>perspective.</em></>}</h1>
          <p className="subtitle">Smarter routes. New perspectives. More time for what matters. Discover a better way around Colombo with TrafficEase.</p>
          <div className="hero-actions"><button className="primary" onClick={()=>{setPage('Route Planner');document.getElementById('journey')?.scrollIntoView({behavior:'smooth'});}}>Explore demo routes <span aria-hidden="true">→</span></button><button className="secondary" onClick={()=>setPage('AR Navigation')}>Discover AR navigation</button></div>
          <div className="hero-footnote"><span className="round-arrow">→</span><span>Built for the journeys we make every day.</span></div>
        </div>
        <div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/>
          <svg className="city-art" viewBox="0 0 600 600" role="img" aria-label="Stylized illustration of a coastal Colombo road, not a real route map">
            <defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#a8c9d6"/><stop offset="1" stopColor="#e4e8df"/></linearGradient><linearGradient id="sea" x2="1" y2="1"><stop stopColor="#4e879a"/><stop offset="1" stopColor="#203e54"/></linearGradient></defs>
            <rect width="600" height="600" fill="url(#sky)"/><circle cx="440" cy="135" r="55" fill="#ffce38"/>
            <path d="M0 300L600 260V600H0Z" fill="url(#sea)"/><path d="M210 280L600 270V600H110Z" fill="#b4c4b8"/>
            <g fill="#466273"><path d="M265 285V185H305V285Z"/><path d="M320 280V135H355V280Z"/><path d="M370 280V205H416V280Z"/><path d="M435 278V170H478V278Z"/><path d="M505 280V210H550V280Z"/></g>
            <g fill="#d5dfdc"><path d="M275 200H285V265H275ZM330 150H338V260H330ZM385 218H395V260H385ZM445 185H455V260H445ZM515 225H525V260H515Z"/></g>
            <path d="M335 280C270 350 265 405 420 600H140C300 440 200 370 285 280Z" fill="#f1eee0"/><path d="M321 280C255 360 265 420 380 600H185C315 435 223 365 294 280Z" fill="#233b4b"/>
            <path d="M307 290C244 365 300 445 280 600" fill="none" stroke="#ffca28" strokeWidth="5" strokeDasharray="22 18"/>
            <g stroke="#244c45" strokeWidth="7" fill="none"><path d="M165 385L172 288M475 395L480 292"/></g><g fill="#365e51"><path d="M172 287Q120 240 112 280Q143 271 172 299Q153 228 197 246L178 293Q224 251 233 283L178 302Z"/><path d="M480 290Q437 248 428 281L477 302Q461 237 498 249L485 295Q531 260 539 288L486 305Z"/></g>
            <g transform="translate(318 446) rotate(-15)"><rect x="-20" y="-35" width="40" height="70" rx="12" fill="#ffca28"/><rect x="-14" y="-18" width="28" height="22" rx="4" fill="#183345"/><path d="M-12 24H12" stroke="#fff" strokeWidth="4"/></g>
            <path d="M0 420Q70 390 120 420M0 470Q50 444 105 460M20 530Q60 510 100 525" stroke="#86abba" strokeWidth="3" fill="none"/>
          </svg>
          <div className="visual-caption"><span className="caption-icon">⌖</span><div><strong>Colombo & beyond</strong><span>A better way forward.</span></div><span className="caption-arrow">→</span></div>
          <span className="art-label">CONCEPT ILLUSTRATION</span>
        </div>
      </section>
      <section className="capabilities" aria-label="Explore TrafficEase">{[
        ['01','→','Smarter routes','Compare illustrative routes and see the journey at a glance.','Route Planner'],
        ['02','◷','Ahead of the rush','Explore the idea of experimental AI traffic predictions.','AI Predictions'],
        ['03','⌖','A new perspective','Discover our planned camera-based navigation experience.','AR Navigation'],
        ['04','◇','Made for home','Designed around Sri Lankan roads, starting with Colombo.','Dashboard']
      ].map(([n,icon,title,body,target])=><button className="capability" key={n} onClick={()=>setPage(target)}><div className="capability-top"><span className="capability-icon">{icon}</span><span>{n}</span></div><h2>{title}</h2><p>{body}</p><span className="card-link">Explore <span aria-hidden="true">→</span></span></button>)}</section>
    </div>
    <main id="journey"><div className="content-heading"><div><p className="eyebrow">LESS GUESSWORK. MORE GOING.</p><h2>Your next journey starts here.</h2></div><span className="pill">FOUNDATION DEMO</span></div>
      <div className="notice"><b>Demonstration only</b><span>All route times and distances are placeholders. No live traffic provider is connected.</span></div>
      {(page==='Dashboard'||page==='Route Planner')&&<>
      <section className="planner"><div className="section-title"><h2>Where are you heading?</h2><span>01 / PLAN YOUR JOURNEY</span></div><form onSubmit={plan}><label><span>STARTING POINT</span><input required value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Enter starting location"/></label><div className="journey-arrow" aria-hidden="true">→</div><label><span>DESTINATION</span><input required value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Enter destination"/></label><button className="primary" type="submit">Explore demo routes →</button></form><p className="form-note">GPS detection is planned. This milestone uses typed locations only.</p></section>
      <div className="route-layout"><section className="map-panel"><div className="section-title"><h2>Your journey, at a glance</h2><span className="pill">SCHEMATIC MAP</span></div><DemoMap selected={selected}/></section>
      <section className="results"><div className="section-title"><h2>Demo alternatives</h2><span>3 ROUTES</span></div><p role="status" className="status">{message}</p>{routes.map((r,i)=><button className={'route-card '+(selected===i?'selected':'')} key={r.name} onClick={()=>setSelected(i)} aria-pressed={selected===i}><div className="route-top"><span className="route-tag">{r.note}</span><span>{selected===i?'●':'○'}</span></div><h3>{r.name}</h3><div className="metrics"><strong>{r.time}<small> min</small></strong><span>{r.distance} km</span></div><p>{i===0?'Illustrative saving: 8 min vs Galle Road':'Fixed sample · not a traffic observation'}</p></button>)}</section></div>
      </>}
      {(page==='Dashboard'||page==='AI Predictions'||page==='AR Navigation')&&<section className="feature-grid">{page!=='AR Navigation'&&<article className="feature"><span className="feature-icon">◷</span><span className="pill">EXPERIMENTAL · PLANNED</span><h2>Ahead of the rush.</h2><p>Future AI predictions will explore time, weather and road patterns using clearly labeled synthetic data. No trained model or real-world validation yet.</p><button className="text-button" onClick={()=>setPage('AI Predictions')}>Explore AI predictions →</button></article>}{page!=='AI Predictions'&&<article className="feature dark"><span className="feature-icon">⌖</span><span className="pill">AR LAB · PLANNED</span><h2>See another way.</h2><p>Future camera guidance will combine GPS, compass and road geometry, with a map fallback. Intended for stationary users or passengers.</p><button className="text-button" onClick={()=>setPage('AR Navigation')}>Explore AR navigation →</button></article>}</section>}
      <footer><div><a className="brand" href="#">TrafficEase<span className="brand-dot">→</span></a><p>Small detours. Better journeys.</p></div><div><span className="eyebrow">BUILT FOR SRI LANKA</span><p>AI + Cloud + AR · HNDSE coursework</p><small>Demonstration only. No live traffic data.</small></div></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
