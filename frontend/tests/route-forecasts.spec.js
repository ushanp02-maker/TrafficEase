import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync('../backend/src/main/resources/experimental/journeys.json','utf8'));
const observations=JSON.parse(readFileSync('../data/journeys/routing-observations.json','utf8'));
const jid='pettah--piliyandala';
function result(status='AVAILABLE'){
 const routes=observations[jid].routes.map((r,i)=>({id:`route-${i+1}`,distanceMeters:r.distance,durationSeconds:r.duration,geometry:r.geometry,fastestAvailable:i===0,shortestAvailable:i===0}));
 const predictions=routes.map((r,i)=>({routeId:r.id,status:'SUPPORTED',congestion:i?'HIGH':'LOW',syntheticBurden:i?1.5:.2,features:{directness:i?1.5:1.1,turns_per_km:.3,weather:'RAIN'},geometryFeatures:{featureVersion:'fixture-schema'}}));
 return {journey:catalog.journeys.find(j=>j.id===jid),routing:{routes,snapping:[],generatedAt:new Date().toISOString()},weather:{status,source:status==='MANUAL_SIMULATION'?'USER_SIMULATION':'Open-Meteo',message:'Explicit browser-test weather fixture, not live weather.',validFor:'2026-11-19T19:00:00+05:30',retrievedAt:new Date().toISOString(),routes:status==='UNAVAILABLE'?[]:routes.map(r=>({routeId:r.id,category:'RAIN',samples:[]}))},forecast:status==='UNAVAILABLE'?{status:'WEATHER_UNAVAILABLE',message:'Automatic weather unavailable'}:{status:'AVAILABLE',result:{modelVersion:'fixture-synthetic',forecastAt:new Date().toISOString(),limitations:['Synthetic browser fixture'],routePredictions:predictions,recommendation:{status:'EXPERIMENTAL_PREFERENCE',routeId:'route-1',message:'Fixture meaningful experimental preference; no real traffic guarantee.'}}},trafficAwareDuration:{message:'OSRM baseline unchanged. Traffic-aware and simulated journey times unavailable.'},attribution:'© OpenStreetMap contributors · Weather by Open-Meteo'};
}
async function setup(page,reply=result()){
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/route-forecasts/catalog',r=>r.fulfill({json:{...catalog,model:{modelStatus:'ready'}}}));
 await page.route('**/api/journeys/capabilities',r=>r.fulfill({json:{timeZone:'Asia/Colombo',now:new Date().toISOString()}}));
 await page.route('**/api/route-forecasts',r=>r.fulfill({json:reply}));
 await page.goto('/route-forecasts');await page.getByRole('combobox',{name:'SUPPORTED REAL JOURNEY'}).selectOption(jid);
}
test('journey → automatic weather → model → genuine mapped alternatives',async({page})=>{
 await setup(page);let submitted;page.on('request',r=>{if(r.url().endsWith('/api/route-forecasts')&&r.method()==='POST')submitted=r.postDataJSON();});
 await page.getByRole('button',{name:'Predict Traffic'}).click();
 await expect(page.getByRole('heading',{name:'Automatic forecast weather',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Experimental preference: route-1'})).toBeVisible();
 await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
 await page.getByRole('button',{name:'Select road route 2',exact:true}).click();await expect(page.getByRole('button',{name:'Select road route 2',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(submitted).toMatchObject({journeyId:jid,mode:'LEAVE_NOW',weatherMode:'AUTO',manualWeather:null});
 await expect(page.getByText('LOW · EXPERIMENTAL / SYNTHETIC',{exact:true})).toBeVisible();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`forecast @${width}`).toBe(true);}
 await expect(page.getByTestId('home-hero')).toHaveCount(0);
});
test('unavailable automatic weather retains baseline and requires explicit simulation resubmit',async({page})=>{
 await setup(page,result('UNAVAILABLE'));await page.getByRole('button',{name:'Predict Traffic'}).click();
 await expect(page.getByRole('heading',{name:'Automatic weather unavailable',exact:true})).toBeVisible();await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
 await page.getByRole('button',{name:'Use explicit manual weather simulation'}).click();await expect(page.getByRole('combobox',{name:'SIMULATED WEATHER · NOT A FORECAST'})).toBeVisible();
 await expect(page.locator('.route-card')).toHaveCount(0);
 await page.route('**/api/route-forecasts',r=>{expect(r.request().postDataJSON()).toMatchObject({weatherMode:'MANUAL_SIMULATION',manualWeather:'CLEAR'});return r.fulfill({json:result('MANUAL_SIMULATION')});});
 await page.getByRole('button',{name:'Predict Traffic'}).click();await expect(page.getByRole('heading',{name:'MANUAL WEATHER SIMULATION',exact:true})).toBeVisible();
});
test('ties and missing model do not invent preferences; new inputs clear stale results',async({page})=>{
 const data=result();data.forecast.result.recommendation={status:'TIE_OR_INSUFFICIENT_DIFFERENTIATION',routeId:null,message:'These synthetic results are indistinguishable.'};
 await setup(page,data);await page.getByRole('button',{name:'Predict Traffic'}).click();await expect(page.getByText('These synthetic results are indistinguishable.',{exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'SUPPORTED REAL JOURNEY'}).selectOption('badulla--ella');await expect(page.locator('.route-card')).toHaveCount(0);
 data.forecast={status:'MODEL_UNAVAILABLE',message:'Separate route model unavailable fixture'};await page.route('**/api/route-forecasts',r=>r.fulfill({json:data}));await page.getByRole('button',{name:'Predict Traffic'}).click();await expect(page.getByText('Separate route model unavailable fixture',{exact:true}).first()).toBeVisible();await expect(page.locator('.route-card')).toHaveCount(2);
});
test('provider error has no fabricated routes and catalog can retry',async({page})=>{
 await setup(page);await page.route('**/api/route-forecasts',r=>r.fulfill({status:422,json:{message:'Provider snap exceeds 300 m'}}));await page.getByRole('button',{name:'Predict Traffic'}).click();await expect(page.getByRole('alert')).toContainText('Provider snap exceeds 300 m');await expect(page.locator('.route-card')).toHaveCount(0);
});
test('future departure is serialized with Colombo offset and single route abstains',async({page})=>{
 const data=result();data.routing.routes=data.routing.routes.slice(0,1);data.forecast.result.routePredictions=data.forecast.result.routePredictions.slice(0,1);data.forecast.result.recommendation={status:'SINGLE_ROUTE',routeId:null,message:'Only one genuine route returned; no verified alternative.'};
 await setup(page,data);await page.getByRole('combobox',{name:'JOURNEY MODE',exact:true}).selectOption('FUTURE_DATE');
 const future=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Date.now()+86400000)).replace(' ','T');
 await page.getByLabel('DEPARTURE DATE AND TIME · SRI LANKA').fill(future);
 const sent=page.waitForRequest(r=>r.url().endsWith('/api/route-forecasts')&&r.method()==='POST');await page.getByRole('button',{name:'Predict Traffic'}).click();expect((await sent).postDataJSON()).toMatchObject({mode:'FUTURE_DATE',departureAt:future+':00+05:30'});
 await expect(page.getByText('Only one genuine route returned; no verified alternative.',{exact:true})).toBeVisible();await expect(page.locator('.route-card')).toHaveCount(1);
});
test('real Spring/FastAPI with live OSRM keeps manual simulation explicitly labeled',async({page})=>{
 test.skip(!process.env.LIVE_ROUTE_INTEGRATION,'Deliberate low-volume live-provider test only.');
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());await page.goto('/route-forecasts');
 await page.getByRole('combobox',{name:'SUPPORTED REAL JOURNEY'}).selectOption(jid);
 await page.getByRole('combobox',{name:'WEATHER INPUT SOURCE'}).selectOption('MANUAL_SIMULATION');
 await page.getByRole('button',{name:'Predict Traffic'}).click();await expect(page.getByRole('heading',{name:'MANUAL WEATHER SIMULATION',exact:true})).toBeVisible({timeout:30000});
 await expect(page.locator('.congestion-label').first()).toContainText('EXPERIMENTAL / SYNTHETIC');expect(await page.locator('.leaflet-overlay-pane path').count()).toBeGreaterThanOrEqual(1);
 await expect(page.getByText(/Model: route-shape-synthetic-v1-/)).toBeVisible();
});
test('real HTTP Spring → fixture weather → trained FastAPI integration',async({page})=>{
 test.skip(!process.env.ROUTE_WEATHER_FIXTURE,'Requires an explicitly configured local weather fixture server, not live Open-Meteo.');
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());await page.goto('/route-forecasts');await page.getByRole('combobox',{name:'SUPPORTED REAL JOURNEY'}).selectOption(jid);const response=page.waitForResponse(r=>r.url().endsWith('/api/route-forecasts')&&r.request().method()==='POST');await page.getByRole('button',{name:'Predict Traffic'}).click();const body=await (await response).json();
 expect(body.weather.status).toBe('AVAILABLE');expect(body.forecast.result.supportsJourneyDuration).toBe(false);expect(body.forecast.result.adjustedDurationSeconds).toBe(null);
 await expect(page.getByRole('heading',{name:'Automatic forecast weather',exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.congestion-label').first()).toContainText('EXPERIMENTAL / SYNTHETIC');
 await expect(page.getByText(/Model: route-shape-synthetic-v1-/)).toBeVisible();await expect(page.locator('.leaflet-overlay-pane path[fill="none"]')).toHaveCount(body.routing.routes.length);
});
