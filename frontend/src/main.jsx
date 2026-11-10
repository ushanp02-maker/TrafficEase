import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import RoutePlanner from './RoutePlanner.jsx';
import ForecastPanel from './ForecastPanel.jsx';
import ArNavigation from './ArNavigation.jsx';

const sections = ['Dashboard', 'Route Planner', 'AI Predictions', 'AR Navigation'];
function App() {
  const [page,setPage]=useState('Dashboard');
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
          <p className="subtitle">Smarter routes. New perspectives. More time for what matters. Discover a better way around Sri Lanka with TrafficEase.</p>
          <div className="hero-actions"><button className="primary" onClick={()=>{setPage('Route Planner');document.getElementById('journey')?.scrollIntoView({behavior:'smooth'});}}>Plan a road journey <span aria-hidden="true">→</span></button><button className="secondary" onClick={()=>setPage('AR Navigation')}>Discover AR navigation</button></div>
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
          <div className="visual-caption"><span className="caption-icon">⌖</span><div><strong>Sri Lanka, island-wide</strong><span>A better way forward.</span></div><span className="caption-arrow">→</span></div>
          <span className="art-label">CONCEPT ILLUSTRATION</span>
        </div>
      </section>
      <section className="capabilities" aria-label="Explore TrafficEase">{[
        ['01','→','Smarter routes','Compare genuine road routes and see the journey at a glance.','Route Planner'],
        ['02','◷','Ahead of the rush','Explore the idea of experimental AI traffic predictions.','AI Predictions'],
        ['03','⌖','A new perspective','Discover our planned camera-based navigation experience.','AR Navigation'],
        ['04','◇','Made for home','Search Sri Lankan locations, wherever mapped road data is available.','Dashboard']
      ].map(([n,icon,title,body,target])=><button className="capability" key={n} onClick={()=>setPage(target)}><div className="capability-top"><span className="capability-icon">{icon}</span><span>{n}</span></div><h2>{title}</h2><p>{body}</p><span className="card-link">Explore <span aria-hidden="true">→</span></span></button>)}</section>
    </div>
    <main id="journey"><div className="content-heading"><div><p className="eyebrow">LESS GUESSWORK. MORE GOING.</p><h2>{page==='AI Predictions'?'Explore a hypothetical traffic scenario.':'Your next journey starts here.'}</h2></div><span className="pill">{page==='AI Predictions'?'EXPERIMENTAL AI':'NATIONWIDE · BASELINE ROUTING'}</span></div>
      {page!=='AI Predictions'&&<div className="notice"><b>Baseline road routing</b><span>OSRM durations are not live traffic or future forecasts. Geographic coverage and road access vary.</span></div>}
      {(page==='Dashboard'||page==='Route Planner')&&<RoutePlanner/>}
      {page==='AI Predictions'&&<ForecastPanel/>}
      {page==='AR Navigation'&&<ArNavigation/>}
      {(page==='Dashboard')&&<section className="feature-grid">{page!=='AR Navigation'&&<article className="feature"><span className="feature-icon">◷</span><span className="pill">EXPERIMENTAL · SYNTHETIC</span><h2>Ahead of the rush.</h2><p>Explore congestion categories from a synthetic-data model using fictional road, time, weather and holiday scenarios. Not validated against actual Sri Lankan traffic.</p><button className="text-button" onClick={()=>setPage('AI Predictions')}>Explore AI predictions →</button></article>}{page!=='AI Predictions'&&<article className="feature dark"><span className="feature-icon">⌖</span><span className="pill">AR · FIELD VALIDATION PENDING</span><h2>See another way.</h2><p>Explore the camera-and-compass prototype with genuine routed road geometry and a map fallback. Stationary users or passengers only; field validation pending.</p><button className="text-button" onClick={()=>setPage('AR Navigation')}>Explore AR navigation →</button></article>}</section>}
      <footer><div><a className="brand" href="#">TrafficEase<span className="brand-dot">→</span></a><p>Small detours. Better journeys.</p></div><div><span className="eyebrow">BUILT FOR SRI LANKA</span><p>AI + Cloud + AR · HNDSE coursework</p><small>Baseline routing & experimental scenarios. No live traffic data.</small></div></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
